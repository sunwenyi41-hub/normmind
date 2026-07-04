# AGENTS 协作说明

本项目为「规范智能知识问答 Agent / NormMind」代码仓库。所有参与开发的 AI Agent 和人工协作者，都应遵循以下规则。

## 项目目标

- 以 `spec-kit` 为核心推进 SDD 开发。
- 每个开发阶段对应一个独立 spec 单元，阶段边界清晰，可单独验收。
- 开发顺序遵循“先框架再模块、先核心再拓展”。
- 基于当前仓库既有技术栈继续开发：Next.js、TypeScript、Tailwind、shadcn/ui、Supabase、Coze、Vercel。

## 强制流程

1. 开始新阶段前，先确认 `progress.md` 中该阶段状态不是已完成。
2. 新阶段必须先有对应的 spec、plan、tasks，再进入实现。
3. 阶段开发完成后，必须先更新 `progress.md`，再继续下一个阶段。
4. 若阶段范围、验收标准或优先级发生变化，先更新 `progress.md`，再修改对应 spec 文档。
5. 任何回答、计划或代码提交，都应与当前阶段目标保持一致，避免跨阶段无边界扩张。

## progress.md 更新要求

完成任一阶段后，必须同步更新 [progress.md](/Users/mirror/Documents/规范智能知识问答%20Agent/progress.md)：

- 更新阶段状态
- 填写完成说明
- 填写遗留事项
- 记录范围变更或阻塞原因

如果 `progress.md` 未更新，则该阶段不能视为真正完成。

## 阶段优先级

默认按以下顺序推进：

1. `foundation-hardening`
2. `qa-workbench`
3. `citation-and-pdf-viewer`
4. `knowledge-library`
5. `admin-and-quality-ops`
6. `release-and-deploy`

除非用户明确要求调整，否则不要跳阶段开发。

## 实施边界

- 优先复用现有代码和现有 Supabase 项目，不重复造基础设施。
- Coze 负责知识检索和 Agentic RAG，网站侧重点是鉴权、持久化、工作台体验、引用追溯和运营闭环。
- 不要在未定义 spec 的情况下扩展企业组织、支付、OCR、大规模后台管理等超出当前路线的功能。
- 所有面向用户的数据访问必须遵循 Supabase RLS 与所有权校验。

## 提交要求

- 提交前确认改动与当前阶段一致。
- 若完成了某个阶段或阶段内关键里程碑，提交信息应清晰体现阶段目标。
- 若只是准备性文档更新，也应在提交信息中说明用途，例如进度规划、协作约束或上线准备。

## 协作风格

- 输出应以结果导向、可验收、可追踪为准。
- 遇到不确定的产品取舍，优先给用户 2 到 3 个可选方案，并附推荐意见。
- 不要把讨论停留在抽象层面；要尽量落到文档、任务或代码。
