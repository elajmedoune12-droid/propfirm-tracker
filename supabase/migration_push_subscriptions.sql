-- ==========================================================
-- Notifications push Web Push (résumé quotidien envoyé par le
-- workflow GitHub Actions "Push digest").
-- À coller dans le SQL Editor de Supabase et exécuter.
--
-- Une ligne = un appareil abonné (endpoint unique par navigateur).
-- L'app insère/supprime ses propres lignes (RLS) ; le workflow
-- lit tout avec la clé service_role qui contourne la RLS.
-- ==========================================================

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "select_own" on push_subscriptions;
create policy "select_own" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "insert_own" on push_subscriptions;
create policy "insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "update_own" on push_subscriptions;
create policy "update_own" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own" on push_subscriptions;
create policy "delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);
