import React, { useState, useMemo } from "react";
import AccountDetails from "./AccountDetails";
import {
  Building2, Plus, Trash2, Pencil, Zap, KeyRound, ChevronDown, ChevronUp, Eye, EyeOff,
  Lock, Unlock, AlertTriangle, Clock, History, Search, X as XIcon, ArrowRight, SlidersHorizontal, CalendarClock,
} from "lucide-react";
import { fmt, todayStr, addMonths, daysUntil, timeAgo, nextPayoutDate } from "../utils/format";
import * as api from "../lib/api";
import {
  PHASES, phaseInfo, phasesForChallenge, PLATFORMS, FieldRow, EmptyState, PageHeader,
  ChallengeTag, AssetTag, ASSET_CLASSES, CHALLENGE_TYPES, AccountStatus,
} from "./ui";

const PAYOUT_FREQUENCIES = {
  weekly: "Hebdomadaire",
  bi_weekly: "Bi-hebdomadaire",
  monthly: "Mensuel",
  on_demand: "À la demande",
  other: "Autre",
};

function PassphraseModal({ mode, error, onClose, onSubmit }) {
  const [pass, setPass] = useState("");
  const [confirmVal, setConfirmVal] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title"><KeyRound size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          {mode === "create" ? "Choisis une passphrase" : "Passphrase requise"}
        </div>
        <p className="modal-text">
          {mode === "create"
            ? "Cette passphrase chiffre tes mots de passe côté base (pgcrypto). Elle n'est stockée nulle part — mémorise-la bien, elle ne peut pas être récupérée."
            : "Entre ta passphrase pour révéler ce mot de passe pendant 60 secondes."}
        </p>
        <FieldRow>
          <input className="input" type="password" placeholder="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
          {mode === "create" && <input className="input" type="password" placeholder="Confirmer" value={confirmVal} onChange={(e) => setConfirmVal(e.target.value)} />}
        </FieldRow>
        {error && <div className="pin-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={() => onSubmit(pass, confirmVal)}>Valider</button>
        </div>
      </div>
    </div>
  );
}

function BreachReasonModal({ onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title"><AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: -3, color: "#F2496B" }} />Marquer ce compte comme échoué</div>
        <p className="modal-text">Raison (optionnel) — utile plus tard pour repérer tes erreurs les plus fréquentes.</p>
        <FieldRow>
          <input className="input" placeholder="Ex: drawdown quotidien dépassé" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </FieldRow>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary danger" onClick={() => onSubmit(reason.trim() || null)}>Confirmer l'échec</button>
        </div>
      </div>
    </div>
  );
}

