import React, { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Download, Search } from "lucide-react";
import { fmt, todayStr, downloadCSV } from "../utils/format";
import * as api from "../lib/api";
import { EXPENSE_CATEGORIES, FieldRow, EmptyState, PageHeader } from "./ui";

export default function Expenses({ expenses, accounts, firms, reload }) {
  const blank = { date: todayStr(), description: "", category: EXPENSE_CATEGORIES[0], amount: "", account_id: "" };
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank);
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const firmName = (firmId) => firms.find((f) => f.id === firmId)?.name || "—";
  const accLabel = (accId) => { const a = accounts.find((x) => x.id === accId); return a ? `${firmName(a.firm_id)} ${fmt(a.size)}` : "—"; };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(blank); };
  const startCreate = () => { setEditingId(null); setForm(blank); setShowForm(true); };
  const startEdit = (e) => {
    setEditingId(e.id);
    setForm({
      date: e.date || todayStr(),
      description: e.description || "",
      category: e.category || EXPENSE_CATEGORIES[0],
      amount: e.amount,
      account_id: e.account_id || "",
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.amount) return;
    const payload = { ...form, amount: Number(form.amount), account_id: form.account_id || null };
    if (editingId) await api.updateExpense(editingId, payload);
    else await api.createExpense(payload);
    closeForm();
    reload();
  };

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (filterAccount !== "all") {
          if (filterAccount === "none" ? e.account_id : e.account_id !== filterAccount) return false;
        }
        if (filterCategory !== "all" && e.category !== filterCategory) return false;
        if (q) {
          const desc = (e.description || "").toLowerCase();
          const cat = (e.category || "").toLowerCase();
          const label = accLabel(e.account_id).toLowerCase();
          if (!desc.includes(q) && !cat.includes(q) && !label.includes(q) && !String(e.amount).includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [expenses, search, filterAccount, filterCategory, accounts, firms]);

  const hasActiveFilters = search.length > 0 || filterAccount !== "all" || filterCategory !== "all";
  const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const resetFilters = () => { setSearch(""); setFilterAccount("all"); setFilterCategory("all"); };

  const exportCsv = () => {
    downloadCSV("depenses.csv",
      filteredExpenses.map((e) => ({ date: e.date, description: e.description, category: e.category, compte: accLabel(e.account_id), montant: e.amount })),
      ["date", "description", "category", "compte", "montant"]
    );
  };

  return (
    <div className="tab-content">
      <PageHeader
        eyebrow={hasActiveFilters ? `Total affiché ${fmt(filteredTotal)} · ${fmt(total)} au total` : `Total ${fmt(total)}`}
        title="Dépenses"
        sub="Frais d'achat de challenges, resets, abonnements."
        action={<div className="page-actions">
          <button className="btn ghost" onClick={exportCsv} disabled={expenses.length === 0}><Download size={15} /> <span className="btn-label">CSV</span></button>
          <button className="btn primary" onClick={startCreate}><Plus size={15} /> Nouvelle dépense</button>
        </div>} />

      {expenses.length > 1 && (
        <div className="acc-toolbar">
          <div className="acc-search">
            <Search size={14} />
            <input className="input" placeholder="Rechercher une description, une catégorie, un compte..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input acc-filter" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">Toutes catégories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input acc-filter" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
            <option value="all">Tous les comptes</option>
            <option value="none">Sans compte lié</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a.id)}</option>)}
          </select>
          {hasActiveFilters && <button className="btn ghost small" onClick={resetFilters}>Réinitialiser</button>}
        </div>
      )}

      <div className="panel">
        {expenses.length === 0 ? (
          <EmptyState icon={Plus} title="Aucune dépense" sub="Ajoute ta première dépense." />
        ) : filteredExpenses.length === 0 ? (
          <EmptyState icon={Search} title="Aucun résultat" sub="Aucune dépense ne correspond à ces filtres." />
        ) : (
          <div className="table-wrap">
            <table className="table fixed-cols payouts-table">
              <colgroup>
                <col style={{ width: 100 }} />
                <col />
                <col style={{ width: 150 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Compte</th><th className="num">Montant</th><th></th></tr></thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="dim" data-label="Date">{e.date}</td>
                    <td className="ellipsis-cell" data-label="Description">{e.description || "—"}</td>
                    <td data-label="Catégorie"><span className="tag" style={{ "--c": "#8891A3" }}>{e.category}</span></td>
                    <td className="dim ellipsis-cell" data-label="Compte">{accLabel(e.account_id)}</td>
                    <td className="num" data-label="Montant" style={{ color: "var(--loss)" }}>-{fmt(e.amount)}</td>
                    <td data-label="">
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => startEdit(e)} title="Modifier"><Pencil size={13} /></button>
                        <button className="icon-btn" onClick={async () => { await api.removeExpense(e.id); reload(); }} title="Supprimer"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId ? "Modifier la dépense" : "Nouvelle dépense"}</div>
            <div className="form-panel">
              <FieldRow>
                <label>Date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                <label>Montant ($)<input className="input" type="number" autoFocus value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="99" /></label>
              </FieldRow>
              <FieldRow>
                <label>Catégorie
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>Compte lié (optionnel)
                  <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                    <option value="">—</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{firmName(a.firm_id)} {fmt(a.size)}</option>)}
                  </select>
                </label>
              </FieldRow>
              <FieldRow>
                <label style={{ flex: "1 1 100%" }}>Description<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ex: Challenge 100k" /></label>
              </FieldRow>
              <div className="modal-actions">
                <button className="btn ghost" onClick={closeForm}>Annuler</button>
                <button className="btn primary" onClick={submit} disabled={!form.amount}>{editingId ? "Enregistrer" : "Ajouter"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}