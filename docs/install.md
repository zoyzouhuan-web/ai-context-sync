# 安装指南

## 快速开始

### 1. 从 NPM 安装

```bash
npm install -g context-bridge-sync
```

### 2. 验证安装

```bash
which context-bridge-sync
# 或查看版本
npm info context-bridge-sync version
```

## 配置

根据你使用的 AI 工具选择相应的配置步骤。

### Claude Code 配置

参考 [setup-claude-code.md](setup-claude-code.md)

### Codex 配置

参考 [setup-codex.md](setup-codex.md)

## 从源代码安装（开发者）

如果你想从 GitHub 源代码安装并进行开发：

```bash
git clone https://github.com/zoyzouhuan-web/ai-context-sync.git
cd ai-context-sync

# 安装依赖
npm install

# 注册 MCP Server（使用本地路径）
claude mcp add context-bridge \
  node $(pwd)/mcp-server/index.js \
  -e VAULT_PATH=~/workplace
```

## 常见问题

### 如何更新到最新版本？

```bash
npm install -g context-bridge-sync@latest
```

或者让 npm 自动检查更新：

```bash
npm outdated -g | grep context-bridge-sync
npm update -g context-bridge-sync
```

### 如何卸载？

```bash
npm uninstall -g context-bridge-sync
```

### MCP Server 路径在哪里？

全局安装后，MCP Server 位于：

```bash
# 查看 npm 全局路径
npm config get prefix

# MCP Server 路径（macOS/Linux）
~/.npm-global/lib/node_modules/context-bridge-sync/mcp-server/index.js

# 或
$(npm prefix -g)/lib/node_modules/context-bridge-sync/mcp-server/index.js
```

## 故障排除

### npm 全局安装失败

检查 npm 全局目录权限：

```bash
# 查看全局路径
npm config get prefix

# 如果没有写入权限，可以修改全局路径或使用 sudo（不推荐）
```

### MCP Server 无法找到

1. 确保已全局安装：`npm list -g context-bridge-sync`
2. 检查路径是否正确
3. 重启 Claude Code 或 Codex
