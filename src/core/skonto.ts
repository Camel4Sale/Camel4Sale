/**
 * Skonto-Angaben nach XRechnung-Regel BR-DE-18.
 *
 * XRechnung verlangt für Skonto eine maschinenlesbare Struktur in den
 * Zahlungsbedingungen (BT-20), zeilenweise im Format:
 *
 *   #SKONTO#TAGE=14#PROZENT=2.00#
 *
 * Optional mit Basisbetrag: #SKONTO#TAGE=14#PROZENT=2.00#BASISBETRAG=119.00#
 * Freitext ist in eigenen Zeilen zulässig.
 */

import { formatScaledPlain, parseDecimal, roundHalfAwayDiv, type Cents } from "./money";

export interface SkontoLine {
  days: number;
  percentE2: bigint;
  baseAmountCents?: Cents;
}

// Offizielles Muster laut KoSIT-Schematron (Stand Bundle 2026-01-31): nur noch
// SKONTO (VERZUG wurde gestrichen), Prozent mit genau 2 Nachkommastellen.
export const SKONTO_LINE_RE =
  /^#(SKONTO)#TAGE=(\d+)#PROZENT=(\d+\.\d{2})(?:#BASISBETRAG=(-?\d+\.\d{2}))?#$/;

export function buildSkontoLine(days: number, percentE2: bigint): string {
  const pct = formatScaledPlain(percentE2, 2);
  const [intPart, frac = ""] = pct.split(".");
  return `#SKONTO#TAGE=${days}#PROZENT=${intPart}.${frac.padEnd(2, "0")}#`;
}

/** Baut die komplette BT-20-Note: Skonto-Zeilen zuerst, dann Freitext. */
export function buildPaymentTermsNote(
  terms: { days: number; percent: string }[],
  freeText?: string
): { note: string; errors: string[] } {
  const errors: string[] = [];
  const lines: string[] = [];
  for (const t of terms) {
    const pctE2 = parseDecimal(t.percent, 2);
    if (pctE2 === null || pctE2 <= 0n || pctE2 >= 100_00n) {
      errors.push(`Ungültiger Skonto-Prozentsatz: „${t.percent}“`);
      continue;
    }
    if (!Number.isInteger(t.days) || t.days <= 0) {
      errors.push(`Ungültige Skonto-Tage: „${t.days}“`);
      continue;
    }
    lines.push(buildSkontoLine(t.days, pctE2));
  }
  if (freeText && freeText.trim()) lines.push(freeText.trim());
  return { note: lines.join("\n"), errors };
}

/** Prüft eine BT-20-Note auf BR-DE-18-Konformität der #-Zeilen. */
export function validateSkontoNote(note: string): string[] {
  const problems: string[] = [];
  for (const raw of note.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#") && !SKONTO_LINE_RE.test(line)) {
      problems.push(line);
    }
  }
  return problems;
}

export function parseSkontoNote(note: string): SkontoLine[] {
  const result: SkontoLine[] = [];
  for (const raw of note.split("\n")) {
    const m = SKONTO_LINE_RE.exec(raw.trim());
    if (m) {
      const pct = parseDecimal(m[3], 2);
      const base = m[4] ? parseDecimal(m[4], 2) : null;
      if (pct !== null) {
        result.push({
          days: Number(m[2]),
          percentE2: pct,
          baseAmountCents: base !== null ? Number(base) : undefined
        });
      }
    }
  }
  return result;
}

/** Skontobetrag in Cent (kaufmännisch gerundet). */
export function skontoAmountCents(totalCents: Cents, percentE2: bigint): Cents {
  return Number(roundHalfAwayDiv(BigInt(totalCents) * percentE2, 10_000n));
}
