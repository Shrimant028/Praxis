create extension if not exists pgcrypto;

create table if not exists sources (
  id text primary key,
  owner_key text not null,
  title text not null,
  type text not null,
  author text not null default '',
  color text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists highlights (
  id text primary key,
  owner_key text not null,
  source_id text not null references sources(id) on delete cascade,
  text text not null,
  tags jsonb not null default '[]'::jsonb,
  note text not null default '',
  converted boolean not null default false,
  created_at timestamptz not null
);

create table if not exists conversions (
  id text primary key,
  owner_key text not null,
  highlight_id text null references highlights(id) on delete cascade,
  source_id text null references sources(id) on delete set null,
  insight text not null default '',
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  intention_full text not null default '',
  intention_why text not null default '',
  created_at timestamptz not null
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  source_id text null references sources(id) on delete set null,
  highlight_id text null references highlights(id) on delete set null,
  conversion_id text null references conversions(id) on delete set null,
  storage_provider text not null default 'r2',
  bucket text not null,
  object_key text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text null,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_sources_owner_key on sources(owner_key);
create index if not exists idx_highlights_owner_key on highlights(owner_key);
create index if not exists idx_highlights_source_id on highlights(source_id);
create index if not exists idx_conversions_owner_key on conversions(owner_key);
create index if not exists idx_conversions_highlight_id on conversions(highlight_id);
create index if not exists idx_conversions_source_id on conversions(source_id);
create index if not exists idx_files_owner_key on files(owner_key);
create index if not exists idx_files_source_id on files(source_id);
create index if not exists idx_files_highlight_id on files(highlight_id);
create index if not exists idx_files_conversion_id on files(conversion_id);
