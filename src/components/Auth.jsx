import React, { useState } from "react";
import { CircleDollarSign, ShieldCheck, ArrowLeft, MailCheck, KeyRound } from "lucide-react";
import { supabase } from "../supabaseClient";

export function LoginForm({ onSignedIn, onBack, initialMode = "signin" }) {
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
        // forgot password
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
    <div className="auth-screen">
      <div className="auth-card">
        {onBack && (
          <button className="auth-back-btn" onClick={onBack} type="button">
            <ArrowLeft size={14} /> Retour
          </button>
        )}
        <div className="brand"><CircleDollarSign size={20} className="brand-icon" /><span>FUNDED<span className="brand-dot">.</span></span></div>

        {mode === "forgot" ? (
          <>
            <h1 className="auth-title">Mot de passe oublié</h1>
            <p className="modal-text">Entre ton email, on t'envoie un lien pour choisir un nouveau mot de passe.</p>
            <form onSubmit={submit} className="auth-form">
              <label>Email<input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {error && <div className="pin-error">{error}</div>}
              {info && <div className="auth-info"><MailCheck size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{info}</div>}
              <button className="btn primary" disabled={busy || !email} type="submit">
                {busy ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
            <button className="link-btn" onClick={() => switchMode("signin")}>Retour à la connexion</button>
          </>
        ) : (
          <>
            <h1 className="auth-title">{mode === "signin" ? "Connexion" : "Créer un compte"}</h1>
            <form onSubmit={submit} className="auth-form">
              <label>Email<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>
  Mot de passe
  <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
</label>
{error && <div className="pin-error">{error}</div>}
{info && <div className="auth-info">{info}</div>}
<button className="btn primary" disabled={busy} type="submit">
  {mode === "signin" ? "Se connecter" : "Créer le compte"}
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
          </>
        )}
      </div>
    </div>
  );
}

/* Écran affiché quand Supabase redirige l'utilisateur après avoir cliqué sur le lien
   de réinitialisation reçu par email (événement PASSWORD_RECOVERY). */
export function ResetPasswordForm({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><KeyRound size={20} className="brand-icon" /><span>Nouveau mot de passe</span></div>
        <p className="modal-text">Choisis un nouveau mot de passe pour ton compte FUNDED.</p>
        <form onSubmit={submit} className="auth-form">
          <label>Nouveau mot de passe<input className="input" type="password" required minLength={6} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>Confirmer<input className="input" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          {error && <div className="pin-error">{error}</div>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>
    </div>
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
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><ShieldCheck size={20} className="brand-icon" /><span>Vérification 2FA</span></div>
        <p className="modal-text">Entre le code à 6 chiffres de ton application d'authentification (Google Authenticator, Authy...).</p>
        <form onSubmit={verify} className="auth-form">
          <input className="input" inputMode="numeric" maxLength={6} placeholder="123456"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          {error && <div className="pin-error">{error}</div>}
          <button className="btn primary" disabled={busy} type="submit">Vérifier</button>
        </form>
      </div>
    </div>
  );
}

export function MfaEnroll({ onDone, onSkip }) {
  const [step, setStep] = useState("start"); // start | scan | error
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const start = async () => {
    setError("");
    // Clean up any stale unverified TOTP factor left over from an earlier
    // attempt — Supabase refuses to enroll a new one otherwise (422).
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
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><ShieldCheck size={20} className="brand-icon" /><span>Sécuriser ton compte</span></div>
        {step === "start" && (
          <>
            <p className="modal-text">
              Tes comptes prop firm contiennent des identifiants sensibles. Active la double authentification (2FA)
              avec Google Authenticator ou Authy pour protéger l'accès.
            </p>
            {error && <div className="pin-error">{error}</div>}
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button className="btn primary" onClick={start}>Configurer le 2FA</button>
              <button className="btn ghost" onClick={onSkip}>Plus tard</button>
            </div>
          </>
        )}
        {step === "scan" && (
          <form onSubmit={confirm} className="auth-form">
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
            <input className="input" inputMode="numeric" maxLength={6} placeholder="123456"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            {error && <div className="pin-error">{error}</div>}
            <button className="btn primary" type="submit">Activer le 2FA</button>
          </form>
        )}
      </div>
    </div>
  );
}