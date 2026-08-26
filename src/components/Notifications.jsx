import React, { useEffect, useMemo, useState } from "react";
import { Bell, TrendingUp, Trophy, XCircle, Clock, CalendarClock, CheckCheck, Trash2, MailOpen } from "lucide-react";
import { fmt, daysUntil, nextPayoutDate, timeAgo, todayStr } from "../utils/format";

/* Centre de notifications dérivé des données déjà présentes côté client
   (aucune table supplémentaire) : payouts reçus récemment, comptes financés
   ou échoués récemment, deadlines de challenge imminentes et prochains
   payouts attendus.
   Chaque notification peut être marquée comme lue ou supprimée,
   individuellement ou en bloc. Les ids lus / supprimés sont persistés en
   localStorage (les ids sont stables : ils dérivent de l'évènement source),
   et synchronisés entre les instances (desktop flottante / header mobile)
   via un évènement window. */

const READ_KEY = "funded_notifs_read_v1";
const DEL_KEY = "funded_notifs_deleted_v1";
const SYNC_EVENT = "funded-notifs-sync";

const RECENT_DAYS = 7; // fenêtre des évènements passés (payouts, funded/breached)
const SOON_DAYS = 3;   // seuil "imminent" pour deadlines / payouts attendus

const DAY_MS = 86400000;
const inWindow = (dateStr, days, now = Date.now()) => {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return !Number.isNaN(t) && t <= now && now - t <= days * DAY_MS;
};

// Passé → "il y a Xj", aujourd'hui → "aujourd'hui", futur → "jj/mm"
export const whenLabel = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const diffDays = Math.round((d - new Date(todayStr())) / DAY_MS);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays > 0) return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return timeAgo(ts);
};

/* Construit la liste des notifications, triée de la plus récente à la plus ancienne.
   accountLabel(id) doit retourner un libellé du type "FTMO 100K". */
export function buildNotifications({ accounts = [], payouts = [], accountEvents = [], accountLabel }) {
  const items = [];

  for (const p of payouts) {
    if (!inWindow(p.date, RECENT_DAYS)) continue;
    items.push({
      id: `payout-${p.id}`,
      kind: "payout",
      title: `Payout de ${fmt(p.amount)} reçu`,
      sub: accountLabel ? accountLabel(p.account_id) : "",
      ts: p.date,
      tab: "payouts",
      tone: "success",
    });
  }

  for (const ev of accountEvents) {
    if (!inWindow(ev.event_date, RECENT_DAYS)) continue;
    if (ev.phase === "funded") {
      items.push({
        id: `funded-${ev.id}`,
        kind: "funded",
        title: "Compte financé",
        sub: accountLabel ? accountLabel(ev.account_id) : "",
        ts: ev.event_date,
        tab: "accounts",
        tone: "gold",
      });
    } else if (ev.phase === "breached") {
      items.push({
        id: `breach-${ev.id}`,
        kind: "breached",
        title: "Compte échoué",
        sub: accountLabel ? accountLabel(ev.account_id) : "",
        ts: ev.event_date,
        tab: "accounts",
        tone: "loss",
      });
    }
  }

  for (const a of accounts) {
    const label = accountLabel ? accountLabel(a.id) : "";

    // Deadline de challenge imminente ou dépassée (uniquement en challenge)
    const inChallenge = a.phase === "phase1" || a.phase === "phase2" || a.phase === "phase3";
    const dLeft = a.challenge_deadline ? daysUntil(a.challenge_deadline) : null;
    if (inChallenge && dLeft !== null && dLeft <= SOON_DAYS) {
      items.push({
        id: `deadline-${a.id}-${a.challenge_deadline}`,
        kind: "deadline",
        title: dLeft >= 0 ? `Deadline dans ${dLeft} jour${dLeft > 1 ? "s" : ""}` : "Deadline dépassée",
        sub: label,
        ts: a.challenge_deadline,
        tab: "accounts",
        tone: "warn",
      });
    }

    // Prochain payout attendu — même logique de cycle que Accounts/AccountDetails :
    // le cycle démarre au 1er trade post-funding et est consommé par chaque payout.
    if (a.phase === "funded") {
      const lastPayoutDate = payouts
        .filter((p) => p.account_id === a.id)
        .reduce((max, p) => (!max || p.date > max ? p.date : max), null);
      const anchor = a.trading_start_date && (!lastPayoutDate || a.trading_start_date > lastPayoutDate)
        ? a.trading_start_date : null;
      const next = nextPayoutDate(anchor, a.payout_frequency);
      const nd = next ? daysUntil(next) : null;
      if (nd !== null && nd >= 0 && nd <= SOON_DAYS) {
        items.push({
          id: `nextpay-${a.id}-${next}`,
          kind: "payout_soon",
          title: nd === 0 ? "Payout attendu aujourd'hui" : nd === 1 ? "Payout attendu demain" : `Payout attendu dans ${nd} jours`,
          sub: label,
          ts: next,
          tab: "accounts",
          tone: "info",
        });
      }
    }
  }

  return items.sort((x, y) => (y.ts || "").localeCompare(x.ts || ""));
}

/* --- persistance des ids lus / supprimés ------------------------------- */

const loadIds = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? new Set(v) : new Set();
  } catch { return new Set(); }
};

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function persistIds(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* stockage indisponible */ }
}

