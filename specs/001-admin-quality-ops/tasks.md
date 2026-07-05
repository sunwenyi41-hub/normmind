# Tasks: 管理后台与质量运营

## Phase 1: Setup

- [x] T001 建立活动 Speckit 单元与设计文档 `specs/001-admin-quality-ops/`
- [x] T002 在 `.env.example` 记录服务端管理员白名单变量

## Phase 2: Foundational

- [x] T003 实现可共享的管理员判定 `src/lib/admin-auth.ts`
- [x] T004 建立管理路由服务端保护 `src/app/admin/layout.tsx`

## Phase 3: User Story 1 - 安全访问后台 (P1)

- [x] T005 [US1] 向工作台传递管理员状态 `src/app/page.tsx`
- [x] T006 [US1] 隐藏普通用户的后台入口 `src/components/chat-shell.tsx`
- [x] T007 [P] [US1] 隐藏资料库和设置页中的非授权入口 `src/app/library/page.tsx`, `src/app/library/[id]/page.tsx`, `src/app/settings/page.tsx`
- [ ] T008 [US1] 用管理员和普通用户完成路由回归并记录结果 `specs/001-admin-quality-ops/quickstart.md`

## Phase 4: User Story 2 - 真实反馈处理 (P2)

- [x] T009 [US2] 设计反馈处理状态迁移 `supabase/migrations/`
- [x] T010 [US2] 实现管理员反馈列表与状态更新 `src/app/admin/feedback/page.tsx`
- [x] T011 [US2] 补充反馈 RLS 与越权回归 `supabase/tests/ownership_rls.sql`

## Phase 5: User Story 3 - QA 与评测数据 (P3)

- [x] T012 [P] [US3] 建立 QA 样本与评测记录表 `supabase/migrations/`
- [x] T013 [US3] 接入 QA 样本管理 `src/app/admin/qa/page.tsx`
- [x] T014 [US3] 接入评测记录查看 `src/app/admin/evals/page.tsx`

## Phase 6: Polish

- [x] T015 运行 `npm run lint` 和 `npm run build`
- [ ] T016 更新 `progress.md` 并完成阶段验收

## Dependencies

- US1 是 US2 和 US3 的安全前置。
- US2 可在 US1 通过后独立交付。
- US3 可与 US2 独立开发，但必须共用同一管理员授权规则。
