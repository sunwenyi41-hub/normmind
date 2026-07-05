-- Admin quality operations: feedback workflow, QA samples and evaluation runs.

alter table public.feedback
  alter column message_id drop not null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists answer_id text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'resolved', 'closed')),
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

create unique index if not exists feedback_snapshot_answer_unique
  on public.feedback (conversation_id, answer_id, user_id)
  where conversation_id is not null and answer_id is not null;

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at desc);

alter table public.feedback drop constraint if exists feedback_answer_reference_check;
alter table public.feedback add constraint feedback_answer_reference_check
  check (message_id is not null or (conversation_id is not null and answer_id is not null));

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

drop policy if exists "admins_select_all_feedback" on public.feedback;
create policy "admins_select_all_feedback"
  on public.feedback for select to authenticated
  using ((select public.is_app_admin()));

drop policy if exists "admins_update_all_feedback" on public.feedback;
create policy "admins_update_all_feedback"
  on public.feedback for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "users_insert_own_feedback" on public.feedback;
create policy "users_insert_own_feedback"
  on public.feedback for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      exists (
        select 1 from public.messages m
        where m.id = message_id
          and m.user_id = (select auth.uid())
          and m.role = 'assistant'
      )
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and c.user_id = (select auth.uid())
      )
    )
  );

create table if not exists public.qa_samples (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 2 and 2000),
  expected_points jsonb not null default '[]'::jsonb check (jsonb_typeof(expected_points) = 'array'),
  category text not null default '未分类' check (char_length(category) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  total_count integer not null default 0 check (total_count >= 0),
  passed_count integer not null default 0 check (passed_count >= 0 and passed_count <= total_count),
  failed_items jsonb not null default '[]'::jsonb check (jsonb_typeof(failed_items) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists qa_samples_status_updated_idx on public.qa_samples (status, updated_at desc);
create index if not exists evaluation_runs_created_idx on public.evaluation_runs (created_at desc);

alter table public.qa_samples enable row level security;
alter table public.evaluation_runs enable row level security;

create policy "admins_manage_qa_samples"
  on public.qa_samples for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

create policy "admins_manage_evaluation_runs"
  on public.evaluation_runs for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

grant select, insert, update, delete on public.qa_samples to authenticated;
grant select, insert, update, delete on public.evaluation_runs to authenticated;

insert into public.qa_samples (question, expected_points, category, status)
values
  ('《住宅建筑规范》的编号和实施日期是什么？', '["规范编号", "实施日期", "版本风险提示"]'::jsonb, '版本识别', 'active'),
  ('当规范库中没有可靠引用时应如何回答？', '["明确证据不足", "不编造条款", "建议补充条件"]'::jsonb, '证据不足', 'active');

insert into public.evaluation_runs (name, status, total_count, passed_count, failed_items)
values
  ('MVP 条文查找基线', 'completed', 18, 16, '[{"question":"示例失败项","reason":"版本字段缺失"}]'::jsonb),
  ('无答案兜底集', 'completed', 9, 8, '[{"question":"示例拒答项","reason":"风险提示不足"}]'::jsonb);

-- Existing administrators can be promoted in Supabase SQL Editor with:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'your-admin@example.com';
