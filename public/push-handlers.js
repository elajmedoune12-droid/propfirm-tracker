/* Handler Web Push chargé par le service worker généré (vite-plugin-pwa
   importScripts). Fichier en JS pur : il n'est PAS bundlé, il est servi tel quel.
   payload JSON attendu : { title, body, tag?, url? } */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "FUNDED.", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || "/" },
    })
  );
});

/* Clic sur la notification : focus sur l'app si elle est déjà ouverte,
   sinon ouverture de l'URL portée par le payload. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && client.url !== new URL(url, self.location.origin).href) {
            try { await client.navigate(url); } catch { /* navigation refusée : le focus suffit */ }
          }
          return;
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
