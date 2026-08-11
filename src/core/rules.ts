/**
 * Prüfregeln für Rechnungen.
 *
 * Implementiert eine praxisrelevante Teilmenge der Geschäftsregeln aus
 * EN 16931 (BR-*, BR-CO-*) und der XRechnung-CIUS (BR-DE-*) sowie zusätzliche
 * deutsche Plausibilitätsprüfungen (§ 14 UStG, IBAN, USt-IdNr).
 *
 * Wichtig (siehe README): Diese Prüfung ersetzt nicht den offiziellen
 * KoSIT-Referenzvalidator; sie ist eine schnelle, lokale Vorprüfung mit
 * verständlichen deutschen Meldungen.
 */

import type { Invoice } from "./model";
import type { LineError, Totals } from "./totals";
import { isPlausibleTaxNumber, isPlausibleVatId, isValidIban } from "./iban";
import { compareISO, isValidISODate } from "./dates";
import { buildPaymentTermsNote, validateSkontoNote } from "./skonto";
import { parsePercent, parseUnitPrice, taxCents, type Cents } from "./money";
import type { ParsedInvoice } from "./parse";

export type Severity = "error" | "warning" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  hint?: string;
}

const BIC_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

function f(id: string, severity: Severity, message: string, hint?: string): Finding {
  return { id, severity, message, hint };
}

export function sortFindings(findings: Finding[]): Finding[] {
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const x of findings) c[x.severity]++;
  return c;
}

