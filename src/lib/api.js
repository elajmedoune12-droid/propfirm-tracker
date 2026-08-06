import { supabase } from "../supabaseClient";

function check(error) {
  if (error) throw error;
}

/* ---------------- Firms ---------------- */
export async function listFirms() {
  const { data, error } = await supabase.from("firms").select("*").order("created_at");
  check(error);
  return data;
}
export async function createFirm(firm) {
  const { error } = await supabase.from("firms").insert(firm);
  check(error);
}
export async function updateFirm(id, patch) {
  const { error } = await supabase.from("firms").update(patch).eq("id", id);
  check(error);
}
export async function removeFirm(id) {
  const { error } = await supabase.from("firms").delete().eq("id", id);
  check(error);
}

/* ---------------- Accounts ---------------- */
export async function listAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
  check(error);
  return data;
}
export async function createAccount(account) {
  const { data, error } = await supabase.from("accounts").insert(account).select().single();
  check(error);
  return data;
}
export async function updateAccount(id, patch) {
  const { error } = await supabase.from("accounts").update(patch).eq("id", id);
  check(error);
}
export async function removeAccount(id) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  check(error);
}
export async function removeLinkedPurchaseExpense(accountId) {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("account_id", accountId)
    .eq("category", "Achat challenge");
  check(error);
}
export async function syncPurchaseExpense(accountId, cost, date, description) {
  const { data: existing, error: selErr } = await supabase
    .from("expenses")
    .select("id")
    .eq("account_id", accountId)
    .eq("category", "Achat challenge")
    .limit(1);
  check(selErr);
  const row = existing && existing[0];
  if (Number(cost) > 0) {
    if (row) {
      const { error } = await supabase.from("expenses").update({ amount: Number(cost), date, description }).eq("id", row.id);
      check(error);
    } else {
      const { error } = await supabase.from("expenses").insert({ account_id: accountId, category: "Achat challenge", amount: Number(cost), date, description });
      check(error);
    }
  } else if (row) {
    const { error } = await supabase.from("expenses").delete().eq("id", row.id);
    check(error);
  }
}

/* password encryption via RPC (passphrase never stored) */
export async function setAccountPassword(accountId, password, passphrase) {
  const { error } = await supabase.rpc("set_account_password", {
    p_account_id: accountId,
    p_password: password,
    p_passphrase: passphrase,
  });
  check(error);
}
export async function getAccountPassword(accountId, passphrase) {
  const { data, error } = await supabase.rpc("get_account_password", {
    p_account_id: accountId,
    p_passphrase: passphrase,
  });
  check(error);
  return data; // null if wrong passphrase or none set
}

/* ---------------- Scaling history ---------------- */
export async function listScalingHistory(accountId) {
  const { data, error } = await supabase
    .from("scaling_history")
    .select("*")
    .eq("account_id", accountId)
    .order("applied_at", { ascending: false });
  check(error);
  return data;
}
export async function listAllScalingHistory() {
  const { data, error } = await supabase.from("scaling_history").select("*").order("applied_at");
  check(error);
  return data;
}
export async function applyScaling(account) {
  const newSize = Math.round((Number(account.size) * (1 + Number(account.scaling_pct || 0) / 100)) / 100) * 100;
  const { error: histErr } = await supabase.from("scaling_history").insert({
    account_id: account.id,
    old_size: account.size,
    new_size: newSize,
  });
  check(histErr);
  const { error } = await supabase
    .from("accounts")
    .update({ size: newSize, last_scale_date: new Date().toISOString().slice(0, 10) })
    .eq("id", account.id);
  check(error);
  return newSize;
}

