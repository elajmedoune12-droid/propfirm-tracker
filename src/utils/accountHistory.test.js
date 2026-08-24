import { describe, it, expect } from "vitest";
import { accountsAsOfYear } from "./accountHistory";

const scaling = [];
const events = (accountId) => [
  { account_id: accountId, phase: "phase1", event_date: "2025-01-10" },
  { account_id: accountId, phase: "funded", event_date: "2025-06-01" },
];

describe("accountsAsOfYear", () => {
  it("utilise la phase en vigueur au 31/12 de l'année", () => {
    const accounts = [{ id: "a", phase: "phase1", size: 50000, initial_size: 25000 }];
    const res = accountsAsOfYear(accounts, events("a"), scaling, 2025);
    expect(res).toHaveLength(1);
    expect(res[0].yearPhase).toBe("funded");
  });

  it("exclut les comptes créés après l'année demandée", () => {
    const accounts = [{ id: "a", phase: "funded", size: 50000 }];
    const res = accountsAsOfYear(accounts, events("a"), scaling, 2024);
    expect(res).toHaveLength(0);
  });

  it("retombe sur la phase actuelle sans historique", () => {
    const accounts = [{ id: "legacy", phase: "breached", size: 10000 }];
    const res = accountsAsOfYear(accounts, [], scaling, 2025);
    expect(res[0].yearPhase).toBe("breached");
  });

  it("rejoue le scaling jusqu'à la date donnée", () => {
    const history = [
      { account_id: "s", old_size: 25000, new_size: 50000, applied_at: "2025-03-01" },
      { account_id: "s", old_size: 50000, new_size: 75000, applied_at: "2026-02-01" },
    ];
    const accounts = [{ id: "s", phase: "funded", size: 75000, initial_size: 25000 }];
    const y2025 = accountsAsOfYear(accounts, events("s"), history, 2025);
    expect(y2025[0].yearSize).toBe(50000); // seul le scaling de mars 2025 s'applique
    const y2026 = accountsAsOfYear(accounts, events("s"), history, 2026);
    expect(y2026[0].yearSize).toBe(75000); // le scaling de fév. 2026 compte aussi
  });
});
