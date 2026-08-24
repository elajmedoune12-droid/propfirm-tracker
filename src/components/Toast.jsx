import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

/* Système de toasts minimaliste, sans contexte : n'importe quel module peut
   appeler toast.error(...) / toast.success(...) et le <Toaster/> monté une
   seule fois dans App affiche les notifications. api.js s'y branche pour
   remonter automatiquement les erreurs Supabase silencieuses. */

let listeners = [];
let seq = 0;

const emit = (t) => listeners.forEach((fn) => fn(t));
const push = (type, message, duration = 4000) => {
  const item = { id: ++seq, type, message };
  emit(item);
  setTimeout(() => emit({ id: item.id, type: "dismiss" }), duration);
};

export const toast = {
  success: (msg) => push("success", msg),
  error: (msg) => push("error", msg, 6000),
  info: (msg) => push("info", msg),
};

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onUpdate = (t) => {
      setItems((cur) =>
        t.type === "dismiss" ? cur.filter((i) => i.id !== t.id) : [...cur.slice(-3), t]
      );
    };
    listeners.push(onUpdate);
    return () => { listeners = listeners.filter((fn) => fn !== onUpdate); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((i) => {
        const Icon = ICONS[i.type] || Info;
        return (
          <div key={i.id} className={`toast toast-${i.type}`}>
            <Icon size={15} />
            <span className="toast-msg">{i.message}</span>
            <button className="toast-close" aria-label="Fermer"
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== i.id))}>
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
