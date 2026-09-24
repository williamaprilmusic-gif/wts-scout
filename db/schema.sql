-- WTS Scout database schema for Neon Postgres.
-- Workspace membership is the tenant boundary. All application APIs authorize
-- against the authenticated session and membership, never a browser-supplied workspace id.

create extension if not exists pgcrypto;

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

create table if not exists player_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  full_name text not null,
  age integer,
  position text,
  secondary_position text,
  preferred_foot text,
  nationality text,
  city text,
  current_club text,
  league text,
  status text default 'Emerging',
  fit_score integer,
  minutes integer default 0,
  goals integer default 0,
  assists integer default 0,
  strengths text[] default '{}',
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_workspace_fk foreign key (workspace_id) references workspaces(id) on delete cascade
);

create index if not exists player_profiles_workspace_idx on player_profiles(workspace_id);
create index if not exists player_profiles_position_idx on player_profiles(workspace_id, position);
create index if not exists player_profiles_search_idx on player_profiles using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(position,'') || ' ' || coalesce(nationality,'') || ' ' || coalesce(current_club,'')));

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(workspace_id, player_id),
  constraint watchlist_workspace_fk foreign key (workspace_id) references workspaces(id) on delete cascade
);

create index if not exists watchlists_workspace_idx on watchlists(workspace_id);

create table if not exists scouting_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  note text not null,
  stage text not null default 'watching',
  created_at timestamptz not null default now(),
  constraint notes_workspace_fk foreign key (workspace_id) references workspaces(id) on delete cascade
);

create index if not exists scouting_notes_player_idx on scouting_notes(workspace_id, player_id, created_at desc);

create table if not exists scouting_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  title text not null,
  content jsonb not null,
  fit_score integer,
  created_at timestamptz not null default now(),
  constraint reports_workspace_fk foreign key (workspace_id) references workspaces(id) on delete cascade
);

create index if not exists scouting_reports_player_idx on scouting_reports(workspace_id, player_id, created_at desc);


create or replace function set_wts_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_updated_at on player_profiles;
create trigger player_profiles_updated_at before update on player_profiles for each row execute function set_wts_updated_at();

drop trigger if exists app_users_updated_at on app_users;
create trigger app_users_updated_at before update on app_users for each row execute function set_wts_updated_at();
