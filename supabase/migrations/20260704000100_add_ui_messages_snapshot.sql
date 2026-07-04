alter table public.conversations
  add column if not exists messages_json jsonb not null default '[]'::jsonb check (jsonb_typeof(messages_json) = 'array'),
  add column if not exists last_mode text not null default 'standard' check (last_mode in ('standard', 'deep')),
  add column if not exists last_message_preview text;

