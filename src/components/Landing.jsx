import React, { useEffect, useRef, useState } from "react";
import {
  CircleDollarSign, LayoutDashboard, Building2, Wallet, TrendingUp,
  Target, ShieldCheck, ArrowRight, Download,
} from "lucide-react";
import { ThemeToggle } from "./ui";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Tableau de bord clair",
    text: "Capital financé, ROI, P&L net : toute la santé de ton activité en un coup d'œil.",
  },
  {
    icon: Building2,
    title: "Multi-firmes",
    text: "Centralise tous tes comptes, toutes prop firms confondues, en un seul endroit.",
  },
  {
    icon: Wallet,
    title: "Suivi des comptes",
    text: "Phases, drawdown, deadlines : ne perds plus le fil d'aucun de tes challenges.",
  },
  {
    icon: TrendingUp,
    title: "Dépenses & payouts",
    text: "Compare ce que tu investis à ce que tu retires, mois après mois.",
  },
  {
    icon: Target,
    title: "Objectifs annuels",
    text: "Fixe un cap de financement pour l'année et suis ta progression en temps réel.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurisé",
    text: "Double authentification et export de tes données à tout moment.",
  },
];

const FIRMS = [
  "FTMO", "FundedNext", "The5ers", "E8 Markets", "Apex Trader Funding",
  "TopStep", "Alpha Capital", "FunderPro",
];

const HERO_CHIPS = [
  { label: "Capital financé", to: 128400, prefix: "$" },
  { label: "ROI 2026", to: 23.8, prefix: "+", suffix: " %", decimals: 1 },
  { label: "Payouts ce mois", to: 5120, prefix: "$" },
];

const BIG_STATS = [
  { label: "de capital suivi", to: 2.4, suffix: " M$", decimals: 1 },
  { label: "de payouts enregistrés", to: 310, suffix: " K$" },
  { label: "de challenges pilotés", to: 480, suffix: "+" },
  { label: "et un export total de tes données", to: 100, suffix: " %" },
];

/* Révèle son contenu quand il entre dans le viewport (une seule fois). */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={"reveal" + (className ? " " + className : "")} style={{ "--d": `${delay}ms` }}>
      {children}
    </div>
  );
}

/* Compteur animé ease-out — valeur finale directe si mouvement réduit. */
function CountUp({ to, prefix = "", suffix = "", decimals = 0 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) { setVal(to); return; }
    let raf;
    const t0 = performance.now();
    const dur = 1300;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      {prefix}
      {val.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

/* Inclinaison 3D légère qui suit le pointeur. */
function useTilt(max = 7) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
    };
    const reset = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [max]);
  return ref;
}

