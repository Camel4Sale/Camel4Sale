/** Berechnung aller Rechnungssummen und der USt-Aufschlüsselung (BG-23). */

import type { Invoice, InvoiceLine, TaxCategory } from "./model";
import { exemptionCodeFor, exemptionTextFor } from "./model";
import {
  lineNetCents,
  parsePercent,
  parseQuantity,
  parseUnitPrice,
  taxCents,
  type Cents
} from "./money";

export interface ComputedLine {
  line: InvoiceLine;
  index: number;
  qtyE4: bigint;
  priceE4: bigint;
  pctE2: bigint;
  netCents: Cents;
}

export interface TaxBreakdownEntry {
  category: TaxCategory;
  percentE2: bigint;
  taxableCents: Cents;
  taxCents: Cents;
  exemptionReason?: string;
  exemptionReasonCode?: string;
}

export interface Totals {
  lines: ComputedLine[];
  lineExtensionCents: Cents; // BT-106
  taxExclusiveCents: Cents; // BT-109
  taxTotalCents: Cents; // BT-110
  taxInclusiveCents: Cents; // BT-112
  payableCents: Cents; // BT-115
  breakdown: TaxBreakdownEntry[];
}

export interface LineError {
  lineIndex: number;
  field: "quantity" | "unitPrice" | "taxPercent";
  message: string;
}

export function computeLine(line: InvoiceLine, index: number): ComputedLine | LineError {
  const qtyE4 = parseQuantity(line.quantity);
  if (qtyE4 === null) {
    return { lineIndex: index, field: "quantity", message: `Position ${index + 1}: Menge „${line.quantity}“ ist keine gültige Zahl (max. 4 Nachkommastellen).` };
  }
  const priceE4 = parseUnitPrice(line.unitPrice);
  if (priceE4 === null) {
    return { lineIndex: index, field: "unitPrice", message: `Position ${index + 1}: Einzelpreis „${line.unitPrice}“ ist keine gültige Zahl (max. 4 Nachkommastellen).` };
  }
  const pctE2 = line.taxCategory === "S" ? parsePercent(line.taxPercent) : 0n;
  if (pctE2 === null) {
    return { lineIndex: index, field: "taxPercent", message: `Position ${index + 1}: USt-Satz „${line.taxPercent}“ ist ungültig.` };
  }
  return { line, index, qtyE4, priceE4, pctE2, netCents: lineNetCents(qtyE4, priceE4) };
}

function isLineError(v: ComputedLine | LineError): v is LineError {
  return (v as LineError).message !== undefined;
}

export function computeTotals(
  inv: Invoice
): { totals: Totals; errors: LineError[] } | { totals: null; errors: LineError[] } {
  const computed: ComputedLine[] = [];
  const errors: LineError[] = [];
  inv.lines.forEach((line, i) => {
    const r = computeLine(line, i);
    if (isLineError(r)) errors.push(r);
    else computed.push(r);
  });
  if (errors.length > 0 || computed.length === 0) return { totals: null, errors };

  // Gruppierung nach Kategorie + Prozentsatz
  const groups = new Map<string, TaxBreakdownEntry>();
  for (const c of computed) {
    const cat = c.line.taxCategory;
    const key = `${cat}|${c.pctE2.toString()}`;
    const entry = groups.get(key) ?? {
      category: cat,
      percentE2: c.pctE2,
      taxableCents: 0,
      taxCents: 0,
      exemptionReason: exemptionTextFor(cat, inv.seller.kleinunternehmer),
      exemptionReasonCode: exemptionCodeFor(cat)
    };
    entry.taxableCents += c.netCents;
    groups.set(key, entry);
  }
  const breakdown = [...groups.values()].sort((a, b) =>
    a.category === b.category
      ? Number(b.percentE2 - a.percentE2)
      : a.category.localeCompare(b.category)
  );
  for (const entry of breakdown) {
    entry.taxCents = entry.category === "S" ? taxCents(entry.taxableCents, entry.percentE2) : 0;
  }

  const lineExtensionCents = computed.reduce((s, c) => s + c.netCents, 0);
  const taxTotalCents = breakdown.reduce((s, b) => s + b.taxCents, 0);
  const taxExclusiveCents = lineExtensionCents;
  const taxInclusiveCents = taxExclusiveCents + taxTotalCents;

  return {
    totals: {
      lines: computed,
      lineExtensionCents,
      taxExclusiveCents,
      taxTotalCents,
      taxInclusiveCents,
      payableCents: taxInclusiveCents,
      breakdown
    },
    errors: []
  };
}
