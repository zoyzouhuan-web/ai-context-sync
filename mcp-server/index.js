#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const VAULT_PATH = process.env.VAULT_PATH || path.join(os.homedir(), 'workplace');
const CONTEXT_DIR = path.join(VAULT_PATH, 'ContextBridge');
const MAX_RECENT_HISTORY = 3;
const MAX_HISTORY_BEFORE_MERGE = 20;
const MAX_INJECT_TOKENS_APPROX = 1000; // rough char limit: ~4 chars/token

function ensureContextDir() {
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }
}

function projectNameFromPath(projectPath) {
  // Use last two path segments to avoid collisions: "workplace/claim" → "workplace__claim"
  const normalized = path.normalize(projectPath);
  const parts = normalized.split(path.sep).filter(Boolean);
  const slug = parts.slice(-2).join('__').replace(/[^a-zA-Z0-9_\-一-龥]/g, '_');
  return slug;
}

function contextFilePath(projectPath) {
  ensureContextDir();
  const name = projectNameFromPath(projectPath);
  return path.join(CONTEXT_DIR, `${name}.md`);
}

function parseContextFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  const result = {
    project: '',
    last_updated: '',
    current_status: '',
    key_decisions: [],
    history: [],
  };

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const projectMatch = fm.match(/project:\s*(.+)/);
    const updatedMatch = fm.match(/last_updated:\s*(.+)/);
    if (projectMatch) result.project = projectMatch[1].trim();
    if (updatedMatch) result.last_updated = updatedMatch[1].trim();
  }

  // Parse current status
  const statusMatch = content.match(/## 当前任务状态\n([\s\S]*?)(?=\n## |\n---|\s*$)/);
  if (statusMatch) result.current_status = statusMatch[1].trim();

  // Parse key decisions
  const decisionsMatch = content.match(/## 关键决策\n([\s\S]*?)(?=\n## |\n---|\s*$)/);
  if (decisionsMatch) {
    result.key_decisions = decisionsMatch[1]
      .split('\n')
      .map(l => l.replace(/^- /, '').trim())
      .filter(Boolean);
  }

  // Parse history entries
  const historySection = content.match(/## 历史记录\n([\s\S]*?)$/);
  if (historySection) {
    const entries = historySection[1].split(/(?=### )/).filter(Boolean);
    result.history = entries.map(entry => {
      const headerMatch = entry.match(/### (.+?) \| (.+?)\n/);
      const summaryMatch = entry.match(/做了什么：([\s\S]*?)(?=\n未完成：|\n决策：|\s*$)/);
      const todoMatch = entry.match(/未完成：([\s\S]*?)(?=\n决策：|\s*$)/);
      const decisionMatch = entry.match(/决策：([\s\S]*?)(?=\s*$)/);
      return {
        date: headerMatch ? headerMatch[1].trim() : '',
        tool: headerMatch ? headerMatch[2].trim() : '',
        summary: summaryMatch ? summaryMatch[1].trim() : '',
        todo: todoMatch ? todoMatch[1].trim() : '',
        decision: decisionMatch ? decisionMatch[1].trim() : '',
      };
    }).filter(e => e.date);
  }

  return result;
}

function serializeContextFile(data) {
  const lines = [];
  lines.push('---');
  lines.push(`project: ${data.project}`);
  const bjTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');
  lines.push(`last_updated: ${bjTime}`);
  lines.push('---');
  lines.push('');
  lines.push('## 当前任务状态');
  lines.push(data.current_status || '');
  lines.push('');
  lines.push('## 关键决策');
  (data.key_decisions || []).forEach(d => lines.push(`- ${d}`));
  lines.push('');
  lines.push('## 历史记录');
  lines.push('');
  (data.history || []).forEach(entry => {
    lines.push(`### ${entry.date} | ${entry.tool}`);
    lines.push(`做了什么：${entry.summary}`);
    lines.push(`未完成：${entry.todo || '无'}`);
    lines.push(`决策：${entry.decision || '无'}`);
    lines.push('');
  });
  return lines.join('\n');
}

function mergeOldHistory(history) {
  if (history.length <= MAX_HISTORY_BEFORE_MERGE) return history;
  const toMerge = history.slice(0, history.length - 10);
  const keep = history.slice(history.length - 10);
  const merged = {
    date: `${toMerge[0].date} ~ ${toMerge[toMerge.length - 1].date}`,
    tool: '历史快照',
    summary: toMerge.map(e => `[${e.date}/${e.tool}] ${e.summary}`).join('；'),
    todo: '',
    decision: toMerge.flatMap(e => e.decision ? [e.decision] : []).join('；'),
  };
  return [merged, ...keep];
}

// ── Tool handlers ──────────────────────────────────────────────

function handleSaveContext(args) {
  const { project_path, summary, decisions, todo, tool } = args;
  if (!project_path || !summary) {
    return { error: 'project_path and summary are required' };
  }

  const filePath = contextFilePath(project_path);
  let data = parseContextFile(filePath) || {
    project: project_path,
    last_updated: '',
    current_status: '',
    key_decisions: [],
    history: [],
  };

  // Update current status with this session's todo
  data.project = project_path;
  data.current_status = todo || summary;

  // Merge new decisions (deduplicate)
  if (decisions && decisions.length > 0) {
    const existing = new Set(data.key_decisions);
    decisions.forEach(d => existing.add(d));
    data.key_decisions = Array.from(existing);
  }

  // Prepend new history entry (newest first) - Beijing time
  const bjNow = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  const dateStr = bjNow.toISOString().slice(0, 16).replace('T', ' ');
  const newEntry = {
    date: dateStr,
    tool: tool || 'AI',
    summary,
    todo: todo || '',
    decision: (decisions || []).join('；'),
  };
  data.history = [newEntry, ...data.history];

  // Merge if too long
  data.history = mergeOldHistory(data.history);

  fs.writeFileSync(filePath, serializeContextFile(data), 'utf-8');

  return {
    success: true,
    file: filePath,
    message: `上下文已保存到 ${filePath}`,
  };
}

function handleLoadContext(args) {
  const { project_path } = args;
  if (!project_path) return { error: 'project_path is required' };

  const filePath = contextFilePath(project_path);
  const data = parseContextFile(filePath);

  if (!data) {
    return {
      success: true,
      found: false,
      context: '',
      message: '该项目暂无历史上下文，这是全新开始。',
    };
  }

  // Build inject string within token budget
  const recentHistory = data.history.slice(0, MAX_RECENT_HISTORY);
  const parts = [
    `【当前任务状态】\n${data.current_status}`,
    `【关键决策】\n${data.key_decisions.map(d => `- ${d}`).join('\n')}`,
    `【最近对话记录】\n${recentHistory.map(e =>
      `${e.date} (${e.tool}):\n  做了什么：${e.summary}\n  未完成：${e.todo}`
    ).join('\n\n')}`,
  ];

  let context = parts.join('\n\n');

  // Rough token budget trim (~4 chars per token)
  if (context.length > MAX_INJECT_TOKENS_APPROX * 4) {
    context = context.slice(0, MAX_INJECT_TOKENS_APPROX * 4) + '\n...(已截断，完整记录见 Obsidian ContextBridge)';
  }

  return {
    success: true,
    found: true,
    project: data.project,
    last_updated: data.last_updated,
    context,
    token_estimate: Math.ceil(context.length / 4),
  };
}

function handleListProjects() {
  ensureContextDir();
  const files = fs.readdirSync(CONTEXT_DIR).filter(f => f.endsWith('.md'));

  const projects = files.map(file => {
    const filePath = path.join(CONTEXT_DIR, file);
    const data = parseContextFile(filePath);
    if (!data) return null;
    return {
      file,
      project: data.project,
      last_updated: data.last_updated,
      current_status: data.current_status?.slice(0, 80) + (data.current_status?.length > 80 ? '...' : ''),
      history_count: data.history.length,
    };
  }).filter(Boolean);

  projects.sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''));

  return { success: true, projects };
}

// ── MCP Server setup ───────────────────────────────────────────

const server = new Server(
  { name: 'context-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'save_context',
      description: '保存本次对话的上下文摘要到项目文件。在每次对话结束前调用，将本次做了什么、关键决策、下次待办写入持久化存储。',
      inputSchema: {
        type: 'object',
        properties: {
          project_path: {
            type: 'string',
            description: '项目目录的绝对路径，用于唯一标识项目，例如 /Users/zouhuan/workplace/claim',
          },
          summary: {
            type: 'string',
            description: '本次对话做了什么，简洁描述，不超过200字',
          },
          decisions: {
            type: 'array',
            items: { type: 'string' },
            description: '本次对话产生的关键决策列表',
          },
          todo: {
            type: 'string',
            description: '下次继续需要做的事，作为当前任务状态更新',
          },
          tool: {
            type: 'string',
            description: '当前使用的 AI 工具名称，例如 Claude Code 或 Codex',
          },
        },
        required: ['project_path', 'summary'],
      },
    },
    {
      name: 'load_context',
      description: '加载项目的历史上下文。在新对话开始、识别到项目目录后调用，获取上次的任务状态、关键决策和最近对话记录。',
      inputSchema: {
        type: 'object',
        properties: {
          project_path: {
            type: 'string',
            description: '项目目录的绝对路径',
          },
        },
        required: ['project_path'],
      },
    },
    {
      name: 'list_projects',
      description: '列出所有已有上下文记录的项目，按最后更新时间排序。',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result;
  try {
    if (name === 'save_context') result = handleSaveContext(args);
    else if (name === 'load_context') result = handleLoadContext(args);
    else if (name === 'list_projects') result = handleListProjects();
    else result = { error: `Unknown tool: ${name}` };
  } catch (err) {
    result = { error: err.message };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
