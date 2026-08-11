/** Beispieldaten: Mehrfamilienhaus mit 3 Wohnungen, Mieterwechsel, Zählern. */

import { DEFAULT_COST_TYPES, newId } from "./model";
import type { CostItem, CostType, MeterReading, Period, Property, Tenancy, Unit } from "./model";
import {
  kvSet,
  saveCostItem,
  saveCostType,
  saveMeter,
  savePeriod,
  saveProperty,
  saveTenancy,
  saveUnit
} from "./db";

export async function loadDemoData(): Promise<{ propertyId: string; periodId: string }> {
  const property: Property = {
    id: newId(),
    name: "MFH Gartenstraße 5",
    street: "Gartenstraße 5",
    zip: "76133",
    city: "Karlsruhe",
    landlordName: "Jan Muster",
    landlordAddress: "Musterweg 1, 76133 Karlsruhe",
    landlordEmail: "vermietung@muster.example",
    landlordPhone: "+49 721 987654",
    iban: "DE89370400440532013000",
    heatingConsumptionSharePct: 70,
    vacancyPersons: 1
  };

  const units: Unit[] = [
    { id: newId(), propertyId: property.id, label: "Whg. 1 (EG)", areaSqm: "62,0" },
    { id: newId(), propertyId: property.id, label: "Whg. 2 (1. OG)", areaSqm: "74,5" },
    { id: newId(), propertyId: property.id, label: "Whg. 3 (DG)", areaSqm: "48,0" }
  ];

  const tenancies: Tenancy[] = [
    {
      id: newId(),
      unitId: units[0].id,
      tenantName: "Familie Yilmaz",
      persons: 3,
      start: "2022-04-01",
      monthlyAdvance: "220,00"
    },
    {
      id: newId(),
      unitId: units[1].id,
      tenantName: "Petra Schneider",
      persons: 2,
      start: "2019-08-01",
      end: "2025-06-30",
      monthlyAdvance: "240,00"
    },
    {
      id: newId(),
      unitId: units[1].id,
      tenantName: "Lukas & Mia Hoffmann",
      persons: 2,
      start: "2025-08-01",
      monthlyAdvance: "250,00"
    },
    {
      id: newId(),
      unitId: units[2].id,
      tenantName: "Erik Johansson",
      persons: 1,
      start: "2024-01-01",
      monthlyAdvance: "150,00"
    }
  ];

  const costTypes: CostType[] = DEFAULT_COST_TYPES.slice(0, 10).map((t) => ({
    ...t,
    id: newId(),
    propertyId: property.id
  }));
  const byName = (n: string) => costTypes.find((c) => c.name === n)!;

  const period: Period = {
    id: newId(),
    propertyId: property.id,
    label: "2025",
    start: "2025-01-01",
    end: "2025-12-31"
  };

  const items: CostItem[] = [
    { id: newId(), periodId: period.id, costTypeId: byName("Grundsteuer").id, amount: "1.140,00" },
    { id: newId(), periodId: period.id, costTypeId: byName("Wasser / Abwasser").id, amount: "1.680,50", label: "Stadtwerke Jahresrechnung" },
    { id: newId(), periodId: period.id, costTypeId: byName("Heizung & Warmwasser").id, amount: "4.860,00", label: "Fernwärme + Ablesedienst" },
    { id: newId(), periodId: period.id, costTypeId: byName("Müllabfuhr").id, amount: "624,00" },
    { id: newId(), periodId: period.id, costTypeId: byName("Gebäudereinigung").id, amount: "960,00" },
    { id: newId(), periodId: period.id, costTypeId: byName("Gartenpflege").id, amount: "420,00" },
    { id: newId(), periodId: period.id, costTypeId: byName("Allgemeinstrom").id, amount: "310,25" },
    { id: newId(), periodId: period.id, costTypeId: byName("Sach- & Haftpflichtversicherung").id, amount: "890,00" }
  ];

  const meters: MeterReading[] = [
    { id: newId(), periodId: period.id, costTypeId: byName("Wasser / Abwasser").id, unitId: units[0].id, consumption: "98,4" },
    { id: newId(), periodId: period.id, costTypeId: byName("Wasser / Abwasser").id, unitId: units[1].id, consumption: "71,2" },
    { id: newId(), periodId: period.id, costTypeId: byName("Wasser / Abwasser").id, unitId: units[2].id, consumption: "34,9" },
    { id: newId(), periodId: period.id, costTypeId: byName("Heizung & Warmwasser").id, unitId: units[0].id, consumption: "5.120" },
    { id: newId(), periodId: period.id, costTypeId: byName("Heizung & Warmwasser").id, unitId: units[1].id, consumption: "6.480" },
    { id: newId(), periodId: period.id, costTypeId: byName("Heizung & Warmwasser").id, unitId: units[2].id, consumption: "3.150" }
  ];

  await saveProperty(property);
  for (const u of units) await saveUnit(u);
  for (const t of tenancies) await saveTenancy(t);
  for (const c of costTypes) await saveCostType(c);
  await savePeriod(period);
  for (const i of items) await saveCostItem(i);
  for (const m of meters) await saveMeter(m);
  await kvSet("demoMode", true);
  await kvSet("onboarded", true);
  return { propertyId: property.id, periodId: period.id };
}
