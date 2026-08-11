/**
 * Toleranter Parser für empfangene E-Rechnungen.
 *
 * Unterstützt:
 *   - UBL 2.1 Invoice und CreditNote (XRechnung, Peppol BIS)
 *   - UN/CEFACT CII (ZUGFeRD / Factur-X, XRechnung-CII)
 *
 * Ziel ist eine robuste Anzeige + rechnerische Prüfung, kein striktes
 * Schema-Parsing: fehlende Felder bleiben einfach undefined.
 */

import { XMLParser, XMLValidator } from "fast-xml-parser";
import { format102ToISO } from "./dates";
import { parseAmountToCents, parseDecimal, type Cents } from "./money";

export interface ParsedParty {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  countryCode?: string;
  vatId?: string;
  taxNumber?: string;
  email?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface ParsedLine {
  id?: string;
  name?: string;
  description?: string;
  quantity?: string;
  unitCode?: string;
  unitPrice?: string;
  netCents?: Cents;
  percent?: string;
  category?: string;
}

export interface ParsedTaxSubtotal {
  category?: string;
  percentE2?: bigint;
  taxableCents?: Cents;
  taxCents?: Cents;
  exemptionReason?: string;
}

export interface ParsedDeclaredTotals {
  lineExtensionCents?: Cents;
  allowanceTotalCents?: Cents;
  chargeTotalCents?: Cents;
  taxExclusiveCents?: Cents;
  taxTotalCents?: Cents;
  taxInclusiveCents?: Cents;
  prepaidCents?: Cents;
  roundingCents?: Cents;
  payableCents?: Cents;
}

export interface ParsedInvoice {
  syntax: "ubl-invoice" | "ubl-creditnote" | "cii";
  customizationId?: string;
  profileId?: string;
  number?: string;
  typeCode?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  buyerReference?: string;
  orderReference?: string;
  precedingInvoiceNumber?: string;
  notes: string[];
  seller: ParsedParty;
  buyer: ParsedParty;
  deliveryDate?: string;
  periodStart?: string;
  periodEnd?: string;
  paymentMeansCode?: string;
  iban?: string;
  paymentTermsNote?: string;
  lines: ParsedLine[];
  subtotals: ParsedTaxSubtotal[];
  declared: ParsedDeclaredTotals;
}

export interface ParseFailure {
  error: string;
}

export function isParseFailure(v: ParsedInvoice | ParseFailure): v is ParseFailure {
  return (v as ParseFailure).error !== undefined;
}

// ---------------------------------------------------------------------------

type Any = any;

function arr(v: Any): Any[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Textinhalt eines Knotens (fast-xml-parser liefert String oder {#text}). */
function t(v: Any): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in v) {
    const inner = v["#text"];
    if (inner === undefined || inner === null) return undefined;
    return String(inner).trim() || undefined;
  }
  return undefined;
}

function attr(v: Any, name: string): string | undefined {
  if (v && typeof v === "object") {
    const a = v[`@_${name}`];
    if (a !== undefined && a !== null) return String(a);
  }
  return undefined;
}

function cents(v: Any): Cents | undefined {
  const s = t(v);
  if (s === undefined) return undefined;
  const c = parseAmountToCents(s.replace(",", "."));
  return c === null ? undefined : c;
}

function pctE2(v: Any): bigint | undefined {
  const s = t(v);
  if (s === undefined) return undefined;
  const p = parseDecimal(s.replace(",", "."), 2);
  return p === null ? undefined : p;
}

export function parseInvoiceXml(xml: string): ParsedInvoice | ParseFailure {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    return {
      error: `Die Datei ist kein wohlgeformtes XML (${valid.err?.msg ?? "Syntaxfehler"}, Zeile ${
        valid.err?.line ?? "?"
      }).`
    };
  }
  let doc: Any;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true
    });
    doc = parser.parse(xml);
  } catch {
    return { error: "Die Datei ist kein wohlgeformtes XML." };
  }
  if (doc?.Invoice) return parseUbl(doc.Invoice, "ubl-invoice");
  if (doc?.CreditNote) return parseUbl(doc.CreditNote, "ubl-creditnote");
  if (doc?.CrossIndustryInvoice) return parseCii(doc.CrossIndustryInvoice);
  return {
    error:
      "Kein unterstütztes Rechnungsformat gefunden (erwartet: UBL Invoice/CreditNote oder UN/CEFACT CrossIndustryInvoice)."
  };
}

