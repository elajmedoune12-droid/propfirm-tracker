/* ============================================================
   FUNDED. — Résumé quotidien par Web Push (Vercel Cron)
   Appelé chaque matin par le cron défini dans vercel.json.
   Utilise les variables d'environnement du projet Vercel :
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY [, VAPID_SUBJECT]
   Protection : si CRON_SECRET est défini sur le projet, l'appel
   doit porter "Authorization: Bearer <CRON_SECRET>" (c'est ce que
   fait automatiquement le scheduler Vercel quand la var existe).
   ============================================================ */

import webpush from "web-push";

const DAY_MS = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const todayStr = () => isoDay(Date.now());
const yesterdayStr = () => isoDay(Date.now() - DAY_MS);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const today = Date.parse(`${todayStr()}T00:00:00Z`);
  return Math.round((target - today) / DAY_MS);
}

// Portage exact de nextPayoutDate() côté app (src/utils/format.js)
function nextPayoutDate(anchorDate, frequency) {
  if (!anchorDate || !frequency || frequency === "on_demand" || frequency === "other") return null;
  const cursor = new Date(`${anchorDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return null;
  if (frequency === "weekly") cursor.setUTCDate(cursor.getUTCDate() + 7);
  else if (frequency === "bi_weekly") cursor.setUTCDate(cursor.getUTCDate() + 14);
  else if (frequency === "monthly") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  else return null;
  return cursor.toISOString().slice(0, 10);
}

const fmt = (n) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default async function handler(req, res) {
  // Sécurise le endpoint si CRON_SECRET est configuré
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Non autorisé" });
      return;
    }
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

  for (const [k, v] of Object.entries({
    SUPABASE_URL: SB_URL,
    SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
    VAPID_PUBLIC_KEY: VAPID_PUBLIC,
    VAPID_PRIVATE_KEY: VAPID_PRIVATE,
  })) {
    if (!v) {
      res.status(500).json({ error: `Variable manquante : ${k}` });
      return;
    }
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@funded.app",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );

  const listTable = async (table) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) throw new Error(`Lecture de "${table}" : HTTP ${r.status}`);
    return r.json();
  };

  try {
    const [accounts, payouts, accountEvents, firms, subscriptions] = await Promise.all([
      listTable("accounts"),
      listTable("payouts"),
      listTable("account_events"),
      listTable("firms"),
      listTable("push_subscriptions"),
    ]);

    if (subscriptions.length === 0) {
      res.status(200).json({ ok: true, sent: 0, note: "Aucun appareil abonné." });
      return;
    }

    const firmName = (id) => firms.find((f) => f.id === id)?.name || "—";
    const label = (a) => `${firmName(a.firm_id)} ${a.size}`;
    const yest = yesterdayStr();
    const today = todayStr();

    const linesByUser = new Map();
    const addLine = (userId, text) => {
      if (!linesByUser.has(userId)) linesByUser.set(userId, []);
      linesByUser.get(userId).push(text);
    };

    // Rétrospectif (< 24h) : payouts reçus, comptes financés/échoués
    for (const p of payouts) {
      if (!p.date || p.date < yest || p.date > today) continue;
      const acc = accounts.find((a) => a.id === p.account_id);
      addLine(p.user_id, `Payout de ${fmt(p.amount)} reçu${acc ? ` · ${label(acc)}` : ""}`);
    }
    for (const ev of accountEvents) {
      if (!ev.event_date || ev.event_date < yest || ev.event_date > today) continue;
      if (ev.phase !== "funded" && ev.phase !== "breached") continue;
      const acc = accounts.find((a) => a.id === ev.account_id);
      addLine(ev.user_id, `${ev.phase === "funded" ? "Compte financé" : "Compte échoué"}${acc ? ` · ${label(acc)}` : ""}`);
    }

    // Prospectif : deadlines ≤ 3j et prochains payouts attendus ≤ 3j
    for (const a of accounts) {
      const inChallenge = ["phase1", "phase2", "phase3"].includes(a.phase);
      const dLeft = a.challenge_deadline ? daysUntil(a.challenge_deadline) : null;
      if (inChallenge && dLeft !== null && dLeft <= 3) {
        addLine(a.user_id, `Deadline ${dLeft >= 0 ? `dans ${dLeft} jour${dLeft > 1 ? "s" : ""}` : "dépassée"} · ${label(a)}`);
      }
      if (a.phase !== "funded") continue;
      const lastPayoutDate = payouts
        .filter((p) => p.account_id === a.id)
        .reduce((max, p) => (!max || p.date > max ? p.date : max), null);
      const anchor = a.trading_start_date && (!lastPayoutDate || a.trading_start_date > lastPayoutDate)
        ? a.trading_start_date
        : null;
      const next = nextPayoutDate(anchor, a.payout_frequency);
      const nd = next ? daysUntil(next) : null;
      if (nd !== null && nd >= 0 && nd <= 3) {
        addLine(a.user_id, `Payout attendu ${nd === 0 ? "aujourd'hui" : nd === 1 ? "demain" : `dans ${nd} jours`} · ${label(a)}`);
      }
    }

    let sent = 0;
    let failed = 0;
    let pruned = 0;
    const errors = [];

    for (const sub of subscriptions) {
      const lines = linesByUser.get(sub.user_id);
      if (!lines || lines.length === 0) continue;

      const body = lines.length <= 4
        ? lines.join("\n")
        : `${lines.slice(0, 4).join("\n")}\n+${lines.length - 4} autre${lines.length - 4 > 1 ? "s" : ""}`;

      const payload = JSON.stringify({
        title: `FUNDED. — Résumé du jour (${lines.length})`,
        body,
        tag: "funded-daily",
        url: "/",
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          const del = await fetch(
            `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            { method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
          );
          if (del.ok) pruned++;
        } else {
          failed++;
          errors.push(err?.message || "erreur inconnue");
        }
      }
    }

    res.status(200).json({
      ok: true,
      sent,
      failed,
      pruned,
      users: linesByUser.size,
      errors: errors.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
