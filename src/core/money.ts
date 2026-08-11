/**
 * Exakte Geldarithmetik ohne Gleitkommafehler.
 *
 * Alle Werte werden als skalierte BigInt geführt:
 *   - Mengen:       4 Nachkommastellen (Skala 10^4)
 *   - Einzelpreise: 4 Nachkommastellen (Skala 10^4, also 1/100 Cent)
 *   - Prozentsätze: 2 Nachkommastellen (Skala 10^2)
 *   - Beträge:      ganzzahlige Euro-Cent
 *
 * Rundung: kaufmännisch (round half away from zero), wie in der Praxis für
 * Rechnungsbeträge üblich.
 */

export type Cents = number;

export const QTY_FRACTION_DIGITS = 4;
export const PRICE_FRACTION_DIGITS = 4;
export const PCT_FRACTION_DIGITS = 2;

/**
 * Parst eine Dezimalzahl in deutscher ("1.234,56") oder internationaler
 * ("1234.56") Schreibweise in einen skalierten BigInt.
 * Gibt null zurück bei ungültiger Eingabe oder zu vielen Nachkommastellen.
 */
export function parseDecimal(input: string, maxFractionDigits: number): bigint | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[\s €]/g, "");
  if (s === "") return null;
  if (s.includes(",")) {
    // Deutsche Schreibweise: Punkte sind Tausendertrenner
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const [, sign, intPart, fracPart = ""] = m;
  if (fracPart.length > maxFractionDigits) return null;
  const scaled =
    BigInt(intPart) * 10n ** BigInt(maxFractionDigits) +
    BigInt(fracPart.padEnd(maxFractionDigits, "0") || "0");
  return sign === "-" ? -scaled : scaled;
}

export function parseQuantity(input: string): bigint | null {
  const v = parseDecimal(input, QTY_FRACTION_DIGITS);
  return v === null || v === 0n ? (v === 0n ? 0n : null) : v;
}

export function parseUnitPrice(input: string): bigint | null {
  return parseDecimal(input, PRICE_FRACTION_DIGITS);
}

export function parsePercent(input: string): bigint | null {
  const v = parseDecimal(input, PCT_FRACTION_DIGITS);
  if (v === null || v < 0n || v > 100_00n) return null;
  return v;
}

/** Betrag (z. B. "1.234,56" oder "1234.56") in Cent. */
export function parseAmountToCents(input: string): Cents | null {
  const v = parseDecimal(input, 2);
  if (v === null) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

/** Kaufmännische Rundung: n / d, halbe Werte weg von der Null. */
export function roundHalfAwayDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("Divisor muss positiv sein");
  const neg = n < 0n;
  const an = neg ? -n : n;
  const q = (2n * an + d) / (2n * d);
  return neg ? -q : q;
}

/** Positionsnetto in Cent aus skalierter Menge (10^4) und Einzelpreis (10^4). */
export function lineNetCents(qtyE4: bigint, priceE4: bigint): Cents {
  // qty * price ist 10^8-skaliert in Euro = 10^6-skaliert in Cent
  const cents = roundHalfAwayDiv(qtyE4 * priceE4, 1_000_000n);
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) throw new Error("Betrag außerhalb des darstellbaren Bereichs");
  return n;
}

/** Steuerbetrag in Cent aus Bemessungsgrundlage (Cent) und Prozentsatz (10^2). */
export function taxCents(taxableCents: Cents, pctE2: bigint): Cents {
  const cents = roundHalfAwayDiv(BigInt(taxableCents) * pctE2, 10_000n);
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) throw new Error("Betrag außerhalb des darstellbaren Bereichs");
  return n;
}

function groupThousands(digits: string, sep: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += sep;
  }
  return out;
}

/** "1.234,56" – deutsche Anzeige. */
export function formatCents(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const intPart = Math.trunc(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${groupThousands(intPart, ".")},${frac}`;
}

/** "1.234,56 €" */
export function formatEUR(cents: Cents): string {
  return `${formatCents(cents)} €`;
}

/** "1234.56" – XML-Schreibweise (Punkt, immer 2 Nachkommastellen). */
export function formatCentsPlain(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const intPart = Math.trunc(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${intPart}.${frac}`;
}

/** Skalierten BigInt als Dezimalzahl mit Punkt ausgeben, Nullen am Ende gekürzt. */
export function formatScaledPlain(value: bigint, fractionDigits: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(fractionDigits);
  const intPart = (abs / base).toString();
  let frac = (abs % base).toString().padStart(fractionDigits, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
}

/** Skalierten BigInt in deutscher Schreibweise anzeigen (für UI). */
export function formatScaledDE(value: bigint, fractionDigits: number): string {
  const plain = formatScaledPlain(value, fractionDigits);
  return plain.replace(".", ",");
}

/** Prozentsatz (10^2) als XML-Wert, z. B. 1900 → "19", 850 → "8.5". */
export function formatPercentPlain(pctE2: bigint): string {
  return formatScaledPlain(pctE2, PCT_FRACTION_DIGITS);
}