// ---------------------------------------------------------------------------
// UBL
// ---------------------------------------------------------------------------

function parseUblParty(partyWrapper: Any): ParsedParty {
  const party = partyWrapper?.Party ?? partyWrapper;
  if (!party) return {};
  const addr = party.PostalAddress;
  const contact = party.Contact;
  const legal = party.PartyLegalEntity;
  let vatId: string | undefined;
  let taxNumber: string | undefined;
  for (const pts of arr(party.PartyTaxScheme)) {
    const scheme = t(pts?.TaxScheme?.ID);
    const companyId = t(pts?.CompanyID);
    if (scheme === "VAT") vatId = companyId ?? vatId;
    else if (scheme === "FC") taxNumber = companyId ?? taxNumber;
    else if (!vatId) vatId = companyId;
  }
  return {
    name: t(legal?.RegistrationName) ?? t(party.PartyName?.Name),
    street: t(addr?.StreetName),
    zip: t(addr?.PostalZone),
    city: t(addr?.CityName),
    countryCode: t(addr?.Country?.IdentificationCode),
    vatId,
    taxNumber,
    email: t(party.EndpointID),
    contactName: t(contact?.Name),
    contactPhone: t(contact?.Telephone),
    contactEmail: t(contact?.ElectronicMail)
  };
}

function parseUbl(inv: Any, syntax: "ubl-invoice" | "ubl-creditnote"): ParsedInvoice {
  const isCredit = syntax === "ubl-creditnote";
  const lineName = isCredit ? "CreditNoteLine" : "InvoiceLine";
  const qtyName = isCredit ? "CreditedQuantity" : "InvoicedQuantity";

  const paymentMeans = arr(inv.PaymentMeans)[0];
  const taxTotal = arr(inv.TaxTotal)[0];
  const legal = inv.LegalMonetaryTotal;
  const period = inv.InvoicePeriod;

  const lines: ParsedLine[] = arr(inv[lineName]).map((l: Any) => ({
    id: t(l.ID),
    name: t(l.Item?.Name),
    description: t(l.Item?.Description),
    quantity: t(l[qtyName]),
    unitCode: attr(l[qtyName], "unitCode"),
    unitPrice: t(l.Price?.PriceAmount),
    netCents: cents(l.LineExtensionAmount),
    percent: t(l.Item?.ClassifiedTaxCategory?.Percent),
    category: t(l.Item?.ClassifiedTaxCategory?.ID)
  }));

  const subtotals: ParsedTaxSubtotal[] = arr(taxTotal?.TaxSubtotal).map((s: Any) => ({
    category: t(s.TaxCategory?.ID),
    percentE2: pctE2(s.TaxCategory?.Percent),
    taxableCents: cents(s.TaxableAmount),
    taxCents: cents(s.TaxAmount),
    exemptionReason: t(s.TaxCategory?.TaxExemptionReason)
  }));

  return {
    syntax,
    customizationId: t(inv.CustomizationID),
    profileId: t(inv.ProfileID),
    number: t(inv.ID),
    typeCode: t(inv.InvoiceTypeCode) ?? t(inv.CreditNoteTypeCode),
    issueDate: t(inv.IssueDate),
    dueDate: t(inv.DueDate) ?? t(arr(inv.PaymentMeans)[0]?.PaymentDueDate),
    currency: t(inv.DocumentCurrencyCode),
    buyerReference: t(inv.BuyerReference),
    orderReference: t(inv.OrderReference?.ID),
    precedingInvoiceNumber: t(arr(inv.BillingReference)[0]?.InvoiceDocumentReference?.ID),
    notes: arr(inv.Note)
      .map((n: Any) => t(n))
      .filter((x): x is string => Boolean(x)),
    seller: parseUblParty(inv.AccountingSupplierParty),
    buyer: parseUblParty(inv.AccountingCustomerParty),
    deliveryDate: t(arr(inv.Delivery)[0]?.ActualDeliveryDate),
    periodStart: t(period?.StartDate),
    periodEnd: t(period?.EndDate),
    paymentMeansCode: t(paymentMeans?.PaymentMeansCode),
    iban: t(paymentMeans?.PayeeFinancialAccount?.ID),
    paymentTermsNote: t(arr(inv.PaymentTerms)[0]?.Note),
    lines,
    subtotals,
    declared: {
      lineExtensionCents: cents(legal?.LineExtensionAmount),
      allowanceTotalCents: cents(legal?.AllowanceTotalAmount),
      chargeTotalCents: cents(legal?.ChargeTotalAmount),
      taxExclusiveCents: cents(legal?.TaxExclusiveAmount),
      taxTotalCents: cents(taxTotal?.TaxAmount),
      taxInclusiveCents: cents(legal?.TaxInclusiveAmount),
      prepaidCents: cents(legal?.PrepaidAmount),
      roundingCents: cents(legal?.PayableRoundingAmount),
      payableCents: cents(legal?.PayableAmount)
    }
  };
}

