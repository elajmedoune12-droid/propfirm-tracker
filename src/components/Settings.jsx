import React, { useState, useEffect } from "react";
import {
  User, SlidersHorizontal, Sun, Moon, Loader2, LogOut,
  Mail, Lock, Eye, EyeOff, ShieldCheck, ShieldOff, Download, Palette, Bell, BellOff,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { PageHeader } from "./ui";
import { enablePushNotifications, disablePushNotifications, isPushEnabledOnThisDevice } from "../lib/push";

export function profileInfo(session) {
  const meta = session?.user?.user_metadata || {};
  return {
    name: meta.full_name?.trim() || "",
    avatarUrl: meta.avatar_url || null,
    email: session?.user?.email || "",
  };
}

function initials({ name, email }) {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }
  return (email || "").slice(0, 2).toUpperCase();
}

export function AvatarGlyph({ info, size = "" }) {
  if (info.avatarUrl) {
    return <img src={info.avatarUrl} alt="avatar" className={"avatar avatar-img " + size} />;
  }
  return <span className={"avatar " + size}>{initials(info)}</span>;
}

/* Bouton profil (sidebar) : avatar + nom/email quand la sidebar est ouverte,
   simple avatar centré quand elle est réduite. Ouvre/ferme le UserPopup. */
export function ProfileButton({ session, collapsed, onClick }) {
  const info = profileInfo(session);
  if (collapsed) {
    return (
      <button className="profile-btn collapsed" onClick={onClick} title={info.name || info.email}>
        <AvatarGlyph info={info} />
      </button>
    );
  }
  return (
    <button className="profile-btn" onClick={onClick}>
      <AvatarGlyph info={info} />
      <span className="profile-btn-text">
        <span className="profile-btn-name">{info.name || "Mon profil"}</span>
        <span className="profile-btn-email">{info.email}</span>
      </span>
      <ChevronGlyph />
    </button>
  );
}

function ChevronGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="profile-btn-chevron">
      <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Popover attaché au bouton profil : "Mon profil" ouvre la page profil,
   "Réglages" ouvre la modale, et la déconnexion demande confirmation. */
export function UserPopup({ session, collapsed, onClose, onOpenProfile, onOpenSettings, onLogoutRequest }) {
  const info = profileInfo(session);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="popup-scrim" onClick={onClose} />
      <div className={"user-popup" + (collapsed ? " from-collapsed" : "")}>
        <div className="user-popup-head">
          <AvatarGlyph info={info} size="md" />
          <div className="user-popup-id">
            <div className="user-popup-name">{info.name || "Mon profil"}</div>
            <div className="user-popup-email">{info.email}</div>
          </div>
        </div>
        <div className="user-popup-items">
          <button className="user-popup-item" onClick={onOpenProfile}>
            <User size={15} /> Mon profil
          </button>
          <button className="user-popup-item" onClick={onOpenSettings}>
            <SlidersHorizontal size={15} /> Réglages
          </button>
        </div>
        <div className="user-popup-items danger">
          <button className="user-popup-item danger" onClick={onLogoutRequest}>
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}

/* Confirmation de déconnexion */
export function LogoutConfirm({ onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal small logout-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="logout-confirm-icon"><LogOut size={20} /></div>
        <div className="modal-title" style={{ justifyContent: "center" }}>Se déconnecter ?</div>
        <p className="modal-text" style={{ textAlign: "center" }}>
          Tu devras te reconnecter pour accéder à ton tableau de bord.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Annuler</button>
          <button className="btn danger" onClick={onConfirm}>Déconnexion</button>
        </div>
      </div>
    </div>
  );
}

function pwdStrength(pwd) {
  if (!pwd) return null;
  if (pwd.length < 6) return { label: "Trop court", color: "var(--loss)", pct: 20 };
  if (pwd.length < 8) return { label: "Faible", color: "#F7B731", pct: 40 };
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return { label: "Fort", color: "var(--profit)", pct: 100 };
  return { label: "Moyen", color: "#F7B731", pct: 65 };
}

