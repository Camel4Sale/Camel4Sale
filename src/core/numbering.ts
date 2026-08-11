/**
 * Fortlaufende Rechnungsnummern über Vorlagen-Templates.
 *
 * Platzhalter:
 *   {JJJJ}  Jahr vierstellig      {JJ}  Jahr zweistellig
 *   {MM}    Monat zweistellig
 *   {lfd}   laufende Nummer       {lfd3}/{lfd4}/{lfd5}  mit führenden Nullen
 *
 * Der Zähler läuft pro Kalenderjahr (üblich in DE, GoBD-freundlich lückenlos).
 */

export const DEFAULT_NUMBER_TEMPLATE = "{JJJJ}-{lfd4}";

export function templateIsValid(template: string): boolean {
  return /\{lfd[345]?\}/.test(template) && template.trim().length > 0;
}

export function formatInvoiceNumber(template: string, isoDate: string, seq: number): string {
  const year = isoDate.slice(0, 4);
  const month = isoDate.slice(5, 7);
  return template
    .replace(/\{JJJJ\}/g, year)
    .replace(/\{JJ\}/g, year.slice(2))
    .replace(/\{MM\}/g, month)
    .replace(/\{lfd5\}/g, String(seq).padStart(5, "0"))
    .replace(/\{lfd4\}/g, String(seq).padStart(4, "0"))
    .replace(/\{lfd3\}/g, String(seq).padStart(3, "0"))
    .replace(/\{lfd\}/g, String(seq));
}
