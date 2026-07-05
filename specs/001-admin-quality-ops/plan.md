# Implementation Plan: 管理后台与质量运营

**Branch**: `001-admin-quality-ops` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

## Summary

在现有 Next.js 工作台中建立服务端管理员校验，隐藏普通用户的后台入口，并逐步使用 Supabase 真实反馈、QA 和评测数据替换演示数据。

## Technical Context

**Language/Version**: TypeScript, Node.js 24, React 19  
**Primary Dependencies**: Next.js App Router, Supabase SSR, Tailwind CSS  
**Storage**: Supabase Postgres  
**Testing**: ESLint, TypeScript build, route and RLS smoke tests  
**Target Platform**: Vercel Fluid Compute  
**Project Type**: Full-stack web application  
**Performance Goals**: 后台列表首次可用内容 2 秒内展示  
**Constraints**: 不向浏览器暴露高权限密钥；授权不使用可编辑的 user metadata  
**Scale/Scope**: 首版 1–10 名管理员，数千条反馈或样本

## Constitution Check

项目 constitution 尚未完成正式原则填写。本单元按现有 AGENTS.md 与用户确认的技术栈执行，不引入新框架，不改变 Coze 单轮工具边界。

## Project Structure

```text
src/app/admin/          # 服务端保护的后台页面
src/lib/admin-auth.ts   # 管理员授权判定
src/app/api/admin/      # 后续管理操作接口
supabase/migrations/    # 质量运营数据与 RLS
tests/                  # 权限与数据边界回归
```

**Structure Decision**: 继续使用单一 Next.js 应用，后台与用户端共享认证会话，由服务端和 RLS 同时守住边界。
