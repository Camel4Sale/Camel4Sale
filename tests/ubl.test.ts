import { describe, expect, it } from "vitest";
import { buildUblInvoice, xmlFileName } from "../src/core/ubl";
import { computeTotals } from "../src/core/totals";
import { parseInvoiceXml, isParseFailure } from "../src/core/parse";
import { validateParsed } from "../src/core/rules";
import { testInvoice, testSeller } from "./helpers";
import { newId } from "../src/core/model";
import { XRECHNUNG_CUSTOMIZATION_ID } from "../src/config";

function build(inv = testInvoice()) {
  const { totals } = computeTotals(inv);
  expect(totals).not.toBeNull();
  return buildUblInvoice(inv, totals!);
}

describe("UBL-Builder", () => {
  it("erzeugt die Pflicht-Kopffelder in Schema-Reihenfolge", () => {
    const xml = build();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<cbc:CustomizationID>${XRECHNUNG_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
    const order = [
      "cbc:CustomizationID",
      "cbc:ProfileID",
      "cbc:ID",
      "cbc:IssueDate",
      "cbc:DueDate",
      "cbc:InvoiceTypeCode",
      "cbc:DocumentCurrencyCode",
      "cbc:BuyerReference",
      "cac:InvoicePeriod",
      "cac:OrderReference",
      "cac:AccountingSupplierParty",
      "cac:AccountingCustomerParty",
      "cac:PaymentMeans",
      "cac:PaymentTerms",
      "cac:TaxTotal",
      "cac:LegalMonetaryTotal",
      "cac:InvoiceLine"
    ];
    let last = -1;
    for (const tag of order) {
      const idx = xml.indexOf(`<${tag}`);
      expect(idx, `Element ${tag} fehlt oder falsche Reihenfolge`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("enthält die berechneten Beträge", () => {
    const xml = build();
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">809.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">153.71</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">962.71</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">962.71</cbc:PayableAmount>');
  });

  it("enthält XRechnung-Pflichtangaben (BR-DE)", () => {
    const xml = build();
    expect(xml).toContain("<cbc:BuyerReference>BEST-2026-017</cbc:BuyerReference>");
    expect(xml).toContain("<cbc:Name>Jan Muster</cbc:Name>"); // BT-41
    expect(xml).toContain("<cbc:Telephone>+49 721 1234567</cbc:Telephone>"); // BT-42
    expect(xml).toContain("<cbc:ElectronicMail>hallo@muster-webdesign.example</cbc:ElectronicMail>"); // BT-43
    expect(xml).toContain("<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>");
    expect(xml).toContain("<cbc:ID>DE89370400440532013000</cbc:ID>"); // BT-84
    expect(xml).toContain("#SKONTO#TAGE=7#PROZENT=2.00#");
    expect(xml).toContain('<cbc:EndpointID schemeID="EM">hallo@muster-webdesign.example</cbc:EndpointID>');
  });

  it("escapet Sonderzeichen", () => {
    const inv = testInvoice({
      buyer: { ...testInvoice().buyer, name: "Müller & Söhne <GmbH>" }
    });
    const xml = build(inv);
    expect(xml).toContain("Müller &amp; Söhne &lt;GmbH&gt;");
  });

  it("Reverse Charge: Kategorie AE mit Code und Grund, Prozent 0", () => {
    const inv = testInvoice({
      lines: [
        {
          id: newId(),
          name: "Beratung EU",
          quantity: "1",
          unitCode: "C62",
          unitPrice: "1.000,00",
          taxCategory: "AE",
          taxPercent: "0"
        }
      ],
      buyer: {
        name: "Aurora BV",
        street: "Gracht 1",
        zip: "1011AB",
        city: "Amsterdam",
        countryCode: "NL",
        vatId: "NL123456789B01",
        email: "billing@aurora.example"
      }
    });
    const xml = build(inv);
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("Reverse Charge");
    expect(xml).toMatch(/<cac:TaxCategory>\s*<cbc:ID>AE<\/cbc:ID>\s*<cbc:Percent>0<\/cbc:Percent>/);
  });

  it("Storno (384) mit BillingReference", () => {
    const inv = testInvoice({
      typeCode: 384,
      number: "2026-0002",
      precedingInvoiceNumber: "2026-0001",
      precedingInvoiceDate: "2026-08-04"
    });
    const xml = build(inv);
    expect(xml).toContain("<cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>");
    expect(xml).toMatch(
      /<cac:BillingReference>\s*<cac:InvoiceDocumentReference>\s*<cbc:ID>2026-0001<\/cbc:ID>/
    );
  });

  it("Steuernummer statt USt-IdNr wird als FC-Schema ausgegeben", () => {
    const inv = testInvoice({ seller: testSeller({ vatId: undefined }) });
    const xml = build(inv);
    expect(xml).toContain("<cbc:CompanyID>35012/34567</cbc:CompanyID>");
    expect(xml).toContain("<cbc:ID>FC</cbc:ID>");
  });

  it("Roundtrip: eigene XML wird fehlerfrei geparst und validiert", () => {
    const inv = testInvoice();
    const xml = build(inv);
    const parsed = parseInvoiceXml(xml);
    expect(isParseFailure(parsed)).toBe(false);
    if (isParseFailure(parsed)) return;
    expect(parsed.syntax).toBe("ubl-invoice");
    expect(parsed.number).toBe("2026-0001");
    expect(parsed.seller.name).toBe("Muster Webdesign");
    expect(parsed.buyer.vatId).toBe("DE987654321");
    expect(parsed.declared.payableCents).toBe(96271);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].netCents).toBe(76000);
    const findings = validateParsed(parsed);
    const errors = findings.filter((x) => x.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  it("Roundtrip Kleinunternehmer ohne Fehler", () => {
    const inv = testInvoice({
      seller: testSeller({ kleinunternehmer: true }),
      lines: [
        {
          id: newId(),
          name: "Nachhilfe",
          quantity: "10",
          unitCode: "HUR",
          unitPrice: "40,00",
          taxCategory: "E",
          taxPercent: "0"
        }
      ]
    });
    const xml = build(inv);
    expect(xml).toContain("§ 19 UStG");
    const parsed = parseInvoiceXml(xml);
    if (isParseFailure(parsed)) throw new Error(parsed.error);
    const errors = validateParsed(parsed).filter((x) => x.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  it("Dateiname", () => {
    expect(xmlFileName(testInvoice())).toBe("2026-0001_XRechnung.xml");
    expect(xmlFileName(testInvoice({ number: "RE 2026/17" }))).toBe("RE-2026-17_XRechnung.xml");
  });
});