/** Prüfung einer in der App erstellten Rechnung (vor Finalisierung/Export). */
export function validateInvoice(
  inv: Invoice,
  totals: Totals | null,
  lineErrors: LineError[]
): Finding[] {
  const out: Finding[] = [];
  const s = inv.seller;
  const b = inv.buyer;

  // --- Verkäufer ---
  if (!s.name.trim()) out.push(f("BR-06", "error", "Ihr Firmenname fehlt (Stammdaten → Meine Firma)."));
  if (!s.street.trim() || !s.zip.trim() || !s.city.trim() || !s.countryCode.trim())
    out.push(f("BR-08", "error", "Ihre Anschrift ist unvollständig (Straße, PLZ, Ort, Land)."));
  if (!s.vatId?.trim() && !s.taxNumber?.trim())
    out.push(
      f(
        "BR-CO-26",
        "error",
        "USt-IdNr. oder Steuernummer des Rechnungsstellers fehlt.",
        "Mindestens eine der beiden Angaben ist Pflicht (§ 14 UStG, BT-31/BT-32)."
      )
    );
  if (s.vatId?.trim() && !isPlausibleVatId(s.vatId))
    out.push(f("XR-VATID", "warning", `Ihre USt-IdNr. „${s.vatId}“ sieht ungewöhnlich aus (erwartet z. B. DE123456789).`));
  if (s.taxNumber?.trim() && !isPlausibleTaxNumber(s.taxNumber))
    out.push(f("XR-STNR", "warning", `Ihre Steuernummer „${s.taxNumber}“ sieht ungewöhnlich aus (10–13 Ziffern).`));
  if (!s.contactName.trim())
    out.push(f("BR-DE-5", "error", "Ansprechpartner fehlt (XRechnung-Pflicht, Stammdaten → Meine Firma)."));
  if (!s.phone.trim())
    out.push(f("BR-DE-6", "error", "Telefonnummer fehlt (XRechnung-Pflicht, Stammdaten → Meine Firma)."));
  if (!s.email.trim())
    out.push(f("BR-DE-7", "error", "E-Mail-Adresse fehlt (XRechnung-Pflicht, Stammdaten → Meine Firma)."));
  if (!s.iban.trim())
    out.push(f("BR-DE-1", "error", "IBAN fehlt – XRechnung verlangt Zahlungsangaben (Überweisung)."));
  else if (!isValidIban(s.iban))
    out.push(f("XR-IBAN", "error", `Die IBAN „${s.iban}“ ist ungültig (Prüfziffern-Check fehlgeschlagen).`));
  if (s.bic?.trim() && !BIC_RE.test(s.bic.replace(/\s/g, "").toUpperCase()))
    out.push(f("XR-BIC", "warning", `Der BIC „${s.bic}“ hat kein gültiges Format (8 oder 11 Stellen).`));

  // --- Käufer ---
  if (!b.name.trim()) out.push(f("BR-07", "error", "Der Name des Rechnungsempfängers fehlt."));
  if (!b.street.trim() || !b.zip.trim() || !b.city.trim() || !b.countryCode.trim())
    out.push(f("BR-10", "error", "Die Anschrift des Rechnungsempfängers ist unvollständig."));
  if (!b.email?.trim())
    out.push(
      f(
        "XR-B-MAIL",
        "warning",
        "E-Mail-Adresse des Empfängers fehlt (elektronische Adresse, BT-49).",
        "Viele Empfangsplattformen und Peppol setzen eine elektronische Adresse voraus."
      )
    );
  if (b.vatId?.trim() && !isPlausibleVatId(b.vatId))
    out.push(f("XR-VATID-K", "warning", `Die USt-IdNr. des Empfängers „${b.vatId}“ sieht ungewöhnlich aus.`));

  // --- Kopfdaten ---
  if (!isValidISODate(inv.issueDate)) out.push(f("BR-03", "error", "Das Rechnungsdatum ist ungültig."));
  if (inv.dueDate && !isValidISODate(inv.dueDate))
    out.push(f("XR-DATUM-F", "error", "Das Fälligkeitsdatum ist ungültig."));
  if (
    inv.dueDate &&
    isValidISODate(inv.dueDate) &&
    isValidISODate(inv.issueDate) &&
    compareISO(inv.dueDate, inv.issueDate) < 0
  )
    out.push(f("XR-DATUM", "error", "Das Fälligkeitsdatum liegt vor dem Rechnungsdatum."));
  if (!inv.buyerReference.trim())
    out.push(
      f(
        "BR-DE-15",
        "error",
        "Die Käuferreferenz (BT-10) fehlt.",
        "Bei Behörden: Leitweg-ID. Bei Unternehmen: z. B. Kundennummer, Bestellzeichen oder „n/a“ nach Absprache."
      )
    );
  const hasPeriod = Boolean(inv.periodStart || inv.periodEnd);
  if (!inv.deliveryDate && !hasPeriod)
    out.push(
      f(
        "DE-UST-14",
        "warning",
        "Kein Liefer-/Leistungsdatum und kein Leistungszeitraum angegeben.",
        "§ 14 Abs. 4 UStG verlangt den Zeitpunkt der Leistung; er darf dem Rechnungsdatum entsprechen."
      )
    );
  if (inv.deliveryDate && !isValidISODate(inv.deliveryDate))
    out.push(f("XR-DATUM-L", "error", "Das Leistungsdatum ist ungültig."));
  if (inv.periodStart && inv.periodEnd && compareISO(inv.periodStart, inv.periodEnd) > 0)
    out.push(f("XR-ZEITRAUM", "error", "Der Leistungszeitraum ist ungültig (Beginn liegt nach Ende)."));
  if (
    !inv.dueDate &&
    inv.skonto.length === 0 &&
    !inv.paymentTermsText?.trim() &&
    (totals ? totals.payableCents > 0 : true)
  )
    out.push(
      f(
        "BR-CO-25",
        "error",
        "Fälligkeitsdatum oder Zahlungsbedingungen fehlen.",
        "Bei positivem Zahlbetrag verlangt die EN 16931 eines von beiden (BT-9 oder BT-20)."
      )
    );

  // --- Storno / Korrektur ---
  if (inv.typeCode === 384 && !inv.precedingInvoiceNumber?.trim())
    out.push(
      f(
        "XR-STORNO",
        "error",
        "Für eine Rechnungskorrektur/Storno muss die Nummer der Ursprungsrechnung angegeben werden (BG-3)."
      )
    );

  // --- Positionen ---
  if (inv.lines.length === 0) out.push(f("BR-16", "error", "Die Rechnung enthält keine Positionen."));
  for (const e of lineErrors) out.push(f("XR-POS", "error", e.message));
  inv.lines.forEach((line, i) => {
    const pos = `Position ${i + 1}`;
    if (!line.name.trim()) out.push(f("BR-25", "error", `${pos}: Bezeichnung fehlt.`));
    const price = parseUnitPrice(line.unitPrice);
    if (price !== null && price < 0n)
      out.push(
        f(
          "BR-27",
          "error",
          `${pos}: Der Einzelpreis darf nicht negativ sein.`,
          "Für Gutschriften/Storno stattdessen eine negative Menge erfassen."
        )
      );
    if (line.taxCategory === "S") {
      const pct = parsePercent(line.taxPercent);
      if (pct !== null && pct === 0n)
        out.push(
          f(
            "BR-S-05",
            "error",
            `${pos}: Kategorie „Umsatzsteuer“ mit 0 % ist unzulässig.`,
            "Für 0 % die passende Kategorie wählen (befreit, Reverse Charge, innergemeinschaftlich …)."
          )
        );
    }
    if (line.quantity.trim() === "0" || line.quantity.trim() === "0,0")
      out.push(f("XR-MENGE", "warning", `${pos}: Menge ist 0 – Position wirkt sich nicht aus.`));
    if (s.kleinunternehmer && line.taxCategory === "S")
      out.push(
        f(
          "DE-19-UST",
          "error",
          `${pos}: Als Kleinunternehmer (§ 19 UStG) dürfen Sie keine Umsatzsteuer ausweisen.`,
          "Kategorie „Steuerbefreit“ verwenden (wird automatisch mit § 19-Hinweis ausgegeben)."
        )
      );
    if (line.taxCategory === "AE" && !b.vatId?.trim())
      out.push(
        f(
          "BR-AE-04",
          "error",
          `${pos}: Reverse Charge erfordert die USt-IdNr. des Leistungsempfängers.`
        )
      );
    if (line.taxCategory === "K") {
      if (!b.vatId?.trim())
        out.push(
          f(
            "BR-IC-K",
            "error",
            `${pos}: Innergemeinschaftliche Lieferung erfordert die USt-IdNr. des Empfängers.`
          )
        );
      if (b.countryCode === "DE")
        out.push(
          f(
            "XR-IC-LAND",
            "error",
            `${pos}: Innergemeinschaftliche Lieferung an einen Empfänger in Deutschland ist nicht plausibel.`
          )
        );
    }
  });

  // --- Skonto / Zahlungsbedingungen ---
  const { note, errors: skontoErrors } = buildPaymentTermsNote(inv.skonto, inv.paymentTermsText);
  for (const msg of skontoErrors) out.push(f("XR-SKONTO", "error", msg));
  for (const badLine of validateSkontoNote(note))
    out.push(
      f(
        "BR-DE-18",
        "error",
        `Zahlungsbedingungen: Die Zeile „${badLine}“ entspricht nicht dem XRechnung-Skonto-Format.`,
        "Zeilen, die mit # beginnen, müssen exakt dem Muster #SKONTO#TAGE=n#PROZENT=n.nn# folgen."
      )
    );

  return sortFindings(out);
}

