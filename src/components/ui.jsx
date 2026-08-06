import React, { useState, useEffect } from "react";
import { LayoutDashboard, Wallet, Receipt, TrendingUp, TrendingDown, Target, CircleDollarSign, X, ChevronRight, ChevronLeft, Sun, Moon, Building2, Layers, CheckCircle2, AlertTriangle, Loader2, PiggyBank } from "lucide-react";
import { fmt } from "../utils/format";
import { ProfileButton, UserPopup, LogoutConfirm } from "./Settings";

export function ThemeToggle({ theme, onToggle, variant = "floating" }) {
  if (variant === "sidebar") {
    return (
      <button className="sidebar-theme-toggle" onClick={onToggle}>
        <span>{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>
        {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      </button>
    );
  }
  return (
    <button className="theme-toggle" onClick={onToggle}>
      {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      <span>{theme === "dark" ? "Sombre" : "Clair"}</span>
    </button>
  );
}

/* Phases possibles, toutes structures de challenge confondues.
   Le nombre d'étapes réellement utilisées dépend du challenge_type
   du COMPTE (voir phasesForChallenge ci-dessous) : instant / 1phase / 2phase / 3phase. */
export const PHASES = [
  { id: "phase1", label: "Étape 1", color: "#4EA6F0" },
  { id: "phase2", label: "Étape 2", color: "#A98CF5" },
  { id: "phase3", label: "Étape 3", color: "#F0954E" },
  { id: "funded", label: "Financé", color: "#35D28A" },
  { id: "breached", label: "Échoué", color: "#F2496B" },
];
export const phaseInfo = (id) => PHASES.find((p) => p.id === id) || PHASES[0];

export const CHALLENGE_TYPES = [
  { id: "instant", label: "Instantané" },
  { id: "1phase", label: "1 étape" },
  { id: "2phase", label: "2 étapes" },
  { id: "3phase", label: "3 étapes" },
];
export const challengeTypeInfo = (id) => CHALLENGE_TYPES.find((c) => c.id === id) || CHALLENGE_TYPES[2];

/* Retourne la liste de phases pertinentes pour un type de challenge donné
   (toujours terminée par funded/breached). currentPhase est ajoutée si elle
   n'y figure pas déjà, pour ne jamais perdre la valeur d'un compte existant. */
export function phasesForChallenge(challengeType, currentPhase) {
  const map = {
    instant: ["funded", "breached"],
    "1phase": ["phase1", "funded", "breached"],
    "2phase": ["phase1", "phase2", "funded", "breached"],
    "3phase": ["phase1", "phase2", "phase3", "funded", "breached"],
  };
  const ids = map[challengeType] || map["2phase"];
  const list = PHASES.filter((p) => ids.includes(p.id));
  if (currentPhase && !ids.includes(currentPhase)) {
    return [phaseInfo(currentPhase), ...list];
  }
  return list;
}

export const ASSET_CLASSES = [
  { id: "cfd", label: "CFD", color: "#4EA6F0" },
  { id: "futures", label: "Futures", color: "#E8B94D" },
  { id: "both", label: "CFD & Futures", color: "#A98CF5" },
];
export const assetClassInfo = (id) => ASSET_CLASSES.find((a) => a.id === id) || ASSET_CLASSES[0];

export const EXPENSE_CATEGORIES = ["Achat challenge", "Reset", "Abonnement", "Autre"];
export const PLATFORMS = ["MT4", "MT5", "cTrader", "DXtrade", "Match-Trader", "Rithmic", "Tradovate", "Autre"];

export function ChallengeTag({ challengeType }) {
  const info = challengeTypeInfo(challengeType);
  return <span className="tag" style={{ "--c": "#8891A3" }}>{info.label}</span>;
}
export function AssetTag({ assetClass }) {
  const info = assetClassInfo(assetClass);
  return <span className="tag" style={{ "--c": info.color }}>{info.label}</span>;
}

export function StatCard({ label, value, sub, accent, icon: Icon, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div className="stat-label">{label}</div>
        {Icon && (
          <div className="stat-icon" style={accent ? { color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` } : undefined}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="stat-foot">
        {sub && <div className="stat-sub">{sub}</div>}
        {trend != null && (
          <div className={"stat-trend" + (trend >= 0 ? " up" : " down")}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

/* Liste de barres horizontales — répartition (par firme, par phase, etc.) */
export function BarList({ items, emptyLabel = "Aucune donnée" }) {
  if (!items || items.length === 0) {
    return <div className="empty-sub" style={{ textAlign: "center", padding: "20px 0" }}>{emptyLabel}</div>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bar-list">
      {items.map((it) => (
        <div className="bar-list-row" key={it.label}>
          <div className="bar-list-top">
            <span className="bar-list-label">{it.label}</span>
            <span className="bar-list-value">{it.display}</span>
          </div>
          <div className="firm-bar small">
            <div
              className="firm-bar-fill"
              style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, background: it.color || "var(--gold)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dial({ value, target, size = 128, color = "#E8B94D" }) {
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const ticks = Array.from({ length: 24 });
  return (
    <div className="dial-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2},${size / 2})`}>
          {ticks.map((_, i) => {
            const angle = (i / ticks.length) * 360;
            const big = i % 6 === 0;
            return (
              <line key={i} x1={0} y1={-(r + 4)} x2={0} y2={-(r + (big ? 9 : 6))}
                stroke="#2A3142" strokeWidth={big ? 1.6 : 1} transform={`rotate(${angle})`} />
            );
          })}
        </g>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1B2130" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="dial-center">
        <div className="dial-pct">{Math.round(pct * 100)}%</div>
        <div className="dial-of">de {fmt(target)}</div>
      </div>
    </div>
  );
}

/* Mixed-size funding tranches: consumes funded account sizes sequentially per tranche */
export function computeTrancheFill(tranches, fundedAccounts) {
  const pool = fundedAccounts.map((a) => Number(a.size));
  return tranches.map((t) => {
    let filled = 0;
    for (let i = 0; i < t.count; i++) {
      const idx = pool.indexOf(Number(t.size));
      if (idx >= 0) { pool.splice(idx, 1); filled++; } else break;
    }
    return { ...t, filled };
  });
}

export function TrancheStrip({ tranches, fundedAccounts }) {
  const filledTranches = computeTrancheFill(tranches, fundedAccounts);
  return (
    <div className="tranche-strip">
      {filledTranches.map((t) => (
        <div key={t.id} className="tranche-group">
          <div className="tranche-boxes">
            {Array.from({ length: t.count }).map((_, i) => (
              <div key={i} className={"step-box" + (i < t.filled ? " filled" : "")}>{i < t.filled ? "✓" : ""}</div>
            ))}
          </div>
          <div className="step-unit">{t.count}× {fmt(t.size)}</div>
        </div>
      ))}
    </div>
  );
}

/* Constructeur de paliers de financement — utilisé en création ET en édition
   (via initialList, pour pré-remplir avec les paliers déjà enregistrés). */
export function TrancheBuilder({ onSave, saveLabel = "Définir", busy, initialList }) {
  const [size, setSize] = useState("");
  const [count, setCount] = useState("");
  const [list, setList] = useState(() => initialList || []);
  const total = list.reduce((s, t) => s + t.size * t.count, 0);

  const addTranche = () => {
    if (Number(size) > 0 && Number(count) > 0) {
      setList([...list, { id: Math.random().toString(36).slice(2), size: Number(size), count: Number(count) }]);
      setSize(""); setCount("");
    }
  };
  const removeTranche = (id) => setList(list.filter((t) => t.id !== id));

  return (
    <div className="tranche-builder">
      <FieldRow>
        <input className="input" type="number" placeholder="Taille $ (ex: 50000)" value={size} onChange={(e) => setSize(e.target.value)} />
        <input className="input" type="number" placeholder="Nombre de comptes" value={count} onChange={(e) => setCount(e.target.value)} />
        <button className="btn ghost small" type="button" onClick={addTranche}>+ Palier</button>
      </FieldRow>
      {list.length > 0 && (
        <>
          <div className="tranche-chips">
            {list.map((t) => (
              <span key={t.id} className="tranche-chip">
                {t.count}× {fmt(t.size)}
                <X size={12} onClick={() => removeTranche(t.id)} style={{ cursor: "pointer" }} />
              </span>
            ))}
          </div>
          <div className="empty-sub">Total : {fmt(total)}</div>
        </>
      )}
      <button className="btn primary" disabled={list.length === 0 || busy} onClick={() => onSave(list)}>
        {busy ? <Loader2 size={14} className="spin" /> : null} {saveLabel}
      </button>
    </div>
  );
}

export function PhaseBadge({ phase }) {
  const info = phaseInfo(phase);
  return <span className="badge" style={{ "--c": info.color }}><span className="badge-dot" />{info.label}</span>;
}

/* Statut visuel du compte : bannière franche pour financé/échoué,
   frise d'étapes claire pendant le challenge (y compris instant funding,
   qui saute directement en financé ou échoué). */
export function AccountStatus({ challengeType, phase }) {
  if (phase === "breached") {
    return (
      <div className="status-banner status-breached">
        <AlertTriangle size={15} />
        <span>Compte échoué</span>
      </div>
    );
  }
  if (phase === "funded") {
    return (
      <div className="status-banner status-funded">
        <CheckCircle2 size={15} />
        <span>Compte financé</span>
      </div>
    );
  }
  const steps = phasesForChallenge(challengeType, phase).filter((p) => p.id !== "breached" && p.id !== "funded");
  const allSteps = [...steps, { id: "funded", label: "Financé" }];
  const currentIndex = allSteps.findIndex((s) => s.id === phase);
  const current = allSteps[currentIndex];
  return (
    <div>
      <div className="status-stepper">
        {allSteps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={"status-dot" + (i < currentIndex ? " done" : i === currentIndex ? " current" : "")}>
              {i < currentIndex ? "✓" : i + 1}
            </div>
            {i < allSteps.length - 1 && <div className={"status-line" + (i < currentIndex ? " done" : "")} />}
          </React.Fragment>
        ))}
      </div>
      <div className="status-caption">{current ? `${current.label} en cours` : ""}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="empty">
      <Icon size={26} strokeWidth={1.5} />
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  );
}

export function FieldRow({ children }) {
  return <div className="field-row">{children}</div>;
}

export function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="page-header">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-sub">{sub}</p></div>
      {action}
    </div>
  );
}

export function Sidebar({ tab, setTab, session, onOpenSettings, onOpenProfile, onSignOut }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  useEffect(() => { localStorage.setItem("sidebar_collapsed", collapsed); }, [collapsed]);

  const [showPopup, setShowPopup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const items = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "firms", label: "Firmes", icon: Building2 },
    { id: "accounts", label: "Comptes", icon: Wallet },
    { id: "personal", label: "Compte propre", icon: PiggyBank },
    { id: "expenses", label: "Dépenses", icon: Receipt },
    { id: "payouts", label: "Payouts", icon: TrendingUp },
    { id: "goals", label: "Objectifs", icon: Target },
  ];
  return (
    <>
      {/* Header mobile : masqué en desktop (voir .mobile-header), affiché en <= 860px
          quand la sidebar devient une barre de nav fixée en bas de l'écran. */}
      <div className="mobile-header">
        <div className="brand"><CircleDollarSign size={18} className="brand-icon" /><span>FUNDED<span className="brand-dot">.</span></span></div>
      </div>

      <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
        <div className="sidebar-top">
          <div className="brand">
            <CircleDollarSign size={20} className="brand-icon" />
            {!collapsed && <span>FUNDED<span className="brand-dot">.</span></span>}
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Élargir" : "Réduire"}
            title={collapsed ? "Élargir" : "Réduire"}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        <nav className="nav">
          {items.map((it) => (
            <button key={it.id} title={collapsed ? it.label : undefined}
              className={"nav-item" + (tab === it.id ? " active" : "")} onClick={() => setTab(it.id)}>
              <it.icon size={17} />{!collapsed && <span>{it.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-user-wrap">
          <ProfileButton session={session} collapsed={collapsed} onClick={() => setShowPopup((v) => !v)} />
          {showPopup && (
            <UserPopup
              session={session}
              collapsed={collapsed}
              onClose={() => setShowPopup(false)}
              onOpenProfile={() => { setShowPopup(false); onOpenProfile(); }}
              onOpenSettings={() => { setShowPopup(false); onOpenSettings(); }}
              onLogoutRequest={() => { setShowPopup(false); setShowLogoutConfirm(true); }}
            />
          )}
        </div>

        {showLogoutConfirm && (
          <LogoutConfirm
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={() => { setShowLogoutConfirm(false); onSignOut(); }}
          />
        )}
      </aside>
    </>
  );
}

export { ChevronRight };