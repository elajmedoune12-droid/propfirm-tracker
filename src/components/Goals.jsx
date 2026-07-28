import React, { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, AlertTriangle, AlertCircle, X } from "lucide-react";
import { fmt, fmtSigned } from "../utils/format";
import * as api from "../lib/api";
import { Dial, TrancheStrip, TrancheBuilder, PageHeader, EmptyState } from "./ui";
import { accountsAsOfYear } from "../utils/accountHistory";

/* Confirmation avant suppression — un objectif supprimé perd tous ses paliers,
   aucune récupération possible. */
function DeleteGoalConfirm({ year, busy, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="logout-confirm-icon"><AlertTriangle size={20} /></div>
        <div className="modal-title" style={{ justifyContent: "center" }}>Supprimer l'objectif {year} ?</div>
        <p className="modal-text" style={{ textAlign: "center" }}>
          Tous les paliers définis pour {year} seront perdus. Cette action est irréversible.
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

/* Modale unique pour créer OU modifier un objectif.
   - Création : l'année est modifiable, la liste part vide.
   - Édition : l'année est verrouillée, la liste part pré-remplie
     avec les paliers déjà enregistrés pour cette année.
   Un seul bouton d'action visible (celui de TrancheBuilder, pleine largeur) ;
   on ferme via la croix du titre plutôt qu'un 2e bouton "Annuler" qui
   flottait mal aligné en bas de la modale. */
function GoalModal({ mode, year, initialList, existingYears, busy, err, onClose, onSave }) {
  const [yearInput, setYearInput] = useState(year);
  const numYear = Number(yearInput) || year;
  const isEditing = mode === "edit";
  const wouldOverwrite = !isEditing && existingYears.includes(numYear);

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {isEditing ? `Modifier l'objectif ${year}` : "Nouvel objectif"}
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="form-panel">
          <label style={{ maxWidth: 160 }}>Année
            <input className="input" type="number" value={yearInput} disabled={isEditing}
              onChange={(e) => setYearInput(e.target.value)} />
          </label>
          {wouldOverwrite && (
            <div className="pin-error" style={{ margin: 0 }}>
              <AlertCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
              {numYear} a déjà un objectif — l'enregistrer remplacera ses paliers actuels.
            </div>
          )}
          <TrancheBuilder
            key={numYear}
            initialList={initialList}
            saveLabel={isEditing || wouldOverwrite ? "Remplacer l'objectif" : "Enregistrer l'objectif"}
            busy={busy}
            onSave={(list) => onSave(numYear, list)}
          />
          {err && <div className="pin-error">{err}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Goals({ accounts, expenses, payouts, goalTranches, currentYear, reload, accountEvents = [], scalingHistory = [] }) {
  const [modal, setModal] = useState(null); // { mode: "create"|"edit", year, initialList } | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const yearOf = (d) => Number((d || "").slice(0, 4)) || currentYear;
  const totalsForYear = (y) => {
    const exp = expenses.filter((e) => yearOf(e.date) === y).reduce((s, e) => s + Number(e.amount), 0);
    const pay = payouts.filter((p) => yearOf(p.date) === y).reduce((s, p) => s + Number(p.amount), 0);
    return { exp, pay, net: pay - exp };
  };

  const years = useMemo(() => {
    const s = new Set([currentYear]);
    expenses.forEach((e) => s.add(yearOf(e.date)));
    payouts.forEach((p) => s.add(yearOf(p.date)));
    goalTranches.forEach((g) => s.add(g.year));
    return Array.from(s).sort((a, b) => b - a);
  }, [expenses, payouts, goalTranches, currentYear]);

  const tranchesFor = (y) => goalTranches.filter((g) => g.year === y);
  const yearsWithGoals = useMemo(() => Array.from(new Set(goalTranches.map((g) => g.year))), [goalTranches]);

  const openCreate = () => {
    // Propose la prochaine année qui n'a pas encore d'objectif, plutôt que toujours +1
    let candidate = currentYear + 1;
    while (yearsWithGoals.includes(candidate)) candidate++;
    setErr("");
    setModal({ mode: "create", year: candidate, initialList: [] });
  };

  const openEdit = (y) => {
    const initialList = tranchesFor(y).map((t) => ({ id: t.id, size: Number(t.size), count: Number(t.count) }));
    setErr("");
    setModal({ mode: "edit", year: y, initialList });
  };

  const closeModal = () => { if (!busy) { setModal(null); setErr(""); } };

  const saveGoal = async (targetYear, list) => {
    setBusy(true); setErr("");
    try {
      await api.deleteGoalYear(targetYear);
      await api.createGoalTranches(list.map((t) => ({ year: targetYear, size: t.size, count: t.count })));
      reload();
      setModal(null);
    } catch (e2) {
      setErr(e2.message || "Impossible d'enregistrer l'objectif.");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (y) => { setDeleteErr(""); setDeleteTarget(y); };
  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    setDeleteBusy(true); setDeleteErr("");
    try {
      await api.deleteGoalYear(deleteTarget);
      setDeleteTarget(null);
      reload();
    } catch (e2) {
      setDeleteErr(e2.message || "Impossible de supprimer l'objectif.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Objectifs de financement" title="Objectifs par année" sub="Un parcours en paliers mixtes: ex. 2×50K + 1×200K + 1×100K + 4×25K = 500K."
        action={<div className="page-actions"><button className="btn primary" onClick={openCreate}><Plus size={15} /> Nouvel objectif</button></div>} />

      {years.length === 0 ? (
        <div className="panel"><EmptyState icon={Plus} title="Aucun objectif" sub="Définis ton premier objectif de financement." /></div>
      ) : (
        <div className="card-grid">
          {years.map((y) => {
            const tranches = tranchesFor(y);
            const target = tranches.reduce((s, t) => s + t.size * t.count, 0);
            const t = totalsForYear(y);
            const accountsOfYear = accountsAsOfYear(accounts, accountEvents, scalingHistory, y);
            const fundedAccounts = accountsOfYear.filter((a) => a.yearPhase === "funded");
            const fundedCapital = fundedAccounts.reduce((s, a) => s + a.yearSize, 0);
            return (
              <div key={y} className="goal-card">
                <div className="goal-card-top">
                  <div className="goal-year">{y}</div>
                  {tranches.length > 0 && (
                    <div className="card-actions">
                      <button className="icon-btn" onClick={() => openEdit(y)} title="Modifier" aria-label={`Modifier l'objectif ${y}`}>
                        <Pencil size={13} />
                      </button>
                      <button className="icon-btn" onClick={() => requestDelete(y)} title="Supprimer" aria-label={`Supprimer l'objectif ${y}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                {tranches.length > 0 ? (
                  <>
                    <Dial value={fundedCapital} target={target} size={112} />
                    <TrancheStrip tranches={tranches} fundedAccounts={fundedAccounts} />
                    <div className="goal-stats">
                      <div className="goal-stat-row"><span className="dim">Capital financé</span><span style={{ color: "var(--profit)" }}>{fmt(fundedCapital)}</span></div>
                      <div className="goal-stat-row"><span className="dim">Payouts {y}</span><span style={{ color: "var(--profit)" }}>{fmt(t.pay)}</span></div>
                      <div className="goal-stat-row"><span className="dim">Dépenses {y}</span><span style={{ color: "var(--loss)" }}>{fmt(t.exp)}</span></div>
                      <div className="goal-stat-row"><span className="dim">P&L net {y}</span><span style={{ color: t.net >= 0 ? "var(--profit)" : "var(--loss)" }}>{fmtSigned(t.net)}</span></div>
                    </div>
                  </>
                ) : (
                  <div className="goal-no-target">
                    <p className="modal-text">Pas d'objectif défini.</p>
                    <button className="btn primary small" onClick={() => openEdit(y)}>
                      <Plus size={13} /> Définir un objectif
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <GoalModal
          mode={modal.mode}
          year={modal.year}
          initialList={modal.initialList}
          existingYears={yearsWithGoals}
          busy={busy}
          err={err}
          onClose={closeModal}
          onSave={saveGoal}
        />
      )}

      {deleteTarget != null && (
        <DeleteGoalConfirm
          year={deleteTarget}
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