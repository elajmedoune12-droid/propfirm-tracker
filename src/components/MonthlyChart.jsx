import React from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { fmt } from "../utils/format";

/* Graphique mensuel du Dashboard. Fichier séparé pour pouvoir le charger en
   lazy (React.lazy) : recharts ne rentre plus dans le bundle principal.
   Les couleurs passent par des variables CSS définies dans styles.css,
   donc le graphique suit automatiquement le thème sombre/clair. */
export default function MonthlyChart({ data }) {
  return (
    <ResponsiveContainer>
      <ComposedChart data={data} barGap={3} margin={{ left: -18, top: 6 }}>
        <defs>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2496B" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#F2496B" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35D28A" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#35D28A" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="month" stroke="var(--chart-tick)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} />
        <YAxis stroke="var(--chart-tick)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          cursor={{ fill: "var(--chart-cursor)" }}
          contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--text)", marginBottom: 4, fontWeight: 600 }}
          formatter={(v) => fmt(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Dépenses" fill="url(#gradExpense)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="Payouts" fill="url(#gradPayout)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Line
          type="monotone" dataKey="Net" stroke="#F7B731" strokeWidth={2.25}
          dot={{ r: 3, fill: "#F7B731", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#F7B731", stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
