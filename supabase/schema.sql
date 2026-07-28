-- ==========================================================
-- FUNDED. — schéma Supabase
-- À exécuter dans l'éditeur SQL de ton projet Supabase.
-- ==========================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------
-- Firms
-- ----------------------------------------------------------
create table if not exists firms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  max_allocation numeric default 0,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Accounts
-- ----------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firm_id uuid references firms(id) on delete set null,
  size numeric not null,
  initial_size numeric not null,
  cost numeric default 0,
  phase text not null default 'phase1' check (phase in ('phase1','phase2','funded','breached')),
  purchase_date date not null default current_date,

  -- deadline de challenge
  challenge_deadline date,

  -- drawdown
  daily_drawdown_limit_pct numeric,
  max_drawdown_limit_pct numeric,
  current_drawdown_pct numeric default 0,

  -- scaling
  scaling_enabled boolean default false,
  scaling_pct numeric,
  scaling_interval_months int,
  last_scale_date date,

  -- identifiants (mot de passe chiffré, jamais en clair)
  login text,
  platform text,
  server text,
  password_encrypted bytea,

  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Scaling history
-- ----------------------------------------------------------
create table if not exists scaling_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  old_size numeric not null,
  new_size numeric not null,
  applied_at date not null default current_date
);

-- ----------------------------------------------------------
-- Expenses
-- ----------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  date date not null default current_date,
  description text,
  category text default 'Autre',
  amount numeric not null,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Payouts
-- ----------------------------------------------------------
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  date date not null default current_date,
  amount numeric not null,
  notes text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Goal tranches (paliers de financement mixtes par année)
-- ex: année 2026 -> {size:50000, count:2}, {size:200000, count:1}, ...
-- ----------------------------------------------------------
create table if not exists goal_tranches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  size numeric not null,
  count int not null,
  created_at timestamptz default now()
);

-- ==========================================================
-- Row Level Security — chacun ne voit et ne modifie que ses données
-- ==========================================================
alter table firms enable row level security;
alter table accounts enable row level security;
alter table scaling_history enable row level security;
alter table expenses enable row level security;
alter table payouts enable row level security;
alter table goal_tranches enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['firms','accounts','scaling_history','expenses','payouts','goal_tranches']
  loop
    execute format('drop policy if exists "select_own" on %I', t);
    execute format('create policy "select_own" on %I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "insert_own" on %I', t);
    execute format('create policy "insert_own" on %I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "update_own" on %I', t);
    execute format('create policy "update_own" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "delete_own" on %I', t);
    execute format('create policy "delete_own" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ==========================================================
-- Mots de passe chiffrés (pgcrypto) — la passphrase n'est
-- jamais stockée côté serveur, seulement fournie à l'appel.
-- ==========================================================
create or replace function set_account_password(p_account_id uuid, p_password text, p_passphrase text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update accounts
  set password_encrypted = pgp_sym_encrypt(p_password, p_passphrase)
  where id = p_account_id and user_id = auth.uid();
end;
$$;

create or replace function get_account_password(p_account_id uuid, p_passphrase text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  begin
    select pgp_sym_decrypt(password_encrypted, p_passphrase) into result
    from accounts
    where id = p_account_id and user_id = auth.uid();
  exception when others then
    return null;
  end;
  return result;
end;
$$;

grant execute on function set_account_password(uuid, text, text) to authenticated;
grant execute on function get_account_password(uuid, text) to authenticated;

-- ==========================================================
-- Fin du script.
-- Rappel : la "passphrase" utilisée pour chiffrer/déchiffrer
-- n'est PAS ton mot de passe Supabase — choisis-en une dédiée
-- et mémorise-la, elle n'est stockée nulle part.
-- ==========================================================


create or replace function set_account_password(p_account_id uuid, p_password text, p_passphrase text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update accounts
  set password_encrypted = pgp_sym_encrypt(p_password, p_passphrase)
  where id = p_account_id and user_id = auth.uid();
end;
$$;

create or replace function get_account_password(p_account_id uuid, p_passphrase text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result text;
begin
  begin
    select pgp_sym_decrypt(password_encrypted, p_passphrase) into result
    from accounts
    where id = p_account_id and user_id = auth.uid();
  exception when others then
    return null;
  end;
  return result;
end;
$$;

alter table accounts add column if not exists drawdown_updated_at timestamptz;

-- ==========================================================
-- Avatars (photo de profil) — Supabase Storage
-- À exécuter une fois pour activer l'upload d'avatar depuis
-- le panneau "Profil & paramètres".
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatar_insert_own" on storage.objects;
create policy "avatar_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '.', 1));

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '.', 1));

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '.', 1));