/* En-tête de panneau réglages : icône + libellé, cohérent avec le reste de l'app. */
function SettingsPanel({ icon, label, full = false, children }) {
  return (
    <div className={"panel settings-panel" + (full ? " full" : "")}>
      <div className="settings-panel-head">
        <span className="settings-panel-icon">{icon}</span>
        <span className="settings-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

/* Page complète Réglages : email, mot de passe, 2FA, notifications, export des données, thème.
   L'identité (avatar + nom) vit dans la page Profil. */
export function SettingsPage({ session, theme, onToggleTheme, onMfaChange }) {
  const user = session?.user;

  /* --- Email --- */
  const [email, setEmail] = useState(user?.email || "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const emailChanged = email !== user?.email && email.length > 0;

  const saveEmail = async (e) => {
    e.preventDefault();
    setEmailErr(""); setEmailMsg("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr("Email invalide."); return; }
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setEmailMsg("Vérifie ta boîte mail pour confirmer le changement.");
    } catch (err) {
      setEmailErr(err.message || "Impossible de mettre à jour l'email.");
    } finally {
      setEmailBusy(false);
    }
  };

  /* --- Mot de passe --- */
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const strength = pwdStrength(newPassword);

  const savePassword = async (e) => {
    e.preventDefault();
    setPwErr(""); setPwMsg("");
    if (newPassword.length < 6) { setPwErr("6 caractères minimum."); return; }
    if (newPassword !== confirmPassword) { setPwErr("Les mots de passe ne correspondent pas."); return; }
    setPwBusy(true);
    try {
      const { error: checkErr } = await supabase.auth.signInWithPassword({ email: user?.email, password: currentPwd });
      if (checkErr) throw new Error("Mot de passe actuel incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMsg("Mot de passe modifié.");
      setCurrentPwd(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPwErr(err.message || "Impossible de modifier le mot de passe.");
    } finally {
      setPwBusy(false);
    }
  };

  /* --- 2FA : statut + activation/désactivation --- */
  const [factor, setFactor] = useState(null); // { id } ou null si pas de TOTP actif
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMsg, setMfaMsg] = useState("");

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactor(data?.totp?.[0] || null);
    });
  }, []);

  const disableMfa = async () => {
    if (!factor) return;
    if (!confirm("Désactiver le 2FA ? Ton compte sera moins protégé.")) return;
    setMfaBusy(true); setMfaMsg("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      setFactor(null);
      setMfaMsg("2FA désactivé.");
      onMfaChange?.();
    } catch (err) {
      setMfaMsg(err.message || "Impossible de désactiver le 2FA.");
    } finally {
      setMfaBusy(false);
    }
  };

  /* --- Notifications push --- */
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [pushErr, setPushErr] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  // État réel : un abonnement push actif existe-t-il sur CET appareil ?
  useEffect(() => {
    isPushEnabledOnThisDevice().then(setPushEnabled);
  }, []);

  const handleEnablePush = async () => {
    setPushBusy(true); setPushErr(""); setPushMsg("");
    try {
      await enablePushNotifications();
      setPushEnabled(true);
      setPushMsg("Notifications activées sur cet appareil.");
    } catch (err) {
      setPushErr(err.message || "Impossible d'activer les notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true); setPushErr(""); setPushMsg("");
    try {
      await disablePushNotifications();
      setPushEnabled(false);
      setPushMsg("Notifications désactivées sur cet appareil.");
    } catch (err) {
      setPushErr(err.message || "Impossible de désactiver les notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestPush = async () => {
    setPushBusy(true); setPushErr(""); setPushMsg("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { user_id: user.id, title: "FUNDED.", body: "Ceci est une notification test 🎉", url: "/" },
      });
      if (error) throw error;
      if (data.total === 0) {
        setPushErr("Aucun appareil enregistré pour recevoir des notifications. Clique d'abord sur \"Activer\" sur l'appareil où tu veux les recevoir.");
      } else if (data.succeeded === 0) {
        setPushErr("Échec de l'envoi : " + (data.errors?.[0] || "erreur inconnue"));
      } else {
        setPushMsg(`Envoyée à ${data.succeeded}/${data.total} appareil(s).`);
      }
    } catch (err) {
      setPushErr(err.message || "Échec de l'envoi.");
    } finally {
      setPushBusy(false);
    }
  };

  /* --- Export des données --- */
  const [exportBusy, setExportBusy] = useState(false);
  const exportData = async () => {
    setExportBusy(true);
    try {
      const [{ data: firms }, { data: accounts }, { data: expenses }, { data: payouts }] = await Promise.all([
        supabase.from("firms").select("*"),
        supabase.from("accounts").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("payouts").select("*"),
      ]);
      const blob = new Blob(
        [JSON.stringify({ firms, accounts, expenses, payouts }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funded-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="profile-page">
      <PageHeader eyebrow="Compte" title="Réglages" sub="Sécurité, apparence et données de ton compte." />

      <div className="settings-grid">
        {/* Email */}
        <SettingsPanel icon={<Mail size={14} />} label="Adresse email">
          <form onSubmit={saveEmail} className="auth-form">
            <label>Email
              <input className="input" type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }} />
            </label>
            {emailErr && <div className="pin-error">{emailErr}</div>}
            {emailMsg && <div className="auth-info">{emailMsg}</div>}
            <button className="btn primary small" type="submit" disabled={!emailChanged || emailBusy}>
              {emailBusy ? <Loader2 size={14} className="spin" /> : <Mail size={13} />}
              {emailChanged ? "Confirmer le nouvel email" : "Email inchangé"}
            </button>
          </form>
        </SettingsPanel>

        {/* 2FA */}
        <SettingsPanel icon={factor ? <ShieldCheck size={14} /> : <ShieldOff size={14} />} label="Double authentification">
          <div className="mfa-row">
            <span className={factor ? "mfa-pill on" : "mfa-pill off"}>
              {factor ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
              {factor ? "Activé" : "Désactivé"}
            </span>
            {factor ? (
              <button className="btn ghost small danger-text" onClick={disableMfa} disabled={mfaBusy}>
                {mfaBusy ? <Loader2 size={14} className="spin" /> : null} Désactiver
              </button>
            ) : (
              <span className="empty-sub">Active-le en te déconnectant puis reconnectant.</span>
            )}
          </div>
          {mfaMsg && <div className="auth-info">{mfaMsg}</div>}
        </SettingsPanel>

        {/* Mot de passe — pleine largeur : 3 champs + jauge, a besoin de place */}
        <SettingsPanel icon={<Lock size={14} />} label="Mot de passe" full>
          <form onSubmit={savePassword} className="auth-form settings-pwd-form">
            <label>Mot de passe actuel
              <div className="input-icon-wrap">
                <input className="input" type={showCurrent ? "text" : "password"} value={currentPwd}
                  onChange={(e) => { setCurrentPwd(e.target.value); setPwErr(""); }} placeholder="••••••••" />
                <button type="button" className="input-icon-btn" onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <label>Nouveau mot de passe
              <div className="input-icon-wrap">
                <input className="input" type={showNew ? "text" : "password"} value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwErr(""); }} placeholder="••••••••" />
                <button type="button" className="input-icon-btn" onClick={() => setShowNew((v) => !v)}>
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {strength && (
                <div className="pwd-strength">
                  <div className="pwd-strength-track"><div className="pwd-strength-fill" style={{ width: strength.pct + "%", background: strength.color }} /></div>
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </label>
            <label>Confirmer
              <div className="input-icon-wrap">
                <input className="input" type={showConfirm ? "text" : "password"} value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwErr(""); }} placeholder="••••••••" />
                <button type="button" className="input-icon-btn" onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <div className="settings-pwd-actions">
              {pwErr && <div className="pin-error">{pwErr}</div>}
              {pwMsg && <div className="auth-info">{pwMsg}</div>}
              <button className="btn primary small" type="submit" disabled={!currentPwd || !newPassword || !confirmPassword || pwBusy}>
                {pwBusy ? <Loader2 size={14} className="spin" /> : <Lock size={13} />} Changer le mot de passe
              </button>
            </div>
          </form>
        </SettingsPanel>

        {/* Données */}
        <SettingsPanel icon={<Download size={14} />} label="Mes données">
          <p className="settings-panel-hint">Récupère une copie complète de tes firmes, comptes, dépenses et retraits.</p>
          <button className="btn ghost small" type="button" onClick={exportData} disabled={exportBusy}>
            {exportBusy ? <Loader2 size={14} className="spin" /> : <Download size={13} />} Exporter mes données (JSON)
          </button>
        </SettingsPanel>

        {/* Notifications push */}
        <SettingsPanel icon={pushEnabled ? <Bell size={14} /> : <BellOff size={14} />} label="Notifications">
          <p className="settings-panel-hint">
            Reçois des alertes directement sur ton téléphone, même l'app fermée.
            {" "}Sur iPhone : ajoute d'abord l'app à l'écran d'accueil, puis active ici depuis cette icône.
          </p>
          <div className="mfa-row">
            <span className={pushEnabled ? "mfa-pill on" : "mfa-pill off"}>
              {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {pushEnabled ? "Activées" : "Désactivées"}
            </span>
            {!pushEnabled ? (
              <button className="btn primary small" onClick={handleEnablePush} disabled={pushBusy}>
                {pushBusy ? <Loader2 size={14} className="spin" /> : <Bell size={13} />} Activer
              </button>
            ) : (
              <>
                <button className="btn ghost small" onClick={sendTestPush} disabled={pushBusy}>
                  {pushBusy ? <Loader2 size={14} className="spin" /> : <Bell size={13} />} Notification test
                </button>
                <button className="btn ghost small danger-text" onClick={handleDisablePush} disabled={pushBusy}>
                  Désactiver
                </button>
              </>
            )}
          </div>
          {pushErr && <div className="pin-error">{pushErr}</div>}
          {pushMsg && <div className="auth-info">{pushMsg}</div>}
        </SettingsPanel>

        {/* Apparence */}
        <SettingsPanel icon={<Palette size={14} />} label="Apparence">
          <div className="theme-switch">
            <button type="button" className={"theme-switch-opt" + (theme === "light" ? " active" : "")} onClick={() => theme !== "light" && onToggleTheme()}>
              <Sun size={14} /> Clair
            </button>
            <button type="button" className={"theme-switch-opt" + (theme === "dark" ? " active" : "")} onClick={() => theme !== "dark" && onToggleTheme()}>
              <Moon size={14} /> Sombre
            </button>
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}