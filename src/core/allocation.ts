/**
 * Abrechnungs-Engine: verteilt Kosten tagesgenau auf Nutzungssegmente.
 *
 * Prinzipien:
 *  - Jede Einheit wird für den Abrechnungszeitraum in Segmente zerlegt
 *    (Mietverhältnisse + Leerstand). Leerstand trägt der Vermieter.
 *  - Gewichte je Verteilerschlüssel (Fläche×Tage, Personen×Tage, Tage,
 *    Verbrauch, direkt); Heiz-/Warmwasserkosten werden nach HeizkostenV in
 *    Verbrauchs- und Grundkostenanteil gesplittet.
 *  - Rundung centgenau mit Restverteilung (largest remainder):
 *    Die Summe der Anteile ergibt IMMER exakt den Gesamtbetrag.
 */

import type {
  CostItem,
  CostType,
  MeterReading,
  Period,
  Property,
  Tenancy,
  Unit
} from "./model";
import { compareISO, daysInclusive, monthSegments, overlapDays } from "./dates";
import { parseDecimal, roundHalfAwayDiv, type Cents } from "./money";

export interface Segment {
  unitId: string;
  unitLabel: string;
  tenancyId: string | null; // null = Leerstand (Vermieter)
  tenantName: string; // "Leerstand (Vermieter)" bei null
  persons: number;
  start: string;
  end: string;
  days: number;
}

export interface CostShare {
  costTypeId: string;
  costTypeName: string;
  keyLabel: string;
  totalCents: Cents;
  shareCents: Cents;
  /** Anteilsbeschreibung, z. B. "64,5 m² × 365 Tage von 23.544 m²-Tagen" */
  basis: string;
}

export interface SegmentResult {
  segment: Segment;
  shares: CostShare[];
  totalCents: Cents;
  advanceCents: Cents;
  /** positiv = Guthaben des Mieters, negativ = Nachzahlung */
  balanceCents: Cents;
}

export interface Finding {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  hint?: string;
}

export interface AllocationResult {
  segments: SegmentResult[];
  totalCostCents: Cents;
  findings: Finding[];
  periodDays: number;
}

export interface AllocationInput {
  property: Property;
  units: Unit[];
  tenancies: Tenancy[];
  period: Period;
  costTypes: CostType[];
  costItems: CostItem[];
  meterReadings: MeterReading[];
}

const VACANCY_LABEL = "Leerstand (Vermieter)";

function f(id: string, severity: Finding["severity"], message: string, hint?: string): Finding {
  return { id, severity, message, hint };
}

/** Verteilt totalCents nach BigInt-Gewichten; Summe stimmt exakt (largest remainder). */
export function distributeByWeights(totalCents: Cents, weights: bigint[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum <= 0n || weights.length === 0) return weights.map(() => 0);
  const total = BigInt(totalCents);
  const floors: Cents[] = [];
  const remainders: { idx: number; rem: bigint }[] = [];
  let assigned = 0n;
  weights.forEach((w, idx) => {
    const exact = total * w; // Skala: cents × weight
    const fl = exact / sum; // BigInt-Division: bei negativen totals Richtung 0
    floors.push(Number(fl));
    assigned += fl;
    remainders.push({ idx, rem: exact - fl * sum });
  });
  let rest = Number(total - assigned);
  const sign = rest < 0 ? -1 : 1;
  remainders.sort((a, b) => (sign > 0 ? (b.rem < a.rem ? -1 : 1) : a.rem < b.rem ? -1 : 1));
  for (let i = 0; rest !== 0 && i < remainders.length; i++) {
    floors[remainders[i].idx] += sign;
    rest -= sign;
  }
  return floors;
}

