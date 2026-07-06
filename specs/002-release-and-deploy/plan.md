# Implementation Plan: 发布收口与认证回调

1. 扩展邮箱确认 Route Handler，同时兼容 PKCE code 与 token hash。
2. 在 Next.js Proxy 中兼容 Supabase 回落到根路径的 PKCE code。
3. 为认证响应设置私有、禁止缓存响应头。
4. 执行 lint、build，并部署到 Vercel Production。
5. 更新 `progress.md` 与发布检查清单。
6. 在登录页增加忘记密码入口，使用 `resetPasswordForEmail` 发送 PKCE 恢复邮件。
7. 新增设置新密码页面，校验恢复会话后使用 `updateUser` 更新密码。
