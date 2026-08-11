/**
 * Beispieldaten für den Demo-Modus.
 *
 * Alle Angaben sind fiktiv; die IBAN ist die bekannte Standard-Beispiel-IBAN
 * (prüfzifferngültig, kein echtes Konto).
 */

import type { CatalogItem, Customer, Invoice, SellerProfile } from "./model";
import { newId } from "./model";
import { addDaysISO, todayISO } from "./dates";
import { computeTotals } from "./totals";
import { buildUblInvoice } from "./ubl";
import {
  kvSet,
  saveCustomer,
  saveInvoice,
  saveItem,
  saveSeller,
  setCounter
} from "./db";
import { yearOf } from "./dates";

export const DEMO_SELLER: SellerProfile = {
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
  defaultSkontoDays: 7,
  defaultSkontoPercent: "2,00"
};

export async function loadDemoData(): Promise<void> {
  const today = todayISO();
  const seller = DEMO_SELLER;

  const customerA: Customer = {
    id: newId(),
    number: "K-1001",
    name: "Beispiel GmbH",
    street: "Industrieweg 8",
    zip: "70565",
    city: "Stuttgart",
    countryCode: "DE",
    email: "rechnung@beispiel-gmbh.example",
    vatId: "DE987654321",
    buyerReference: "BEST-2026-017"
  };
  const customerB: Customer = {
    id: newId(),
    number: "K-1002",
    name: "Stadt Musterhausen – Bauamt",
    street: "Rathausplatz 1",
    zip: "34117",
    city: "Musterhausen",
    countryCode: "DE",
    email: "erechnung@musterhausen.example",
    buyerReference: "04011000-1234512345-06",
    notes: "Behörde – Leitweg-ID als Käuferreferenz verwenden."
  };

  const itemA: CatalogItem = {
    id: newId(),
    number: "WD-STD",
    name: "Webdesign / Entwicklung",
    description: "Konzeption, Design und Umsetzung nach Aufwand",
    unitCode: "HUR",
    unitPrice: "95,00",
    taxCategory: "S",
    taxPercent: "19"
  };
  const itemB: CatalogItem = {
    id: newId(),
    number: "WD-WART",
    name: "Wartungspauschale Website",
    description: "Updates, Backups und Monitoring",
    unitCode: "MON",
    unitPrice: "49,00",
    taxCategory: "S",
    taxPercent: "19"
  };

  const issueDate = addDaysISO(today, -7);
  const finalInvoice: Invoice = {
    id: newId(),
    status: "final",
    typeCode: 380,
    number: `${yearOf(issueDate)}-0001`,
    issueDate,
    dueDate: addDaysISO(issueDate, 14),
    periodStart: addDaysISO(issueDate, -30),
    periodEnd: issueDate,
    buyerReference: customerA.buyerReference!,
    orderReference: "BEST-2026-017",
    seller,
    customerId: customerA.id,
    buyer: {
      name: customerA.name,
      street: customerA.street,
      zip: customerA.zip,
      city: customerA.city,
      countryCode: customerA.countryCode,
      email: customerA.email,
      vatId: customerA.vatId,
      customerNumber: customerA.number
    },
    lines: [
      {
        id: newId(),
        itemNumber: "WD-STD",
        name: "Webdesign / Entwicklung",
        description: "Relaunch Produktseiten inkl. responsivem Layout",
        quantity: "8",
        unitCode: "HUR",
        unitPrice: "95,00",
        taxCategory: "S",
        taxPercent: "19"
      },
      {
        id: newId(),
        itemNumber: "WD-WART",
        name: "Wartungspauschale Website",
        description: "Monat Juli 2026",
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
    createdAt: new Date().toISOString(),
    finalizedAt: new Date().toISOString()
  };
  const result = computeTotals(finalInvoice);
  if (result.totals) {
    finalInvoice.xml = buildUblInvoice(finalInvoice, result.totals);
  }

  const draftInvoice: Invoice = {
    id: newId(),
    status: "draft",
    typeCode: 380,
    issueDate: today,
    dueDate: addDaysISO(today, 14),
    deliveryDate: today,
    buyerReference: customerB.buyerReference!,
    seller,
    customerId: customerB.id,
    buyer: {
      name: customerB.name,
      street: customerB.street,
      zip: customerB.zip,
      city: customerB.city,
      countryCode: customerB.countryCode,
      email: customerB.email,
      customerNumber: customerB.number
    },
    lines: [
      {
        id: newId(),
        name: "Barrierefreiheits-Audit Website",
        description: "Prüfung nach BITV 2.0 inkl. Bericht",
        quantity: "1",
        unitCode: "C62",
        unitPrice: "1.450,00",
        taxCategory: "S",
        taxPercent: "19"
      }
    ],
    skonto: [],
    currency: "EUR",
    createdAt: new Date().toISOString()
  };

  await saveSeller(seller);
  await saveCustomer(customerA);
  await saveCustomer(customerB);
  await saveItem(itemA);
  await saveItem(itemB);
  await saveInvoice(finalInvoice);
  await saveInvoice(draftInvoice);
  await setCounter(yearOf(issueDate), 1);
  await kvSet("demoMode", true);
  await kvSet("onboarded", true);
}
