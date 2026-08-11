/** IBAN-Prüfung nach ISO 13616 (Mod-97). */

const IBAN_LENGTHS: Record<string, number> = {
  AT: 20,
  BE: 16,
  CH: 21,
  DE: 22,
  DK: 18,
  ES: 24,
  FR: 27,
  GB: 22,
  IE: 22,
  IT: 27,
  LU: 20,
  NL: 18,
  PL: 28,
  PT: 25,
  SE: 24
};

export function normalizeIban(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  // Umstellung: erste 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0n;
  for (const ch of rearranged) {
    const v = ch >= "0" && ch <= "9" ? ch : (ch.charCodeAt(0) - 55).toString();
    remainder = (remainder * (v.length === 2 ? 100n : 10n) + BigInt(v)) % 97n;
  }
  return remainder === 1n;
}

/** IBAN in 4er-Gruppen für die Anzeige. */
export function formatIban(input: string): string {
  const iban = normalizeIban(input);
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Deutsche USt-IdNr: DE + 9 Ziffern. Andere EU-Länder: grobe Formatprüfung. */
export function isPlausibleVatId(vatId: string): boolean {
  const v = vatId.replace(/\s/g, "").toUpperCase();
  if (v.startsWith("DE")) return /^DE\d{9}$/.test(v);
  return /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(v);
}

/** Deutsche Steuernummer: 10–13 Ziffern (mit / oder Leerzeichen erlaubt). */
export function isPlausibleTaxNumber(taxNumber: string): boolean {
  const digits = taxNumber.replace(/[\s/.-]/g, "");
  return /^\d{10,13}$/.test(digits);
}
