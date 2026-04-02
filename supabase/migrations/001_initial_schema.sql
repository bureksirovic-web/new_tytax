-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  language text not null default 'en',
  unit_system text not null default 'metric',
  theme text not null default 'tactical',
  bodyweight_kg real,
  gender text,
  experience_level text,
  active_family_member_id uuid,
  active_equipment_profile_id uuid,
  warmup_strategy text not null default 'standard',
  auto_backup boolean not null default false,
  bar_weight_kg real not null default 7.5,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profiles enable row level security;
create policy "Users own their profile" on public.profiles
  for all using (auth.uid() = id);

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================
create table if not exists public.family_members (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  bodyweight_kg real,
  gender text,
  experience_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.family_members enable row level security;
create policy "Users own their family members" on public.family_members
  for all using (auth.uid() = profile_id);

-- ============================================================
-- EQUIPMENT PROFILES
-- ============================================================
create table if not exists public.equipment_profiles (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  has_smith_machine boolean not null default true,
  has_upper_pulley boolean not null default true,
  has_lower_pulley boolean not null default true,
  has_leg_extension boolean not null default true,
  has_leg_curl boolean not null default true,
  attachments jsonb not null default '[]',
  has_pull_up_bar boolean not null default false,
  has_dip_station boolean not null default false,
  has_rings boolean not null default false,
  has_parallettes boolean not null default false,
  kettlebell_weights jsonb not null default '[]',
  plate_weights jsonb not null default '[]',
  bar_weight_kg real not null default 7.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.equipment_profiles enable row level security;
create policy "Users own their equipment profiles" on public.equipment_profiles
  for all using (auth.uid() = profile_id);

-- ============================================================
-- PROGRAMS
-- ============================================================
create table if not exists public.programs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  split_type text not null,
  frequency int not null,
  periodization_type text not null default 'none',
  periodization_config jsonb,
  session_order text[] not null default '{}',
  sessions jsonb not null default '[]',
  modalities_used text[] not null default '{}',
  is_active boolean not null default false,
  is_preset boolean not null default false,
  current_session_index int not null default 0,
  rotation_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.programs enable row level security;
create policy "Users own their programs" on public.programs
  for all using (auth.uid() = profile_id);

-- ============================================================
-- WORKOUT LOGS
-- ============================================================
create table if not exists public.workout_logs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id),
  program_id uuid references public.programs(id),
  session_name text not null,
  date date not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds int not null default 0,
  exercises jsonb not null default '[]',
  notes text,
  rpe int,
  bodyweight_kg real,
  total_volume_kg real not null default 0,
  total_sets int not null default 0,
  pr_count int not null default 0,
  modalities_used text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.workout_logs enable row level security;
create policy "Users own their workout logs" on public.workout_logs
  for all using (auth.uid() = profile_id);

create index idx_workout_logs_profile_date on public.workout_logs(profile_id, date desc);
create index idx_workout_logs_program on public.workout_logs(program_id);

-- ============================================================
-- PR RECORDS
-- ============================================================
create table if not exists public.pr_records (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  pr_type text not null,
  value real not null,
  reps int,
  achieved_at timestamptz not null,
  workout_log_id uuid references public.workout_logs(id),
  created_at timestamptz not null default now()
);

alter table public.pr_records enable row level security;
create policy "Users own their PR records" on public.pr_records
  for all using (auth.uid() = profile_id);

create index idx_pr_records_exercise on public.pr_records(profile_id, exercise_id);

-- ============================================================
-- BODYWEIGHT ENTRIES
-- ============================================================
create table if not exists public.bodyweight_entries (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  value_kg real not null,
  created_at timestamptz not null default now(),
  unique(profile_id, date)
);

alter table public.bodyweight_entries enable row level security;
create policy "Users own their bodyweight entries" on public.bodyweight_entries
  for all using (auth.uid() = profile_id);

-- ============================================================
-- EXERCISE NOTES
-- ============================================================
create table if not exists public.exercise_notes (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  unique(profile_id, exercise_id)
);

alter table public.exercise_notes enable row level security;
create policy "Users own their exercise notes" on public.exercise_notes
  for all using (auth.uid() = profile_id);

-- ============================================================
-- SYNC METADATA
-- ============================================================
create table if not exists public.sync_metadata (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  table_name text not null,
  device_id text not null,
  last_synced_at timestamptz not null default now(),
  unique(profile_id, table_name, device_id)
);

alter table public.sync_metadata enable row level security;
create policy "Users own their sync metadata" on public.sync_metadata
  for all using (auth.uid() = profile_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();
create trigger handle_programs_updated_at before update on public.programs
  for each row execute procedure public.handle_updated_at();
create trigger handle_workout_logs_updated_at before update on public.workout_logs
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- FOREIGN KEY INDEXES
-- ============================================================
create index family_members_profile_id_idx on public.family_members(profile_id);
create index equipment_profiles_profile_id_idx on public.equipment_profiles(profile_id);
create index programs_profile_id_idx on public.programs(profile_id);
create index bodyweight_entries_profile_id_idx on public.bodyweight_entries(profile_id);
create index exercise_notes_profile_id_idx on public.exercise_notes(profile_id);
create index sync_metadata_profile_id_idx on public.sync_metadata(profile_id);
create index pr_records_workout_log_id_idx on public.pr_records(workout_log_id);
create index workout_logs_family_member_id_idx on public.workout_logs(family_member_id);

-- ============================================================
-- ADDITIONAL UPDATED_AT TRIGGERS
-- ============================================================
create trigger handle_family_members_updated_at before update on public.family_members
  for each row execute function public.handle_updated_at();
create trigger handle_equipment_profiles_updated_at before update on public.equipment_profiles
  for each row execute function public.handle_updated_at();
create trigger handle_bodyweight_entries_updated_at before update on public.bodyweight_entries
  for each row execute function public.handle_updated_at();
create trigger handle_exercise_notes_updated_at before update on public.exercise_notes
  for each row execute function public.handle_updated_at();
create trigger handle_sync_metadata_updated_at before update on public.sync_metadata
  for each row execute function public.handle_updated_at();
