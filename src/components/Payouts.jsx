import React, { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Download, FileText, TrendingUp, Search, Loader2, AlertTriangle, AlertCircle } from "lucide-react";
import { fmt, todayStr, downloadCSV, downloadPayoutsPDF } from "../utils/format";
import * as api from "../lib/api";
import { FieldRow, EmptyState, PageHeader } from "./ui";

/* Confirmation avant suppression — un payout est un mouvement d'argent réel,
   pas question de le perdre sur un clic accidentel. */
function DeletePayoutConfirm({ payout, accLabel, busy, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="logout-confirm-icon"><AlertTriangle size={20} /></div>
        <div className="modal-title" style={{ justifyContent: "center" }}>Supprimer ce payout ?</div>
        <p className="modal-text" style={{ textAlign: "center" }}>
          {fmt(payout.amount)} du {payout.date} ({accLabel(payout.account_id)}) sera définitivement supprimé.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Annuler</button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : null} Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Payouts({ payouts, accounts, firms, reload }) {
  const blank = { date: todayStr(), account_id: "", amount: "", notes: "" };
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const [exportBusy, setExportBusy] = useState(null); // "csv" | "pdf" | null

  const total = payouts.reduce((s, p) => s + Number(p.amount), 0);

  const firmName = (firmId) => firms.find((f) => f.id === firmId)?.name || "—";
  const accLabel = (accId) => { const a = accounts.find((x) => x.id === accId); return a ? `${firmName(a.firm_id)} ${fmt(a.size)}` : "—"; };
  const fundableAccounts = accounts.filter((a) => a.phase === "funded");

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(blank); setFormErr(""); };
  const startCreate = () => { setEditingId(null); setForm(blank); setFormErr(""); setShowForm(true); };
  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ date: p.date || todayStr(), account_id: p.account_id || "", amount: p.amount, notes: p.notes || "" });
    setFormErr("");
    setShowForm(true);
  };

  const submit = async (e) => {
    e?.preventDefault();
    const amount = Number(form.amount);
    if (!form.amount || amount <= 0) { setFormErr("Le montant doit être supérieur à 0."); return; }
    if (!form.date) { setFormErr("La date est requise."); return; }

    setBusy(true); setFormErr("");
    try {
      const payload = { ...form, amount, account_id: form.account_id || null };
      if (editingId) await api.updatePayout(editingId, payload);
      else await api.createPayout(payload);
      closeForm();
      reload();
    } catch (err) {
      setFormErr(err.message || "Impossible d'enregistrer le payout.");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (p) => { setDeleteErr(""); setDeleteTarget(p); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteErr("");
    try {
      await api.removePayout(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setDeleteErr(err.message || "Impossible de supprimer le payout.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts
      .filter((p) => {
        if (filterAccount !== "all" && p.account_id !== filterAccount) return false;
        if (q) {
          const label = accLabel(p.account_id).toLowerCase();
          const notes = (p.notes || "").toLowerCase();
          if (!label.includes(q) && !notes.includes(q) && !String(p.amount).includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [payouts, search, filterAccount, accounts, firms]);

  const hasActiveFilters = search.length > 0 || filterAccount !== "all";
  const filteredTotal = filteredPayouts.reduce((s, p) => s + Number(p.amount), 0);

  const exportCsv = () => {
    setExportBusy("csv");
    try {
      downloadCSV("payouts.csv",
        filteredPayouts.map((p) => ({ date: p.date, compte: accLabel(p.account_id), montant: p.amount, note: p.notes })),
        ["date", "compte", "montant", "note"]
      );
    } finally {
      setExportBusy(null);
    }
  };
  const exportPdf = async () => {
    setExportBusy("pdf");
    try {
      await downloadPayoutsPDF(filteredPayouts, accLabel, "payouts.pdf");
    } finally {
      setExportBusy(null);
    }
  };

  return (
    <div className="tab-content">
      <PageHeader
        eyebrow={hasActiveFilters ? `Total affiché ${fmt(filteredTotal)} · ${fmt(total)} au total` : `Total ${fmt(total)}`}
        title="Payouts"
        sub="Retraits reçus de tes comptes financés."
        action={<div className="page-actions">
          <div className="export-group">
            <button className="btn ghost" onClick={exportCsv} disabled={exportBusy !== null || payouts.length === 0}>
              {exportBusy === "csv" ? <Loader2 size={15} className="spin" /> : <Download size={15} />} <span className="btn-label">CSV</span>
            </button>
            <button className="btn ghost" onClick={exportPdf} disabled={exportBusy !== null || payouts.length === 0}>
              {exportBusy === "pdf" ? <Loader2 size={15} className="spin" /> : <FileText size={15} />} <span className="btn-label">PDF</span>
            </button>
          </div>
          <button className="btn primary" onClick={startCreate}><Plus size={15} /> Nouveau payout</button>
        </div>}
      />

      {payouts.length > 1 && (
        <div className="acc-toolbar">
          <div className="acc-search">
            <Search size={14} />
            <input className="input" placeholder="Rechercher un compte, une note..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input acc-filter" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
            <option value="all">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a.id)}</option>)}
          </select>
        </div>
      )}

      <div className="panel">
        {payouts.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Aucun payout" sub="Enregistre ton premier payout reçu." />
        ) : filteredPayouts.length === 0 ? (
          <EmptyState icon={Search} title="Aucun résultat" sub="Aucun payout ne correspond à cette recherche." />
        ) : (
          <div className="table-wrap">
            <table className="table payouts-table">
              <thead><tr><th>Date</th><th>Compte</th><th>Note</th><th className="num">Montant</th><th></th></tr></thead>
              <tbody>
                {filteredPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="dim" data-label="Date">{p.date}</td>
                    <td className="ellipsis-cell" data-label="Compte" title={accLabel(p.account_id)}>{accLabel(p.account_id)}</td>
                    <td className="dim ellipsis-cell" data-label="Note" title={p.notes || undefined}>{p.notes || "—"}</td>
                    <td className="num" data-label="Montant" style={{ color: "var(--profit)" }}>+{fmt(p.amount)}</td>
                    <td data-label="">
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => startEdit(p)} title="Modifier" aria-label="Modifier ce payout"><Pencil size={13} /></button>
                        <button className="icon-btn" onClick={() => requestDelete(p)} title="Supprimer" aria-label="Supprimer ce payout"><Trash2 size={13} /></button>
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
        <div className="modal-backdrop" onClick={busy ? undefined : closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId ? "Modifier le payout" : "Nouveau payout"}</div>
            <form className="form-panel" onSubmit={submit}>
              <FieldRow>
                <label>Date<input className="input" type="date" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setFormErr(""); }} /></label>
                <label>Montant ($)<input className="input" type="number" min="0" step="0.01" autoFocus value={form.amount}
                  onChange={(e) => { setForm({ ...form, amount: e.target.value }); setFormErr(""); }} placeholder="850" /></label>
              </FieldRow>
              <FieldRow>
                <label>Compte (financé)
                  <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                    <option value="">—</option>
                    {fundableAccounts.map((a) => <option key={a.id} value={a.id}>{firmName(a.firm_id)} {fmt(a.size)}</option>)}
                  </select>
                  {fundableAccounts.length === 0 && <span className="empty-sub">Aucun compte financé pour l'instant.</span>}
                </label>
                <label>Note (optionnel)<input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ex: 1er payout" /></label>
              </FieldRow>
              {formErr && <div className="pin-error"><AlertCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{formErr}</div>}
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeForm} disabled={busy}>Annuler</button>
                <button type="submit" className="btn primary" disabled={!form.amount || busy}>
                  {busy ? <Loader2 size={14} className="spin" /> : null} {editingId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeletePayoutConfirm
          payout={deleteTarget}
          accLabel={accLabel}
          busy={deleteBusy}
          onCancel={() => !deleteBusy && setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {deleteErr && (
        <div className="modal-backdrop" onClick={() => setDeleteErr("")}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="pin-error" style={{ margin: 0 }}>{deleteErr}</div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setDeleteErr("")}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}