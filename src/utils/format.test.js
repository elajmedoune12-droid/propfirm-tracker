import { describe, it, expect, vi, beforeAll } from "vitest";
import { fmt, fmtSigned, daysUntil, addMonths, nextPayoutDate, timeAgo, downloadCSV } from "./format";

beforeAll(() => {
  // URL.createObjectURL et le DOM n'existent pas sous Node : stubs minimaux
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  global.document ??= { createElement: () => ({ click: () => {} }) };
});

describe("fmt", () => {
  it("formate les montants en dollars", () => {
    expect(fmt(1234567)).toBe("$1,234,567");
    expect(fmt(0)).toBe("$0");
  });
  it("tolère null/undefined/NaN", () => {
    expect(fmt(null)).toBe("$0");
    expect(fmt(undefined)).toBe("$0");
    expect(fmt("abc")).toBe("$0");
  });
});

describe("fmtSigned", () => {
  it("préfixe + et -", () => {
    expect(fmtSigned(500)).toBe("+$500");
    expect(fmtSigned(-1200)).toBe("-$1,200");
    expect(fmtSigned(0)).toBe("+$0");
  });
});

describe("daysUntil", () => {
  it("compte les jours restants", () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    expect(daysUntil(tomorrow)).toBe(1);
  });
  it("retourne null sans date", () => {
    expect(daysUntil("")).toBeNull();
    expect(daysUntil(null)).toBeNull();
  });
});

describe("addMonths", () => {
  it("ajoute des mois simplement", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });
});

describe("nextPayoutDate", () => {
  it("avance d'un cycle selon la fréquence", () => {
    expect(nextPayoutDate("2026-01-10", "weekly")).toBe("2026-01-17");
    expect(nextPayoutDate("2026-01-10", "bi_weekly")).toBe("2026-01-24");
    expect(nextPayoutDate("2026-01-10", "monthly")).toBe("2026-02-10");
  });
  it("retourne null pour on_demand / other / entrées invalides", () => {
    expect(nextPayoutDate("2026-01-10", "on_demand")).toBeNull();
    expect(nextPayoutDate("2026-01-10", "other")).toBeNull();
    expect(nextPayoutDate("", "weekly")).toBeNull();
    expect(nextPayoutDate("pas-une-date", "weekly")).toBeNull();
  });
});

describe("timeAgo", () => {
  it("exprime les durées courtes", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 30 * 1000).toISOString())).toBe("à l'instant");
    expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString())).toBe("il y a 5 min");
    expect(timeAgo(new Date(now - 3 * 3600 * 1000).toISOString())).toBe("il y a 3h");
    expect(timeAgo(new Date(now - 2 * 24 * 3600 * 1000).toISOString())).toBe("il y a 2j");
  });
});

describe("downloadCSV", () => {
  it("échappe les guillemets et saute une ligne par row", () => {
    let captured;
    const origBlob = global.Blob;
    global.Blob = class { constructor(parts) { captured = parts[0]; } };
    downloadCSV("test.csv",
      [{ a: 'say "hi"', b: 2 }, { a: "x", b: 3 }],
      ["a", "b"]);
    global.Blob = origBlob;
    expect(captured).toBe('"a","b"\n"say ""hi""","2"\n"x","3"');
  });
});
