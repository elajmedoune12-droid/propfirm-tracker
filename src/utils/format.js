export const fmt = (n) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const fmtSigned = (n) => {
  const v = Number(n) || 0;
  const s = "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v < 0 ? "-" + s : "+" + s;
};

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const addMonths = (dateStr, months) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + Number(months || 0));
  return d.toISOString().slice(0, 10);
};

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(todayStr());
  const target = new Date(dateStr);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// Calcule la prochaine date de payout à partir d'une date d'ancrage (idéalement
// la date à laquelle le compte est passé "funded" ; à défaut la date d'achat)
// et de la fréquence choisie. On avance cycle par cycle jusqu'à dépasser
// aujourd'hui, pour retomber juste sur la bonne échéance peu importe depuis
// quand le compte est financé.
export function nextPayoutDate(anchorDate, frequency) {
  // Un seul pas depuis le jour de reprise du trading — pas de saut automatique
  // vers plusieurs cycles dans le futur si le compte est resté inactif.
  // Si la date tombée est dépassée, c'est un vrai retard à afficher tel quel,
  // pas à masquer en avançant silencieusement.
  if (!anchorDate || !frequency || frequency === "on_demand" || frequency === "other") return null;
  let cursor = new Date(anchorDate);
  if (Number.isNaN(cursor.getTime())) return null;
  if (frequency === "weekly") cursor.setDate(cursor.getDate() + 7);
  else if (frequency === "bi_weekly") cursor.setDate(cursor.getDate() + 14);
  else if (frequency === "monthly") cursor.setMonth(cursor.getMonth() + 1);
  else return null;
  return cursor.toISOString().slice(0, 10);
}

export function downloadCSV(filename, rows, headers) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayoutsPDF(payouts, accountLabel, filename) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Historique des payouts", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Généré le ${todayStr()}`, 14, 24);

  const rows = payouts
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((p) => [p.date, accountLabel(p.account_id), fmt(p.amount), p.notes || ""]);

  autoTable(doc, {
    startY: 30,
    head: [["Date", "Compte", "Montant", "Note"]],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 34, 45] },
  });

  const total = payouts.reduce((s, p) => s + Number(p.amount), 0);
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 30;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`Total: ${fmt(total)}`, 14, finalY + 10);

  doc.save(filename);
}

export const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
};