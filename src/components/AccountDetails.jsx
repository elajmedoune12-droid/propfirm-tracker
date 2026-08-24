import React from "react";
import { X, Building2, TrendingUp, KeyRound, History, Wallet, Receipt, Copy, CheckCircle2 } from "lucide-react";
import { fmt, fmtSigned, daysUntil, addMonths, todayStr, nextPayoutDate } from "../utils/format";
import { toast } from "./Toast";
import { AccountStatus, ChallengeTag, AssetTag, PhaseBadge } from "./ui";

const FREQ_LABELS = {
  weekly: "Hebdomadaire",
  bi_weekly: "Toutes les 2 semaines",
  monthly: "Mensuelle",
  on_demand: "À la demande",
  other: "Autre",
};
const freqLabel = (f) => FREQ_LABELS[f] || f || "—";

export default function AccountDetails({ account: a, firm, payoutsForAccount, expensesForAccount, scalingHistory, onClose, onEdit }) {
  if (!a) return null;

  const dLeft = a.challenge_deadline ? daysUntil(a.challenge_deadline) : null;
  const nextScale = a.scaling_enabled ? addMonths(a.last_scale_date || a.purchase_date, a.scaling_interval_months) : null;
  const scaleDue = nextScale && nextScale <= todayStr();
  const hasCreds = !!(a.login || a.platform || a.server);
  // Même logique que sur la carte : le cycle de payout démarre au 1er trade
  // sur le compte financé, pas à la date où il est devenu "funded".
  const lastPayoutDate = payoutsForAccount.reduce((max, p) => (!max || p.date > max ? p.date : max), null);
  const cycleAnchor = a.trading_start_date && (!lastPayoutDate || a.trading_start_date > lastPayoutDate)
    ? a.trading_start_date : null;
  const nextPayout = a.phase === "funded" ? nextPayoutDate(cycleAnchor, a.payout_frequency) : null;
  const payoutDLeft = nextPayout ? daysUntil(nextPayout) : null;

  // --- Rentabilité ---
  const totalPayouts = payoutsForAccount.reduce((s, p) => s + Number(p.amount), 0);
  const otherExpenses = (expensesForAccount || []).filter((e) => e.category !== "Achat challenge");
  const otherExpensesTotal = otherExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalInvested = Number(a.cost || 0) + otherExpensesTotal;
  const net = totalPayouts - totalInvested;
  const refundThreshold = firm?.refund_after_payouts || null;
  const reimbursed = refundThreshold
    ? payoutsForAccount.length >= refundThreshold
    : totalInvested > 0 && totalPayouts >= totalInvested;
  const roi = totalInvested > 0 ? Math.round((net / totalInvested) * 1000) / 10 : null;

  // --- Drawdown global : barre de consommation de la limite ---
  const ddCur = a.current_drawdown_pct != null && a.current_drawdown_pct !== "" ? Number(a.current_drawdown_pct) : null;
  const ddMax = a.max_drawdown_limit_pct ? Number(a.max_drawdown_limit_pct) : null;
  const ddRatio = ddCur != null && ddMax ? Math.min(1, Math.max(0, ddCur / ddMax)) : null;

  const copyValue = (text, label) =>
    navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copié`)).catch(() => {});

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={17} /> {firm ? firm.name : "—"} — {fmt(a.size)}
          </span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tag-row" style={{ marginBottom: 14 }}>
          <PhaseBadge phase={a.phase} />
          <ChallengeTag challengeType={a.challenge_type} />
          <AssetTag assetClass={a.asset_class} />
          {a.payout_split_pct > 0 && <span className="tag" style={{ "--c": "#35D28A" }}>{a.payout_split_pct}% split</span>}
        </div>

        {a.phase !== "funded" && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <AccountStatus challengeType={a.challenge_type} phase={a.phase} />
          </div>
        )}

        {/* Rentabilité — la partie la plus demandée */}
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="settings-label"><Wallet size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Rentabilité</div>
          {(refundThreshold || totalInvested > 0) && reimbursed && (
            <div className="reimbursed-banner" style={{ marginBottom: 10 }}>
              <CheckCircle2 size={15} />
              {refundThreshold
                ? `Frais remboursés (${payoutsForAccount.length}/${refundThreshold} payouts reçus)`
                : "Coût total remboursé par les payouts"}
            </div>
          )}
          <div className="stat-grid compact">
            <MiniStat label="Investi au total" value={fmt(totalInvested)} />
            <MiniStat label="Payouts reçus" value={fmt(totalPayouts)} accent="var(--profit)" />
            <MiniStat label="Net" value={fmtSigned(net)} accent={net >= 0 ? "var(--profit)" : "var(--loss)"} />
            <MiniStat label="ROI" value={roi != null ? `${roi >= 0 ? "+" : ""}${roi}%` : "—"} accent={roi != null ? (roi >= 0 ? "var(--profit)" : "var(--loss)") : undefined} />
          </div>
          {!reimbursed && (
            <p className="empty-sub" style={{ marginTop: 10, marginBottom: 0 }}>
              {refundThreshold
                ? `${payoutsForAccount.length}/${refundThreshold} payouts reçus avant remboursement des frais.`
                : totalInvested === 0
                  ? "Aucun coût enregistré pour ce compte."
                  : `Reste ${fmt(totalInvested - totalPayouts)} à récupérer pour rembourser le coût initial.`}
            </p>
          )}
        </div>

        <div className="settings-grid" style={{ marginBottom: 14 }}>
          <div className="panel">
            <div className="settings-label">Infos générales</div>
            <div className="bar-list">
              <Row label="Taille actuelle" value={fmt(a.size)} />
              {a.initial_size && a.size !== a.initial_size && <Row label="Taille initiale" value={fmt(a.initial_size)} />}
              <Row label="Coût d'achat" value={fmt(a.cost || 0)} />
              <Row label="Date d'achat" value={a.purchase_date || "—"} />
              {a.challenge_deadline && (
                <Row
                  label="Deadline challenge"
                  value={
                    <span className={dLeft != null ? (dLeft < 0 ? "val-bad" : dLeft <= 7 ? "val-warn" : "") : ""}>
                      {a.challenge_deadline}
                      {dLeft != null ? ` (${dLeft >= 0 ? `${dLeft}j restants` : "dépassée"})` : ""}
                    </span>
                  }
                />
              )}
              {a.trading_start_date && <Row label="1er trade (financé)" value={a.trading_start_date} />}
            </div>
          </div>

          <div className="panel">
            <div className="settings-label">Risque</div>
            <div className="bar-list">
              <Row label="Drawdown quotidien max" value={a.daily_drawdown_limit_pct ? `${a.daily_drawdown_limit_pct}%` : "—"} />
              <div className="bar-list-top">
                <span className="bar-list-label">Drawdown global utilisé</span>
                <span className={"bar-list-value" + (ddRatio >= 1 ? " val-bad" : ddRatio >= .7 ? " val-warn" : "")}>
                  {ddCur != null && ddMax ? `${ddCur}% / ${ddMax}%` : ddMax ? `limite ${ddMax}%` : "—"}
                </span>
              </div>
              {ddRatio != null && (
                <div className="firm-bar small">
                  <div className={"firm-bar-fill" + (ddRatio >= 1 ? " over" : "")} style={{ width: `${ddRatio * 100}%` }} />
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="settings-label">Payout</div>
            <div className="bar-list">
              <Row label="Split" value={a.payout_split_pct ? `${a.payout_split_pct}%` : "—"} />
              <Row label="Fréquence" value={freqLabel(a.payout_frequency)} />
              <Row label="Total reçu" value={<span className="val-good">{fmt(totalPayouts)}</span>} />
              <Row label="Nombre de payouts" value={payoutsForAccount.length} />
              {a.phase === "funded" && (
                <Row
                  label="Prochain payout"
                  value={
                    nextPayout ? (
                      <span className={payoutDLeft === 0 || payoutDLeft === 1 ? "val-good" : ""}>
                        {nextPayout}
                        {payoutDLeft === 0 ? " (aujourd'hui)" : payoutDLeft === 1 ? " (demain)" : payoutDLeft > 1 ? ` (dans ${payoutDLeft}j)` : ""}
                      </span>
                    ) : (a.trading_start_date ? "Payout reçu — relance un trade" : "Aucun trade lancé")
                  }
                />
              )}
            </div>
          </div>

          <div className="panel">
            <div className="settings-label">Scaling</div>
            {a.scaling_enabled ? (
              <div className="bar-list">
                <Row label="Augmentation" value={`${a.scaling_pct}% tous les ${a.scaling_interval_months} mois`} />
                <Row label="Dernier scaling" value={a.last_scale_date || "Jamais"} />
                <Row
                  label="Prochain scaling"
                  value={
                    nextScale ? (
                      <>
                        {nextScale}
                        {scaleDue && <> <span className="val-good">(disponible)</span></>}
                      </>
                    ) : "—"
                  }
                />
              </div>
            ) : (
              <div className="empty-sub">Pas de plan de scaling sur ce compte.</div>
            )}
          </div>
        </div>

        {hasCreds && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="settings-label"><KeyRound size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Identifiants</div>
            <div className="bar-list">
              {a.login && (
                <Row
                  label="Login"
                  value={<>{a.login}<button className="row-copy" title="Copier le login" aria-label="Copier le login" onClick={() => copyValue(a.login, "Login")}><Copy size={12} /></button></>}
                />
              )}
              {a.platform && <Row label="Plateforme" value={a.platform} />}
              {a.server && (
                <Row
                  label="Serveur"
                  value={<>{a.server}<button className="row-copy" title="Copier le serveur" aria-label="Copier le serveur" onClick={() => copyValue(a.server, "Serveur")}><Copy size={12} /></button></>}
                />
              )}
            </div>
            <p className="empty-sub" style={{ marginTop: 8 }}>Le mot de passe reste chiffré — révèle-le depuis la carte du compte (cadenas).</p>
          </div>
        )}

        {otherExpenses.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="settings-label"><Receipt size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Autres dépenses liées (resets, abonnements...)</div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th className="num">Montant</th></tr></thead>
                <tbody>
                  {[...otherExpenses].sort((x, y) => (x.date < y.date ? 1 : -1)).map((e) => (
                    <tr key={e.id}><td>{e.date}</td><td className="dim ellipsis-cell" title={e.description}>{e.description}</td><td className="num">{fmt(e.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td>Total</td><td /><td className="num">{fmt(otherExpensesTotal)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {payoutsForAccount.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="settings-label"><TrendingUp size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Historique des payouts</div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th className="num">Montant</th></tr></thead>
                <tbody>
                  {[...payoutsForAccount].sort((x, y) => (x.date < y.date ? 1 : -1)).map((p) => (
                    <tr key={p.id}><td>{p.date}</td><td className="num val-good">{fmt(p.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td>Total</td><td className="num">{fmt(totalPayouts)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {scalingHistory && scalingHistory.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="settings-label"><History size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Historique de scaling</div>
            <div className="scaling-history">
              {scalingHistory.map((h, i) => (
                <div key={i} className="scaling-row">{h.applied_at || h.date} — {fmt(h.old_size)} → {fmt(h.new_size)}</div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Fermer</button>
          <button className="btn primary" onClick={() => { onClose(); onEdit(a); }}>Modifier ce compte</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="bar-list-top">
      <span className="bar-list-label">{label}</span>
      <span className="bar-list-value">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="stat-card" style={{ padding: "10px 12px" }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 16, marginTop: 4, ...(accent ? { color: accent } : {}) }}>{value}</div>
    </div>
  );
}
