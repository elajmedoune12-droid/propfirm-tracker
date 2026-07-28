import React, { useRef, useState } from "react";
import {
  Camera, Check, AlertCircle, Loader2, CalendarDays, Building2,
  Wallet, TrendingUp, ShieldCheck, ShieldOff, SlidersHorizontal,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { fmt } from "../utils/format";
import { PageHeader, StatCard } from "./ui";

function initials({ name, email }) {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }
  return (email || "").slice(0, 2).toUpperCase();
}

export default function Profile({ session, accounts, firms, payouts, mfaEnabled, onOpenSettings }) {
  const user = session?.user;
  const fileRef = useRef(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const displayAvatar = avatarPreview || avatarUrl;
  const changed = fullName !== (user?.user_metadata?.full_name || "") || !!avatarFile
    || (!avatarUrl && user?.user_metadata?.avatar_url);

  const pickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Image trop lourde (max 2 Mo)."); return; }
    setErr("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };
  const removeAvatar = () => { setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null); };

  const save = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (upErr) throw new Error("Upload avatar impossible : " + upErr.message);
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        finalAvatarUrl = data.publicUrl;
      }
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), avatar_url: finalAvatarUrl || null },
      });
      if (error) throw error;
      setAvatarUrl(finalAvatarUrl); setAvatarFile(null); setAvatarPreview(null);
      setMsg("Profil mis à jour.");
    } catch (e2) {
      setErr(e2.message || "Impossible de mettre à jour le profil.");
    } finally {
      setBusy(false);
    }
  };

  // Stats
  const fundedAccounts = (accounts || []).filter((a) => a.phase === "funded");
  const totalFunded = fundedAccounts.reduce((s, a) => s + Number(a.size || 0), 0);
  const totalPayouts = (payouts || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeAccounts = (accounts || []).filter((a) => a.phase !== "breached").length;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="profile-page">
      <PageHeader eyebrow="Compte" title="Mon profil" sub="Ton identité et un aperçu de ton activité." />

      <div className="profile-banner">
        <div className="avatar-picker">
          <div className="avatar-picker-img-wrap">
            {displayAvatar ? (
              <img src={displayAvatar} alt="avatar" className="avatar-picker-img lg" />
            ) : (
              <span className="avatar-picker-img avatar-picker-fallback lg">
                {initials({ name: fullName, email: user?.email || "" })}
              </span>
            )}
            <button type="button" className="avatar-picker-cam" onClick={() => fileRef.current?.click()}>
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only-file" onChange={pickAvatar} />
          </div>
          <div className="avatar-picker-actions">
            <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()}>Changer</button>
            {displayAvatar && <button type="button" className="btn ghost small danger-text" onClick={removeAvatar}>Supprimer</button>}
          </div>
        </div>

        <form onSubmit={save} className="profile-banner-form">
          <label>Nom affiché
            <input className="input" type="text" placeholder="Ton nom" value={fullName}
              onChange={(e) => setFullName(e.target.value)} />
          </label>
          <div className="profile-banner-meta">
            <span>{user?.email}</span>
            <span className="dot">·</span>
            <span><CalendarDays size={12} /> Membre depuis {memberSince}</span>
            <span className="dot">·</span>
            <span className={mfaEnabled ? "mfa-pill on" : "mfa-pill off"}>
              {mfaEnabled ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
              2FA {mfaEnabled ? "activé" : "désactivé"}
            </span>
          </div>
          {err && <div className="pin-error"><AlertCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{err}</div>}
          {msg && <div className="auth-info"><Check size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{msg}</div>}
          <div className="profile-banner-actions">
            <button className="btn primary small" type="submit" disabled={!changed || busy}>
              {busy ? <Loader2 size={14} className="spin" /> : null} Enregistrer
            </button>
            <button type="button" className="btn ghost small" onClick={onOpenSettings}>
              <SlidersHorizontal size={13} /> Réglages du compte
            </button>
          </div>
        </form>
      </div>

      <div className="stat-grid">
        <StatCard label="Capital financé" value={fmt(totalFunded)} sub={`${fundedAccounts.length} compte(s) financé(s)`} accent="var(--gold)" />
        <StatCard label="Total payouts" value={fmt(totalPayouts)} sub={`${(payouts || []).length} payout(s)`} accent="var(--profit)" />
        <StatCard label="Comptes actifs" value={activeAccounts} sub={`${(accounts || []).length} au total`} />
        <StatCard label="Firmes" value={(firms || []).length} sub="prop firms suivies" />
      </div>
    </div>
  );
}