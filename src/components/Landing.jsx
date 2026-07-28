import React from "react";
import {
  CircleDollarSign, LayoutDashboard, Building2, Wallet, TrendingUp,
  Target, ShieldCheck, ArrowRight, Download,
} from "lucide-react";

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

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="brand"><CircleDollarSign size={20} className="brand-icon" /><span>FUNDED<span className="brand-dot">.</span></span></div>
        <button className="btn ghost small" onClick={onLogin}>Se connecter</button>
      </header>

      <section className="landing-hero">
        <span className="eyebrow landing-eyebrow">Suivi de comptes prop firm</span>
        <h1 className="landing-title">
          Pilote tes comptes financés<br className="landing-title-break" /> comme un vrai <span className="landing-title-accent">trader business</span>.
        </h1>
        <p className="landing-sub">
          Firmes, comptes, dépenses, payouts et objectifs : FUNDED. regroupe tout ce dont tu as besoin
          pour suivre la rentabilité réelle de ton activité prop trading.
        </p>
        <div className="landing-cta">
          <button className="btn primary" onClick={onSignup}>
            Commencer gratuitement <ArrowRight size={15} />
          </button>
          <button className="btn ghost" onClick={onLogin}>J'ai déjà un compte</button>
        </div>
      </section>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div className="landing-feature-card" key={f.title}>
            <span className="landing-feature-icon"><f.icon size={18} /></span>
            <div className="landing-feature-title">{f.title}</div>
            <p className="landing-feature-text">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="landing-bottom-cta">
        <div>
          <h2 className="landing-bottom-title">Prêt à y voir plus clair sur tes comptes ?</h2>
          <p className="landing-sub">Gratuit, sans engagement, tes données restent les tiennes.</p>
        </div>
        <button className="btn primary" onClick={onSignup}>
          Créer mon compte <ArrowRight size={15} />
        </button>
      </section>

      <footer className="landing-footer">
        <span>FUNDED<span className="brand-dot">.</span> — {new Date().getFullYear()}</span>
        <span className="landing-footer-sub"><Download size={12} /> Tes données t'appartiennent, exportables à tout moment.</span>
      </footer>
    </div>
  );
}