import { describe, expect, it } from "vitest";
import {
  advanceForTenancy,
  allocate,
  buildSegments,
  deadlineFinding,
  distributeByWeights,
  type AllocationInput
} from "../src/core/allocation";
import type { CostType, Period, Property, Tenancy, Unit } from "../src/core/model";
import { newId } from "../src/core/model";
import { daysInclusive, monthSegments, overlapDays } from "../src/core/dates";

function baseProperty(): Property {
  return {
    id: "p1",
    name: "MFH Test",
    street: "Weg 1",
    zip: "76133",
    city: "Karlsruhe",
    landlordName: "V",
    landlordAddress: "Adresse",
    heatingConsumptionSharePct: 70,
    vacancyPersons: 1
  };
}

const period: Period = { id: "per1", propertyId: "p1", label: "2025", start: "2025-01-01", end: "2025-12-31" };

function unit(id: string, label: string, area: string): Unit {
  return { id, propertyId: "p1", label, areaSqm: area };
}

function tenancy(unitId: string, name: string, persons: number, start: string, end?: string, monthly = "100,00"): Tenancy {
  return { id: newId(), unitId, tenantName: name, persons, start, end, monthlyAdvance: monthly };
}

function costType(id: string, name: string, key: CostType["key"], isHeating = false): CostType {
  return { id, propertyId: "p1", name, key, isHeating };
}

function input(partial: Partial<AllocationInput>): AllocationInput {
  return {
    property: baseProperty(),
    units: [],
    tenancies: [],
    period,
    costTypes: [],
    costItems: [],
    meterReadings: [],
    ...partial
  };
}

describe("Datums-Arithmetik", () => {
  it("zählt Tage inklusiv", () => {
    expect(daysInclusive("2025-01-01", "2025-12-31")).toBe(365);
    expect(daysInclusive("2024-01-01", "2024-12-31")).toBe(366); // Schaltjahr
    expect(daysInclusive("2025-06-30", "2025-06-30")).toBe(1);
  });
  it("berechnet Überlappungen", () => {
    expect(overlapDays("2025-05-01", "2025-05-31", "2025-01-01", "2025-12-31")?.days).toBe(31);
    expect(overlapDays("2024-01-01", "2024-12-31", "2025-01-01", "2025-12-31")).toBeNull();
  });
  it("zerlegt in Kalendermonate", () => {
    const segs = monthSegments("2025-06-15", "2025-08-10");
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ month: 6, daysInMonth: 30, overlapDays: 16 });
    expect(segs[2]).toMatchObject({ month: 8, overlapDays: 10 });
  });
});

describe("distributeByWeights (Rundungsausgleich)", () => {
  it("Summe stimmt immer exakt", () => {
    const cents = distributeByWeights(10000, [1n, 1n, 1n]); // 100 € auf 3
    expect(cents.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(cents.filter((c) => c === 3333).length).toBe(2);
    expect(cents.filter((c) => c === 3334).length).toBe(1);
  });
  it("verteilt proportional", () => {
    const cents = distributeByWeights(9000, [2n, 1n]);
    expect(cents).toEqual([6000, 3000]);
  });
  it("Null-Gewichte ergeben 0", () => {
    expect(distributeByWeights(5000, [0n, 0n])).toEqual([0, 0]);
  });
  it("funktioniert mit vielen ungeraden Gewichten (Invariante)", () => {
    const weights = [37n, 113n, 59n, 7n, 211n, 89n];
    const cents = distributeByWeights(123457, weights);
    expect(cents.reduce((a, b) => a + b, 0)).toBe(123457);
  });
});

describe("buildSegments (tagesgenau, Leerstand)", () => {
  it("durchgehendes Mietverhältnis = 1 Segment", () => {
    const u = unit("u1", "Whg. 1", "60");
    const segs = buildSegments(u, [tenancy("u1", "A", 2, "2020-01-01")], period, []);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ tenantName: "A", days: 365 });
  });
  it("Mieterwechsel mit Leerstand dazwischen", () => {
    const u = unit("u1", "Whg. 1", "60");
    const segs = buildSegments(
      u,
      [tenancy("u1", "Alt", 2, "2020-01-01", "2025-06-30"), tenancy("u1", "Neu", 1, "2025-08-01")],
      period,
      []
    );
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ tenantName: "Alt", days: 181 });
    expect(segs[1]).toMatchObject({ tenantName: "Leerstand (Vermieter)", days: 31 });
    expect(segs[2]).toMatchObject({ tenantName: "Neu", days: 153 });
    expect(segs.reduce((a, s) => a + s.days, 0)).toBe(365);
  });
  it("meldet Überschneidungen", () => {
    const findings: { id: string }[] = [];
    buildSegments(
      unit("u1", "Whg. 1", "60"),
      [tenancy("u1", "A", 1, "2025-01-01", "2025-06-30"), tenancy("u1", "B", 1, "2025-06-01")],
      period,
      findings as never
    );
    expect(findings.some((x) => x.id === "NK-UEBERLAPP")).toBe(true);
  });
});

