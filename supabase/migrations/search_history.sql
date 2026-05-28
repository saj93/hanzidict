-- Search history table
-- Run this in Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists search_history (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  query       text not null,
  searched_at timestamptz default now() not null
);

-- Index for fast per-user lookup ordered by time
create index if not exists search_history_user_time
  on search_history (user_id, searched_at desc);

-- Row-level security: users can only see and modify their own rows
alter table search_history enable row level security;

create policy "Users can read own search history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own search history"
  on search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own search history"
  on search_history for delete
  using (auth.uid() = user_id);

-- Service role (used by the API) bypasses RLS automatically
