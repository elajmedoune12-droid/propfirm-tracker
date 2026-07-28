import React, { useState, useMemo } from "react";
import {
  Building2, Plus, Trash2, Pencil, Wallet, Search, Loader2, AlertTriangle, AlertCircle,
  Globe, ChevronDown, ChevronUp, MessageCircle, ShieldAlert, RotateCcw, StickyNote,
} from "lucide-react";
import { fmt } from "../utils/format";
import * as api from "../lib/api";
import { FieldRow, EmptyState, PageHeader, PhaseBadge, ChallengeTag, AssetTag } from "./ui";

const blankForm = {
  name: "", max_allocation: "",
  consistency_rule_pct: "", refunds_fee: false,
  website: "", support_contact: "", notes: "",
};

/* Confirmation avant suppression — la firme peut avoir un historique
   (dépenses passées, comptes échoués déjà comptés ailleurs) même sans
   compte actif, donc on ne supprime jamais sans confirmation explicite. */
function DeleteFirmConfirm({ firm, busy, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="logout-confirm-icon"><AlertTriangle size={20} /></div>
        <div className="modal-title" style={{ justifyContent: "center" }}>Supprimer {firm.name} ?</div>
        <p className="modal-text" style={{ textAlign: "center" }}>
          Cette action est irréversible. Les dépenses déjà liées à cette firme resteront, mais ne seront plus rattachées à un nom.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Annuler</button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : null} Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* Une carte firme : extraite pour garder le rendu de la liste lisible
   et pouvoir mémoïser les calculs par firme si besoin plus tard. */
function FirmCard({ firm, accounts, onEdit, onDeleteRequest }) {
  const [expanded, setExpanded] = useState(false);
  const accs = useMemo(() => accounts.filter((a) => a.firm_id === firm.id), [accounts, firm.id]);
  const alloc = useMemo(
    () => accs.filter((a) => a.phase !== "breached").reduce((s, a) => s + Number(a.size), 0),
    [accs]
  );
  const hasMax = firm.max_allocation > 0;
  const pct = hasMax ? Math.min(1, alloc / firm.max_allocation) : 0;
  const over = hasMax && alloc > firm.max_allocation;

  const websiteHref = firm.website && !/^https?:\/\//i.test(firm.website) ? `https://${firm.website}` : firm.website;
  const hasDetails = firm.support_contact || firm.notes || firm.refunds_fee;

  return (
    <div className="firm-card">
      <div className="firm-card-top">
        <div className="firm-card-id">
          <div className="firm-avatar"><Building2 size={16} /></div>
          <div className="min-w-0">
            <div className="account-firm" title={firm.name}>{firm.name}</div>
            <div className="firm-card-count"><Wallet size={11} /> {accs.length} compte{accs.length > 1 ? "s" : ""}</div>
          </div>
        </div>
        <div className="card-actions">
          {websiteHref && (
            <a className="icon-btn" href={websiteHref} target="_blank" rel="noopener noreferrer" title="Ouvrir le site" aria-label={`Ouvrir le site de ${firm.name}`}>
              <Globe size={14} />
            </a>
          )}
          <button className="icon-btn" onClick={() => onEdit(firm)} title="Modifier" aria-label={`Modifier ${firm.name}`}>
            <Pencil size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={() => onDeleteRequest(firm)}
            title="Supprimer"
            aria-label={`Supprimer ${firm.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {firm.consistency_rule_pct > 0 && (
        <div className="tag-row">
          <span className="tag" style={{ "--c": "#F7B731" }}><ShieldAlert size={11} /> Consistency {firm.consistency_rule_pct}%</span>
        </div>
      )}

      <div>
        <div className="firm-alloc-top">
          <span className="mini-label">Allocation</span>
          <span className={"firm-alloc-value" + (over ? " over" : "")}>
            {fmt(alloc)}{hasMax ? ` / ${fmt(firm.max_allocation)}` : ""}
          </span>
        </div>
        <div className="firm-bar">
          <div className={"firm-bar-fill" + (over ? " over" : "")} style={{ width: `${hasMax ? pct * 100 : 100}%` }} />
        </div>
        {!hasMax && <div className="mini-label" style={{ marginTop: 5 }}>Pas de maximum défini</div>}
      </div>

      {accs.length > 0 && (
        <div className="firm-accounts-list">
          {accs.map((a) => (
            <div key={a.id} className="firm-account-row">
              <span className="firm-account-size">{fmt(a.size)}</span>
              <span className="tag-row">
                <ChallengeTag challengeType={a.challenge_type} />
                <AssetTag assetClass={a.asset_class} />
                <PhaseBadge phase={a.phase} />
              </span>
            </div>
          ))}
        </div>
      )}

      {hasDetails && (
        <div className="creds-block">
          <button className="creds-toggle" onClick={() => setExpanded((v) => !v)}>
            Détails {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expanded && (
            <div className="creds-detail">
              <div className="creds-line"><span className="dim"><RotateCcw size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Frais remboursé</span><span>{firm.refunds_fee ? "Oui, au 1er payout" : "Non"}</span></div>
              {firm.support_contact && (
                <div className="creds-line"><span className="dim"><MessageCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Contact</span><span>{firm.support_contact}</span></div>
              )}
              {firm.notes && (
                <div className="firm-notes"><StickyNote size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{firm.notes}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Firms({ firms, accounts, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name | accounts | allocation

  const [deleteTarget, setDeleteTarget] = useState(null); // firm en attente de confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const closeForm = () => { setShowForm(false); setForm(blankForm); setEditingId(null); setFormErr(""); };

  const accountsFor = (firmId) => accounts.filter((a) => a.firm_id === firmId);
  const allocationFor = (firmId) =>
    accountsFor(firmId).filter((a) => a.phase !== "breached").reduce((s, a) => s + Number(a.size), 0);

  const submit = async (e) => {
    e?.preventDefault();
    const name = form.name.trim();
    if (!name) { setFormErr("Le nom est requis."); return; }
    const maxAlloc = Number(form.max_allocation) || 0;
    if (maxAlloc < 0) { setFormErr("L'allocation max ne peut pas être négative."); return; }
    const consistency = form.consistency_rule_pct === "" ? null : Number(form.consistency_rule_pct);
    if (consistency !== null && (consistency < 0 || consistency > 100)) { setFormErr("La règle de consistency doit être entre 0 et 100."); return; }

    setBusy(true); setFormErr("");
    try {
      const payload = {
        name, max_allocation: maxAlloc,
        consistency_rule_pct: consistency,
        refunds_fee: form.refunds_fee,
        website: form.website.trim() || null,
        support_contact: form.support_contact.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) await api.updateFirm(editingId, payload);
      else await api.createFirm(payload);
      closeForm();
      reload();
    } catch (err) {
      setFormErr(err.message || "Impossible d'enregistrer la firme.");
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => { setEditingId(null); setForm(blankForm); setFormErr(""); setShowForm(true); };

  const startEdit = (f) => {
    setEditingId(f.id);
    setForm({
      name: f.name, max_allocation: f.max_allocation || "",
      consistency_rule_pct: f.consistency_rule_pct ?? "",
      refunds_fee: f.refunds_fee || false,
      website: f.website || "", support_contact: f.support_contact || "", notes: f.notes || "",
    });
    setFormErr("");
    setShowForm(true);
  };

  const requestDelete = (f) => { setDeleteErr(""); setDeleteTarget(f); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteErr("");
    try {
      await api.removeFirm(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setDeleteErr(err.message || "Impossible de supprimer la firme.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredSortedFirms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = firms.filter((f) => !q || f.name.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sortBy === "accounts") return accountsFor(b.id).length - accountsFor(a.id).length;
      if (sortBy === "allocation") return allocationFor(b.id) - allocationFor(a.id);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [firms, accounts, search, sortBy]);

  const hasActiveFilters = search.length > 0;

  return (
    <div className="tab-content">
      <PageHeader
        eyebrow={hasActiveFilters ? `${filteredSortedFirms.length}/${firms.length} firme(s)` : `${firms.length} firme(s)`}
        title="Firmes"
        sub="Tes prop firms et leur allocation maximale."
        action={<div className="page-actions"><button className="btn primary" onClick={startCreate}><Plus size={15} /> Nouvelle firme</button></div>}
      />

      {firms.length === 0 ? (
        <div className="panel"><EmptyState icon={Building2} title="Aucune firme" sub="Ajoute ta première prop firm." /></div>
      ) : (
        <>
          {firms.length > 1 && (
            <div className="acc-toolbar">
              <div className="acc-search">
                <Search size={14} />
                <input className="input" placeholder="Rechercher une firme..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="input acc-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Trier par nom</option>
                <option value="accounts">Trier par nb. de comptes</option>
                <option value="allocation">Trier par allocation</option>
              </select>
            </div>
          )}

          {filteredSortedFirms.length === 0 ? (
            <div className="panel"><EmptyState icon={Search} title="Aucun résultat" sub="Aucune firme ne correspond à cette recherche." /></div>
          ) : (
            <div className="card-grid">
              {filteredSortedFirms.map((f) => (
                <FirmCard key={f.id} firm={f} accounts={accounts} onEdit={startEdit} onDeleteRequest={requestDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={busy ? undefined : closeForm}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId ? "Modifier la firme" : "Nouvelle firme"}</div>
            <form className="form-panel" onSubmit={submit}>
              <label>Nom
                <input className="input" placeholder="ex: FTMO" value={form.name} autoFocus
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormErr(""); }} />
              </label>
              <label>Allocation max ($, optionnel)
                <input className="input" type="number" min="0" placeholder="ex: 2000000" value={form.max_allocation}
                  onChange={(e) => setForm({ ...form, max_allocation: e.target.value })} />
              </label>

              <FieldRow>
                <label>Règle de consistency (%)
                  <input className="input" type="number" min="0" max="100" placeholder="ex: 30" value={form.consistency_rule_pct}
                    onChange={(e) => setForm({ ...form, consistency_rule_pct: e.target.value })} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <span style={{ visibility: "hidden" }}>.</span>
                  <span className="checkbox-row" style={{ marginBottom: 0 }}>
                    <input type="checkbox" checked={form.refunds_fee} onChange={(e) => setForm({ ...form, refunds_fee: e.target.checked })} />
                    <span>Frais de challenge remboursé au 1er payout</span>
                  </span>
                </label>
              </FieldRow>

              <label>Site web (optionnel)
                <input className="input" placeholder="ex: ftmo.com" value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </label>
              <label>Contact support (optionnel)
                <input className="input" placeholder="ex: support@firm.com ou Discord" value={form.support_contact}
                  onChange={(e) => setForm({ ...form, support_contact: e.target.value })} />
              </label>
              <label>Notes (optionnel)
                <textarea className="input" rows={3} placeholder="ex: pas de news trading, pas de hold le week-end..." value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>

              {formErr && <div className="pin-error"><AlertCircle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{formErr}</div>}
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeForm} disabled={busy}>Annuler</button>
                <button type="submit" className="btn primary" disabled={!form.name.trim() || busy}>
                  {busy ? <Loader2 size={14} className="spin" /> : null} {editingId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteFirmConfirm
          firm={deleteTarget}
          busy={deleteBusy}
          onCancel={() => !deleteBusy && setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {deleteErr && (
        <div className="modal-backdrop" onClick={() => setDeleteErr("")}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="pin-error" style={{ margin: 0 }}>{deleteErr}</div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setDeleteErr("")}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}