// ---------------------------------------------------------------------------
// CII (ZUGFeRD / Factur-X)
// ---------------------------------------------------------------------------

function ciiDate(v: Any): string | undefined {
  const dts = v?.DateTimeString ?? v;
  const s = t(dts);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return format102ToISO(s);
}

function parseCiiParty(party: Any): ParsedParty {
  if (!party) return {};
  const addr = party.PostalTradeAddress;
  const contact = party.DefinedTradeContact;
  let vatId: string | undefined;
  let taxNumber: string | undefined;
  for (const reg of arr(party.SpecifiedTaxRegistration)) {
    const id = reg?.ID;
    const scheme = attr(id, "schemeID");
    if (scheme === "VA") vatId = t(id) ?? vatId;
    else if (scheme === "FC") taxNumber = t(id) ?? taxNumber;
    else if (!vatId) vatId = t(id);
  }
  return {
    name: t(party.Name),
    street: t(addr?.LineOne),
    zip: t(addr?.PostcodeCode),
    city: t(addr?.CityName),
    countryCode: t(addr?.CountryID),
    vatId,
    taxNumber,
    email: t(party.URIUniversalCommunication?.URIID),
    contactName: t(contact?.PersonName) ?? t(contact?.DepartmentName),
    contactPhone: t(contact?.TelephoneUniversalCommunication?.CompleteNumber),
    contactEmail: t(contact?.EmailURIUniversalCommunication?.URIID)
  };
}

