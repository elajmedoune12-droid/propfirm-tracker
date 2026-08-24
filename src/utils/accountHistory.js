// Reconstitue la phase d'un compte telle qu'elle était à une date donnée (ex: le
// 31/12 d'une année), à partir de son historique (table account_events). Sans
// historique (comptes créés avant cette fonctionnalité et jamais retouchés
// depuis), on retombe sur la phase actuelle, appliquée à toutes les années.
export function phaseAsOf(accountId, currentPhase, events, endDate) {
  const evs = events.filter((e) => e.account_id === accountId);
  if (evs.length === 0) return currentPhase;
  const past = evs.filter((e) => e.event_date <= endDate).sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  if (past.length === 0) return null; // le compte n'avait pas encore d'évènement à cette date (créé après)
  return past[past.length - 1].phase;
}

// Reconstitue la taille du compte à une date donnée, en "rejouant" le scaling
// appliqué jusque-là (table scaling_history). Sans scaling avant cette date,
// on repart de la taille initiale.
export function sizeAsOf(account, scalingHistory, endDate) {
  const applied = scalingHistory
    .filter((h) => h.account_id === account.id && h.applied_at <= endDate)
    .sort((a, b) => (a.applied_at < b.applied_at ? -1 : 1));
  if (applied.length === 0) return Number(account.initial_size || account.size);
  return Number(applied[applied.length - 1].new_size);
}

// Reconstitue la liste des comptes tels qu'ils étaient au 31/12 d'une année
// donnée (phase + taille à cette époque). Un compte funded en 2024 puis
// breached en 2026 compte comme "funded" pour 2024/2025, et comme "breached"
// à partir de 2026. Les comptes pas encore créés à cette date sont exclus.
export function accountsAsOfYear(accounts, accountEvents, scalingHistory, year) {
  const endDate = `${year}-12-31`;
  return accounts
    .map((a) => {
      const yearSize = sizeAsOf(a, scalingHistory, endDate);
      return { ...a, size: yearSize, yearSize, currentSize: a.size, yearPhase: phaseAsOf(a.id, a.phase, accountEvents, endDate) };
    })
    .filter((a) => a.yearPhase !== null);
}

// Année où un compte est devenu "funded" pour la première fois (à partir de son
// historique d'évènements). Sert à ne compter un compte que pour l'objectif de
// l'année où il a été financé, pas pour chaque année suivante où il l'est resté.
export function fundedYearOf(accountId, events) {
  const evs = events
    .filter((e) => e.account_id === accountId && e.phase === "funded")
    .sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  return evs.length > 0 ? Number(evs[0].event_date.slice(0, 4)) : null;
}