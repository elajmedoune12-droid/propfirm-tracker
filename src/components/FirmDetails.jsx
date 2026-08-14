import React from "react";
import { X, Building2, Globe, MessageCircle, StickyNote, ShieldAlert, RotateCcw, Wallet, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmt } from "../utils/format";
import { PhaseBadge, ChallengeTag, AssetTag } from "./ui";

export default function FirmDetails({ firm, accounts, onClose, onEdit }) {
  if (!firm) return null;

  const alloc = accounts.filter((a) => a.phase !== "breached").reduce((s, a) => s + Number(a.size), 0);
  const funded = accounts.filter((a) => a.phase === "funded").length;
  const breached = accounts.filter((a) => a.phase === "breached").length;
  const active = accounts.length - funded - breached;
  const hasMax = firm.max_allocation > 0;
  const allocPct = hasMax ? Math.min(1, alloc / firm.max_allocation) : 0;
  const over = hasMax && alloc > firm.max_allocation;
  const websiteHref = firm.website && !/^https?:\/\//i.test(firm.website) ? `https://${firm.website}` : firm.website;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="firm-avatar"><Building2 size={17} /></div>
            {firm.name}
          </span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tag-row" style={{ marginBottom: 14 }}>
          {firm.consistency_rule_pct > 0 && (
            <span className="tag" style={{ "--c": "#F7B731" }}><ShieldAlert size={11} /> Consistency {firm.consistency_rule_pct}%</span>
          )}
          <span className="tag" style={{ "--c": firm.refund_after_payouts > 0 ? "#35D28A" : "#8891A3" }}>
            <RotateCcw size={11} /> {firm.refund_after_payouts > 0 ? `Remboursé après ${firm.refund_after_payouts} payout${firm.refund_after_payouts > 1 ? "s" : ""}` : "Pas de remboursement"}
          </span>
        </div>

        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <MiniStat label="Comptes" value={accounts.length} icon={Wallet} />
          <MiniStat label="En cours" value={active} />
          <MiniStat label="Financés" value={funded} accent="var(--profit)" icon={CheckCircle2} />
          <MiniStat label="Échoués" value={breached} accent="var(--loss)" icon={AlertTriangle} />
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="settings-label">Allocation</div>
          <div className="firm-alloc-top">
            <span className="mini-label">Actuelle</span>
            <span className={"firm-alloc-value" + (over ? " over" : "")}>
              {fmt(alloc)}{hasMax ? ` / ${fmt(firm.max_allocation)}` : ""}
            </span>
          </div>
          <div className="firm-bar">
            <div className={"firm-bar-fill" + (over ? " over" : "")} style={{ width: `${hasMax ? allocPct * 100 : 100}%` }} />
          </div>
          {!hasMax && <div className="mini-label" style={{ marginTop: 5 }}>Pas de maximum défini</div>}
        </div>

        <div className="settings-grid" style={{ marginBottom: 14 }}>
          <div className="panel">
            <div className="settings-label">Contact</div>
            <div className="bar-list">
              {websiteHref ? (
                <Row label={<><Globe size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Site</>} value={<a href={websiteHref} target="_blank" rel="noopener noreferrer">{firm.website}</a>} />
              ) : (
                <Row label="Site" value="—" />
              )}
              <Row label={<><MessageCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Support</>} value={firm.support_contact || "—"} />
            </div>
          </div>

          <div className="panel">
            <div className="settings-label"><StickyNote size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Notes</div>
            {firm.notes ? (
              <p className="empty-sub" style={{ margin: 0, lineHeight: 1.6 }}>{firm.notes}</p>
            ) : (
              <p className="empty-sub" style={{ margin: 0 }}>Aucune note pour cette firme.</p>
            )}
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="settings-label"><TrendingUp size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Comptes chez cette firme</div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Taille</th><th>Type</th><th>Actif</th><th>Phase</th></tr></thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="num">{fmt(a.size)}</td>
                      <td><ChallengeTag challengeType={a.challenge_type} /></td>
                      <td><AssetTag assetClass={a.asset_class} /></td>
                      <td><PhaseBadge phase={a.phase} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Fermer</button>
          <button className="btn primary" onClick={() => onEdit(firm)}>Modifier cette firme</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="bar-list-top">
      <span className="bar-list-label" style={{ display: "flex", alignItems: "center" }}>{label}</span>
      <span className="bar-list-value">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent, icon: Icon }) {
  return (
    <div className="stat-card" style={{ padding: "10px 12px" }}>
      <div className="stat-card-head" style={{ marginBottom: 4 }}>
        <div className="stat-label">{label}</div>
        {Icon && <Icon size={13} color={accent || "var(--text-faint)"} />}
      </div>
      <div className="stat-value" style={{ fontSize: 18, ...(accent ? { color: accent } : {}) }}>{value}</div>
    </div>
  );
}