/* ---------------- Account events (historique des changements de phase) ---------------- */
export async function listAccountEvents() {
  const { data, error } = await supabase.from("account_events").select("*").order("event_date");
  check(error);
  return data;
}
export async function logAccountEvent(accountId, phase, eventDate, reason = null) {
  const { error } = await supabase.from("account_events").insert({
    account_id: accountId,
    phase,
    event_date: eventDate || new Date().toISOString().slice(0, 10),
    reason: reason || null,
  });
  check(error);
}
// Met à jour la phase du compte ET journalise l'évènement en une seule étape —
// à utiliser pour tout changement de phase déclenché par les boutons "Passer à..."
// ou "Marquer échoué", pour que le Dashboard puisse reconstituer l'historique.
export async function changeAccountPhase(accountId, phase, reason = null) {
  const eventDate = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("accounts").update({ phase }).eq("id", accountId);
  check(error);
  await logAccountEvent(accountId, phase, eventDate, reason);
}

export async function quickUpdateDrawdown(accountId, pct) {
  const { error } = await supabase
    .from("accounts")
    .update({ current_drawdown_pct: pct, drawdown_updated_at: new Date().toISOString() })
    .eq("id", accountId);
  check(error);
}

/* ---------------- Expenses ---------------- */
export async function listExpenses() {
  const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
  check(error);
  return data;
}
export async function createExpense(exp) {
  const { error } = await supabase.from("expenses").insert(exp);
  check(error);
}
export async function updateExpense(id, exp) {
  const { error } = await supabase.from("expenses").update(exp).eq("id", id);
  check(error);
}
export async function removeExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  check(error);
}

/* ---------------- Payouts ---------------- */
export async function listPayouts() {
  const { data, error } = await supabase.from("payouts").select("*").order("date", { ascending: false });
  check(error);
  return data;
}
export async function createPayout(p) {
  const { error } = await supabase.from("payouts").insert(p);
  check(error);
}
export async function updatePayout(id, p) {
  const { error } = await supabase.from("payouts").update(p).eq("id", id);
  check(error);
}
export async function removePayout(id) {
  const { error } = await supabase.from("payouts").delete().eq("id", id);
  check(error);
}

/* ---------------- Goal tranches ---------------- */
export async function listGoalTranches() {
  const { data, error } = await supabase.from("goal_tranches").select("*").order("year");
  check(error);
  return data;
}
export async function createGoalTranches(rows) {
  const { error } = await supabase.from("goal_tranches").insert(rows);
  check(error);
}
export async function deleteGoalYear(year) {
  const { error } = await supabase.from("goal_tranches").delete().eq("year", year);
  check(error);
}
/* ---------------- Compte propre (perso) ---------------- */
export async function getPersonalAccount() {
  const { data, error } = await supabase.from("personal_account").select("*").maybeSingle();
  check(error);
  return data;
}
export async function upsertPersonalAccount(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("personal_account")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  check(error);
  return data;
}

export async function listBalanceHistory() {
  const { data, error } = await supabase
    .from("personal_balance_history")
    .select("*")
    .order("entry_date", { ascending: true });
  check(error);
  return data;
}
export async function addBalanceEntry(balance, note, entryDate, depositAmount = 0, weeklyPnl = 0) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("personal_balance_history").insert({
    user_id: user.id,
    balance: Number(balance),
    note: note || null,
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    deposit_amount: Number(depositAmount) || 0,
    weekly_pnl: Number(weeklyPnl) || 0,
  });
  check(error);
}
export async function removeBalanceEntry(id) {
  const { error } = await supabase.from("personal_balance_history").delete().eq("id", id);
  check(error);
}

export async function listMilestones() {
  const { data, error } = await supabase
    .from("personal_milestones")
    .select("*")
    .order("sort_order", { ascending: true });
  check(error);
  return data;
}
export async function createMilestone(label, targetBalance, sortOrder) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("personal_milestones").insert({
    user_id: user.id,
    label,
    target_balance: Number(targetBalance),
    sort_order: sortOrder,
  });
  check(error);
}
export async function removeMilestone(id) {
  const { error } = await supabase.from("personal_milestones").delete().eq("id", id);
  check(error);
}
export async function markMilestoneAchieved(id, achieved) {
  const { error } = await supabase
    .from("personal_milestones")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", id);
  check(error);
}

export async function updateBalanceEntry(id, patch) {
  const { error } = await supabase.from("personal_balance_history").update(patch).eq("id", id);
  check(error);
}