/** Zerlegt eine Einheit in Nutzungssegmente über den Zeitraum (inkl. Leerstand). */
export function buildSegments(
  unit: Unit,
  tenancies: Tenancy[],
  period: Period,
  findings: Finding[]
): Segment[] {
  const relevant = tenancies
    .filter((t) => t.unitId === unit.id)
    .map((t) => ({
      t,
      ov: overlapDays(t.start, t.end ?? period.end, period.start, period.end)
    }))
    .filter((x): x is { t: Tenancy; ov: NonNullable<ReturnType<typeof overlapDays>> } =>
      Boolean(x.ov)
    )
    .sort((a, b) => compareISO(a.ov.start, b.ov.start));

  const segments: Segment[] = [];
  let cursor = period.start;
  for (const { t, ov } of relevant) {
    if (compareISO(ov.start, cursor) < 0) {
      findings.push(
        f(
          "NK-UEBERLAPP",
          "error",
          `${unit.label}: Mietverhältnisse überschneiden sich (${t.tenantName} ab ${ov.start}).`,
          "Ein-/Auszugsdaten prüfen – pro Tag darf nur ein Mietverhältnis aktiv sein."
        )
      );
    }
    if (compareISO(ov.start, cursor) > 0) {
      const vacEnd = addDays(ov.start, -1);
      segments.push(vacancySegment(unit, cursor, vacEnd));
    }
    segments.push({
      unitId: unit.id,
      unitLabel: unit.label,
      tenancyId: t.id,
      tenantName: t.tenantName,
      persons: t.persons,
      start: ov.start,
      end: ov.end,
      days: ov.days
    });
    cursor = addDays(ov.end, 1);
    if (compareISO(cursor, period.end) > 0) break;
  }
  if (compareISO(cursor, period.end) <= 0) {
    segments.push(vacancySegment(unit, cursor, period.end));
  }
  return segments;
}

function vacancySegment(unit: Unit, start: string, end: string): Segment {
  return {
    unitId: unit.id,
    unitLabel: unit.label,
    tenancyId: null,
    tenantName: VACANCY_LABEL,
    persons: 0,
    start,
    end,
    days: daysInclusive(start, end)
  };
}

