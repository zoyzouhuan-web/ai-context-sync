# NPM 发布指南

## 发布前检查

1. 更新版本号（在 `package.json` 中）：
   ```bash
   npm version patch  # 补丁版本 1.0.0 -> 1.0.1
   npm version minor  # 小版本 1.0.0 -> 1.1.0
   npm version major  # 大版本 1.0.0 -> 2.0.0
   ```

2. 验证代码可用性：
   ```bash
   npm run start  # 确保 MCP Server 正常启动
   npm run build:obsidian:prod  # 确保 Obsidian 插件编译成功
   ```

3. 更新 `CHANGELOG.md`（可选）：
   记录本次版本的改动

## 发布到 NPM

### 首次发布

1. 确保已登录 NPM：
   ```bash
   npm login
   ```

2. 从项目根目录发布：
   ```bash
   npm publish
   ```

3. 验证发布成功：
   ```bash
   npm view ai-context-sync
   npm info ai-context-sync version
   ```

### 后续更新

```bash
# 更新版本号
npm version patch

# 发布新版本
npm publish

# 推送到 GitHub
git push origin main --tags
```

## 用户安装

用户可以通过以下方式安装：

```bash
# 全局安装
npm install -g ai-context-sync

# 验证安装
which ai-context-sync
ai-context-sync --version  # 如果支持的话
```

## 包内容

NPM 包包含：

- `mcp-server/` — MCP Server 源代码和编译产物
- `obsidian-plugin/` — Obsidian 插件源代码
- `docs/` — 完整文档（包括 setup-claude-code.md 和 setup-codex.md）
- `README.md` — 项目说明
- `LICENSE` — MIT 许可证

## 常见问题

### 如何更新 NPM 包？

1. 在项目中做出改动
2. 更新版本号：`npm version patch`
3. 重新发布：`npm publish`
4. 推送到 GitHub：`git push origin main --tags`

### 可以发布到私有作用域吗？

可以。修改 `package.json` 中的 `name` 为 `@zoyzouhuan-web/ai-context-sync`，然后发布即可。

### 如何回滚版本？

```bash
npm unpublish ai-context-sync@1.0.0
```

注意：npm 限制在发布后 72 小时内才能撤销发布。

## 故障排除

### "403 Forbidden" 错误

- 检查是否登录：`npm whoami`
- 检查包名是否已被占用
- 检查 `package.json` 中的 `name` 字段

### "ELIFECYCLE ERR! ... ERR! errno 1" 错误

- 检查 `postinstall` 脚本是否有问题
- 尝试移除或简化 `postinstall` 脚本

### 已发布的包无法使用

- 检查 `files` 字段是否包含了所需文件
- 验证 `main` 字段指向正确的入口文件
- 检查 `bin` 字段配置
