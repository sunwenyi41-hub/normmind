# Research Decisions

## Administrator authorization

- **Decision**: 优先使用服务端 `ADMIN_EMAILS` 白名单，并兼容只读的 `app_metadata.role=admin`。
- **Rationale**: 能在不暴露高权限密钥的前提下快速建立可审计边界。
- **Alternatives considered**: `user_metadata` 可被用户修改，不能用于授权；单独管理员账号系统对 MVP 过重。

## Defense in depth

- **Decision**: 页面路由服务端校验，入口按权限显示，真实运营表同时使用 RLS。
- **Rationale**: 隐藏按钮只是体验措施，不是安全边界。
- **Alternatives considered**: 只靠前端路由判断无法阻止直接请求。