function addDays(iso: string, days: number): string {
  const t = new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Vorauszahlungen eines Mietverhältnisses im Zeitraum (kalendermonatsgenau anteilig). */
export function advanceForTenancy(t: Tenancy, period: Period): Cents {
  if (t.advancePaidOverride?.trim()) {
    const v = parseDecimal(t.advancePaidOverride, 2);
    if (v !== null) return Number(v);
  }
  const monthly = parseDecimal(t.monthlyAdvance, 2);
  if (monthly === null) return 0;
  const ov = overlapDays(t.start, t.end ?? period.end, period.start, period.end);
  if (!ov) return 0;
  let cents = 0n;
  for (const seg of monthSegments(ov.start, ov.end)) {
    // Monatsbetrag × belegte Tage / Tage des Monats, kaufmännisch je Monat
    cents += roundHalfAwayDiv(monthly * BigInt(seg.overlapDays), BigInt(seg.daysInMonth));
  }
  return Number(cents);
}

export function allocate(input: AllocationInput): AllocationResult {
  const { property, units, tenancies, period, costTypes, costItems, meterReadings } = input;
  const findings: Finding[] = [];
  const periodDays = daysInclusive(period.start, period.end);

  if (compareISO(period.start, period.end) > 0) {
    return {
      segments: [],
      totalCostCents: 0,
      findings: [f("NK-ZEITRAUM", "error", "Der Abrechnungszeitraum ist ungültig (Beginn nach Ende).")],
      periodDays: 0
    };
  }
  if (periodDays > 366) {
    findings.push(
      f(
        "NK-556-ZEITRAUM",
        "error",
        `Der Abrechnungszeitraum umfasst ${periodDays} Tage – erlaubt sind höchstens 12 Monate (§ 556 Abs. 3 BGB).`
      )
    );
  }

  // Segmente aller Einheiten
  const segments: Segment[] = [];
  for (const unit of units) {
    const area = parseDecimal(unit.areaSqm, 2);
    if (area === null || area <= 0n) {
      findings.push(f("NK-FLAECHE", "error", `${unit.label}: Wohnfläche fehlt oder ist ungültig.`));
    }
    segments.push(...buildSegments(unit, tenancies, period, findings));
  }
  const vacancyDays = segments.filter((s) => s.tenancyId === null).reduce((a, s) => a + s.days, 0);
  if (vacancyDays > 0) {
    findings.push(
      f(
        "NK-LEERSTAND",
        "info",
        `${vacancyDays} Leerstands-Tage im Zeitraum – diese Anteile trägt der Vermieter.`
      )
    );
  }

  // Kosten je Kostenart aggregieren
  const results: SegmentResult[] = segments.map((segment) => ({
    segment,
    shares: [],
    totalCents: 0,
    advanceCents: 0,
    balanceCents: 0
  }));
  let totalCostCents = 0;

  const areaWeight = (s: Segment): bigint => {
    const unit = units.find((u) => u.id === s.unitId)!;
    const area = parseDecimal(unit.areaSqm, 2) ?? 0n;
    return area * BigInt(s.days);
  };

  for (const ct of costTypes) {
    const items = costItems.filter((i) => i.costTypeId === ct.id && i.periodId === period.id);
    if (items.length === 0) continue;
    let typeTotal = 0;
    let parseError = false;
    for (const item of items) {
      const v = parseDecimal(item.amount, 2);
      if (v === null) {
        findings.push(
          f("NK-BETRAG", "error", `${ct.name}: Betrag „${item.amount}“ ist keine gültige Zahl.`)
        );
        parseError = true;
      } else {
        typeTotal += Number(v);
      }
    }
    if (parseError) continue;
    totalCostCents += typeTotal;

    const keyLabel = keyLabelFor(ct);
    const addShares = (cents: Cents[], basisFor: (s: Segment, idx: number) => string, label = keyLabel) => {
      cents.forEach((c, i) => {
        if (c === 0 && results[i].segment.days === 0) return;
        results[i].shares.push({
          costTypeId: ct.id,
          costTypeName: ct.name,
          keyLabel: label,
          totalCents: typeTotal,
          shareCents: c,
          basis: basisFor(results[i].segment, i)
        });
        results[i].totalCents += c;
      });
    };

    if (ct.isHeating) {
      // HeizkostenV: Verbrauchsanteil (50–70 %) + Grundkostenanteil nach Fläche
      const sharePct = Math.min(70, Math.max(50, property.heatingConsumptionSharePct || 70));
      const consumptionPart = Number(roundHalfAwayDiv(BigInt(typeTotal) * BigInt(sharePct), 100n));
      const basePart = typeTotal - consumptionPart;
      const consWeights = consumptionWeights(ct, segments, meterReadings, period);
      const hasConsumption = consWeights.some((w) => w > 0n);
      if (!hasConsumption) {
        findings.push(
          f(
            "NK-HEIZKV",
            "warning",
            `${ct.name}: Keine Verbrauchswerte erfasst – Verteilung erfolgt vollständig nach Wohnfläche.`,
            "Ohne verbrauchsabhängige Abrechnung steht Mietern ein Kürzungsrecht von 15 % zu (§ 12 HeizkostenV)."
          )
        );
        addShares(
          distributeByWeights(typeTotal, segments.map(areaWeight)),
          (s) => `nach Wohnfläche (${s.days} Tage)`,
          "Wohnfläche (ersatzweise)"
        );
      } else {
        addShares(
          distributeByWeights(consumptionPart, consWeights),
          (s) => `Verbrauchsanteil ${sharePct} % (${s.days} Tage)`,
          `Verbrauch (${sharePct} %)`
        );
        addShares(
          distributeByWeights(basePart, segments.map(areaWeight)),
          () => `Grundkostenanteil ${100 - sharePct} % nach Wohnfläche`,
          `Grundkosten (${100 - sharePct} %)`
        );
      }
      continue;
    }

    switch (ct.key) {
      case "flaeche":
        addShares(
          distributeByWeights(typeTotal, segments.map(areaWeight)),
          (s) => `${unitArea(units, s.unitId)} m² × ${s.days} Tage`
        );
        break;
      case "personen": {
        const weights = segments.map((s) =>
          BigInt((s.tenancyId === null ? property.vacancyPersons : s.persons) * s.days)
        );
        if (!weights.some((w) => w > 0n)) {
          findings.push(
            f("NK-PERSONEN", "warning", `${ct.name}: Keine Personenzahlen vorhanden – Kostenart bleibt unverteilt.`)
          );
          break;
        }
        addShares(
          distributeByWeights(typeTotal, weights),
          (s) => `${s.tenancyId === null ? property.vacancyPersons : s.persons} Person(en) × ${s.days} Tage`
        );
        break;
      }
      case "einheiten":
        addShares(
          distributeByWeights(typeTotal, segments.map((s) => BigInt(s.days))),
          (s) => `1 Einheit × ${s.days} Tage`
        );
        break;
      case "verbrauch": {
        const weights = consumptionWeights(ct, segments, meterReadings, period);
        if (!weights.some((w) => w > 0n)) {
          findings.push(
            f(
              "NK-ZAEHLER",
              "warning",
              `${ct.name}: Keine Zählerstände erfasst – Verteilung erfolgt ersatzweise nach Wohnfläche.`
            )
          );
          addShares(
            distributeByWeights(typeTotal, segments.map(areaWeight)),
            (s) => `nach Wohnfläche (${s.days} Tage)`,
            "Wohnfläche (ersatzweise)"
          );
        } else {
          addShares(
            distributeByWeights(typeTotal, weights),
            (s) => `Verbrauchsanteil (${s.days} Tage)`
          );
        }
        break;
      }
      case "direkt": {
        for (const item of items) {
          const amount = Number(parseDecimal(item.amount, 2) ?? 0n);
          const targetSegs = segments
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.unitId === item.directUnitId);
          if (targetSegs.length === 0) {
            findings.push(
              f("NK-DIREKT", "error", `${ct.name}: Direktzuordnung ohne (gültige) Ziel-Einheit.`)
            );
            continue;
          }
          const cents = distributeByWeights(
            amount,
            targetSegs.map(({ s }) => BigInt(s.days))
          );
          targetSegs.forEach(({ i }, k) => {
            results[i].shares.push({
              costTypeId: ct.id,
              costTypeName: ct.name,
              keyLabel: keyLabel,
              totalCents: amount,
              shareCents: cents[k],
              basis: `direkt zugeordnet (${results[i].segment.days} Tage)`
            });
            results[i].totalCents += cents[k];
          });
        }
        break;
      }
    }
  }

  if (totalCostCents === 0) {
    findings.push(f("NK-KOSTEN", "warning", "Für diesen Zeitraum sind noch keine Kosten erfasst."));
  }

  // Vorauszahlungen & Salden
  for (const r of results) {
    if (r.segment.tenancyId) {
      const t = tenancies.find((x) => x.id === r.segment.tenancyId)!;
      r.advanceCents = advanceForTenancy(t, period);
    }
    r.balanceCents = r.advanceCents - r.totalCents;
  }

  return { segments: results, totalCostCents, findings, periodDays };
}

