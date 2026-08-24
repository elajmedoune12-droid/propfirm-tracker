import React, { useMemo, lazy, Suspense } from "react";
import { usePageVisible } from "./PageTransition";
import { Receipt, Wallet, Target, TrendingUp, CircleDollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { fmt, fmtSigned } from "../utils/format";
import { accountsAsOfYear } from "../utils/accountHistory";
import { StatCard, Dial, TrancheStrip, TrancheBuilder, EmptyState, PageHeader, BarList, PHASES } from "./ui";

// recharts (~400 ko) est sorti du bundle principal : le graphique se charge
// en tâche de fond pendant que les stats s'affichent.
const MonthlyChart = lazy(() => import("./MonthlyChart"));

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Sélecteur d'année : ‹ 2027 › — permet de naviguer librement, sans limite
// (2028, 2029... ou en arrière sur les années passées).
function YearSwitcher({ year, onChange }) {
  return (
    <div className="year-switcher">
      <button type="button" className="icon-btn" onClick={() => onChange(year - 1)} aria-label="Année précédente"><ChevronLeft size={16} /></button>
      <span className="year-switcher-value">{year}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(year + 1)} aria-label="Année suivante"><ChevronRight size={16} /></button>
    </div>
  );
}

// selectedYear/onChangeYear viennent de App.jsx (et non d'un useState local ici) :
// Dashboard est démonté à chaque changement d'onglet (key={tab} sur PageTransition
// dans App.jsx), donc un état local reviendrait à l'année du jour à chaque retour
// sur l'onglet. En le faisant vivre dans App.jsx, qui ne se démonte jamais, l'année
// choisie reste mémorisée tant que l'appli reste ouverte.
export default function Dashboard({ accounts, expenses, payouts, goalTranches, saveGoalTranches, accountLabel, firms = [], accountEvents = [], scalingHistory = [], selectedYear, onChangeYear }) {
  const yearOf = (d) => Number((d || "").slice(0, 4)) || selectedYear;

  // Comptes tels qu'ils étaient au 31/12 de l'année sélectionnée (phase + taille à
  // cette époque). Un compte funded en 2024 puis breached en 2026 compte comme
  // "funded" pour 2024/2025, et comme "breached" à partir de 2026.
  const accountsAsOfSelectedYear = useMemo(
    () => accountsAsOfYear(accounts, accountEvents, scalingHistory, selectedYear),
    [accounts, accountEvents, scalingHistory, selectedYear]);

  const fundedAccounts = useMemo(() => accountsAsOfSelectedYear.filter((a) => a.yearPhase === "funded"), [accountsAsOfSelectedYear]);
  const fundedCapital = useMemo(() => fundedAccounts.reduce((s, a) => s + a.yearSize, 0), [fundedAccounts]);
  const activeAccounts = useMemo(() => accountsAsOfSelectedYear.filter((a) => a.yearPhase === "phase1" || a.yearPhase === "phase2" || a.yearPhase === "phase3"), [accountsAsOfSelectedYear]);
  const breachedCount = accountsAsOfSelectedYear.filter((a) => a.yearPhase === "breached").length;
  const resolvedCount = fundedAccounts.length + breachedCount;
  const successRate = resolvedCount > 0 ? Math.round((fundedAccounts.length / resolvedCount) * 100) : null;

  const currentYearExp = expenses.filter((e) => yearOf(e.date) === selectedYear).reduce((s, e) => s + Number(e.amount), 0);
  const currentYearPay = payouts.filter((p) => yearOf(p.date) === selectedYear).reduce((s, p) => s + Number(p.amount), 0);
  const currentYearNet = currentYearPay - currentYearExp;
  // ROI de l'année sélectionnée (et non plus all-time), pour rester cohérent avec
  // le capital financé et le taux de réussite qui suivent désormais eux aussi l'année.
  const roi = currentYearExp > 0 ? Math.round(((currentYearPay - currentYearExp) / currentYearExp) * 100) : null;

  const prevYearExp = expenses.filter((e) => yearOf(e.date) === selectedYear - 1).reduce((s, e) => s + Number(e.amount), 0);
  const prevYearPay = payouts.filter((p) => yearOf(p.date) === selectedYear - 1).reduce((s, p) => s + Number(p.amount), 0);
  const prevYearNet = prevYearPay - prevYearExp;
  const netTrend = prevYearNet !== 0 ? Math.round(((currentYearNet - prevYearNet) / Math.abs(prevYearNet)) * 100) : null;

  const yearTranches = goalTranches.filter((g) => g.year === selectedYear);
  const goalTarget = yearTranches.reduce((s, t) => s + t.size * t.count, 0);

  const pageVisible = usePageVisible();
  const monthlyChartData = useMemo(() => MONTHS_FR.map((m, idx) => {
    const exp = expenses.filter((e) => yearOf(e.date) === selectedYear && Number((e.date || "").slice(5, 7)) - 1 === idx).reduce((s, e) => s + Number(e.amount), 0);
    const pay = payouts.filter((p) => yearOf(p.date) === selectedYear && Number((p.date || "").slice(5, 7)) - 1 === idx).reduce((s, p) => s + Number(p.amount), 0);
    return { month: m, "Dépenses": exp, "Payouts": pay, "Net": pay - exp };
  }), [expenses, payouts, selectedYear]);

  const recentActivity = useMemo(() => {
    const acts = [...expenses.map((e) => ({ ...e, kind: "expense" })), ...payouts.map((p) => ({ ...p, kind: "payout" }))];
    return acts.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  }, [expenses, payouts]);

  const phaseBreakdown = useMemo(() => PHASES.map((p) => ({
    label: p.label,
    value: accountsAsOfSelectedYear.filter((a) => a.yearPhase === p.id).length,
    display: `${accountsAsOfSelectedYear.filter((a) => a.yearPhase === p.id).length}`,
    color: p.color,
  })).filter((p) => p.value > 0), [accountsAsOfSelectedYear]);

  const firmBreakdown = useMemo(() => {
    const byFirm = {};
    fundedAccounts.forEach((a) => {
      const name = firms.find((f) => f.id === a.firm_id)?.name || "Autre";
      byFirm[name] = (byFirm[name] || 0) + Number(a.yearSize || 0);
    });
    return Object.entries(byFirm)
      .map(([label, value]) => ({ label, value, display: fmt(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [fundedAccounts, firms]);

  return (
    <div className="tab-content">
      <PageHeader
        eyebrow="Année"
        title="Tableau de bord"
        sub="Vue d'ensemble de tes comptes prop firm."
        action={<YearSwitcher year={selectedYear} onChange={onChangeYear} />}
      />

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Capital financé" value={fmt(fundedCapital)} sub={`${fundedAccounts.length}/${accountsAsOfSelectedYear.length} compte(s) · ${activeAccounts.length} actif(s)`} />
        <StatCard icon={Target} label="Taux de réussite" value={successRate === null ? "—" : `${successRate}%`} sub={`${fundedAccounts.length} financé(s) / ${breachedCount} échoué(s)`} />
        <StatCard icon={TrendingUp} label="ROI (année)" value={roi === null ? "—" : `${roi >= 0 ? "+" : ""}${roi}%`} accent={roi >= 0 ? "#35D28A" : "#F2496B"} sub={`${fmt(currentYearPay)} reçus / ${fmt(currentYearExp)} investis`} />
        <StatCard icon={CircleDollarSign} label="P&L net (année)" value={fmtSigned(currentYearNet)} accent={currentYearNet >= 0 ? "#35D28A" : "#F2496B"} trend={netTrend} />
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-header"><span>Dépenses vs Payouts — {selectedYear}</span></div>
          <div className="chart-box">
            {pageVisible ? (
              <Suspense fallback={<div className="chart-loading skeleton-pulse" />}>
                <MonthlyChart data={monthlyChartData} />
              </Suspense>
            ) : (
              // Page masquée (display:none) : on ne monte pas le graphique,
              // sinon recharts mesure 0×0 et logge des warnings en boucle.
              <div className="chart-loading skeleton-pulse" />
            )}
          </div>
        </div>

        <div className="panel goal-panel">
          <div className="panel-header"><span>Objectif de financement {selectedYear}</span></div>
          {yearTranches.length > 0 ? (
            <div className="goal-dial-block">
              <Dial value={fundedCapital} target={goalTarget} />
              <TrancheStrip tranches={yearTranches} fundedAccounts={fundedAccounts} />
              <div className="goal-dial-caption">{fmt(fundedCapital)} financé sur {fmt(goalTarget)}</div>
            </div>
          ) : (
            <div className="goal-set-inline">
              <p className="modal-text">Aucun objectif pour {selectedYear}. Ex: 2×50K + 1×200K + 1×100K + 4×25K = 500K.</p>
              <TrancheBuilder onSave={(list) => saveGoalTranches(selectedYear, list)} />
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid-secondary">
        <div className="panel">
          <div className="panel-header"><span>Comptes par phase</span></div>
          <BarList items={phaseBreakdown} emptyLabel="Ajoute un compte pour voir la répartition." />
        </div>
        <div className="panel">
          <div className="panel-header"><span>Capital par firme</span><span className="panel-header-sub">Comptes financés uniquement</span></div>
          <BarList items={firmBreakdown} emptyLabel="Aucun compte financé pour l'instant." />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span>Activité récente</span></div>
        {recentActivity.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune activité" sub="Ajoute une dépense ou un payout pour commencer." />
        ) : (
          <div className="act-list">
            {recentActivity.map((a) => {
              const isPay = a.kind === "payout";
              const Icon = isPay ? CircleDollarSign : Receipt;
              return (
                <div className="act-row" key={a.id}>
                  <span className={"act-icon " + (isPay ? "pay" : "exp")}><Icon size={13} /></span>
                  <div className="act-main">
                    <div className="act-title">{isPay ? accountLabel(a.account_id) : (a.description || a.category)}</div>
                    <div className="act-sub">{a.date} · {isPay ? "Payout" : (a.category || "Dépense")}</div>
                  </div>
                  <span className={"act-amt " + (isPay ? "good" : "bad")}>{isPay ? "+" : "-"}{fmt(a.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}