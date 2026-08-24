import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Copie .env.example vers .env et remplis tes clés."
  );
}

export const supabase = createClient(url, anonKey);

/* Keepalive : Supabase (free tier) met en pause un projet sans requête pendant
   7 jours. Tant que l'app est ouverte, on émet une requête HEAD count toutes
   les 5 minutes VIA LE CLIENT supabase-js (mêmes en-têtes auth que le reste de
   l'app — un fetch manuel sur /rest/v1/ se fait rejeter 401). Hors app, le
   workflow GitHub Actions .github/workflows/supabase-keepalive.yml prend le
   relais avec un ping quotidien. */
const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
if (url && anonKey) {
  // Garde-fou HMR : ne jamais créer deux intervalles après un rechargement du module
  if (!window.__fundedKeepalive) {
    window.__fundedKeepalive = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      supabase.from("firms").select("id", { count: "exact", head: true })
        .then(() => {}) // seul le fait de faire la requête compte ; résultat ignoré
        .catch(() => {});
    }, KEEPALIVE_INTERVAL_MS);
  }
}
