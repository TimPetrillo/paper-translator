# Security Policy

## Supported versions

安全修复优先应用于最新发布版本和 `main` 分支。

## Reporting a vulnerability

请不要通过公开 issue 报告 API Key 泄露、跨站脚本、权限滥用或依赖供应链漏洞。

请使用 GitHub 仓库的 **Security → Report a vulnerability** 私密报告功能。如果仓库尚未启用私密报告，请联系仓库维护者并仅描述影响范围，不要在第一封公开邮件中附真实凭据或论文内容。

报告建议包含：

- 受影响版本与浏览器版本
- 最小复现步骤
- 实际影响与攻击前提
- 已脱敏的日志、页面或 API 信息
- 可行的修复建议（如有）

维护者应在 7 天内确认收到报告，并在验证后协调修复与披露时间。

## Security design notes

- API Key 存储于 `chrome.storage.local`，不写入页面 DOM。
- 网络请求由扩展后台 Service Worker 发出。
- 页面内容只发送到用户主动配置的 API 地址。
- 项目不包含遥测或维护者控制的代理服务。
- 用户应使用可信 HTTPS API 端点；HTTP 端点会暴露凭据和正文，不建议使用。
