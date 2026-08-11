/**
 * Zentrales Datenmodell von eRechnung Studio.
 *
 * Alle Geldbeträge werden als Eingabe-Strings gehalten (deutsche oder
 * internationale Dezimalschreibweise) und erst in der Berechnungsschicht
 * (money.ts / totals.ts) exakt in BigInt-Skalen umgerechnet.
 */

/** Umsatzsteuer-Kategorien nach UNCL5305 (Teilmenge, die in DE relevant ist). */
export type TaxCategory = "S" | "Z" | "E" | "AE" | "K" | "G";

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  S: "Umsatzsteuer (Standard/ermäßigt)",
  Z: "Nullsatz (0 %)",
  E: "Steuerbefreit (z. B. § 19 UStG / § 4 UStG)",
  AE: "Reverse Charge (§ 13b UStG)",
  K: "Innergemeinschaftliche Lieferung/Leistung",
  G: "Ausfuhr (Drittland)"
};

/** UN/ECE Rec. 20 Mengeneinheiten (gebräuchliche Auswahl). */
export const UNIT_CODES: { code: string; label: string }[] = [
  { code: "C62", label: "Stück" },
  { code: "HUR", label: "Stunde" },
  { code: "DAY", label: "Tag" },
  { code: "MON", label: "Monat" },
  { code: "KGM", label: "Kilogramm" },
  { code: "MTR", label: "Meter" },
  { code: "MTK", label: "Quadratmeter" },
  { code: "LTR", label: "Liter" },
  { code: "SET", label: "Set" },
  { code: "XPK", label: "Paket" }
];

export function unitLabel(code: string): string {
  return UNIT_CODES.find((u) => u.code === code)?.label ?? code;
}

/** Eigene Firmendaten (Verkäufer, BG-4). */
export interface SellerProfile {
  name: string; // BT-27
  legalForm?: string; // BT-33, z. B. "Inhaber: Max Muster" oder "Geschäftsführer: …"
  registerInfo?: string; // BT-30, z. B. "HRB 12345, AG Mannheim"
  street: string;
  zip: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2
  contactName: string; // BT-41
  phone: string; // BT-42
  email: string; // BT-43 + BT-34 (EndpointID)
  vatId?: string; // BT-31 USt-IdNr
  taxNumber?: string; // BT-32 Steuernummer
  iban: string; // BT-84
  bic?: string; // BT-86
  bankLabel?: string; // Anzeigename der Bank
  accountHolder?: string; // BT-85, Standard: name
  kleinunternehmer: boolean; // § 19 UStG
  numberTemplate: string; // z. B. "{JJJJ}-{lfd4}"
  defaultPaymentDays: number;
  defaultSkontoDays?: number;
  defaultSkontoPercent?: string; // z. B. "2,00"
}

/** Kunde (Käufer, BG-7). */
export interface Customer {
  id: string;
  number: string; // interne Kundennummer
  name: string;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  email?: string; // BT-49 elektronische Adresse
  vatId?: string; // BT-48
  buyerReference?: string; // BT-10 (bei Behörden: Leitweg-ID)
  notes?: string;
}

/** Artikel-/Leistungsstamm. */
export interface CatalogItem {
  id: string;
  number?: string;
  name: string;
  description?: string;
  unitCode: string;
  unitPrice: string;
  taxCategory: TaxCategory;
  taxPercent: string;
}

/** Einzelne Rechnungsposition (BG-25). */
export interface InvoiceLine {
  id: string;
  itemNumber?: string; // BT-155
  name: string; // BT-153
  description?: string; // BT-154
  quantity: string; // BT-129
  unitCode: string; // BT-130
  unitPrice: string; // BT-146 (netto)
  taxCategory: TaxCategory; // BT-151
  taxPercent: string; // BT-152
}

export type InvoiceStatus = "draft" | "final";

/** Käufer-Snapshot in der Rechnung (unabhängig vom Kundenstamm editierbar). */
export interface BuyerSnapshot {
  name: string;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  email?: string;
  vatId?: string;
  customerNumber?: string;
}

export interface SkontoTerm {
  days: number;
  percent: string; // z. B. "2,00"
}

/** Rechnung. Nach Finalisierung unveränderlich (status = "final", xml eingefroren). */
export interface Invoice {
  id: string;
  status: InvoiceStatus;
  /** 380 = Rechnung, 384 = Rechnungskorrektur/Storno */
  typeCode: 380 | 384;
  number?: string; // BT-1, wird bei Finalisierung vergeben
  issueDate: string; // BT-2, ISO yyyy-mm-dd
  dueDate?: string; // BT-9
  deliveryDate?: string; // BT-72 (Leistungs-/Lieferdatum)
  periodStart?: string; // BT-73 (Leistungszeitraum)
  periodEnd?: string; // BT-74
  buyerReference: string; // BT-10
  orderReference?: string; // BT-13 Bestellnummer
  precedingInvoiceNumber?: string; // BT-25 (bei Storno/Korrektur)
  precedingInvoiceDate?: string; // BT-26
  seller: SellerProfile; // Snapshot bei Erstellung
  customerId?: string;
  buyer: BuyerSnapshot;
  lines: InvoiceLine[];
  skonto: SkontoTerm[];
  paymentTermsText?: string; // zusätzlicher Freitext zu Zahlungsbedingungen
  note?: string; // BT-22
  currency: "EUR";
  createdAt: string;
  finalizedAt?: string;
  /** Nach Finalisierung: die eingefrorene XRechnung. */
  xml?: string;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Standard-Befreiungstexte je Kategorie (BT-121/BT-120). */
export function exemptionTextFor(category: TaxCategory, kleinunternehmer: boolean): string | undefined {
  switch (category) {
    case "E":
      return kleinunternehmer
        ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
        : "Steuerbefreite Leistung nach § 4 UStG.";
    case "AE":
      return "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).";
    case "K":
      return "Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1b i. V. m. § 6a UStG).";
    case "G":
      return "Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a i. V. m. § 6 UStG).";
    default:
      return undefined;
  }
}

/** VATEX-Codes (BT-121), soweit eindeutig zuordenbar. */
export function exemptionCodeFor(category: TaxCategory): string | undefined {
  switch (category) {
    case "AE":
      return "VATEX-EU-AE";
    case "K":
      return "VATEX-EU-IC";
    case "G":
      return "VATEX-EU-G";
    default:
      return undefined;
  }
}
