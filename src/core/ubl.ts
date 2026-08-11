/**
 * Erzeugt eine XRechnung als UBL-2.1-Invoice-Dokument.
 *
 * Die Elementreihenfolge folgt strikt dem UBL-Schema (Sequenz!). Optionale
 * Elemente werden nur ausgegeben, wenn sie befüllt sind.
 */

import type { Invoice } from "./model";
import type { Totals } from "./totals";
import {
  formatCentsPlain,
  formatPercentPlain,
  formatScaledPlain,
  QTY_FRACTION_DIGITS
} from "./money";
import { buildPaymentTermsNote } from "./skonto";
import { normalizeIban } from "./iban";
import { el, renderXml, type XmlNode } from "./xml";
import { XRECHNUNG_CUSTOMIZATION_ID, XRECHNUNG_PROFILE_ID } from "../config";

const CURRENCY = "EUR";

function amount(n: string, cents: number): XmlNode {
  return el(n, formatCentsPlain(cents), { currencyID: CURRENCY });
}

function nonEmpty(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

function party(opts: {
  endpointEmail?: string;
  street?: string;
  zip?: string;
  city?: string;
  countryCode: string;
  vatId?: string;
  taxNumber?: string;
  legalName: string;
  registerId?: string;
  legalForm?: string;
  contact?: { name?: string; phone?: string; email?: string };
}): XmlNode {
  const vat = nonEmpty(opts.vatId);
  const fc = nonEmpty(opts.taxNumber);
  const contact = opts.contact;
  const hasContact = contact && (contact.name || contact.phone || contact.email);
  return el("cac:Party", [
    nonEmpty(opts.endpointEmail)
      ? el("cbc:EndpointID", opts.endpointEmail!.trim(), { schemeID: "EM" })
      : null,
    el("cac:PostalAddress", [
      nonEmpty(opts.street) ? el("cbc:StreetName", opts.street!.trim()) : null,
      nonEmpty(opts.city) ? el("cbc:CityName", opts.city!.trim()) : null,
      nonEmpty(opts.zip) ? el("cbc:PostalZone", opts.zip!.trim()) : null,
      el("cac:Country", [el("cbc:IdentificationCode", opts.countryCode)])
    ]),
    vat
      ? el("cac:PartyTaxScheme", [
          el("cbc:CompanyID", vat.replace(/\s/g, "")),
          el("cac:TaxScheme", [el("cbc:ID", "VAT")])
        ])
      : null,
    fc
      ? el("cac:PartyTaxScheme", [
          el("cbc:CompanyID", fc),
          el("cac:TaxScheme", [el("cbc:ID", "FC")])
        ])
      : null,
    el("cac:PartyLegalEntity", [
      el("cbc:RegistrationName", opts.legalName),
      nonEmpty(opts.registerId) ? el("cbc:CompanyID", opts.registerId!.trim()) : null,
      nonEmpty(opts.legalForm) ? el("cbc:CompanyLegalForm", opts.legalForm!.trim()) : null
    ]),
    hasContact
      ? el("cac:Contact", [
          nonEmpty(contact.name) ? el("cbc:Name", contact.name!.trim()) : null,
          nonEmpty(contact.phone) ? el("cbc:Telephone", contact.phone!.trim()) : null,
          nonEmpty(contact.email) ? el("cbc:ElectronicMail", contact.email!.trim()) : null
        ])
      : null
  ]);
}

export function buildUblInvoice(inv: Invoice, totals: Totals): string {
  const s = inv.seller;
  const b = inv.buyer;
  const { note: paymentNote } = buildPaymentTermsNote(inv.skonto, inv.paymentTermsText);

  const notes: string[] = [];
  for (const entry of totals.breakdown) {
    if (entry.category !== "S" && entry.category !== "Z" && entry.exemptionReason) {
      if (!notes.includes(entry.exemptionReason)) notes.push(entry.exemptionReason);
    }
  }
  if (nonEmpty(inv.note)) notes.push(inv.note!.trim());

  const root: XmlNode = {
    n: "ubl:Invoice",
    a: {
      "xmlns:ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
      "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    },
    c: [
      el("cbc:CustomizationID", XRECHNUNG_CUSTOMIZATION_ID),
      el("cbc:ProfileID", XRECHNUNG_PROFILE_ID),
      el("cbc:ID", inv.number ?? "ENTWURF"),
      el("cbc:IssueDate", inv.issueDate),
      inv.dueDate ? el("cbc:DueDate", inv.dueDate) : null,
      el("cbc:InvoiceTypeCode", String(inv.typeCode)),
      ...notes.map((n) => el("cbc:Note", n)),
      el("cbc:DocumentCurrencyCode", CURRENCY),
      el("cbc:BuyerReference", inv.buyerReference.trim()),
      inv.periodStart || inv.periodEnd
        ? el("cac:InvoicePeriod", [
            inv.periodStart ? el("cbc:StartDate", inv.periodStart) : null,
            inv.periodEnd ? el("cbc:EndDate", inv.periodEnd) : null
          ])
        : null,
      nonEmpty(inv.orderReference)
        ? el("cac:OrderReference", [el("cbc:ID", inv.orderReference!.trim())])
        : null,
      nonEmpty(inv.precedingInvoiceNumber)
        ? el("cac:BillingReference", [
            el("cac:InvoiceDocumentReference", [
              el("cbc:ID", inv.precedingInvoiceNumber!.trim()),
              inv.precedingInvoiceDate ? el("cbc:IssueDate", inv.precedingInvoiceDate) : null
            ])
          ])
        : null,
      el("cac:AccountingSupplierParty", [
        party({
          endpointEmail: s.email,
          street: s.street,
          zip: s.zip,
          city: s.city,
          countryCode: s.countryCode,
          vatId: s.vatId,
          taxNumber: s.taxNumber,
          legalName: s.name,
          registerId: s.registerInfo,
          legalForm: s.legalForm,
          contact: { name: s.contactName, phone: s.phone, email: s.email }
        })
      ]),
      el("cac:AccountingCustomerParty", [
        party({
          endpointEmail: b.email,
          street: b.street,
          zip: b.zip,
          city: b.city,
          countryCode: b.countryCode,
          vatId: b.vatId,
          legalName: b.name
        })
      ]),
      inv.deliveryDate
        ? el("cac:Delivery", [el("cbc:ActualDeliveryDate", inv.deliveryDate)])
        : null,
      el("cac:PaymentMeans", [
        el("cbc:PaymentMeansCode", "58"),
        inv.number ? el("cbc:PaymentID", inv.number) : null,
        el("cac:PayeeFinancialAccount", [
          el("cbc:ID", normalizeIban(s.iban)),
          el("cbc:Name", nonEmpty(s.accountHolder) ?? s.name),
          nonEmpty(s.bic)
            ? el("cac:FinancialInstitutionBranch", [el("cbc:ID", s.bic!.replace(/\s/g, "")) ])
            : null
        ])
      ]),
      paymentNote ? el("cac:PaymentTerms", [el("cbc:Note", paymentNote)]) : null,
      el("cac:TaxTotal", [
        amount("cbc:TaxAmount", totals.taxTotalCents),
        ...totals.breakdown.map((entry) =>
          el("cac:TaxSubtotal", [
            amount("cbc:TaxableAmount", entry.taxableCents),
            amount("cbc:TaxAmount", entry.taxCents),
            el("cac:TaxCategory", [
              el("cbc:ID", entry.category),
              el("cbc:Percent", formatPercentPlain(entry.percentE2)),
              entry.category !== "S" && entry.category !== "Z" && entry.exemptionReasonCode
                ? el("cbc:TaxExemptionReasonCode", entry.exemptionReasonCode)
                : null,
              entry.category !== "S" && entry.category !== "Z" && entry.exemptionReason
                ? el("cbc:TaxExemptionReason", entry.exemptionReason)
                : null,
              el("cac:TaxScheme", [el("cbc:ID", "VAT")])
            ])
          ])
        )
      ]),
      el("cac:LegalMonetaryTotal", [
        amount("cbc:LineExtensionAmount", totals.lineExtensionCents),
        amount("cbc:TaxExclusiveAmount", totals.taxExclusiveCents),
        amount("cbc:TaxInclusiveAmount", totals.taxInclusiveCents),
        amount("cbc:PayableAmount", totals.payableCents)
      ]),
      ...totals.lines.map((c, i) =>
        el("cac:InvoiceLine", [
          el("cbc:ID", String(i + 1)),
          el(
            "cbc:InvoicedQuantity",
            formatScaledPlain(c.qtyE4, QTY_FRACTION_DIGITS),
            { unitCode: c.line.unitCode }
          ),
          amount("cbc:LineExtensionAmount", c.netCents),
          c.line.description && c.line.description.trim()
            ? el("cac:Item", [
                el("cbc:Description", c.line.description.trim()),
                el("cbc:Name", c.line.name.trim()),
                sellersItemId(c.line.itemNumber),
                classifiedTax(c.line.taxCategory, c.pctE2)
              ])
            : el("cac:Item", [
                el("cbc:Name", c.line.name.trim()),
                sellersItemId(c.line.itemNumber),
                classifiedTax(c.line.taxCategory, c.pctE2)
              ]),
          el("cac:Price", [priceAmount(c.priceE4)])
        ])
      )
    ]
  };
  return renderXml(root);
}

function sellersItemId(itemNumber: string | undefined): XmlNode | null {
  const id = itemNumber?.trim();
  return id ? el("cac:SellersItemIdentification", [el("cbc:ID", id)]) : null;
}

function classifiedTax(category: string, pctE2: bigint): XmlNode {
  return el("cac:ClassifiedTaxCategory", [
    el("cbc:ID", category),
    el("cbc:Percent", formatPercentPlain(pctE2)),
    el("cac:TaxScheme", [el("cbc:ID", "VAT")])
  ]);
}

/** Einzelpreis (bis 4 Nachkommastellen, ohne überflüssige Nullen). */
function priceAmount(priceE4: bigint): XmlNode {
  const plain = formatScaledPlain(priceE4, 4);
  // Mindestens 2 Nachkommastellen für Lesbarkeit
  const withMin = plain.includes(".")
    ? plain.split(".")[1].length >= 2
      ? plain
      : `${plain}${"0".repeat(2 - plain.split(".")[1].length)}`
    : `${plain}.00`;
  return el("cbc:PriceAmount", withMin, { currencyID: CURRENCY });
}

/** Dateiname-Vorschlag für den Export. */
export function xmlFileName(inv: Invoice): string {
  const num = (inv.number ?? "Entwurf").replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${num}_XRechnung.xml`;
}
