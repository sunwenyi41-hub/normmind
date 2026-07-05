-- NormMind RLS / ownership smoke checklist
--
-- Usage:
-- 1. Replace the two UUID placeholders below with real auth.users ids.
-- 2. Run the setup block in Supabase SQL Editor.
-- 3. Use the SELECT statements to verify cross-user isolation.
--
-- NOTE:
-- This file is intentionally written as a repeatable smoke script,
-- not as a migration.

-- user_a := owner
-- user_b := another authenticated user

begin;

-- Replace these placeholders before running
select
  '00000000-0000-0000-0000-000000000001'::uuid as user_a,
  '00000000-0000-0000-0000-000000000002'::uuid as user_b;

-- Expected checks after seeding / using the app:
-- 1. user_a can select only user_a rows
-- 2. user_b can never select or delete user_a conversations
-- 3. assistant feedback requires message ownership
-- 4. non-admin users cannot select qa_samples or evaluation_runs
-- 5. non-admin users cannot select feedback owned by another user
-- 6. a JWT with app_metadata.role=admin can manage feedback, QA samples and evaluation runs

-- Example verification queries for manual execution:
-- select id, title from public.conversations where user_id = '<user_a>';
-- select id, title from public.conversations where user_id = '<user_b>';
-- select conversation_id, role from public.messages where user_id = '<user_a>';
-- select conversation_id, role from public.messages where user_id = '<user_b>';

-- Run these queries with a normal authenticated JWT; all counts must be zero:
-- select count(*) from public.qa_samples;
-- select count(*) from public.evaluation_runs;
-- select count(*) from public.feedback where user_id <> auth.uid();

-- Run with an administrator JWT; rows should be visible:
-- select id, rating, status from public.feedback order by created_at desc;
-- select id, question, status from public.qa_samples order by updated_at desc;
-- select id, name, status from public.evaluation_runs order by created_at desc;

rollback;