export function useNotifState(items) {
  const [readIds, setReadIds] = useState(() => loadIds(READ_KEY));
  const [deletedIds, setDeletedIds] = useState(() => loadIds(DEL_KEY));

  // Recharger depuis localStorage à chaque changement (écrase les stale reads)
  useEffect(() => {
    const reload = () => {
      setReadIds((prev) => {
        const fresh = loadIds(READ_KEY);
        return sameSet(prev, fresh) ? prev : fresh;
      });
      setDeletedIds((prev) => {
        const fresh = loadIds(DEL_KEY);
        return sameSet(prev, fresh) ? prev : fresh;
      });
    };
    window.addEventListener("focus", reload);
    window.addEventListener("visibilitychange", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("visibilitychange", reload);
    };
  }, []);

  // Synchronisation entre instances (cloche desktop / cloche mobile)
  useEffect(() => {
    const sync = (e) => {
      // En cas de storage event (autre onglet), recharger tout
      if (e.type === "storage") {
        setReadIds(loadIds(READ_KEY));
        setDeletedIds(loadIds(DEL_KEY));
        return;
      }
      setReadIds((prev) => {
        const fresh = loadIds(READ_KEY);
        return sameSet(prev, fresh) ? prev : fresh;
      });
      setDeletedIds((prev) => {
        const fresh = loadIds(DEL_KEY);
        return sameSet(prev, fresh) ? prev : fresh;
      });
    };
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => { persistIds(READ_KEY, readIds); }, [readIds]);
  useEffect(() => { persistIds(DEL_KEY, deletedIds); }, [deletedIds]);

  const visibleItems = useMemo(
    () => items.filter((i) => !deletedIds.has(i.id)),
    [items, deletedIds]
  );

  return {
    visibleItems,
    unreadCount: visibleItems.filter((i) => !readIds.has(i.id)).length,
    readIds,
    markRead: (id) => setReadIds((prev) => prev.has(id) ? prev : new Set(prev).add(id)),
    markUnread: (id) => setReadIds((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    }),
    deleteOne: (id) => {
      setDeletedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    },
    markAllRead: () => setReadIds(new Set([...readIds, ...visibleItems.map((i) => i.id)])),
    deleteAll: () => setDeletedIds(new Set([...deletedIds, ...visibleItems.map((i) => i.id)])),
  };
}

const KIND_ICONS = {
  payout: TrendingUp,
  funded: Trophy,
  breached: XCircle,
  deadline: Clock,
  payout_soon: CalendarClock,
};

const KIND_LABELS = {
  payout: "Payout reçu",
  funded: "Compte financé",
  breached: "Compte échoué",
  deadline: "Deadline",
  payout_soon: "Payout attendu",
};

export function NotificationBell({ items = [], onNavigate }) {
  const [open, setOpen] = useState(false);
  const notif = useNotifState(items);
  const { visibleItems, unreadCount, readIds } = notif;

  const toggle = () => setOpen((v) => !v);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Ouvrir le panneau ne lit plus automatiquement : lecture / suppression
  // sont des actions explicites (à l'unité ou globales). Cliquer une notif
  // la marque comme lue puis navigue vers l'onglet concerné.
  const openItem = (n) => { notif.markRead(n.id); setOpen(false); if (onNavigate) onNavigate(n.tab); };

  const hasVisible = visibleItems.length > 0;

  return (
    <div className="notif-wrap">
      <button
        className={"notif-btn" + (open ? " open" : "")}
        onClick={toggle}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} non lues)` : ""}`}
        title="Notifications"
        aria-expanded={open}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <>
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-head">
              <span>Notifications</span>
              {hasVisible && (
                <span className="notif-head-actions">
                  <button className="notif-markall" onClick={notif.markAllRead} title="Tout marquer comme lu">
                    <CheckCheck size={13} /> Tout lire
                  </button>
                  <button className="notif-markall danger" onClick={notif.deleteAll} title="Tout supprimer">
                    <Trash2 size={12} /> Tout supprimer
                  </button>
                </span>
              )}
            </div>
            <div className="notif-list">
              {!hasVisible ? (
                <div className="notif-empty">Rien de neuf — tout est sous contrôle.</div>
              ) : (
                visibleItems.map((n) => {
                  const Icon = KIND_ICONS[n.kind] || Bell;
                  const unread = !readIds.has(n.id);
                  return (
                    <div key={n.id} className={"notif-item" + (unread ? " unread" : "")}>
                      <button className="notif-item-main" onClick={() => openItem(n)} title={`${KIND_LABELS[n.kind]} — ouvrir`}>
                        <span className={"notif-chip " + n.tone}><Icon size={14} /></span>
                        <span className="notif-body">
                          <span className="notif-title">{n.title}</span>
                          <span className="notif-sub">{n.sub}</span>
                        </span>
                      </button>
                      <span className="notif-side">
                        <span className="notif-time">{whenLabel(n.ts)}</span>
                        <span className="notif-actions">
                          {!unread && (
                            <button className="notif-action" title="Marquer comme non lue"
                              onClick={() => notif.markUnread(n.id)}>
                              <MailOpen size={13} />
                            </button>
                          )}
                          <button className="notif-action del" title="Supprimer" onClick={() => notif.deleteOne(n.id)}>
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
