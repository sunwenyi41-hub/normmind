# Quickstart Validation

1. 在 `.env.local` 中配置 `ADMIN_EMAILS`。
2. 重启开发服务，用白名单邮箱登录，确认工作台显示“管理后台”。
3. 访问 `/admin`, `/admin/qa`, `/admin/feedback`，确认可用。
4. 换用普通账号登录，确认入口不显示，且直接访问 `/admin` 被拦截。
5. 运行 `npm run lint` 与 `npm run build`。

## 2026-07-06 真实环境回归

- 普通账号：可见会话 0，`is_admin=false`，QA / 评测数据均不可见。
- 管理员账号：可见本人会话 12，`is_admin=true`，可访问后台运营数据。
- 结论：会话 RLS 与管理员数据边界通过真实数据库回归。
