# Quickstart Validation

1. 在 `.env.local` 中配置 `ADMIN_EMAILS`。
2. 重启开发服务，用白名单邮箱登录，确认工作台显示“管理后台”。
3. 访问 `/admin`, `/admin/qa`, `/admin/feedback`，确认可用。
4. 换用普通账号登录，确认入口不显示，且直接访问 `/admin` 被拦截。
5. 运行 `npm run lint` 与 `npm run build`。
