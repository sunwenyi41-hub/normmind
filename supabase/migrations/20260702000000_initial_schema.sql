create extension if not exists pgcrypto;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  mode text not null default 'standard' check (mode in ('standard', 'deep')),
  status text not null default 'completed' check (status in ('completed', 'insufficient_evidence', 'failed')),
  citations_json jsonb not null default '[]'::jsonb check (jsonb_typeof(citations_json) = 'array'),
  trace_id text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('helpful', 'unhelpful')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);
create index feedback_user_idx on public.feedback (user_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.feedback enable row level security;

create policy "users_select_own_conversations" on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_conversations" on public.conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users_update_own_conversations" on public.conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users_delete_own_conversations" on public.conversations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "users_select_own_messages" on public.messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_messages" on public.messages for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

create policy "users_select_own_feedback" on public.feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_feedback" on public.feedback for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.messages m where m.id = message_id and m.user_id = (select auth.uid()) and m.role = 'assistant'));
create policy "users_update_own_feedback" on public.feedback for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.feedback to authenticated;
