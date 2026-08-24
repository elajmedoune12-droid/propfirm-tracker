/* ============================================================
   FUNDED. — Envoi d'une notification de test (Vercel Function)
   POST /api/push-test
   En-tête : Authorization: Bearer <access_token Supabase>
   Envoie une notification à TOUS les appareils abonnés de
   l'utilisateur identifié par ce token.
   ============================================================ */

import webpush from "web-push";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée" });
    return;
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

  // Vérifie le token utilisateur auprès de Supabase Auth
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_KEY, Authorization: auth },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }
  const user = await userRes.json();

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@funded.app",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );

  // Récupère les abonnements de cet utilisateur uniquement
  const subRes = await fetch(
    `${SB_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=*`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  if (!subRes.ok) {
    res.status(500).json({ error: "Lecture des abonnements impossible" });
    return;
  }
  const subscriptions = await subRes.json();

  const payload = JSON.stringify({
    title: "FUNDED.",
    body: "Ceci est une notification test. Tout fonctionne !",
    tag: "funded-test",
    url: "/",
  });

  let succeeded = 0;
  let pruned = 0;
  const errors = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      succeeded++;
    } catch (err) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        const del = await fetch(
          `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
        );
        if (del.ok) pruned++;
      } else {
        errors.push(err?.message || "erreur inconnue");
      }
    }
  }

  res.status(200).json({ total: subscriptions.length, succeeded, failed: errors.length, pruned, errors: errors.slice(0, 3) });
}
