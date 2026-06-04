# Codex 配置指南

## 1. 在 config.toml 中注册 MCP Server

编辑 `~/.codex/config.toml`，在 MCP servers 部分添加：

```toml
[mcp_servers.context-sync]
type = "stdio"
command = "node"
args = ["/path/to/ai-context-sync/mcp-server/index.js"]

[mcp_servers.context-sync.env]
VAULT_PATH = "~/workplace"
```

替换 `/path/to/` 为你的实际路径。

重启 Codex 后，在 Settings → MCP Servers 中确认已连接。

## 2. 配置自动上下文加载和保存

编辑 `~/.codex/AGENTS.md`（如不存在则创建），在末尾添加：

```markdown
## AI Context Sync 规则

### 对话开始时
**自动检测项目目录并加载历史上下文**。执行以下步骤：

1. 运行 `pwd` 获取当前工作目录
2. 如果目录下包含 `.git` 文件夹或路径在特定项目目录下，说明这是一个项目目录
3. 立即主动调用 `context-sync` MCP 的 `load_context` 工具，传入项目的绝对路径作为 `project_path`
4. 将返回的上下文作为背景知识，无需向用户复述，直接基于它继续工作

**无需等用户说项目名称** — 自动识别和加载。

### 何时保存上下文
不要等用户说"好了"或"结束"。由你自己判断，满足以下任一条件时主动调用 `context-sync` MCP 的 `save_context` 工具：

1. **完成了一个可交付的阶段**：写完一个功能、修完一个 bug、做完一次架构决策、生成了一份文档
2. **产生了新的关键决策**：技术选型、方案确定、接口约定等，值得跨工具保留的信息
3. **当前任务状态发生了明显变化**：从"分析阶段"进入"实现阶段"、某个模块从未完成变为完成

**不需要保存的情况**：纯粹的解释说明、代码审查讨论、没有实质产出的问答轮次。

保存时参数：
- `project_path`：当前项目绝对路径
- `summary`：本次做了什么（100字以内，聚焦结果不是过程）
- `decisions`：本次产生的关键技术决策（数组，无则传空数组）
- `todo`：基于当前进度，下次应该继续做什么
- `tool`：固定填 `Codex`
```

## 3. 验证配置

重启 Codex，然后打开任何一个 Git 项目目录：

```bash
cd ~/your-project
codex
```

Codex 应该会自动：
1. 检测到你在项目目录中
2. 调用 `load_context` 加载历史上下文
3. 无需你手动输入项目名称

## 故障排除

### MCP Server 无法连接

1. 检查 `~/.codex/config.toml` 中的路径是否正确
2. 确保 `mcp-server/index.js` 文件存在
3. 重启 Codex
4. 在 Settings → MCP Servers 中检查连接状态

### Codex 没有自动加载上下文

1. 确保 `~/.codex/AGENTS.md` 中的规则已正确添加
2. 重启 Codex
3. 尝试手动告诉 Codex 你的项目路径

### 上下文文件没有生成

检查 `VAULT_PATH` 环境变量是否正确指向上下文存储目录（默认 `~/workplace`）。

查看是否已生成上下文文件：
```bash
ls ~/workplace/ContextBridge/
```

### 时间戳不对

确保已重启 Codex 加载最新的 MCP Server 代码。MCP Server 使用北京时间（UTC+8）生成时间戳。
