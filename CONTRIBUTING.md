# Contributing to Paper Translator

感谢参与 Paper Translator。我们欢迎清晰、范围适中的 issue 和 pull request。

## 开始之前

1. 搜索现有 issue 与 PR，避免重复工作。
2. 大型功能或架构调整请先创建 discussion/issue 对齐范围。
3. 安全漏洞不要公开提交，参见 [SECURITY.md](SECURITY.md)。

## 本地开发

```bash
npm install
npm run dev
```

生产验收：

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

## 代码约定

- 保持严格 TypeScript 类型，不新增 `any`。
- API、DOM、Prompt、存储和 UI 逻辑保持分层。
- 新增站点规则时同时保留通用回退，不依赖易变的单一 class。
- 不记录 API Key、论文正文或完整 API 响应。
- 用户可见错误应简洁并给出可操作建议。
- 使用 Prettier 格式化，提交前运行 `npm run format`。

## Pull Request

- 一个 PR 聚焦一个问题。
- 描述动机、实现方式和人工测试页面。
- UI 变更请附截图；站点适配请提供公开测试 URL。
- 不要提交真实 API Key、受版权保护的整篇论文内容或构建目录。
- 更新相关 README、CHANGELOG 或隐私说明。

提交 PR 即表示你同意按项目 MIT License 提供贡献。
