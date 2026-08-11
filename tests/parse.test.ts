import { describe, expect, it } from "vitest";
import { isParseFailure, parseInvoiceXml } from "../src/core/parse";
import { validateParsed } from "../src/core/rules";

/** Fremde UBL-Rechnung mit echten Namespace-Präfixen (gekürzt, aber realistisch). */
const FOREIGN_UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>RE-2026-0815</cbc:ID>
  <cbc:IssueDate>2026-07-15</cbc:IssueDate>
  <cbc:DueDate>2026-07-29</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>04011000-1234512345-06</cbc:BuyerReference>
  <cac:AccountingSupplierParty><cac:Party>
    <cbc:EndpointID schemeID="EM">info@lieferant.example</cbc:EndpointID>
    <cac:PostalAddress><cbc:StreetName>Weg 1</cbc:StreetName><cbc:CityName>Berlin</cbc:CityName><cbc:PostalZone>10115</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>DE812526315</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>Lieferant AG</cbc:RegistrationName></cac:PartyLegalEntity>
    <cac:Contact><cbc:Name>Frau Beispiel</cbc:Name><cbc:Telephone>+49 30 123</cbc:Telephone><cbc:ElectronicMail>info@lieferant.example</cbc:ElectronicMail></cac:Contact>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PostalAddress><cbc:StreetName>Rathausplatz 1</cbc:StreetName><cbc:CityName>Musterhausen</cbc:CityName><cbc:PostalZone>34117</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyLegalEntity><cbc:RegistrationName>Stadt Musterhausen</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>DE89370400440532013000</cbc:ID><cbc:Name>Lieferant AG</cbc:Name></cac:PayeeFinancialAccount></cac:PaymentMeans>
  <cac:PaymentTerms><cbc:Note>#SKONTO#TAGE=7#PROZENT=2.00#</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1190.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Fachbuch E-Rechnung</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

/** Minimales, realistisches CII/ZUGFeRD-Dokument. */
const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>ZF-2026-100</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260710</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>Serverwartung Juli</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>500.00</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>500.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>KD-77</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>IT-Service Nord GmbH</ram:Name>
        <ram:DefinedTradeContact><ram:PersonName>Herr Admin</ram:PersonName><ram:TelephoneUniversalCommunication><ram:CompleteNumber>+49 40 555</ram:CompleteNumber></ram:TelephoneUniversalCommunication><ram:EmailURIUniversalCommunication><ram:URIID>mail@itnord.example</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>
        <ram:PostalTradeAddress><ram:PostcodeCode>20095</ram:PostcodeCode><ram:LineOne>Hafenstraße 2</ram:LineOne><ram:CityName>Hamburg</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE118645675</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Kunde KG</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>28195</ram:PostcodeCode><ram:LineOne>Marktplatz 9</ram:LineOne><ram:CityName>Bremen</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>DE89370400440532013000</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>95.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>500.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms><ram:Description>Zahlbar bis 24.07.2026</ram:Description><ram:DueDateDateTime><udt:DateTimeString format="102">20260724</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>500.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>500.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">95.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>595.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>595.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

describe("parseInvoiceXml – UBL", () => {
  it("parst eine fremde UBL-Rechnung vollständig", () => {
    const p = parseInvoiceXml(FOREIGN_UBL);
    if (isParseFailure(p)) throw new Error(p.error);
    expect(p.syntax).toBe("ubl-invoice");
    expect(p.number).toBe("RE-2026-0815");
    expect(p.buyerReference).toBe("04011000-1234512345-06");
    expect(p.seller.name).toBe("Lieferant AG");
    expect(p.seller.vatId).toBe("DE812526315");
    expect(p.buyer.name).toBe("Stadt Musterhausen");
    expect(p.iban).toBe("DE89370400440532013000");
    expect(p.declared.taxInclusiveCents).toBe(119000);
    expect(p.lines[0].name).toBe("Fachbuch E-Rechnung");
    expect(p.lines[0].netCents).toBe(100000);
    const errors = validateParsed(p).filter((x) => x.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  it("findet manipulierte Summen (BR-CO-10/15)", () => {
    const manipulated = FOREIGN_UBL.replace(
      '<cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount',
      '<cbc:LineExtensionAmount currencyID="EUR">900.00</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount'
    );
    const p = parseInvoiceXml(manipulated);
    if (isParseFailure(p)) throw new Error(p.error);
    const ids = validateParsed(p).map((x) => x.id);
    expect(ids).toContain("BR-CO-10");
    expect(ids).toContain("BR-CO-13");
  });

  it("findet falsche USt-Berechnung (BR-CO-17)", () => {
    const manipulated = FOREIGN_UBL.replaceAll("190.00", "180.00");
    const p = parseInvoiceXml(manipulated);
    if (isParseFailure(p)) throw new Error(p.error);
    const ids = validateParsed(p).map((x) => x.id);
    expect(ids).toContain("BR-CO-17");
  });
});

describe("parseInvoiceXml – CII/ZUGFeRD", () => {
  it("parst ein CII-Dokument", () => {
    const p = parseInvoiceXml(CII);
    if (isParseFailure(p)) throw new Error(p.error);
    expect(p.syntax).toBe("cii");
    expect(p.number).toBe("ZF-2026-100");
    expect(p.issueDate).toBe("2026-07-10");
    expect(p.dueDate).toBe("2026-07-24");
    expect(p.seller.name).toBe("IT-Service Nord GmbH");
    expect(p.seller.vatId).toBe("DE118645675");
    expect(p.seller.contactPhone).toBe("+49 40 555");
    expect(p.iban).toBe("DE89370400440532013000");
    expect(p.declared.payableCents).toBe(59500);
    expect(p.subtotals[0].taxCents).toBe(9500);
    expect(p.lines[0].name).toBe("Serverwartung Juli");
    const errors = validateParsed(p).filter((x) => x.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });
});

describe("parseInvoiceXml – Fehlerfälle", () => {
  it("kaputtes XML", () => {
    const p = parseInvoiceXml("<Invoice><unclosed>");
    expect(isParseFailure(p)).toBe(true);
  });
  it("fremdes XML-Format", () => {
    const p = parseInvoiceXml("<?xml version=\"1.0\"?><html><body>hi</body></html>");
    expect(isParseFailure(p)).toBe(true);
    if (isParseFailure(p)) expect(p.error).toContain("Kein unterstütztes Rechnungsformat");
  });
});