/* Surbrillance radiale qui suit la souris sur une carte. */
function spotlight(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function MockChart() {
  return (
    <svg className="mock-chart" viewBox="0 0 420 110" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mockFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#35D28A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#35D28A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="chart-area" d="M6 92 C 60 88, 96 74, 138 62 C 182 49, 214 44, 254 34 C 296 23, 340 16, 414 9 L414 106 L6 106 Z" fill="url(#mockFill)" />
      <path className="chart-line" d="M6 92 C 60 88, 96 74, 138 62 C 182 49, 214 44, 254 34 C 296 23, 340 16, 414 9"
        fill="none" stroke="#35D28A" strokeWidth="2.5" strokeLinecap="round" pathLength="1" />
      <circle className="chart-dot" cx="414" cy="9" r="4" fill="#35D28A" />
    </svg>
  );
}

export default function Landing({ onLogin, onSignup, theme, onToggleTheme }) {
  const tiltRef = useTilt();
  const pageRef = useRef(null);

  // Parallaxe douce des orbes pendant le scroll interne de la landing
  useEffect(() => {
    const page = pageRef.current;
    if (!page || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        page.style.setProperty("--scroll", String(Math.min(page.scrollTop, 900)));
      });
    };
    page.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      page.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <div className="glow-orb go-a landing-go-a" aria-hidden="true" />
      <div className="glow-orb go-b landing-go-b" aria-hidden="true" />

      <header className="landing-nav a-hero" style={{ "--d": "40ms" }}>
        <div className="brand"><CircleDollarSign size={20} className="brand-icon" /><span>FUNDED<span className="brand-dot">.</span></span></div>
        <div className="landing-nav-actions">
          {onToggleTheme && <ThemeToggle variant="static" theme={theme} onToggle={onToggleTheme} />}
          <button className="btn ghost small" onClick={onLogin}>Se connecter</button>
        </div>
      </header>

      <section className="landing-hero">
        <span className="eyebrow landing-eyebrow a-hero" style={{ "--d": "120ms" }}>Suivi de comptes prop firm</span>
        <h1 className="landing-title a-hero" style={{ "--d": "220ms" }}>
          Pilote tes comptes financés<br className="landing-title-break" /> comme un vrai{" "}
          <span className="landing-title-accent">trader business</span>.
        </h1>
        <p className="landing-sub a-hero" style={{ "--d": "340ms" }}>
          Firmes, comptes, dépenses, payouts et objectifs : FUNDED. regroupe tout ce dont tu as besoin
          pour suivre la rentabilité réelle de ton activité prop trading.
        </p>
        <div className="landing-cta a-hero" style={{ "--d": "460ms" }}>
          <button className="btn primary btn-arrow" onClick={onSignup}>
            Commencer gratuitement <ArrowRight size={15} />
          </button>
          <button className="btn ghost" onClick={onLogin}>J'ai déjà un compte</button>
        </div>

        {/* Aperçu chiffré animé */}
        <div className="hero-chips a-hero" style={{ "--d": "600ms" }} aria-hidden="true">
          {HERO_CHIPS.map((c) => (
            <div className="hero-chip" key={c.label}>
              <span className="hero-chip-label">{c.label}</span>
              <span className={"hero-chip-value" + (c.label.startsWith("ROI") ? " profit" : "")}>
                <CountUp to={c.to} prefix={c.prefix || ""} suffix={c.suffix || ""} decimals={c.decimals || 0} />
              </span>
            </div>
          ))}
        </div>

        {/* Mock du tableau de bord : inclinaison 3D + courbe qui se dessine */}
        <Reveal delay={150} className="mock-reveal">
          <div className="mock-wrap" ref={tiltRef} aria-hidden="true">
            <div className="mock-glow" />
            <div className="mock-card">
              <div className="mock-top">
                <span className="mock-dots"><i /><i /><i /></span>
                <span className="mock-title">FUNDED. — Tableau de bord</span>
              </div>
              <div className="mock-body">
                <div className="mock-tiles">
                  <div className="mock-tile">
                    <span className="mock-tile-label">Capital financé</span>
                    <CountUp to={128400} prefix="$" />
                  </div>
                  <div className="mock-tile profit">
                    <span className="mock-tile-label">P&L net</span>
                    <CountUp to={18740} prefix="+$" />
                  </div>
                  <div className="mock-tile">
                    <span className="mock-tile-label">Comptes actifs</span>
                    <CountUp to={7} />
                  </div>
                </div>
                <MockChart />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Bandeau défilant des firmes */}
      <section className="marquee-section" aria-label="Firmes compatibles">
        <p className="marquee-caption">Conçu pour tous les défis, toutes les firmes</p>
        <div className="marquee">
          <div className="marquee-track">
            {[false, true].map((dup) => (
              <div className="marquee-group" key={String(dup)} aria-hidden={dup || undefined}>
                {FIRMS.map((f) => <span className="marquee-item" key={f}>{f}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section-head">
        <Reveal><span className="eyebrow">Fonctionnalités</span></Reveal>
        <Reveal delay={90}>
          <h2 className="landing-h2">Tout ce qu'un trader business suit,<br />au même endroit.</h2>
        </Reveal>
      </section>

      <section className="landing-features">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 90}>
            <div className="landing-feature-card" onMouseMove={spotlight}>
              <span className="landing-feature-icon"><f.icon size={18} /></span>
              <div className="landing-feature-title">{f.title}</div>
              <p className="landing-feature-text">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Bande de grandes stats animées */}
      <Reveal>
        <section className="big-stats">
          {BIG_STATS.map((s, i) => (
            <div className="big-stat" key={s.label} style={{ "--d": `${i * 80}ms` }}>
              <span className="big-stat-value">
                <CountUp to={s.to} prefix={s.prefix || ""} suffix={s.suffix || ""} decimals={s.decimals || 0} />
              </span>
              <span className="big-stat-label">{s.label}</span>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="landing-bottom-cta">
          <div className="bottom-cta-glow" aria-hidden="true" />
          <div>
            <h2 className="landing-bottom-title">Prêt à y voir plus clair sur tes comptes ?</h2>
            <p className="landing-sub">Gratuit, sans engagement, tes données restent les tiennes.</p>
          </div>
          <button className="btn primary btn-arrow" onClick={onSignup}>
            Créer mon compte <ArrowRight size={15} />
          </button>
        </section>
      </Reveal>

      <Reveal delay={140}>
        <footer className="landing-footer">
          <span>FUNDED<span className="brand-dot">.</span> — {new Date().getFullYear()}</span>
          <span className="landing-footer-sub"><Download size={12} /> Tes données t'appartiennent, exportables à tout moment.</span>
        </footer>
      </Reveal>
    </div>
  );
}
