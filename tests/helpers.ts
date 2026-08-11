import type { Invoice, SellerProfile } from "../src/core/model";
import { newId } from "../src/core/model";

export function testSeller(overrides: Partial<SellerProfile> = {}): SellerProfile {
  return {
    name: "Muster Webdesign",
    legalForm: "Inhaber: Jan Muster",
    street: "Beispielstraße 12",
    zip: "76133",
    city: "Karlsruhe",
    countryCode: "DE",
    contactName: "Jan Muster",
    phone: "+49 721 1234567",
    email: "hallo@muster-webdesign.example",
    vatId: "DE123456789",
    taxNumber: "35012/34567",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    bankLabel: "Commerzbank",
    kleinunternehmer: false,
    numberTemplate: "{JJJJ}-{lfd4}",
    defaultPaymentDays: 14,
    ...overrides
  };
}

export function testInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: newId(),
    status: "final",
    typeCode: 380,
    number: "2026-0001",
    issueDate: "2026-08-04",
    dueDate: "2026-08-18",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    buyerReference: "BEST-2026-017",
    orderReference: "BEST-2026-017",
    seller: testSeller(),
    buyer: {
      name: "Beispiel GmbH",
      street: "Industrieweg 8",
      zip: "70565",
      city: "Stuttgart",
      countryCode: "DE",
      email: "rechnung@beispiel-gmbh.example",
      vatId: "DE987654321",
      customerNumber: "K-1001"
    },
    lines: [
      {
        id: newId(),
        itemNumber: "WD-STD",
        name: "Webdesign / Entwicklung",
        description: "Relaunch Produktseiten",
        quantity: "8",
        unitCode: "HUR",
        unitPrice: "95,00",
        taxCategory: "S",
        taxPercent: "19"
      },
      {
        id: newId(),
        name: "Wartungspauschale Website",
        quantity: "1",
        unitCode: "MON",
        unitPrice: "49,00",
        taxCategory: "S",
        taxPercent: "19"
      }
    ],
    skonto: [{ days: 7, percent: "2,00" }],
    note: "Vielen Dank für Ihren Auftrag!",
    currency: "EUR",
    createdAt: "2026-08-04T10:00:00.000Z",
    finalizedAt: "2026-08-04T10:05:00.000Z",
    ...overrides
  };
}
