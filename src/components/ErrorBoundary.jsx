import React from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/* Garde-fou global : une erreur de rendu n'écrase plus toute l'app.
   Utilisé à deux niveaux — autour de <App/> (écran de secours complet)
   et autour du contenu de chaque onglet (le reste de l'interface survit). */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-icon"><AlertTriangle size={22} /></div>
          <h2>Une erreur est survenue</h2>
          <p className="modal-text">
            {this.props.isolated
              ? "Cette page a planté, mais le reste de l'app fonctionne. Réessaie ou change d'onglet."
              : "L'application a rencontré un problème inattendu."}
          </p>
          <details className="error-details">
            <summary>Détails techniques</summary>
            <pre>{String(error?.message || error)}</pre>
          </details>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button className="btn ghost" onClick={() => window.location.reload()}>
              <Home size={14} /> Recharger
            </button>
            <button className="btn primary" onClick={this.retry}>
              <RotateCw size={14} /> Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }
}