// ---------------------------------------------------------------------------
// Prüfung empfangener/fremder Rechnungen (Checker)
// ---------------------------------------------------------------------------

function centsClose(a: Cents, b: Cents, tolerance = 1): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function validateParsed(p: ParsedInvoice): Finding[] {
  const out: Finding[] = [];

  if (p.customizationId) {
    if (!p.customizationId.includes("xrechnung"))
      out.push(
        f(
          "XR-PROFIL",
          "info",
          "Das Dokument verwendet nicht das XRechnung-Profil.",
          `CustomizationID: ${p.customizationId}`
        )
      );
  } else {
    out.push(f("BR-01", "error", "Die Spezifikations-Kennung (BT-24/CustomizationID) fehlt."));
  }

  if (!p.number) out.push(f("BR-02", "error", "Die Rechnungsnummer (BT-1) fehlt."));
  if (!p.issueDate) out.push(f("BR-03", "error", "Das Rechnungsdatum (BT-2) fehlt."));
  else if (!isValidISODate(p.issueDate))
    out.push(f("XR-DATUM", "error", `Das Rechnungsdatum „${p.issueDate}“ ist kein gültiges Datum.`));
  if (!p.typeCode) out.push(f("BR-04", "error", "Der Rechnungstyp-Code (BT-3) fehlt."));
  else if (!["380", "381", "384", "326", "389", "875", "876", "877"].includes(p.typeCode))
    out.push(f("XR-TYP", "warning", `Ungewöhnlicher Rechnungstyp-Code „${p.typeCode}“.`));
  if (!p.currency) out.push(f("BR-05", "error", "Die Währung (BT-5) fehlt."));

  if (!p.seller.name) out.push(f("BR-06", "error", "Der Name des Verkäufers (BT-27) fehlt."));
  if (!p.seller.countryCode) out.push(f("BR-09", "error", "Das Land des Verkäufers (BT-40) fehlt."));
  if (!p.seller.vatId && !p.seller.taxNumber)
    out.push(f("BR-CO-26", "error", "USt-IdNr. oder Steuernummer des Verkäufers fehlt (BT-31/BT-32)."));
  if (!p.buyer.name) out.push(f("BR-07", "error", "Der Name des Käufers (BT-44) fehlt."));

  if (!p.buyerReference)
    out.push(
      f(
        "BR-DE-15",
        "error",
        "Die Käuferreferenz (BT-10) fehlt – für XRechnung Pflicht (bei Behörden: Leitweg-ID)."
      )
    );

  if (!p.seller.contactName) out.push(f("BR-DE-5", "error", "Ansprechpartner des Verkäufers (BT-41) fehlt."));
  if (!p.seller.contactPhone) out.push(f("BR-DE-6", "error", "Telefonnummer des Verkäufers (BT-42) fehlt."));
  if (!p.seller.contactEmail) out.push(f("BR-DE-7", "error", "E-Mail-Adresse des Verkäufers (BT-43) fehlt."));

  if (!p.paymentMeansCode)
    out.push(f("BR-DE-1", "error", "Zahlungsangaben (BG-16) fehlen – für XRechnung Pflicht."));
  if (p.paymentMeansCode === "58") {
    if (!p.iban) out.push(f("BR-DE-19", "error", "SEPA-Überweisung angegeben, aber keine IBAN (BT-84)."));
    else if (!isValidIban(p.iban))
      out.push(f("XR-IBAN", "error", `Die IBAN „${p.iban}“ ist ungültig (Prüfziffern-Check).`));
  }

  if (p.paymentTermsNote) {
    for (const badLine of validateSkontoNote(p.paymentTermsNote))
      out.push(
        f(
          "BR-DE-18",
          "error",
          `Zahlungsbedingungen: „${badLine}“ entspricht nicht dem Skonto-Muster (#SKONTO#TAGE=n#PROZENT=n.nn#).`
        )
      );
  }

  if (p.lines.length === 0) out.push(f("BR-16", "error", "Die Rechnung enthält keine Positionen."));
  p.lines.forEach((line, i) => {
    if (!line.name) out.push(f("BR-25", "error", `Position ${i + 1}: Bezeichnung (BT-153) fehlt.`));
    if (line.netCents === undefined)
      out.push(f("BR-24", "error", `Position ${i + 1}: Positionsbetrag (BT-131) fehlt oder ist nicht lesbar.`));
    if (!line.quantity) out.push(f("BR-22", "error", `Position ${i + 1}: Menge (BT-129) fehlt.`));
  });

  // --- Rechnerische Prüfung (BR-CO-*) ---
  const d = p.declared;
  const lineSum = p.lines.reduce<Cents | null>(
    (acc, l) => (acc === null || l.netCents === undefined ? null : acc + l.netCents),
    0
  );
  if (lineSum !== null && d.lineExtensionCents !== undefined) {
    if (!centsClose(lineSum, d.lineExtensionCents, 0))
      out.push(
        f(
          "BR-CO-10",
          "error",
          `Summe der Positionen stimmt nicht: Positionen ergeben ${fmt(lineSum)}, angegeben sind ${fmt(d.lineExtensionCents)} (BT-106).`
        )
      );
  }
  if (
    d.lineExtensionCents !== undefined &&
    d.taxExclusiveCents !== undefined
  ) {
    const expected = d.lineExtensionCents - (d.allowanceTotalCents ?? 0) + (d.chargeTotalCents ?? 0);
    if (!centsClose(expected, d.taxExclusiveCents, 0))
      out.push(
        f(
          "BR-CO-13",
          "error",
          `Nettosumme (BT-109) passt nicht: erwartet ${fmt(expected)}, angegeben ${fmt(d.taxExclusiveCents)}.`
        )
      );
  }
  if (d.taxExclusiveCents !== undefined && d.taxInclusiveCents !== undefined) {
    const taxTotal = d.taxTotalCents ?? 0;
    if (!centsClose(d.taxExclusiveCents + taxTotal, d.taxInclusiveCents, 0))
      out.push(
        f(
          "BR-CO-15",
          "error",
          `Bruttosumme (BT-112) passt nicht: Netto ${fmt(d.taxExclusiveCents)} + USt ${fmt(taxTotal)} ≠ ${fmt(d.taxInclusiveCents)}.`
        )
      );
  }
  if (d.taxInclusiveCents !== undefined && d.payableCents !== undefined) {
    const expected = d.taxInclusiveCents - (d.prepaidCents ?? 0) + (d.roundingCents ?? 0);
    if (!centsClose(expected, d.payableCents, 0))
      out.push(
        f(
          "BR-CO-16",
          "error",
          `Zahlbetrag (BT-115) passt nicht: erwartet ${fmt(expected)}, angegeben ${fmt(d.payableCents)}.`
        )
      );
  }
  if (d.taxTotalCents !== undefined && p.subtotals.length > 0) {
    const sum = p.subtotals.reduce<Cents | null>(
      (acc, s) => (acc === null || s.taxCents === undefined ? null : acc + s.taxCents),
      0
    );
    if (sum !== null && !centsClose(sum, d.taxTotalCents, 0))
      out.push(
        f(
          "BR-CO-14",
          "error",
          `USt-Gesamtbetrag stimmt nicht: Aufschlüsselung ergibt ${fmt(sum)}, angegeben ${fmt(d.taxTotalCents)}.`
        )
      );
  }
  for (const st of p.subtotals) {
    if (
      st.taxableCents !== undefined &&
      st.taxCents !== undefined &&
      st.percentE2 !== undefined
    ) {
      const expected = taxCents(st.taxableCents, st.percentE2);
      if (!centsClose(expected, st.taxCents, 1))
        out.push(
          f(
            "BR-CO-17",
            "error",
            `USt-Aufschlüsselung: ${fmtPct(st.percentE2)} % von ${fmt(st.taxableCents)} ergibt ${fmt(expected)}, angegeben sind ${fmt(st.taxCents)}.`
          )
        );
    }
    if (st.category && !["S", "Z", "E", "AE", "K", "G", "O", "L", "M"].includes(st.category))
      out.push(f("XR-KAT", "warning", `Unbekannte USt-Kategorie „${st.category}“.`));
  }

  return sortFindings(out);
}

function fmt(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")} €`;
}

function fmtPct(pctE2: bigint): string {
  const s = (Number(pctE2) / 100).toFixed(2).replace(".", ",");
  return s.replace(/,?0+$/, "") || "0";
}
