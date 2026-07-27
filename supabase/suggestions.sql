create table if not exists suggestions (
  id              bigserial primary key,
  entry_id        bigint references entries(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  field           text not null check (field in ('Definition','Pinyin','Example sentence','Other')),
  current_value   text,
  suggested_value text not null,
  reason          text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now()
);

create index if not exists suggestions_status_idx on suggestions(status, created_at desc);
