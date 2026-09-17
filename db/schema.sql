-- WTS Scout database schema for Neon Postgres.
-- One workspace is the current tenant boundary. Replace the temporary
-- workspace-id trust model with real authentication before public launch.

create extension if not exists pgcrypto;

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
  updated_at timestamptz not null default now()
);

create index if not exists player_profiles_workspace_idx on player_profiles(workspace_id);
create index if not exists player_profiles_position_idx on player_profiles(workspace_id, position);
create index if not exists player_profiles_search_idx on player_profiles using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(position,'') || ' ' || coalesce(nationality,'') || ' ' || coalesce(current_club,'')));

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(workspace_id, player_id)
);

create index if not exists watchlists_workspace_idx on watchlists(workspace_id);

create table if not exists scouting_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  note text not null,
  stage text not null default 'watching',
  created_at timestamptz not null default now()
);

create index if not exists scouting_notes_player_idx on scouting_notes(workspace_id, player_id, created_at desc);

create table if not exists scouting_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  title text not null,
  content jsonb not null,
  fit_score integer,
  created_at timestamptz not null default now()
);

create index if not exists scouting_reports_player_idx on scouting_reports(workspace_id, player_id, created_at desc);

create table if not exists player_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  player_id uuid not null references player_profiles(id) on delete cascade,
  file_path text not null,
  blob_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists player_media_player_idx on player_media(workspace_id, player_id, created_at desc);

create or replace function set_wts_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_updated_at on player_profiles;
create trigger player_profiles_updated_at before update on player_profiles for each row execute function set_wts_updated_at();