export default function Accounts({ accounts, firms, payouts, expenses, reload }) {
  const [showForm, setShowForm] = useState(false);
  const blank = {
    firm_id: "", size: "", cost: "", phase: "phase1", purchase_date: todayStr(), challenge_deadline: "",
    challenge_type: "2phase", asset_class: "cfd",
    daily_drawdown_limit_pct: "", max_drawdown_limit_pct: "", current_drawdown_pct: "",
    scaling_enabled: false, scaling_pct: 25, scaling_interval_months: 4,
    payout_split_pct: "", payout_frequency: "", trading_start_date: "",
    hasCreds: false, login: "", password: "", platform: PLATFORMS[0], server: "",
  };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [historyByAccount, setHistoryByAccount] = useState({});

  const [search, setSearch] = useState("");
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterAsset, setFilterAsset] = useState("all");
  const [filterFirm, setFilterFirm] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // vault passphrase session state
  const [vaultPass, setVaultPass] = useState(null);
  const [vaultUnlockedUntil, setVaultUnlockedUntil] = useState(0);
  const [pendingPasswords, setPendingPasswords] = useState({}); // accountId -> revealed password
  const [modal, setModal] = useState(null); // { mode, purpose, accountId }
  const [modalError, setModalError] = useState("");
  const [breachTarget, setBreachTarget] = useState(null); // account id en attente de sa raison d'échec
  const unlocked = Date.now() < vaultUnlockedUntil;

  const submitAccount = async (passphrase) => {
    if (!form.firm_id || !form.size) return;
    const payload = {
      firm_id: form.firm_id,
      size: Number(form.size),
      initial_size: Number(form.size),
      cost: Number(form.cost) || 0,
      phase: form.phase,
      purchase_date: form.purchase_date,
      challenge_deadline: form.challenge_deadline || null,
      challenge_type: form.challenge_type,
      asset_class: form.asset_class,
      daily_drawdown_limit_pct: form.daily_drawdown_limit_pct ? Number(form.daily_drawdown_limit_pct) : null,
      max_drawdown_limit_pct: form.max_drawdown_limit_pct ? Number(form.max_drawdown_limit_pct) : null,
      current_drawdown_pct: form.current_drawdown_pct ? Number(form.current_drawdown_pct) : 0,
      scaling_enabled: form.scaling_enabled,
      scaling_pct: form.scaling_enabled ? Number(form.scaling_pct) : null,
      scaling_interval_months: form.scaling_enabled ? Number(form.scaling_interval_months) : null,
      payout_split_pct: form.payout_split_pct === "" ? null : Number(form.payout_split_pct),
      payout_frequency: form.payout_frequency || null,
      trading_start_date: form.trading_start_date || null,
      login: form.hasCreds ? form.login : null,
      platform: form.hasCreds ? form.platform : null,
      server: form.hasCreds ? form.server : null,
    };
    const created = await api.createAccount(payload);
    if (created) await api.logAccountEvent(created.id, payload.phase, payload.purchase_date);
    if (created && Number(payload.cost) > 0) {
      await api.createExpense({
        date: payload.purchase_date,
        description: `Achat challenge — ${firmName(payload.firm_id)} ${fmt(payload.size)}`,
        category: "Achat challenge",
        amount: Number(payload.cost),
        account_id: created.id,
      });
    }
    if (form.hasCreds && form.password && created) {
      await api.setAccountPassword(created.id, form.password, passphrase);
    }
    await reload();
    setForm(blank);
    setShowForm(false);
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      firm_id: a.firm_id || "",
      size: a.size,
      cost: a.cost || "",
      phase: a.phase,
      purchase_date: a.purchase_date,
      challenge_deadline: a.challenge_deadline || "",
      challenge_type: a.challenge_type || "2phase",
      asset_class: a.asset_class || "cfd",
      daily_drawdown_limit_pct: a.daily_drawdown_limit_pct || "",
      max_drawdown_limit_pct: a.max_drawdown_limit_pct || "",
      current_drawdown_pct: a.current_drawdown_pct || "",
      scaling_enabled: a.scaling_enabled || false,
      scaling_pct: a.scaling_pct || 25,
      scaling_interval_months: a.scaling_interval_months || 4,
      payout_split_pct: a.payout_split_pct ?? "",
      payout_frequency: a.payout_frequency || "",
      trading_start_date: a.trading_start_date || "",
      hasCreds: !!(a.login || a.platform || a.server),
      login: a.login || "",
      password: "",
      platform: a.platform || PLATFORMS[0],
      server: a.server || "",
    });
    setShowForm(true);
  };

  const submitEdit = async (passphrase) => {
    if (!form.firm_id || !form.size) return;
    const patch = {
      firm_id: form.firm_id,
      size: Number(form.size),
      cost: Number(form.cost) || 0,
      phase: form.phase,
      purchase_date: form.purchase_date,
      challenge_deadline: form.challenge_deadline || null,
      challenge_type: form.challenge_type,
      asset_class: form.asset_class,
      daily_drawdown_limit_pct: form.daily_drawdown_limit_pct ? Number(form.daily_drawdown_limit_pct) : null,
      max_drawdown_limit_pct: form.max_drawdown_limit_pct ? Number(form.max_drawdown_limit_pct) : null,
      current_drawdown_pct: form.current_drawdown_pct ? Number(form.current_drawdown_pct) : 0,
      scaling_enabled: form.scaling_enabled,
      scaling_pct: form.scaling_enabled ? Number(form.scaling_pct) : null,
      scaling_interval_months: form.scaling_enabled ? Number(form.scaling_interval_months) : null,
      payout_split_pct: form.payout_split_pct === "" ? null : Number(form.payout_split_pct),
      payout_frequency: form.payout_frequency || null,
      trading_start_date: form.trading_start_date || null,
      login: form.hasCreds ? (form.login || null) : null,
      platform: form.hasCreds ? (form.platform || null) : null,
      server: form.hasCreds ? (form.server || null) : null,
    };
    if (!form.hasCreds) patch.password_encrypted = null;
    const original = accounts.find((a) => a.id === editingId);
    await api.updateAccount(editingId, patch);
    if (original && original.phase !== patch.phase) {
      await api.logAccountEvent(editingId, patch.phase, todayStr());
    }
    await api.syncPurchaseExpense(editingId, patch.cost, patch.purchase_date, `Achat challenge — ${firmName(patch.firm_id)} ${fmt(patch.size)}`);
    if (form.hasCreds && form.password && passphrase) {
      await api.setAccountPassword(editingId, form.password, passphrase);
    }
    await reload();
    setForm(blank);
    setEditingId(null);
    setShowForm(false);
  };

  const handleFormSubmit = () => {
    const needsPassphrase = form.hasCreds && form.password;
    if (needsPassphrase && !vaultPass) {
      setModalError("");
      setModal({ mode: "create", purpose: editingId ? "save-edit" : "save-new" });
      return;
    }
    if (editingId) submitEdit(vaultPass || null);
    else submitAccount(vaultPass || null);
  };

  const requestReveal = (accountId) => {
    setModalError("");
    if (vaultPass && unlocked) { revealWith(accountId, vaultPass); return; }
    setModal({ mode: "enter", purpose: "reveal", accountId });
  };

  const revealWith = async (accountId, passphrase) => {
    const pwd = await api.getAccountPassword(accountId, passphrase);
    if (pwd === null) { setModalError("Passphrase incorrecte ou aucun mot de passe enregistré."); return false; }
    setPendingPasswords((p) => ({ ...p, [accountId]: pwd }));
    setVaultPass(passphrase);
    setVaultUnlockedUntil(Date.now() + 60000);
    setModal(null);
    return true;
  };

  const onModalSubmit = async (pass, confirmVal) => {
    if (!modal) return;
    if (modal.mode === "create") {
      if (pass.length < 4) { setModalError("Passphrase trop courte."); return; }
      if (pass !== confirmVal) { setModalError("Les deux passphrases ne correspondent pas."); return; }
      setModalError("");
      if (modal.purpose === "save-new") await submitAccount(pass);
      if (modal.purpose === "save-edit") await submitEdit(pass);
      setVaultPass(pass);
      setVaultUnlockedUntil(Date.now() + 60000);
      setModal(null);
    } else {
      if (modal.purpose === "reveal") {
        await revealWith(modal.accountId, pass);
      }
    }
  };

  const lockNow = () => { setVaultUnlockedUntil(0); setPendingPasswords({}); };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!historyByAccount[id]) {
      const h = await api.listScalingHistory(id);
      setHistoryByAccount((prev) => ({ ...prev, [id]: h }));
    }
  };

  const doApplyScaling = async (a) => {
    await api.applyScaling(a);
    const h = await api.listScalingHistory(a.id);
    setHistoryByAccount((prev) => ({ ...prev, [a.id]: h }));
    reload();
  };

  const payoutsFor = (id) => payouts.filter((p) => p.account_id === id).reduce((s, p) => s + Number(p.amount), 0);
  const firmName = (id) => firms.find((f) => f.id === id)?.name || "—";

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const f = firms.find((x) => x.id === a.firm_id);
      if (q && !(f?.name || "").toLowerCase().includes(q) && !String(a.size).includes(q)) return false;
      if (filterPhase !== "all" && a.phase !== filterPhase) return false;
      if (filterAsset !== "all" && (a.asset_class || "cfd") !== filterAsset) return false;
      if (filterFirm !== "all" && a.firm_id !== filterFirm) return false;
      return true;
    });
  }, [accounts, firms, search, filterPhase, filterAsset, filterFirm]);

  const hasActiveFilters = search || filterPhase !== "all" || filterAsset !== "all" || filterFirm !== "all";
  const activeFilterCount = [filterPhase !== "all", filterAsset !== "all", filterFirm !== "all"].filter(Boolean).length;
  const clearFilters = () => { setSearch(""); setFilterPhase("all"); setFilterAsset("all"); setFilterFirm("all"); };

  return (
    <div className="tab-content">
      <PageHeader eyebrow={hasActiveFilters ? `${filteredAccounts.length}/${accounts.length} compte(s)` : `${accounts.length} compte(s)`} title="Comptes" sub="Tes comptes, tes firmes, tes identifiants."
        action={<div className="page-actions"><button className="btn primary" onClick={() => { setEditingId(null); setForm(blank); setShowForm((v) => (editingId ? true : !v)); }}><Plus size={15} /> Nouveau compte</button></div>} />

      {firms.length === 0 && (
        <div className="empty-sub">Aucune firme — va d'abord dans l'onglet <strong>Firmes</strong> pour en ajouter une.</div>
      )}

      {accounts.length > 0 && (
        <div className="acc-toolbar">
          <div className="acc-search">
            <Search size={14} />
            <input className="input" placeholder="Rechercher une firme, une taille..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="filter-btn-wrap">
            <button className={"btn ghost" + (activeFilterCount > 0 ? " active-filter" : "")} onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={14} /> Filtres
              {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
            </button>

            {showFilters && (
              <>
                <div className="popup-scrim" onClick={() => setShowFilters(false)} />
                <div className="filter-popup">
                  <div className="filter-popup-title">Filtrer les comptes</div>
                  <label>Firme
                    <select className="input" value={filterFirm} onChange={(e) => setFilterFirm(e.target.value)}>
                      <option value="all">Toutes les firmes</option>
                      {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  <label>Phase
                    <select className="input" value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
                      <option value="all">Toutes les phases</option>
                      {PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label>Classe d'actifs
                    <select className="input" value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}>
                      <option value="all">CFD & Futures</option>
                      {ASSET_CLASSES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </label>
                  <div className="modal-actions">
                    <button className="btn ghost small" onClick={clearFilters} disabled={!hasActiveFilters}><XIcon size={13} /> Réinitialiser</button>
                    <button className="btn primary small" onClick={() => setShowFilters(false)}>Appliquer</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setForm(blank); setEditingId(null); }}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId ? "Modifier le compte" : "Nouveau compte"}</div>
            <div className="form-panel">
            <div className="form-section-title">Infos générales</div>
          <FieldRow>
            <label>Firme
              <select className="input" value={form.firm_id} onChange={(e) => setForm({ ...form, firm_id: e.target.value })}>
                <option value="">— choisir —</option>
                {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <label>Taille du compte ($)<input className="input" type="number" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="100000" /></label>
          </FieldRow>
          <FieldRow>
            <label>Structure de challenge
              <select
                className="input"
                value={form.challenge_type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  const validPhases = phasesForChallenge(nextType, form.phase);
                  const phaseStillValid = validPhases.some((p) => p.id === form.phase);
                  setForm({ ...form, challenge_type: nextType, phase: phaseStillValid ? form.phase : validPhases[0].id });
                }}
              >
                {CHALLENGE_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label>Classe d'actifs
              <select className="input" value={form.asset_class} onChange={(e) => setForm({ ...form, asset_class: e.target.value })}>
                {ASSET_CLASSES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          </FieldRow>
          <FieldRow>
            <label>Coût d'achat ($)<input className="input" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="500" /></label>
            <label>Date d'achat<input className="input" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></label>
            <label>Phase
              <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {phasesForChallenge(form.challenge_type, form.phase).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          </FieldRow>
          <FieldRow>
            <label>Deadline de challenge (optionnel)<input className="input" type="date" value={form.challenge_deadline} onChange={(e) => setForm({ ...form, challenge_deadline: e.target.value })} /></label>
          </FieldRow>

          <div className="form-section-title">Drawdown (optionnel)</div>
          <FieldRow>
            <label>Limite quotidienne (%)<input className="input" type="number" value={form.daily_drawdown_limit_pct} onChange={(e) => setForm({ ...form, daily_drawdown_limit_pct: e.target.value })} placeholder="5" /></label>
            <label>Limite max (%)<input className="input" type="number" value={form.max_drawdown_limit_pct} onChange={(e) => setForm({ ...form, max_drawdown_limit_pct: e.target.value })} placeholder="10" /></label>
          </FieldRow>

          <div className="form-section-title">Plan / payout (optionnel)</div>
          <FieldRow>
            <label>Split de payout (%)<input className="input" type="number" min="0" max="100" value={form.payout_split_pct} onChange={(e) => setForm({ ...form, payout_split_pct: e.target.value })} placeholder="ex: 80" /></label>
            <label>Fréquence de payout
              <select className="input" value={form.payout_frequency} onChange={(e) => setForm({ ...form, payout_frequency: e.target.value })}>
                <option value="">Non précisé</option>
                {Object.entries(PAYOUT_FREQUENCIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </FieldRow>
          <FieldRow>
            <label>Date du 1er trade sur le compte financé
              <input className="input" type="date" value={form.trading_start_date} onChange={(e) => setForm({ ...form, trading_start_date: e.target.value })} />
            </label>
          </FieldRow>

          <label className="checkbox-row"><input type="checkbox" checked={form.scaling_enabled} onChange={(e) => setForm({ ...form, scaling_enabled: e.target.checked })} /><span>Ce compte a un plan de scaling</span></label>
          {form.scaling_enabled && (
            <FieldRow>
              <label>Augmentation (%)<input className="input" type="number" value={form.scaling_pct} onChange={(e) => setForm({ ...form, scaling_pct: e.target.value })} /></label>
              <label>Tous les (mois)<input className="input" type="number" value={form.scaling_interval_months} onChange={(e) => setForm({ ...form, scaling_interval_months: e.target.value })} /></label>
            </FieldRow>
          )}

          <label className="checkbox-row"><input type="checkbox" checked={form.hasCreds} onChange={(e) => setForm({ ...form, hasCreds: e.target.checked })} /><span>Ajouter les identifiants de connexion</span></label>
          {form.hasCreds && (
            <>
              <FieldRow>
                <label>Login<input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></label>
                <label>{editingId ? "Nouveau mot de passe (laisser vide pour garder l'actuel)" : "Mot de passe"}
                  <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
              </FieldRow>
              <FieldRow>
                <label>Plateforme
                  <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>Serveur<input className="input" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} placeholder="ex: FTMO-Server3" /></label>
              </FieldRow>
            </>
          )}

          <div className="modal-actions">
            <button className="btn ghost" onClick={() => { setShowForm(false); setForm(blank); setEditingId(null); }}>Annuler</button>
            <button className="btn primary" onClick={handleFormSubmit}>{editingId ? "Enregistrer les modifications" : "Ajouter le compte"}</button>
          </div>
            </div>
          </div>
        </div>
      )}

      {unlocked && (
        <div className="unlock-banner"><Unlock size={13} /> Mots de passe visibles pendant 60s
          <button className="btn ghost small" onClick={lockNow}><Lock size={12} /> Verrouiller</button>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="panel"><EmptyState icon={Building2} title="Aucun compte" sub="Ajoute ton premier compte prop firm." /></div>
      ) : filteredAccounts.length === 0 ? (
        <div className="panel"><EmptyState icon={Search} title="Aucun résultat" sub="Aucun compte ne correspond à ces filtres." /></div>
      ) : (
        <div className="card-grid">
          {filteredAccounts.map((a) => {
            const f = firms.find((x) => x.id === a.firm_id);
            const nextScale = a.scaling_enabled ? addMonths(a.last_scale_date || a.purchase_date, a.scaling_interval_months) : null;
            const scaleDue = nextScale && nextScale <= todayStr();
            const dLeft = a.challenge_deadline ? daysUntil(a.challenge_deadline) : null;
            const ddRatio = a.max_drawdown_limit_pct > 0 ? (a.current_drawdown_pct || 0) / a.max_drawdown_limit_pct : 0;
            const expanded = expandedId === a.id;
            const history = historyByAccount[a.id] || [];
            const revealedPwd = pendingPasswords[a.id];
            const stepsNoBreach = phasesForChallenge(a.challenge_type, a.phase).filter((p) => p.id !== "breached");
            const curStepIdx = stepsNoBreach.findIndex((p) => p.id === a.phase);
            const nextStep = curStepIdx >= 0 && curStepIdx < stepsNoBreach.length - 1 ? stepsNoBreach[curStepIdx + 1] : null;
            const isTerminalPhase = a.phase === "funded" || a.phase === "breached";
            // Le cycle de payout ne démarre qu'au 1er trade sur le compte financé,
            // pas à la date où il est devenu "funded". Et une fois un payout reçu,
            // le cycle est "consommé" : tant qu'on n'a pas remarqué un nouveau
            // trade après ce payout, la prochaine date reste inconnue.
            const lastPayoutDate = payouts
              .filter((p) => p.account_id === a.id)
              .reduce((max, p) => (!max || p.date > max ? p.date : max), null);
            const cycleAnchor = a.trading_start_date && (!lastPayoutDate || a.trading_start_date > lastPayoutDate)
              ? a.trading_start_date : null;
            const nextPayout = a.phase === "funded" ? nextPayoutDate(cycleAnchor, a.payout_frequency) : null;
            const payoutDLeft = nextPayout ? daysUntil(nextPayout) : null;

            return (
              <div key={a.id} className="account-card">
                <div className="account-card-top">
                  <div className="min-w-0">
                    <div className="account-firm">{f ? f.name : "—"}</div>
                    <div className="account-size">{fmt(a.size)}{a.initial_size && a.size !== a.initial_size && <span className="dim"> (init. {fmt(a.initial_size)})</span>}</div>
                  </div>
                  <div className="card-actions">
                    <button className="icon-btn" onClick={() => setDetailsId(a.id)} title="Voir le détail"><Eye size={14} /></button>
                    <button className="icon-btn" onClick={() => startEdit(a)}><Pencil size={14} /></button>
                    <button className="icon-btn" onClick={async () => { await api.removeLinkedPurchaseExpense(a.id); await api.removeAccount(a.id); reload(); }}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="tag-row">
                  <ChallengeTag challengeType={a.challenge_type} />
                  <AssetTag assetClass={a.asset_class} />
                  {a.payout_split_pct > 0 && <span className="tag" style={{ "--c": "#35D28A" }}>{a.payout_split_pct}% split</span>}
                </div>

                <div className="account-card-mid">
                  <AccountStatus challengeType={a.challenge_type} phase={a.phase} />
                  {a.phase === "funded" && (
                    !cycleAnchor ? (
                      <div className="next-payout dim-note">
                        <CalendarClock size={13} />
                        {lastPayoutDate && a.trading_start_date ? "Payout reçu — relance un trade pour connaître le prochain" : "Date de payout inconnue — aucun trade lancé"}
                        <button
                          className="btn-link"
                          onClick={async () => { await api.updateAccount(a.id, { trading_start_date: todayStr() }); reload(); }}
                        >
                          J'ai commencé à trader
                        </button>
                      </div>
                    ) : nextPayout ? (
                      <div className={"next-payout" + (payoutDLeft <= 1 ? " due" : "")}>
                        <CalendarClock size={13} />
                        Prochain payout : {nextPayout}
                        {payoutDLeft === 0 ? " (aujourd'hui)" : payoutDLeft === 1 ? " (demain)" : payoutDLeft > 1 ? ` (dans ${payoutDLeft}j)` : ""}
                      </div>
                    ) : (
                      <div className="next-payout dim-note">
                        <CalendarClock size={13} />
                        {a.payout_frequency ? "Payout à la demande" : "Fréquence de payout non définie"}
                      </div>
                    )
                  )}
                  {!isTerminalPhase && (
                    <div className="phase-actions">
                      {nextStep && (
                        <button
                          className="btn-advance"
                          style={{ "--c": phaseInfo(nextStep.id).color }}
                          onClick={async () => { await api.changeAccountPhase(a.id, nextStep.id); reload(); }}
                        >
                          Passer à {nextStep.label} <ArrowRight size={14} />
                        </button>
                      )}
                      <button
                        className="btn ghost small danger-text"
                        onClick={() => setBreachTarget(a.id)}
                      >
                        Marquer échoué
                      </button>
                    </div>
                  )}
                </div>

                {dLeft !== null && (a.phase === "phase1" || a.phase === "phase2" || a.phase === "phase3") && (
                  <div className={"deadline-row" + (dLeft <= 3 ? " urgent" : "")}>
                    <Clock size={13} /> {dLeft >= 0 ? `Expire dans ${dLeft}j` : "Deadline dépassée"} ({a.challenge_deadline})
                  </div>
                )}

                {a.max_drawdown_limit_pct > 0 && (
  <div className="drawdown-row">
    <span className="dim">
      Drawdown max {a.max_drawdown_limit_pct}%{a.daily_drawdown_limit_pct ? ` (quotidien max ${a.daily_drawdown_limit_pct}%)` : ""}
    </span>
  </div>
)}

                {f && f.max_allocation > 0 && (
                  <div className="mini-alloc">
                    <div className="firm-bar small"><div className="firm-bar-fill" style={{ width: `${Math.min(100, (a.size / f.max_allocation) * 100)}%` }} /></div>
                    <div className="mini-label">{fmt(a.size)} / {fmt(f.max_allocation)} allocation firme</div>
                  </div>
                )}

                {a.scaling_enabled && (
                  <div className="scaling-row">
                    <Zap size={13} color="#E8B94D" />
                    <span className="dim">+{a.scaling_pct}% / {a.scaling_interval_months} mois — prochain: {nextScale}</span>
                    {scaleDue && <button className="btn primary small" onClick={() => doApplyScaling(a)}>Appliquer</button>}
                  </div>
                )}

                <div className="account-card-bottom">
                  <div><div className="mini-label">Coût</div><div className="mini-value">{fmt(a.cost)}</div></div>
                  <div><div className="mini-label">Payouts reçus</div><div className="mini-value" style={{ color: "#35D28A" }}>{fmt(payoutsFor(a.id))}</div></div>
                  <div><div className="mini-label">Acheté le</div><div className="mini-value">{a.purchase_date}</div></div>
                </div>

                {(a.login || a.platform || a.scaling_enabled) && (
                  <div className="creds-block">
                    <button className="creds-toggle" onClick={() => toggleExpand(a.id)}>
                      <KeyRound size={13} /> Détails {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {expanded && (
                      <div className="creds-detail">
                        {(a.login || a.platform) && (
                          <>
                            <div className="creds-line"><span className="dim">Login</span><span>{a.login || "—"}</span></div>
                            <div className="creds-line"><span className="dim">Plateforme</span><span>{a.platform || "—"}</span></div>
                            <div className="creds-line"><span className="dim">Serveur</span><span>{a.server || "—"}</span></div>
                            <div className="creds-line">
                              <span className="dim">Mot de passe</span>
                              <span className="creds-pass">
                                {unlocked && revealedPwd ? revealedPwd : "••••••••"}
                                <button className="icon-btn" onClick={() => (unlocked && revealedPwd ? lockNow() : requestReveal(a.id))}>
                                  {unlocked && revealedPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </span>
                            </div>
                          </>
                        )}
                        {a.scaling_enabled && (
                          <div className="scaling-history">
                            <div className="creds-line"><span className="dim"><History size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Historique de scaling</span></div>
                            {history.length === 0 ? (
                              <div className="empty-sub">Aucun scaling appliqué pour l'instant.</div>
                            ) : history.map((h) => (
                              <div key={h.id} className="creds-line"><span className="dim">{h.applied_at}</span><span>{fmt(h.old_size)} → {fmt(h.new_size)}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PassphraseModal
          mode={modal.mode}
          error={modalError}
          onClose={() => { setModal(null); setModalError(""); }}
          onSubmit={onModalSubmit}
        />
      )}

      {breachTarget && (
        <BreachReasonModal
          onClose={() => setBreachTarget(null)}
          onSubmit={async (reason) => {
            await api.changeAccountPhase(breachTarget, "breached", reason);
            setBreachTarget(null);
            reload();
          }}
        />
      )}

      {detailsId && (
        <AccountDetails
          account={accounts.find((x) => x.id === detailsId)}
          firm={firms.find((f) => f.id === accounts.find((x) => x.id === detailsId)?.firm_id)}
          payoutsForAccount={payouts.filter((p) => p.account_id === detailsId)}
          scalingHistory={historyByAccount[detailsId] || []}
          onClose={() => setDetailsId(null)}
          onEdit={(a) => startEdit(a)}
        />
      )}
    </div>
  );
}