function parseCii(root: Any): ParsedInvoice {
  const ctx = root.ExchangedDocumentContext;
  const docHeader = root.ExchangedDocument;
  const trans = root.SupplyChainTradeTransaction;
  const agreement = trans?.ApplicableHeaderTradeAgreement;
  const delivery = trans?.ApplicableHeaderTradeDelivery;
  const settlement = trans?.ApplicableHeaderTradeSettlement;
  const summation = settlement?.SpecifiedTradeSettlementHeaderMonetarySummation;
  const paymentMeans = arr(settlement?.SpecifiedTradeSettlementPaymentMeans)[0];
  const terms = arr(settlement?.SpecifiedTradePaymentTerms)[0];
  const period = settlement?.BillingSpecifiedPeriod;

  const lines: ParsedLine[] = arr(trans?.IncludedSupplyChainTradeLineItem).map((l: Any) => {
    const product = l.SpecifiedTradeProduct;
    const lineDelivery = l.SpecifiedLineTradeDelivery;
    const lineSettlement = l.SpecifiedLineTradeSettlement;
    const lineTax = arr(lineSettlement?.ApplicableTradeTax)[0];
    const qty = lineDelivery?.BilledQuantity;
    return {
      id: t(l.AssociatedDocumentLineDocument?.LineID),
      name: t(product?.Name),
      description: t(product?.Description),
      quantity: t(qty),
      unitCode: attr(qty, "unitCode"),
      unitPrice: t(l.SpecifiedLineTradeAgreement?.NetPriceProductTradePrice?.ChargeAmount),
      netCents: cents(lineSettlement?.SpecifiedTradeSettlementLineMonetarySummation?.LineTotalAmount),
      percent: t(lineTax?.RateApplicablePercent),
      category: t(lineTax?.CategoryCode)
    };
  });

  const subtotals: ParsedTaxSubtotal[] = arr(settlement?.ApplicableTradeTax).map((s: Any) => ({
    category: t(s.CategoryCode),
    percentE2: pctE2(s.RateApplicablePercent),
    taxableCents: cents(s.BasisAmount),
    taxCents: cents(s.CalculatedAmount),
    exemptionReason: t(s.ExemptionReason)
  }));

  // TaxTotalAmount kann mehrfach vorkommen (je Währung) – erste mit Betrag nehmen
  const taxTotalCents = arr(summation?.TaxTotalAmount)
    .map((v: Any) => cents(v))
    .find((c) => c !== undefined);

  return {
    syntax: "cii",
    customizationId: t(ctx?.GuidelineSpecifiedDocumentContextParameter?.ID),
    profileId: t(ctx?.BusinessProcessSpecifiedDocumentContextParameter?.ID),
    number: t(docHeader?.ID),
    typeCode: t(docHeader?.TypeCode),
    issueDate: ciiDate(docHeader?.IssueDateTime),
    dueDate: ciiDate(terms?.DueDateDateTime),
    currency: t(settlement?.InvoiceCurrencyCode),
    buyerReference: t(agreement?.BuyerReference),
    orderReference: t(agreement?.BuyerOrderReferencedDocument?.IssuerAssignedID),
    precedingInvoiceNumber: t(
      arr(settlement?.InvoiceReferencedDocument)[0]?.IssuerAssignedID
    ),
    notes: arr(docHeader?.IncludedNote)
      .map((n: Any) => t(n?.Content))
      .filter((x): x is string => Boolean(x)),
    seller: parseCiiParty(agreement?.SellerTradeParty),
    buyer: parseCiiParty(agreement?.BuyerTradeParty),
    deliveryDate: ciiDate(delivery?.ActualDeliverySupplyChainEvent?.OccurrenceDateTime),
    periodStart: ciiDate(period?.StartDateTime),
    periodEnd: ciiDate(period?.EndDateTime),
    paymentMeansCode: t(paymentMeans?.TypeCode),
    iban: t(paymentMeans?.PayeePartyCreditorFinancialAccount?.IBANID),
    paymentTermsNote: t(terms?.Description),
    lines,
    subtotals,
    declared: {
      lineExtensionCents: cents(summation?.LineTotalAmount),
      allowanceTotalCents: cents(summation?.AllowanceTotalAmount),
      chargeTotalCents: cents(summation?.ChargeTotalAmount),
      taxExclusiveCents: cents(summation?.TaxBasisTotalAmount),
      taxTotalCents,
      taxInclusiveCents: cents(summation?.GrandTotalAmount),
      prepaidCents: cents(summation?.TotalPrepaidAmount),
      roundingCents: cents(summation?.RoundingAmount),
      payableCents: cents(summation?.DuePayableAmount)
    }
  };
}
