-- WTS Scout authentication layer for Neon Postgres.
-- Users own or belong to workspaces. Sessions store only a SHA-256 token hash.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'scout' check (role in ('scout','player','club','academy','admin')),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_lower_idx on app_users (lower(email));

create table if not exists workspaces (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  name text not null,
  owner_user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','scout','analyst','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members(user_id);

create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_sessions_user_idx on app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on app_sessions(expires_at);

create or replace function set_wts_user_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_updated_at on app_users;
create trigger app_users_updated_at before update on app_users for each row execute function set_wts_user_updated_at();