describe("advanceForTenancy", () => {
  it("volles Jahr = 12 Monatsbeträge", () => {
    expect(advanceForTenancy(tenancy("u1", "A", 1, "2024-01-01", undefined, "180,00"), period)).toBe(
      216000
    );
  });
  it("halber Monat wird anteilig gerechnet", () => {
    // Einzug 16.06.2025: Juni anteilig 15/30 = 90 €, Jul–Dez = 6 × 180 €
    const t = tenancy("u1", "A", 1, "2025-06-16", undefined, "180,00");
    expect(advanceForTenancy(t, period)).toBe(9000 + 6 * 18000);
  });
  it("Override gewinnt", () => {
    const t = { ...tenancy("u1", "A", 1, "2020-01-01"), advancePaidOverride: "1.234,56" };
    expect(advanceForTenancy(t, period)).toBe(123456);
  });
});

describe("allocate – Verteilerschlüssel", () => {
  const units2 = [unit("u1", "Whg. 1", "60"), unit("u2", "Whg. 2", "40")];
  const fullTenancies = [tenancy("u1", "A", 2, "2020-01-01"), tenancy("u2", "B", 1, "2020-01-01")];

  it("Wohnfläche: 60/40-Verteilung", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: fullTenancies,
        costTypes: [costType("c1", "Grundsteuer", "flaeche")],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "1.000,00" }]
      })
    );
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    const b = r.segments.find((s) => s.segment.tenantName === "B")!;
    expect(a.totalCents).toBe(60000);
    expect(b.totalCents).toBe(40000);
    expect(r.totalCostCents).toBe(100000);
  });

  it("Personen×Tage inkl. Leerstand mit fiktiver Person", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: [tenancy("u1", "A", 3, "2020-01-01")], // u2 ganzes Jahr leer
        costTypes: [costType("c1", "Müll", "personen")],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "400,00" }]
      })
    );
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    const leer = r.segments.find((s) => s.segment.tenantName.includes("Leerstand"))!;
    // Gewichte: 3 Personen vs. 1 fiktive Person → 300 € / 100 €
    expect(a.totalCents).toBe(30000);
    expect(leer.totalCents).toBe(10000);
  });

  it("Verbrauch nach Zählern, Mieterwechsel teilt Einheiten-Verbrauch nach Tagen", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: [
          tenancy("u1", "Alt", 1, "2020-01-01", "2025-06-30"),
          tenancy("u1", "Neu", 1, "2025-07-01"),
          tenancy("u2", "B", 1, "2020-01-01")
        ],
        costTypes: [costType("c1", "Wasser", "verbrauch")],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "600,00" }],
        meterReadings: [
          { id: "m1", periodId: "per1", costTypeId: "c1", unitId: "u1", consumption: "100" },
          { id: "m2", periodId: "per1", costTypeId: "c1", unitId: "u2", consumption: "50" }
        ]
      })
    );
    const sum = r.segments.reduce((a, s) => a + s.totalCents, 0);
    expect(sum).toBe(60000); // Invariante
    const b = r.segments.find((s) => s.segment.tenantName === "B")!;
    expect(b.totalCents).toBe(20000); // 50 von 150 Einheiten
    const alt = r.segments.find((s) => s.segment.tenantName === "Alt")!;
    const neu = r.segments.find((s) => s.segment.tenantName === "Neu")!;
    expect(alt.totalCents + neu.totalCents).toBe(40000);
    expect(alt.totalCents).toBeLessThan(neu.totalCents); // 181 vs. 184 Tage
  });

  it("HeizkostenV: 70 % Verbrauch + 30 % Fläche", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: fullTenancies,
        costTypes: [{ ...costType("c1", "Heizung", "verbrauch", true) }],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "1.000,00" }],
        meterReadings: [
          { id: "m1", periodId: "per1", costTypeId: "c1", unitId: "u1", consumption: "80" },
          { id: "m2", periodId: "per1", costTypeId: "c1", unitId: "u2", consumption: "20" }
        ]
      })
    );
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    const b = r.segments.find((s) => s.segment.tenantName === "B")!;
    // Verbrauchsanteil 700 €: 80/100 → 560 / 140; Grundkosten 300 €: 60/40 → 180 / 120
    expect(a.totalCents).toBe(56000 + 18000);
    expect(b.totalCents).toBe(14000 + 12000);
  });

  it("Heizung ohne Zähler → Fläche + Kürzungsrechts-Warnung", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: fullTenancies,
        costTypes: [{ ...costType("c1", "Heizung", "verbrauch", true) }],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "1.000,00" }]
      })
    );
    expect(r.findings.some((x) => x.id === "NK-HEIZKV")).toBe(true);
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    expect(a.totalCents).toBe(60000);
  });

  it("Direktzuordnung landet nur bei der Ziel-Einheit", () => {
    const r = allocate(
      input({
        units: units2,
        tenancies: fullTenancies,
        costTypes: [costType("c1", "Kabelanschluss Whg. 2", "direkt")],
        costItems: [
          { id: "i1", periodId: "per1", costTypeId: "c1", amount: "120,00", directUnitId: "u2" }
        ]
      })
    );
    const b = r.segments.find((s) => s.segment.tenantName === "B")!;
    expect(b.totalCents).toBe(12000);
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    expect(a.totalCents).toBe(0);
  });

  it("Saldo = Vorauszahlung − Anteil", () => {
    const r = allocate(
      input({
        units: [unit("u1", "Whg. 1", "60")],
        tenancies: [tenancy("u1", "A", 2, "2020-01-01", undefined, "50,00")],
        costTypes: [costType("c1", "Grundsteuer", "flaeche")],
        costItems: [{ id: "i1", periodId: "per1", costTypeId: "c1", amount: "500,00" }]
      })
    );
    const a = r.segments.find((s) => s.segment.tenantName === "A")!;
    expect(a.advanceCents).toBe(60000);
    expect(a.totalCents).toBe(50000);
    expect(a.balanceCents).toBe(10000); // Guthaben
  });

  it("Zeitraum > 12 Monate ist ein Fehler (§ 556 BGB)", () => {
    const r = allocate(
      input({ period: { ...period, end: "2026-02-01" }, units: [unit("u1", "W", "60")] })
    );
    expect(r.findings.some((x) => x.id === "NK-556-ZEITRAUM")).toBe(true);
  });

  it("Fristprüfung § 556: 12 Monate nach Ende", () => {
    expect(deadlineFinding(period, "2026-12-30")).toBeNull();
    expect(deadlineFinding(period, "2027-01-02")?.id).toBe("NK-556-FRIST");
  });
});
