import React, { useState, useEffect, useMemo } from "react";
import { Wallet, Target, TrendingUp, AlertTriangle, Plus, Trash2, CheckCircle2, Loader2, Flag, ChevronDown, Pencil, Settings as SettingsIcon } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { fmt, fmtSigned } from "../utils/format";
import { StatCard, Dial, PageHeader, FieldRow, EmptyState } from "./ui";
import * as api from "../lib/api";

export default function PersonalAccount() {
  const [account, setAccount] = useState(undefined);
  const [history, setHistory] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const [acc, hist, ms] = await Promise.all([
      api.getPersonalAccount(),
      api.listBalanceHistory(),
      api.listMilestones(),
    ]);
    setAccount(acc || null);
    setHistory(hist);
    setMilestones(ms);
    setLoaded(true);
  };

  useEffect(() => { reload(); }, []);

  if (!loaded) return <div className="loading-screen">Chargement…</div>;
  if (!account) return <SetupForm onDone={reload} />;

  return <AccountView account={account} history={history} milestones={milestones} reload={reload} />;
}

/* --- Formulaire de première configuration --- */
function SetupForm({ onDone }) {
  const [startingBalance, setStartingBalance] = useState("");
  const [targetBalance, setTargetBalance] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("20");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.upsertPersonalAccount({
        starting_balance: Number(startingBalance),
        current_balance: Number(startingBalance),
        peak_balance: Number(startingBalance),
        target_balance: Number(targetBalance) || 0,
        monthly_target: Number(monthlyTarget) || 0,
        max_drawdown_pct: Number(maxDrawdown) || 20,
      });
      await api.addBalanceEntry(Number(startingBalance), "Solde de départ", null, 0, 0);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-page">
      <PageHeader eyebrow="Compte propre" title="Configure ton compte" sub="Ton propre capital, séparé des comptes prop firm." />
      <div className="panel form-panel" style={{ maxWidth: 480 }}>
        <form onSubmit={submit} className="auth-form">
          <label>Solde de départ ($)
            <input className="input" type="number" required value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
          </label>
          <label>Objectif final ($)
            <input className="input" type="number" placeholder="ex: 10000" value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} />
          </label>
          <label>Objectif de profit mensuel (%)
            <input className="input" type="number" step="0.1" placeholder="ex: 10" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} />
          </label>
          <label>Drawdown max toléré (%)
            <input className="input" type="number" value={maxDrawdown} onChange={(e) => setMaxDrawdown(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !startingBalance}>
            {busy ? <Loader2 size={14} className="spin" /> : null} Créer mon suivi
          </button>
        </form>
      </div>
    </div>
  );
}

/* Recalcule la chaîne des soldes dans l'ordre chronologique à partir du
   solde de départ. Nécessaire dès qu'une entrée passée est modifiée, pour
   que toutes les entrées suivantes restent cohérentes. */
function recomputeChain(history, startingBalance) {
  const sorted = [...history].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    return a.created_at < b.created_at ? -1 : 1;
  });
  let equity = Number(startingBalance);
  let peak = equity;
  const recalculated = sorted.map((h) => {
    equity += Number(h.weekly_pnl || 0) + Number(h.deposit_amount || 0);
    if (equity > peak) peak = equity;
    return { ...h, balance: equity };
  });
  return { recalculated, finalBalance: equity, peakBalance: peak };
}

/* Regroupe l'historique par mois calendaire, avec le solde de départ de
   chaque mois (pour calculer l'objectif en $ propre à ce mois précis),
   puis regroupe ces mois par année pour un résumé annuel. */
