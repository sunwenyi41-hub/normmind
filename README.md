# 规智 NormMind

面向建筑、规划与景观设计师的规范智能知识问答 Agent。网站提供快速问答、深度检索、规范引用追溯、会话历史与回答反馈；知识检索和 Agentic RAG 由 Coze 工作流承担。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、shadcn/ui 源码组件
- Supabase Auth + Postgres + RLS
- Coze Workflow API
- Vercel Fluid Compute

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

未配置 Supabase 时，开发环境会自动进入演示模式；若已配置 Coze，问答将调用真实工作流，但不会持久化会话。生产环境不会启用演示模式。

## Supabase 配置

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/20260702000000_initial_schema.sql`，或使用 Supabase CLI 应用迁移。
3. 在 Auth → URL Configuration 中添加本地和 Vercel 回调地址：`/auth/confirm` 与 `/auth/callback`。
4. 将 Project URL 和 Publishable Key 写入 `.env.local`。

### 手机与微信登录

- 手机登录：在 Auth → Providers 开启 Phone，并配置短信服务商；生产环境还应配置 CAPTCHA 与发送频率限制。
- 微信登录：在 Auth → Providers 新建自定义 OAuth2 提供方，标识符使用 `custom:wechat`，填写微信开放平台的授权、Token、用户信息端点及 Client ID/Secret，并将 Supabase 提供的 Callback URL 回填到微信开放平台。

迁移为三个公开表启用了 RLS。客户端仅使用 publishable key；不要把 secret/service-role key 放入浏览器环境变量。

## Coze 工作流契约

服务端向 `/workflow/run` 发送：

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

当前工作流若只返回纯文本 `output`，网站也可以展示，但会标记“引用待补充”。要启用规范引用卡片，请将 Coze 结束节点改为输出 `answer` 和 `citations`。

## 校验

```bash
npm run lint
npm run build
```

`evals/questions.json` 包含 50 条初始评测题框架。上线前需由规范专家补充期望规范、条款和版本，并使用真实 Coze 环境跑完评测。

## GitHub 与 Vercel

1. 将仓库推送至 GitHub，在 Vercel 导入仓库；非 `main` 分支自动生成 Preview，`main` 部署 Production。
2. 在 Vercel 为 Development、Preview、Production 分别配置 `.env.example` 中的变量，避免 Preview 使用生产数据库。
3. 推荐先升级 CLI：`npm i -g vercel@latest`。
4. 可用 `vercel env pull .env.local --yes` 拉取开发变量，再运行 `npm run build`。

## 安全边界

- 每个 API Route 都会服务端验证 Supabase 用户，不能只依赖页面跳转或 Proxy。
- Coze Token 仅由服务端读取。
- RLS 将会话、消息与反馈限制为当前用户所有。
- AI 回答仅作辅助参考，重要结论必须核对规范原文并由专业人员复核。
