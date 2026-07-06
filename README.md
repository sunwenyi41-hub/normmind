# 规智 NormMind

面向建筑、规划与景观设计师的规范智能知识问答 Agent。网站提供快速问答、深度检索、规范引用追溯、会话历史与回答反馈；当前网站侧由 LangChain Agent 编排，知识检索由 Coze Bot 单轮调用优先承担。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、shadcn/ui 源码组件
- Supabase Auth + Postgres + RLS
- OpenRouter API
- Coze Bot / Workflow fallback API
- Vercel Fluid Compute

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

未配置 Supabase 时，开发环境会自动进入演示模式；若已配置 Supabase 与 Coze，问答将调用真实 Agent 链路并持久化会话。生产环境不会启用演示模式。

### 预览入口

- 登录页预览：`/login?preview=1`
- 工作台预览：`/?preview=1`
- 资料库预览：`/library?preview=1`
- 账户设置预览：`/settings?preview=1`
- 管理后台预览：`/admin?preview=1`

预览模式只用于查看界面与演示产品结构，不应视为真实权限或真实业务数据验证结果。

### 开发测试数据

- 登录后可在左侧边栏点击“生成测试数据”，一键写入 3 组示例会话到当前账号
- 该能力只在开发环境开放，对应接口为 `POST /api/dev/seed`
- 生成的数据会同时写入 `conversations.messages_json` 和 `messages` 审计表

## Supabase 配置

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/20260702000000_initial_schema.sql`，或使用 Supabase CLI 应用迁移。
3. 在 Auth → URL Configuration 中添加本地和 Vercel 回调地址：`/auth/confirm` 与 `/auth/callback`。
4. 将 Project URL 和 Publishable Key 写入 `.env.local`。
5. 应用 `supabase/migrations/20260705090000_admin_quality_ops.sql`，并为管理员账号设置受信任的 `app_metadata.role=admin`。

管理员页面还需服务端环境变量：

```env
ADMIN_EMAILS=admin@example.com
```

普通用户不会看到“管理后台”入口，直接访问 `/admin` 也会被服务端拦截。

### 手机与微信登录

- 手机登录：在 Auth → Providers 开启 Phone，并配置短信服务商；生产环境还应配置 CAPTCHA 与发送频率限制。
- 微信登录：在 Auth → Providers 新建自定义 OAuth2 提供方，标识符使用 `custom:wechat`，填写微信开放平台的授权、Token、用户信息端点及 Client ID/Secret，并将 Supabase 提供的 Callback URL 回填到微信开放平台。

迁移为三个公开表启用了 RLS。客户端仅使用 publishable key；不要把 secret/service-role key 放入浏览器环境变量。

## 环境变量说明

最小必填变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `COZE_API_TOKEN`
- `COZE_BOT_ID`
- `ADMIN_EMAILS`

手机号 OTP 注册 / 登录的前端开关：

```env
NEXT_PUBLIC_PHONE_AUTH_ENABLED=1
```

只有在 Supabase Auth 启用 Phone 并配置 MessageBird、Twilio、Vonage 或 TextLocal 等短信服务商后才能打开。首次验证 OTP 会自动创建用户，之后使用同一流程登录。

可选但推荐：

- `LANGSMITH_TRACING`
- `LANGSMITH_API_KEY`
- `LANGSMITH_PROJECT`

当前 `手机号登录` 与 `微信登录` 默认在 UI 中以“即将开放”提示呈现。若要正式启用：

- 手机号登录：需在 Supabase Auth 中开启 Phone，并完成短信服务配置
- 微信登录：需在 Supabase Auth 中配置 `custom:wechat` OAuth

## Coze 工作流契约

服务端优先向 Coze Bot Chat API 发起单轮请求；若 Bot 接口失败，且配置了 workflow id，则退回 Workflow fallback。

Workflow fallback 发送：

```json
{
  "workflow_id": "<mode workflow id>",
  "parameters": { "question": "用户问题", "query": "用户问题" }
}
```

建议两个工作流统一输出以下 JSON（可放在 Coze 返回的 `data`、`output` 或 `result` 中）：

```json
{
  "answer": "回答正文",
  "citations": [
    {
      "documentTitle": "规范名称",
      "version": "GB 00000—2026",
      "clause": "3.2.1",
      "excerpt": "规范原文片段",
      "sourceUrl": "https://optional-source"
    }
  ]
}
```

没有引用时，服务端会自动降级为“证据不足”，不会输出确定性结论。

当前 Coze 若只返回纯文本，网站也可以展示，但会标记“证据不足”。要启用规范引用卡片，请确保 Bot 或 Workflow 最终能返回 `answer` 和 `citations`。

## 校验

```bash
npm run lint
npm run build
```

`evals/questions.json` 包含 50 条初始评测题框架。上线前需由规范专家补充期望规范、条款和版本，并使用真实 Coze 环境跑完评测。

`supabase/tests/ownership_rls.sql` 提供了最小 RLS / 所有权回归脚本骨架，适合在上线前手动验证跨用户隔离。

## GitHub 与 Vercel

1. 将仓库推送至 GitHub，在 Vercel 导入仓库；非 `main` 分支自动生成 Preview，`main` 部署 Production。
2. 在 Vercel 为 Development、Preview、Production 分别配置 `.env.example` 中的变量，避免 Preview 使用生产数据库。
3. 推荐使用 Vercel CLI 54.20.1 或更高版本：`npm i -g vercel@latest`。
4. 可用 `vercel env pull .env.local --yes` 拉取开发变量，再运行 `npm run build`。

推荐上线顺序：

1. 先验证 `/?preview=1`、`/library?preview=1`、`/admin?preview=1`
2. 再验证真实登录链路
3. 最后验证 Coze 真实问答与引用追溯

完整上线清单见：

- [docs/release-checklist.md](/Users/mirror/Documents/规范智能知识问答 Agent/docs/release-checklist.md)

## 安全边界

- 每个 API Route 都会服务端验证 Supabase 用户，不能只依赖页面跳转或 Proxy。
- Coze Token 仅由服务端读取。
- RLS 将会话、消息与反馈限制为当前用户所有。
- 管理员路由使用服务端邮箱白名单 / 受信任 app metadata；数据库管理策略只读取 app metadata，不使用可由用户编辑的 user metadata。
- AI 回答仅作辅助参考，重要结论必须核对规范原文并由专业人员复核。
