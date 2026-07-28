-- ==========================================================
-- Migration : déplacer challenge_type / asset_class des firmes
-- vers les comptes (une firme peut proposer plusieurs structures
-- de challenge et plusieurs classes d'actifs selon le compte acheté).
-- À coller dans le SQL Editor de Supabase et exécuter.
-- ==========================================================

-- 1) Ajouter les colonnes sur accounts
alter table accounts add column if not exists challenge_type text not null default '2phase';
alter table accounts add column if not exists asset_class text not null default 'cfd';

-- 2) Reprendre les valeurs déjà saisies au niveau firme, le temps de la
--    transition (si la colonne existe encore sur firms)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'firms' and column_name = 'challenge_type') then
    update accounts a
    set challenge_type = coalesce(f.challenge_type, '2phase'),
        asset_class = coalesce(f.asset_class, 'cfd')
    from firms f
    where a.firm_id = f.id;
  end if;
end $$;

-- 3) Contraintes de valeurs valides
alter table accounts drop constraint if exists accounts_challenge_type_check;
alter table accounts add constraint accounts_challenge_type_check
  check (challenge_type in ('instant','1phase','2phase','3phase'));

alter table accounts drop constraint if exists accounts_asset_class_check;
alter table accounts add constraint accounts_asset_class_check
  check (asset_class in ('cfd','futures','both'));

-- 4) La phase doit accepter phase1/phase2/phase3/funded/breached
alter table accounts drop constraint if exists accounts_phase_check;
alter table accounts add constraint accounts_phase_check
  check (phase in ('phase1','phase2','phase3','funded','breached'));

-- 5) Nettoyage : retirer challenge_type / asset_class de firms
--    (elles ne servent plus qu'au niveau compte)
alter table firms drop column if exists challenge_type;
alter table firms drop column if exists asset_class;