function computeMonthlyStats(history, startingBalance, monthlyTargetPct) {
  const sorted = [...history].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
  let equity = Number(startingBalance);
  const byMonth = {};

  for (const h of sorted) {
    const ym = h.entry_date.slice(0, 7); // "2026-07"
    if (!byMonth[ym]) byMonth[ym] = { ym, startBalance: equity, profit: 0, deposits: 0 };
    byMonth[ym].profit += Number(h.weekly_pnl || 0);
    byMonth[ym].deposits += Number(h.deposit_amount || 0);
    equity += Number(h.weekly_pnl || 0) + Number(h.deposit_amount || 0);
  }

  const months = Object.values(byMonth)
    .map((m) => {
      const targetAmount = monthlyTargetPct > 0 ? (m.startBalance * monthlyTargetPct) / 100 : 0;
      return {
        ...m,
        targetAmount,
        hit: monthlyTargetPct > 0 ? m.profit >= targetAmount : null,
      };
    })
    .sort((a, b) => (a.ym < b.ym ? 1 : -1)); // plus récent d'abord

  const byYear = {};
  for (const m of months) {
    const year = m.ym.slice(0, 4);
    if (!byYear[year]) byYear[year] = { year, months: [], totalProfit: 0, hitCount: 0, trackedCount: 0 };
    byYear[year].months.push(m);
    byYear[year].totalProfit += m.profit;
    if (m.hit !== null) {
      byYear[year].trackedCount += 1;
      if (m.hit) byYear[year].hitCount += 1;
    }
  }

  return Object.values(byYear).sort((a, b) => (a.year < b.year ? 1 : -1));
}

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${y}`;
}

/* --- Vue principale une fois configuré --- */
function AccountView({ account, history, milestones, reload }) {
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Le drawdown ne reflète que la performance de trading (weekly_pnl) :
  // les dépôts, retraits et corrections manuelles n'y entrent jamais.
  const drawdownPct = useMemo(() => {
    const sorted = [...history].sort((a, b) => (a.entry_date > b.entry_date ? 1 : -1));
    let equity = Number(account.starting_balance);
    let peak = equity;
    for (const h of sorted) {
      equity += Number(h.weekly_pnl || 0);
      if (equity > peak) peak = equity;
    }

    return peak > 0 ? Math.max(0, Math.round(((peak - equity) / peak) * 1000) / 10) : 0;
  }, [history, account.starting_balance]);
  const drawdownBreached = drawdownPct >= account.max_drawdown_pct;

  const now = new Date();
  const monthEntries = history.filter((h) => {
    const d = new Date(h.entry_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthlyProfit = monthEntries.reduce((s, h) => s + Number(h.weekly_pnl || 0), 0);
  const monthlyDeposits = monthEntries.reduce((s, h) => s + Number(h.deposit_amount || 0), 0);

  const totalProfit = history.reduce((s, h) => s + Number(h.weekly_pnl || 0), 0);
  const totalDeposits = history.reduce((s, h) => s + Number(h.deposit_amount || 0), 0);
  const monthlyTargetAmount = (account.current_balance - monthlyProfit - monthlyDeposits) * account.monthly_target / 100;

  const chartData = useMemo(
    () => [...history].sort((a, b) => (a.entry_date > b.entry_date ? 1 : -1)).map((h) => ({ date: h.entry_date.slice(5), balance: h.balance })),
    [history]
  );

  /* Applique un edit/ajout/suppression, recalcule la chaîne complète, et
     persiste les nouveaux soldes + le solde/pic du compte. */
  const applyAndRecompute = async (updatedHistory) => {
    const { recalculated, finalBalance, peakBalance } = recomputeChain(updatedHistory, account.starting_balance);
    await Promise.all(recalculated.map((h) => api.updateBalanceEntry(h.id, { balance: h.balance })));
    await api.upsertPersonalAccount({ current_balance: finalBalance, peak_balance: peakBalance });
    reload();
  };

  return (
    <div className="profile-page">
      <PageHeader
        eyebrow="Compte propre"
        title="Mon compte"
        sub="Ton capital personnel, tes objectifs et ta gestion du risque — mis à jour chaque semaine."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => setShowSettings(true)}>
              <SettingsIcon size={14} /> Réglages
            </button>
            <button className="btn primary" onClick={() => setShowAddWeek(true)}>
              <Plus size={14} /> Nouvelle semaine
            </button>
          </div>
        }
      />

      {drawdownBreached && (
        <div className="status-banner status-breached">
          <AlertTriangle size={15} />
          <span>Drawdown de {drawdownPct}% — au-delà de ta limite de {account.max_drawdown_pct}%. Fais une pause.</span>
        </div>
      )}

      <div className="stat-grid">
        <StatCard label="Solde actuel" value={fmt(account.current_balance)} icon={Wallet} />
        <StatCard label="Profit total (trading)" value={fmtSigned(totalProfit)} sub={totalDeposits !== 0 ? `Hors ${fmt(totalDeposits)} de dépôts/retraits` : null} accent={totalProfit >= 0 ? "var(--profit)" : "var(--loss)"} icon={TrendingUp} />
        <StatCard
          label="Ce mois-ci"
          value={fmtSigned(monthlyProfit)}
          sub={
            account.monthly_target > 0
              ? (monthlyTargetAmount > 0 && monthlyProfit >= monthlyTargetAmount
                  ? "✅ Objectif atteint"
                  : `Objectif : ${account.monthly_target}% (${fmt(monthlyTargetAmount)})`)
              : (monthlyDeposits !== 0 ? `Dépôts/retraits : ${fmt(monthlyDeposits)}` : null)
          }
          accent={monthlyProfit >= 0 ? "var(--profit)" : "var(--loss)"}
          icon={Target}
        />
        <StatCard
          label="Drawdown actuel"
          value={`${drawdownPct}%`}
          sub={`Limite : ${account.max_drawdown_pct}%`}
          accent={drawdownBreached ? "var(--loss)" : "var(--text)"}
          icon={AlertTriangle}
        />
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-header">Évolution du solde</div>
          {chartData.length > 1 ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} tickFormatter={(v) => fmt(v)} width={70} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => fmt(v)}
                  />
                  <Line type="monotone" dataKey="balance" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Wallet} title="Pas encore assez de données" sub="Ajoute quelques semaines pour voir la courbe." />
          )}
        </div>

        <div className="panel goal-panel">
          <div className="panel-header">Objectif final</div>
          {account.target_balance > 0 ? (
            <div className="goal-dial-block">
              <Dial value={account.current_balance} target={account.target_balance} />
              <div className="goal-dial-caption">{fmt(account.current_balance)} sur {fmt(account.target_balance)}</div>
            </div>
          ) : (
            <EmptyState icon={Target} title="Aucun objectif défini" sub={'Clique sur "Réglages" pour en ajouter un.'} />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          Paliers de progression
          <button className="btn ghost small" onClick={() => setShowAddMilestone(true)}><Plus size={13} /> Ajouter un palier</button>
        </div>
        <MilestoneList milestones={milestones} currentBalance={account.current_balance} reload={reload} />
      </div>

      <div className="panel">
        <BalanceHistoryTable history={history} reload={reload} onEdit={setEditingEntry} />
      </div>

      {showAddWeek && (
        <AddWeekModal
          account={account}
          onClose={() => setShowAddWeek(false)}
          onDone={() => { setShowAddWeek(false); reload(); }}
        />
      )}

      {editingEntry && (
        <EditWeekModal
          entry={editingEntry}
          history={history}
          onClose={() => setEditingEntry(null)}
          onDone={async (updatedEntryPatch) => {
            const updatedHistory = history.map((h) => (h.id === editingEntry.id ? { ...h, ...updatedEntryPatch } : h));
            setEditingEntry(null);
            await applyAndRecompute(updatedHistory);
          }}
        />
      )}

      {showSettings && (
        <AccountSettingsModal
          account={account}
          history={history}
          onClose={() => setShowSettings(false)}
          onDone={async (newStartingBalance) => {
            setShowSettings(false);
            const { recalculated, finalBalance, peakBalance } = recomputeChain(history, newStartingBalance);
            await Promise.all(recalculated.map((h) => api.updateBalanceEntry(h.id, { balance: h.balance })));
            await api.upsertPersonalAccount({ current_balance: finalBalance, peak_balance: peakBalance });
            reload();
          }}
        />
      )}

      {showAddMilestone && (
        <AddMilestoneModal
          nextOrder={milestones.length}
          onClose={() => setShowAddMilestone(false)}
          onDone={() => { setShowAddMilestone(false); reload(); }}
        />
      )}
    </div>
  );
}

function MilestoneList({ milestones, currentBalance, reload }) {
  const attempted = React.useRef(new Set());

  useEffect(() => {
    const newlyReached = milestones.filter(
      (m) => !m.achieved_at && currentBalance >= m.target_balance && !attempted.current.has(m.id)
    );
    if (newlyReached.length > 0) {
      newlyReached.forEach((m) => attempted.current.add(m.id));
      Promise.all(newlyReached.map((m) => api.markMilestoneAchieved(m.id, true))).then(reload);
    }
  }, [milestones, currentBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (milestones.length === 0) {
    return <EmptyState icon={Flag} title="Aucun palier" sub="Définis des étapes intermédiaires vers ton objectif." />;
  }
  return (
    <div className="bar-list">
      {milestones.map((m) => {
        const reached = currentBalance >= m.target_balance;
        return (
          <div key={m.id} className="scaling-row" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {reached ? <CheckCircle2 size={15} color="var(--profit)" /> : <Flag size={15} />}
              {m.label} — {fmt(m.target_balance)}
              {m.achieved_at && (
                <span className="empty-sub" style={{ marginLeft: 4 }}>
                  (atteint le {new Date(m.achieved_at).toLocaleDateString("fr-FR")})
                </span>
              )}
            </span>
            <button className="icon-btn" onClick={() => api.removeMilestone(m.id).then(reload)}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* Historique hebdomadaire — potentiellement long : affiche 8 semaines par
   défaut (les plus récentes), avec un bouton pour en révéler davantage.
   Chaque ligne a maintenant son propre bouton "Modifier". */
const PAGE_SIZE = 8;

function MonthlyPerformancePanel({ history, account }) {
  const years = useMemo(
    () => computeMonthlyStats(history, account.starting_balance, account.monthly_target),
    [history, account.starting_balance, account.monthly_target]
  );

  if (years.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">Performance mensuelle</div>
        <EmptyState icon={Target} title="Pas encore de données" sub="Ajoute quelques semaines pour voir ta performance mois par mois." />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">Performance mensuelle</div>
      <div className="tab-content" style={{ gap: 18 }}>
        {years.map((y) => (
          <div key={y.year}>
            <div className="bar-list-top" style={{ marginBottom: 8 }}>
              <span className="bar-list-label" style={{ fontWeight: 700, fontSize: 13 }}>{y.year}</span>
              <span className="bar-list-value">
                {fmtSigned(y.totalProfit)}
                {y.trackedCount > 0 && ` — ${y.hitCount}/${y.trackedCount} mois réussis`}
              </span>
            </div>
            <div className="bar-list">
              {y.months.map((m) => (
                <div key={m.ym} className="scaling-row" style={{ justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.hit === true && <CheckCircle2 size={14} color="var(--profit)" />}
                    {m.hit === false && <AlertTriangle size={14} color="var(--loss)" />}
                    {monthLabel(m.ym)}
                  </span>
                  <span className="num" style={{ color: m.profit >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {fmtSigned(m.profit)}
                    {m.targetAmount > 0 && <span className="dim" style={{ marginLeft: 6, fontWeight: 400 }}>/ {fmt(m.targetAmount)}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceHistoryTable({ history, reload, onEdit }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () => [...history].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [history]
  );
  const visible = sorted.slice(0, visibleCount);
  const remaining = sorted.length - visible.length;

  return (
    <>
      <div className="panel-header">
        Historique hebdomadaire
        <span className="empty-sub">{history.length} semaine{history.length !== 1 ? "s" : ""}</span>
      </div>
      {history.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucune entrée" sub={'Ajoute ta première semaine avec le bouton "Nouvelle semaine".'} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Semaine du</th>
                  <th className="num">Résultat</th>
                  <th className="num">Dépôt/retrait</th>
                  <th className="num">Solde</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((h) => (
                  <tr key={h.id}>
                    <td>{h.entry_date}</td>
                    <td className="num" style={{ color: Number(h.weekly_pnl) > 0 ? "var(--profit)" : Number(h.weekly_pnl) < 0 ? "var(--loss)" : undefined }}>
                      {h.weekly_pnl ? fmtSigned(h.weekly_pnl) : "—"}
                    </td>
                    <td className="num dim">{Number(h.deposit_amount) !== 0 ? fmtSigned(h.deposit_amount) : "—"}</td>
                    <td className="num">{fmt(h.balance)}</td>
                    <td className="dim">{h.note || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => onEdit(h)} title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => api.removeBalanceEntry(h.id).then(reload)} title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {remaining > 0 && (
            <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              <ChevronDown size={13} /> Afficher {Math.min(remaining, PAGE_SIZE)} semaine(s) de plus ({remaining} restantes)
            </button>
          )}
        </>
      )}
    </>
  );
}

function AddWeekModal({ account, onClose, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pnl, setPnl] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const pnlNum = Number(pnl) || 0;
  const depositNum = Number(deposit) || 0;
  const newBalance = Number(account.current_balance) + pnlNum + depositNum;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.addBalanceEntry(newBalance, note, date, depositNum, pnlNum);
      const newPeak = Math.max(account.peak_balance, newBalance);
      await api.upsertPersonalAccount({ current_balance: newBalance, peak_balance: newPeak });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Nouvelle semaine</div>
        <form onSubmit={submit} className="form-panel">
          <label>Semaine du<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>
            Résultat de la semaine ($)
            <input className="input" type="number" placeholder="ex: 250 ou -120" required value={pnl} onChange={(e) => setPnl(e.target.value)} />
          </label>
          <p className="empty-sub" style={{ margin: 0 }}>Positif si semaine gagnante, négatif si semaine perdante.</p>
          <label>
            Dépôt/retrait pendant la semaine ($)
            <input className="input" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </label>
          <p className="empty-sub" style={{ margin: 0 }}>Positif pour un dépôt, négatif pour un retrait. Laisse à 0 sinon.</p>
          <label>Note (optionnel)<input className="input" placeholder="ex: semaine volatile sur l'or" value={note} onChange={(e) => setNote(e.target.value)} /></label>

          <div className="firm-row" style={{ marginTop: 4 }}>
            <div className="firm-row-top">
              <span className="dim" style={{ fontSize: 12 }}>Nouveau solde</span>
              <span className="num" style={{ fontWeight: 700, color: newBalance >= account.current_balance ? "var(--profit)" : "var(--loss)" }}>
                {fmt(newBalance)}
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
            <button className="btn primary" type="submit" disabled={busy || pnl === ""}>
              {busy ? <Loader2 size={14} className="spin" /> : null} Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Modifie une entrée existante de l'historique. Recalcule ensuite toute la
   chaîne des soldes (géré par le parent via applyAndRecompute) pour que les
   semaines suivantes restent cohérentes. */
function EditWeekModal({ entry, onClose, onDone }) {
  const [date, setDate] = useState(entry.entry_date);
  const [pnl, setPnl] = useState(entry.weekly_pnl ?? 0);
  const [deposit, setDeposit] = useState(entry.deposit_amount ?? 0);
  const [note, setNote] = useState(entry.note || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const patch = {
        entry_date: date,
        weekly_pnl: Number(pnl) || 0,
        deposit_amount: Number(deposit) || 0,
        note: note || null,
      };
      await api.updateBalanceEntry(entry.id, patch);
      await onDone(patch);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Modifier cette semaine</div>
        <form onSubmit={submit} className="form-panel">
          <label>Semaine du<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Résultat de la semaine ($)<input className="input" type="number" value={pnl} onChange={(e) => setPnl(e.target.value)} /></label>
          <label>Dépôt/retrait ($)<input className="input" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></label>
          <label>Note (optionnel)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <p className="empty-sub" style={{ margin: 0 }}>
            Le solde de cette semaine et de toutes les semaines suivantes sera recalculé automatiquement.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : null} Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Réglages du compte : objectif final, objectif mensuel, drawdown max,
   et solde de départ (utilisé comme référence pour le calcul du drawdown). */
function AccountSettingsModal({ account, onClose, onDone }) {
  const [targetBalance, setTargetBalance] = useState(account.target_balance || "");
  const [monthlyTarget, setMonthlyTarget] = useState(account.monthly_target || "");
  const [maxDrawdown, setMaxDrawdown] = useState(account.max_drawdown_pct ?? 20);
  const [startingBalance, setStartingBalance] = useState(account.starting_balance ?? 0);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const newStarting = Number(startingBalance) || 0;
      await api.upsertPersonalAccount({
        target_balance: Number(targetBalance) || 0,
        monthly_target: Number(monthlyTarget) || 0,
        max_drawdown_pct: Number(maxDrawdown) || 0,
        starting_balance: newStarting,
      });
      await onDone(newStarting);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Réglages du compte</div>
        <form onSubmit={submit} className="form-panel">
          <label>Objectif final ($)
            <input className="input" type="number" placeholder="ex: 10000" value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} />
          </label>
          <label>Objectif de profit mensuel (%)
            <input className="input" type="number" step="0.1" placeholder="ex: 10" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} />
          </label>
          <label>Drawdown max toléré (%)
            <input className="input" type="number" value={maxDrawdown} onChange={(e) => setMaxDrawdown(e.target.value)} />
          </label>
          <label>Solde de départ ($)
            <input className="input" type="number" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
          </label>
          <p className="empty-sub" style={{ margin: 0 }}>
            Le solde de départ sert de référence pour ton profit total et ton drawdown — ne le change que si la valeur initiale était incorrecte.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : null} Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMilestoneModal({ nextOrder, onClose, onDone }) {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createMilestone(label, target, nextOrder);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Nouveau palier</div>
        <form onSubmit={submit} className="form-panel">
          <label>Nom du palier<input className="input" required placeholder="ex: Étape 1" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <label>Solde à atteindre ($)<input className="input" type="number" required value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : null} Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}