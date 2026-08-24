import React, { useState } from "react";
import { CircleDollarSign, ShieldCheck, ArrowLeft, MailCheck, KeyRound, Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { ThemeToggle } from "./ui";

/* Coque commune aux écrans d'auth : fond quadrillé, orbes flottantes,
   panneau visuel (courbe animée + stats) et carte à entrées décalées. */

const CURVE_PATH = "M6 84 C 58 80, 106 66, 154 44 C 198 24, 256 13, 314 7";
const ain = (i, extra = "") => ({ className: `a-in${extra ? " " + extra : ""}`, style: { "--d": `${i * 70}ms` } });

function AuthVisual({ title, stats = [] }) {
  return (
    <aside className="auth-visual" aria-hidden="true">
      <div>
        <div className="auth-visual-eyebrow">FUNDED.</div>
        <h2 className="auth-visual-title">{title}</h2>
      </div>
      <svg className="auth-visual-curve" viewBox="0 0 320 92" preserveAspectRatio="none">
        <defs>
          <linearGradient id="authCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8B94D" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#E8B94D" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="curve-fill" d={`${CURVE_PATH} L316 92 L6 92 Z`} fill="url(#authCurveFill)" stroke="none" />
        <path className="curve-line" d={CURVE_PATH} />
      </svg>
      <div className="auth-visual-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="auth-visual-stat-label">{s.label}</div>
            <div className={"auth-visual-stat-value" + (s.profit ? " profit" : "")}>{s.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function AuthScreen({ visual, children }) {
  return (
    <div className="auth-screen">
      <div className="glow-orb go-a" aria-hidden="true" />
      <div className="glow-orb go-b" aria-hidden="true" />
      <div className="auth-shell">
        <AuthVisual title={visual.title} stats={visual.stats} />
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

function PwdField({ label, value, onChange, autoFocus, autoComplete = "current-password", ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <label {...rest}>
      {label}
      <div className="input-icon-wrap">
        <input className="input" type={show ? "text" : "password"} required minLength={6}
          value={value} onChange={onChange} autoFocus={autoFocus} autoComplete={autoComplete} placeholder="••••••••" />
        <button type="button" className="input-icon-btn" onClick={() => setShow((v) => !v)}
          aria-label={show ? "Masquer" : "Afficher"}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  );
}

const VISUALS = {
  signin: {
    title: "Reprends le contrôle de ton activité prop trading.",
    stats: [
      { label: "Capital financé", value: "$128 400" },
      { label: "ROI annuel", value: "+23,8 %" },
      { label: "Payouts du mois", value: "$5 120", profit: true },
    ],
  },
  signup: {
    title: "Structure ton activité dès le premier challenge.",
    stats: [
      { label: "Firmes suivies", value: "Illimité" },
      { label: "Phases & deadlines", value: "Automatisés" },
      { label: "Tes données", value: "100 % à toi", profit: true },
    ],
  },
  forgot: {
    title: "Un lien, un nouveau mot de passe, et tu reprends le trading.",
    stats: [
      { label: "Envoi", value: "Immédiat" },
      { label: "Lien sécurisé", value: "À usage unique" },
      { label: "Compte protégé", value: "2FA compatible", profit: true },
    ],
  },
};

export function LoginForm({ onSignedIn, onBack, initialMode = "signin", theme, onToggleTheme }) {
  const [mode, setMode] = useState(initialMode); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignedIn();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
      }
    } catch (err) {
      setError(err.message || "Erreur d'authentification");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError(""); setInfo("");
  };

  return (
    <AuthScreen visual={VISUALS[mode] || VISUALS.signin}>
      <div {...ain(0, "auth-card-topbar")}>
        {onBack ? (
          <button className="auth-back-btn" onClick={onBack} type="button">
            <ArrowLeft size={14} /> Retour
          </button>
        ) : <span />}
        {onToggleTheme && <ThemeToggle variant="static" theme={theme} onToggle={onToggleTheme} />}
      </div>
      <div {...ain(1, "brand")}>
        <CircleDollarSign size={20} className="brand-icon" /><span>FUNDED<span className="brand-dot">.</span></span>
      </div>

      <div className="auth-swap" key={mode}>
        <h1 className="auth-title">
          {mode === "signin" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié"}
        </h1>
        <form onSubmit={submit} className="auth-form">
          {mode === "forgot" && (
            <p {...ain(0, "modal-text")}>
              Entre ton email, on t'envoie un lien pour choisir un nouveau mot de passe.
            </p>
          )}
          <label {...ain(1)}>
            Email
            <input className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="toi@email.com" />
          </label>
          {mode !== "forgot" && (
            <PwdField label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} {...ain(2)} />
          )}
          {error && (
            <div className="pin-error shake-x" key={error}>{error}</div>
          )}
          {info && (
            <div className="auth-info"><MailCheck size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{info}</div>
          )}
          <button {...ain(3, "btn primary btn-submit")} disabled={busy} type="submit">
            {busy && <Loader2 size={14} className="spin" />}
            {mode === "signin" ? "Se connecter" : mode === "signup" ? "Créer le compte" : busy ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>

        <div className="auth-bottom-row">
          <button className="link-btn" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Pas de compte ? Crée-en un" : "Déjà un compte ? Connecte-toi"}
          </button>
          {mode === "signin" && (
            <button type="button" className="auth-forgot-link" onClick={() => switchMode("forgot")}>
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </AuthScreen>
  );
}

/* Écran affiché après le lien de réinitialisation reçu par email (PASSWORD_RECOVERY). */
export function ResetPasswordForm({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const match = confirm.length > 0 && password === confirm;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("6 caractères minimum."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(err.message || "Impossible de mettre à jour le mot de passe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen visual={{
      title: "Ton nouveau mot de passe en quelques secondes.",
      stats: [
        { label: "Minimum", value: "6 caractères" },
        { label: "Vérification", value: "En direct" },
        { label: "Session", value: "Sécurisée", profit: true },
      ],
    }}>
      <div {...ain(0, "brand")}>
        <KeyRound size={20} className="brand-icon" /><span>Nouveau mot de passe</span>
      </div>
      <p {...ain(1, "modal-text")}>Choisis un nouveau mot de passe pour ton compte FUNDED.</p>
      <form onSubmit={submit} className="auth-form">
        <PwdField label="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
          autoFocus autoComplete="new-password" {...ain(2)} />
        <PwdField label="Confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password" {...ain(3)} />
        {confirm.length > 0 && (
          <div className={"pwd-match " + (match ? "ok" : "ko")}>
            {match ? <Check size={13} /> : <X size={13} />}
            {match ? "Les mots de passe correspondent." : "Les mots de passe ne correspondent pas."}
          </div>
        )}
        {error && <div className="pin-error shake-x" key={error}>{error}</div>}
        <button {...ain(4, "btn primary btn-submit")} disabled={busy} type="submit">
          {busy && <Loader2 size={14} className="spin" />} Mettre à jour le mot de passe
        </button>
      </form>
    </AuthScreen>
  );
}

export function MfaChallenge({ factorId, onVerified }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      onVerified();
    } catch (err) {
      setError(err.message || "Code invalide");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen visual={{
      title: "Une dernière vérification avant d'accéder à tes comptes.",
      stats: [
        { label: "Méthode", value: "TOTP" },
        { label: "Code", value: "6 chiffres" },
        { label: "Protection", value: "Renforcée", profit: true },
      ],
    }}>
      <div {...ain(0, "brand")}>
        <ShieldCheck size={20} className="brand-icon" /><span>Vérification 2FA</span>
      </div>
      <form onSubmit={verify} className="auth-form">
        <p {...ain(1, "modal-text")}>
          Entre le code à 6 chiffres de ton application d'authentification (Google Authenticator, Authy...).
        </p>
        <input {...ain(2, "input code-input")} inputMode="numeric" maxLength={6} placeholder="123456"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {error && <div className="pin-error shake-x" key={error}>{error}</div>}
        <button {...ain(3, "btn primary btn-submit")} disabled={busy || code.length < 6} type="submit">
          {busy && <Loader2 size={14} className="spin" />} Vérifier
        </button>
      </form>
    </AuthScreen>
  );
}

export function MfaEnroll({ onDone, onSkip }) {
  const [step, setStep] = useState("start"); // start | scan
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const start = async () => {
    setError("");
    // Nettoie un facteur TOTP non vérifié d'une tentative précédente :
    // Supabase refuse sinon d'en inscrire un nouveau (422).
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = (existing?.all || []).filter((f) => f.factor_type === "totp" && f.status === "unverified");
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `authenticator-${Date.now()}`,
    });
    if (error) { setError(error.message); return; }
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStep("scan");
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: verErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verErr) throw verErr;
      onDone();
    } catch (err) {
      setError(err.message || "Code invalide");
    }
  };

  return (
    <AuthScreen visual={{
      title: "Tes identifiants méritent une double serrure.",
      stats: [
        { label: "Méthode", value: "TOTP" },
        { label: "Apps", value: "Authy, Google…" },
        { label: "Niveau", value: "AAL2", profit: true },
      ],
    }}>
      <div {...ain(0, "brand")}>
        <ShieldCheck size={20} className="brand-icon" /><span>Sécuriser ton compte</span>
      </div>
      {step === "start" && (
        <>
          <p {...ain(1, "modal-text")}>
            Tes comptes prop firm contiennent des identifiants sensibles. Active la double authentification (2FA)
            avec Google Authenticator ou Authy pour protéger l'accès.
          </p>
          {error && <div className="pin-error shake-x" key={error}>{error}</div>}
          <div className="modal-actions enroll-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" onClick={start}>Configurer le 2FA</button>
            <button className="btn ghost" onClick={onSkip}>Plus tard</button>
          </div>
        </>
      )}
      {step === "scan" && (
        <form onSubmit={confirm} className="auth-form auth-swap" key="scan">
          <p className="modal-text">Scanne ce QR code avec ton application d'authentification, puis entre le code généré.</p>
          <div className="qr-wrap">
            {qr && qr.trim().startsWith("<svg") ? (
              <div dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <img src={qr} alt="QR code 2FA" width={180} height={180} />
            )}
          </div>
          {secret && (
            <p className="modal-text">
              Le scan ne fonctionne pas ? Ajoute manuellement une entrée dans ton app avec ce code :
              <br /><code style={{ userSelect: "all", color: "var(--gold)" }}>{secret}</code>
            </p>
          )}
          <input className="input code-input" inputMode="numeric" maxLength={6} placeholder="123456"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          {error && <div className="pin-error shake-x" key={error}>{error}</div>}
          <button className="btn primary btn-submit" type="submit" disabled={code.length < 6}>Activer le 2FA</button>
        </form>
      )}
    </AuthScreen>
  );
}
