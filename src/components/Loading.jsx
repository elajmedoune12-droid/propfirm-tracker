import React from "react";

/* Écran d'attente pendant la vérification de session : wordmark + point
   pulsant, sobre et raccord avec l'identité de l'app. */
export function Splash() {
  return (
    <div className="splash" role="status" aria-label="Chargement">
      <div className="splash-mark">
        funded<span className="splash-tld">.</span>
        <span className="splash-dot" />
      </div>
    </div>
  );
}

/* Squelette reprenant la géométrie du tableau de bord (stats 4 colonnes,
   graphique + objectif, deux panneaux) : le contenu réel s'empile exactement
   à la place des blocs, donc aucun saut de layout à l'arrivée des données. */
export function DashboardSkeleton() {
  return (
    <div className="tab-content" aria-hidden="true">
      <div className="stat-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card skeleton-pulse">
            <div className="skeleton-line" style={{ height: 11, width: "45%", marginBottom: 10 }} />
            <div className="skeleton-line skeleton-line-soft" style={{ height: 22, width: "65%" }} />
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="panel skeleton-pulse chart-box" />
        <div className="panel skeleton-pulse goal-sk" />
      </div>
      <div className="dash-grid-secondary">
        <div className="panel skeleton-pulse bar-sk" />
        <div className="panel skeleton-pulse bar-sk" />
      </div>
    </div>
  );
}

/* Échec de chargement initial : on ne reste pas bloqué sur un spinner. */
export function LoadError({ onRetry }) {
  return (
    <div className="load-error">
      <p>Impossible de charger tes données.<br />Vérifie ta connexion puis réessaie.</p>
      <button className="btn primary" onClick={onRetry}>Réessayer</button>
    </div>
  );
}
