create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'scout' check (role in ('player','scout','club','academy','admin')),
  organisation_name text,
  country text,
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  date_of_birth date,
  position text not null,
  secondary_position text,
  preferred_foot text check (preferred_foot in ('Right','Left','Both')),
  nationality text,
  city text,
  current_club text,
  league text,
  height_cm integer,
  status text not null default 'Emerging',
  bio text,
  strengths text[] not null default '{}',
  minutes integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  fit_score integer check (fit_score between 0 and 100),
  avatar_url text,
  highlights_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, player_id)
);

create table if not exists public.scouting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  note text not null,
  stage text not null default 'watching' check (stage in ('watching','shortlisted','contacted','trial','signed','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.scouting_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  title text not null,
  content jsonb not null,
  fit_score integer,
  created_at timestamptz not null default now()
);

create table if not exists public.player_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  file_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('club','academy','agency')),
  country text,
  city text,
  description text,
  website text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_position on public.player_profiles(position);
create index if not exists idx_players_country on public.player_profiles(nationality);
create index if not exists idx_players_club on public.player_profiles(current_club);
create index if not exists idx_notes_player on public.scouting_notes(player_id);
create index if not exists idx_watchlists_user on public.watchlists(user_id);

alter table public.profiles enable row level security;
alter table public.player_profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.scouting_notes enable row level security;
alter table public.scouting_reports enable row level security;
alter table public.player_media enable row level security;
alter table public.organisations enable row level security;

create policy "profiles are readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "users manage their own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "verified players are discoverable" on public.player_profiles for select to authenticated using (verified = true or owner_id = auth.uid());
create policy "owners create players" on public.player_profiles for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update players" on public.player_profiles for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete players" on public.player_profiles for delete to authenticated using (owner_id = auth.uid());

create policy "users manage their watchlists" on public.watchlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage their notes" on public.scouting_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage their reports" on public.scouting_reports for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage media records" on public.player_media for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "organisation owners manage organisations" on public.organisations for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('player-media', 'player-media', true)
on conflict (id) do nothing;

create policy "signed-in users upload player media" on storage.objects for insert to authenticated with check (bucket_id = 'player-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public can read player media" on storage.objects for select using (bucket_id = 'player-media');
create policy "owners delete player media" on storage.objects for delete to authenticated using (bucket_id = 'player-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name','New Scout'), coalesce(new.raw_user_meta_data->>'role','scout'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