function unitArea(units: Unit[], unitId: string): string {
  return units.find((u) => u.id === unitId)?.areaSqm ?? "?";
}

function keyLabelFor(ct: CostType): string {
  switch (ct.key) {
    case "flaeche":
      return "Wohnfläche";
    case "personen":
      return "Personen";
    case "einheiten":
      return "Einheiten";
    case "verbrauch":
      return "Verbrauch";
    case "direkt":
      return "direkt";
  }
}

/** Verbrauchsgewichte: Zähler je Einheit, bei Mieterwechsel tagesanteilig auf Segmente. */
function consumptionWeights(
  ct: CostType,
  segments: Segment[],
  meterReadings: MeterReading[],
  period: Period
): bigint[] {
  return segments.map((s) => {
    const reading = meterReadings.find(
      (m) => m.costTypeId === ct.id && m.unitId === s.unitId && m.periodId === period.id
    );
    if (!reading) return 0n;
    const consumption = parseDecimal(reading.consumption, 3) ?? 0n;
    if (consumption <= 0n) return 0n;
    const unitDays = segments
      .filter((x) => x.unitId === s.unitId)
      .reduce((a, x) => a + x.days, 0);
    if (unitDays === 0) return 0n;
    // lineare Tagesaufteilung des Einheiten-Verbrauchs auf die Segmente
    return consumption * BigInt(s.days);
  });
}

/** Prüfung der Abrechnungsfrist nach § 556 Abs. 3 BGB (12 Monate nach Zeitraumende). */
export function deadlineFinding(period: Period, today: string): Finding | null {
  const deadline = addDays(period.end, 365);
  if (compareISO(today, deadline) > 0) {
    return f(
      "NK-556-FRIST",
      "warning",
      `Die Abrechnungsfrist (12 Monate nach Zeitraumende, hier ${formatDe(deadline)}) ist überschritten.`,
      "Nachforderungen sind dann i. d. R. ausgeschlossen (§ 556 Abs. 3 BGB); Guthaben der Mieter bleiben fällig."
    );
  }
  return null;
}

function formatDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
