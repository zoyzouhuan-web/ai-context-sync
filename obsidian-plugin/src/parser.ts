import { ProjectContext, HistoryEntry } from './types';

export function parseContextFile(content: string, filePath: string): ProjectContext {
  const result: ProjectContext = {
    project: '',
    last_updated: '',
    current_status: '',
    key_decisions: [],
    history: [],
    filePath,
  };

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const projectMatch = fm.match(/project:\s*(.+)/);
    const updatedMatch = fm.match(/last_updated:\s*(.+)/);
    if (projectMatch) result.project = projectMatch[1].trim();
    if (updatedMatch) result.last_updated = updatedMatch[1].trim();
  }

  const statusMatch = content.match(/## 当前任务状态\n([\s\S]*?)(?=\n## |\s*$)/);
  if (statusMatch) result.current_status = statusMatch[1].trim();

  const decisionsMatch = content.match(/## 关键决策\n([\s\S]*?)(?=\n## |\s*$)/);
  if (decisionsMatch) {
    result.key_decisions = decisionsMatch[1]
      .split('\n')
      .map(l => l.replace(/^- /, '').trim())
      .filter(Boolean);
  }

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
      } as HistoryEntry;
    }).filter(e => e.date);
  }

  return result;
}

export function serializeContextFile(data: ProjectContext): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`project: ${data.project}`);
  lines.push(`last_updated: ${new Date().toISOString()}`);
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
