# 规智 NormMind 上线检查清单

本清单用于阶段 6「部署上线与发布收口」，覆盖环境变量、测试账号、核心链路、权限校验与发布回滚准备。

## 1. 环境准备

### Vercel 项目

- [ ] GitHub 仓库已连接 Vercel
- [x] `main` 当前工作树已通过 Vercel CLI 首次部署 Production
- [ ] 非 `main` 分支自动生成 Preview
- [x] 已升级并验证 Vercel CLI 54.20.1

### 环境变量矩阵

Development、Preview、Production 三套环境至少应区分以下变量：

| 变量 | Development | Preview | Production |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 开发库 | 预发库 | 生产库 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 开发 key | 预发 key | 生产 key |
| `OPENROUTER_API_KEY` | 可共享测试额度 | 独立预发额度 | 生产额度 |
| `OPENROUTER_MODEL` | 固定 | 固定 | 固定 |
| `COZE_API_TOKEN` | 开发 token | 预发 token | 生产 token |
| `COZE_BOT_ID` | 测试 bot | 预发 bot | 生产 bot |
| `LANGSMITH_*` | 可选 | 推荐开启 | 推荐开启 |

注意：

- Preview 不要直连生产 Supabase。
- Production 不要复用开发 / 预发 Coze Token。
- 不要把 secret / service role key 写入前端环境变量。

## 2. 测试账号准备

建议至少准备三类账号：

### 用户账号

- [ ] 普通测试账号 A：验证注册、登录、问答、历史记录
- [ ] 普通测试账号 B：验证跨用户隔离

### 管理员演示账号

- [ ] 管理员账号：验证 `/admin` 系列页面访问与演示流程

### 说明

- 管理员入口与路由已由服务端权限保护；数据库管理权限还需应用最新迁移并写入 `app_metadata.role=admin`。
- 手机号登录 / 微信登录若未配置完成，不应纳入上线前主流程验收。

## 3. 核心链路回归

### 登录与入口

- [ ] 邮箱注册
- [ ] 邮箱登录
- [ ] 邮箱验证回跳
- [ ] 未登录访问 `/` 被正确重定向到 `/login`
- [ ] 预览模式 `/?preview=1` 可进入工作台
- [ ] 登录页“进入工作台预览”按钮可正常跳转

### 问答主流程

- [ ] 快速模式可正常提问并返回回答
- [ ] 深度模式可正常提问并展示阶段状态
- [ ] Coze 异常时页面不崩溃
- [ ] 无引用时回答正确标记为“证据不足”
- [ ] 引用卡片可展开查看
- [ ] PDF 原文可打开

### 会话与反馈

- [ ] 新建会话
- [ ] 继续追问
- [ ] 删除会话
- [ ] 反馈“有帮助 / 无帮助”
- [ ] 刷新页面后历史仍可恢复

### 资料库与后台

- [ ] `/library`
- [ ] `/library/[id]`
- [ ] `/settings`
- [x] `/admin`
- [x] `/admin/qa` （页面可用，等待远程迁移）
- [x] `/admin/evals` （页面可用，等待远程迁移）
- [x] `/admin/feedback` （页面可用，等待远程迁移）
- [ ] `/admin/agent`
- [ ] `/admin/audit`

## 4. Supabase / RLS 检查

- [ ] 所有公开表均启用 RLS
- [ ] `conversations` 仅允许本人读写
- [ ] `messages` 仅允许本人读写
- [ ] `feedback` 仅允许本人读写
- [ ] 使用测试账号 A 创建数据后，账号 B 无法读取
- [ ] `supabase/tests/ownership_rls.sql` 至少手动验证一遍

## 5. 安全与密钥边界

- [ ] 前端构建产物中不包含 Coze Token
- [ ] 前端构建产物中不包含 Supabase service role key
- [ ] 仅服务端 Route Handler 调用 Coze
- [ ] Preview / Production 日志中无敏感明文输出

## 6. 质量上线门槛

- [ ] 核心规范问答演示集可稳定返回
- [ ] 引用追溯链路可演示
- [ ] 后台演示结构完整
- [ ] README、环境变量示例、部署说明均已同步
- [x] `npm run lint`
- [x] `npm run build`

## 7. 发布与回滚建议

### 发布前

- [ ] 保留一个可用 Preview 版本作为上线前对照
- [ ] 确认 Production 环境变量最后一次更新时间
- [ ] 确认 Supabase 迁移已在目标环境执行

### 发布后

- [ ] 首次访问首页
- [ ] 首次登录
- [ ] 首次问答
- [ ] 首次查看引用 PDF

### 回滚策略

- 若生产环境出现严重问题，优先：

1. 回滚至上一版 Vercel Production Deployment
2. 暂时关闭有问题的入口（如后台入口或深度模式）
3. 保留日志与 trace，用于定位 Coze / Agent / 数据层问题

## 8. 当前版本已知限制

- 手机号登录仍依赖 Supabase Phone Auth 与短信服务配置
- 微信登录仍依赖 `custom:wechat` OAuth 配置
- 管理后台已接入服务端权限边界与真实数据读写代码；线上库仍需应用 `20260705090000_admin_quality_ops.sql`
- 资料库上传流程仍为前端原型，未接真实文件存储与后台任务
