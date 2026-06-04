# AI Context Sync

一个跨 AI 工具的上下文共享方案。在 Claude Code、Codex 等多个 AI 编程工具之间无缝共享项目上下文，避免每次切换工具都要重新解释背景。

**核心功能**：
- 📝 **自动上下文保存** — AI 完成阶段任务时自动保存进度
- 🔄 **跨工具加载** — 在任何 AI 工具打开项目时自动恢复历史状态
- 📊 **Obsidian 可视化** — 在 Obsidian 右侧面板查看和编辑所有项目上下文
- 🧠 **智能摘要** — 自动压缩历史记录，token 预算控制在 1000 以内

## 工作原理

```
Claude Code                    Codex
    ↓                           ↓
    └─→ save_context() ←─→ load_context()
         (MCP Server)
         ↓
    ~/workplace/ContextBridge/*.md
         ↑
    Obsidian 插件 (右侧面板)
```

1. **AI 自动保存**：完成功能、修复 bug、做出决策时，AI 自动调用 `save_context` 记录进度
2. **自动加载**：新对话打开项目时，AI 自动调用 `load_context` 恢复上次状态
3. **人工管理**：Obsidian 插件提供 UI，支持手动查看、编辑、历史回溯

## 安装

### 前置要求
- Node.js 20+
- npm
- Obsidian（可选，仅用于 UI 可视化）

### 1. MCP Server 安装（Claude Code 和 Codex）

#### Claude Code 配置

```bash
# 克隆项目
git clone https://github.com/yourusername/ai-context-sync.git
cd ai-context-sync

# 注册 MCP Server
claude mcp add context-sync \
  node $(pwd)/mcp-server/index.js \
  -e VAULT_PATH=~/workplace
```

检查是否连接成功：
```bash
claude mcp list | grep context-sync
```

#### Codex 配置

在 `~/.codex/config.toml` 中添加：

```toml
[mcp_servers.context-sync]
type = "stdio"
command = "node"
args = ["/path/to/ai-context-sync/mcp-server/index.js"]

[mcp_servers.context-sync.env]
VAULT_PATH = "~/workplace"
```

重启 Codex 后，在 Settings → MCP Servers 中确认已连接。

### 2. 行为规则配置

#### Claude Code

在 `~/.claude/CLAUDE.md` 中添加（如果不存在则创建）：

```markdown
## AI Context Sync 规则

### 对话开始时
识别到项目目录时，主动调用 `mcp__context-sync__load_context`，传入项目绝对路径。

### 何时保存
满足以下条件之一时调用 `mcp__context-sync__save_context`：
1. 完成可交付的阶段（功能、bug 修复、决策文档）
2. 产生新的关键决策
3. 任务状态发生明显变化

参数：
- `project_path`：项目目录
- `summary`：本次做了什么（100字以内）
- `decisions`：关键决策列表
- `todo`：下次应继续做的事
- `tool`：固定填 `Claude Code`
```

#### Codex

在 `~/.codex/AGENTS.md` 末尾添加类似规则（将 `tool` 改为 `Codex`）。

### 3. Obsidian 插件安装（可选）

如果你使用 Obsidian 管理笔记：

```bash
# 复制插件到 Obsidian 插件目录
cp -r obsidian-plugin ~/.obsidian/plugins/ai-context-sync

# 在 Obsidian 中启用插件
# Settings → Community plugins → ai-context-sync → Enable
```

插件会在右侧边栏添加 "AI Context Sync" 面板，显示所有项目的上下文。

## 使用示例

### 场景 1：打开新会话加载历史

```
你在 Claude Code 中：
1. 打开 ~/workplace/claim 项目
2. 开始新对话
3. AI 自动调用 load_context
4. AI 知道：上次完成了表单页面，下一步需要 OCR 接口
5. 直接继续工作，无需重新解释背景
```

### 场景 2：完成任务自动保存

```
你完成了 OCR 接口集成：
1. AI 自动调用 save_context
2. 保存内容：做了什么、关键决策、下一步任务
3. 数据写入 ~/workplace/ContextBridge/workplace__claim.md
4. 下次在 Codex 打开时，自动加载这次的进度
```

### 场景 3：在 Obsidian 中查看进度

```
1. Obsidian 右侧面板打开 AI Context Sync
2. 从下拉菜单选择项目
3. 查看当前任务状态、关键决策、历史记录
4. 可直接编辑，保存后立即同步到文件
```

## 数据格式

上下文文件存储在 `~/workplace/ContextBridge/` 目录下，使用 Markdown 格式：

```markdown
---
project: /Users/zouhuan/workplace/claim
last_updated: 2026-06-04T10:15:30.123+08:00
---

## 当前任务状态
接下来需要做什么

## 关键决策
- 决策 1
- 决策 2

## 历史记录

### 2026-06-04 10:15 | Claude Code
做了什么：完成了什么
未完成：还需要做什么
决策：本次的决策

### 2026-06-03 15:30 | Codex
...
```

**时间戳采用北京时间（UTC+8）**，便于国内用户阅读。

## Token 预算

加载上下文时，返回的注入量被严格控制在 **~1000 token** 以内：
- 当前任务状态摘要
- 关键决策列表
- 最近 3 条历史记录

完整的历史记录存储在 Markdown 文件中，可在 Obsidian 中随时查阅，不会增加对话成本。

## 配置选项

在各工具中调用 `list_projects` 可获取所有已有上下文的项目列表。

### MCP Server 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VAULT_PATH` | 存储上下文文件的目录 | `~/workplace` |

## 文件结构

```
ai-context-sync/
├── mcp-server/              # MCP Server 实现
│   ├── index.js            # 核心逻辑
│   ├── package.json
│   └── ...
├── obsidian-plugin/        # Obsidian 插件
│   ├── src/
│   ├── main.ts
│   ├── manifest.json
│   └── ...
├── README.md
├── LICENSE
└── .gitignore
```

## 故障排除

### MCP Server 无法连接

**Claude Code**：
```bash
# 检查注册
claude mcp list | grep context-sync

# 手动测试
node mcp-server/index.js
# 在另一个终端输入：
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node mcp-server/index.js
```

**Codex**：
检查 `~/.codex/config.toml` 中的路径是否正确，重启 Codex 后重试。

### Obsidian 插件不显示

1. 确保插件已启用（Settings → Community plugins）
2. 尝试重启 Obsidian
3. 检查 `~/workplace/ContextBridge/` 目录是否有 `.md` 文件

### AI 没有自动保存

检查 `~/.claude/CLAUDE.md` 或 `~/.codex/AGENTS.md` 中的规则是否正确配置。

## 开发者指南

### 修改 MCP Server

```bash
cd mcp-server
npm install
npm run dev  # 监视模式开发
```

修改 `index.js` 后无需编译，直接生效。

### 修改 Obsidian 插件

```bash
cd obsidian-plugin
npm install
npm run build  # 编译到 main.js
```

## 许可证

MIT License - 详见 LICENSE 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

## 常见问题

**Q: 会记录我的代码内容吗？**
A: 不会。只记录你的任务状态摘要和决策，原始代码完全不涉及。

**Q: 如果中途更换项目目录怎么办？**
A: 上下文按目录路径存储，更换目录相当于新项目，会生成新的上下文文件。

**Q: 支持多人团队吗？**
A: 当前是单人工具。多人场景需要自己配置共享存储（如 Git 同步）。

**Q: 可以导出历史记录吗？**
A: 历史记录本身就是 Markdown 文件，直接 copy 即可。

---

**反馈与支持**：提交 Issue 或联系维护者。
