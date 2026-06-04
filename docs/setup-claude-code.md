# Claude Code 配置指南

## 1. 注册 MCP Server

```bash
git clone https://github.com/yourusername/ai-context-sync.git
cd ai-context-sync

claude mcp add context-sync \
  node $(pwd)/mcp-server/index.js \
  -e VAULT_PATH=~/workplace
```

验证连接：
```bash
claude mcp list | grep context-sync
# 应该显示：context-sync: node ... - ✓ Connected
```

## 2. 配置自动上下文加载和保存

编辑 `~/.claude/CLAUDE.md`（如不存在则创建）：

```markdown
## AI Context Sync 规则

### 对话开始时
**自动检测项目目录并加载历史上下文**。执行以下步骤：

1. 运行 `pwd` 获取当前工作目录
2. 如果目录下包含 `.git` 文件夹或路径在特定项目目录下，说明这是一个项目目录
3. 立即主动调用 `mcp__context-sync__load_context`，传入项目的绝对路径作为 `project_path`
4. 将返回的上下文作为背景知识，无需向用户复述，直接基于它继续工作

**无需等用户说项目名称** — 自动识别和加载。

### 何时保存上下文
不要等用户说"好了"或"结束"。由你自己判断，满足以下任一条件时主动调用 `mcp__context-sync__save_context`：

1. **完成了一个可交付的阶段**：写完一个功能、修完一个 bug、做完一次架构决策、生成了一份文档
2. **产生了新的关键决策**：技术选型、方案确定、接口约定等，值得跨工具保留的信息
3. **当前任务状态发生了明显变化**：从"分析阶段"进入"实现阶段"、某个模块从未完成变为完成

**不需要保存的情况**：纯粹的解释说明、代码审查讨论、没有实质产出的问答轮次。

保存时参数：
- `project_path`：当前项目绝对路径
- `summary`：本次做了什么（100字以内，聚焦结果不是过程）
- `decisions`：本次产生的关键技术决策（数组，无则传空数组）
- `todo`：基于当前进度，下次应该继续做什么
- `tool`：固定填 `Claude Code`
```

## 3. 验证配置

打开任何一个 Git 项目目录，启动 Claude Code 新对话：

```bash
cd ~/your-project
claude
```

Claude 应该会自动：
1. 检测到你在项目目录中
2. 调用 `load_context` 加载历史上下文
3. 无需你手动输入项目名称

## 故障排除

### MCP Server 无法连接

```bash
# 检查是否注册成功
claude mcp list

# 手动测试 MCP Server
node /path/to/ai-context-sync/mcp-server/index.js
# 在另一个终端输入：
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node /path/to/mcp-server/index.js
```

### Claude 没有自动加载上下文

1. 确保 `~/.claude/CLAUDE.md` 中的规则已正确添加
2. 尝试手动告诉 Claude：`pwd` 然后 `我现在在 <project-path> 项目工作`
3. Claude 应该会自动调用 `load_context`

### 上下文没有正确保存

检查 `VAULT_PATH` 环境变量是否正确指向上下文存储目录（默认 `~/workplace`）。

查看是否已生成上下文文件：
```bash
ls ~/workplace/ContextBridge/
```
