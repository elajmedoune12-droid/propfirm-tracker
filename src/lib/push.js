import { supabase } from "../supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Les notifications push ne sont pas supportées sur cet appareil/navigateur.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission refusée.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });
  }

  const { data: { user } } = await supabase.auth.getUser();
  const json = subscription.toJSON();
  await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  }, { onConflict: "endpoint" });

  return true;
}

/* Désactive les push sur cet appareil : désabonnement navigateur +
   suppression de la ligne côté base. */
export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  const endpoint = subscription.endpoint;
  try { await subscription.unsubscribe(); } catch { /* déjà invalide côté navigateur */ }
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) console.warn("Suppression de l'abonnement côté serveur impossible :", error.message);
  return true;
}

/* État réel de CET appareil (et non la simple permission du navigateur) :
   un abonnement push actif existe-t-il ici ? */
export async function isPushEnabledOnThisDevice() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}