/** Datenmodell von Nebenkosten Studio. Beträge/Flächen als Eingabe-Strings (deutsche Dezimalschreibweise). */

export type AllocationKey = "flaeche" | "personen" | "einheiten" | "verbrauch" | "direkt";

export const ALLOCATION_LABELS: Record<AllocationKey, string> = {
  flaeche: "Wohnfläche (m² × Tage)",
  personen: "Personen × Tage",
  einheiten: "Einheiten (× Tage)",
  verbrauch: "Verbrauch (Zähler)",
  direkt: "Direktzuordnung"
};

/** Gebäude/Objekt. */
export interface Property {
  id: string;
  name: string; // z. B. "MFH Beispielstraße 12"
  street: string;
  zip: string;
  city: string;
  landlordName: string;
  landlordAddress: string; // eine Zeile, z. B. "Musterweg 1, 76133 Karlsruhe"
  landlordEmail?: string;
  landlordPhone?: string;
  iban?: string;
  /** Verbrauchsanteil Heiz-/Warmwasserkosten in % (HeizkostenV: 50–70, üblich 70). */
  heatingConsumptionSharePct: number;
  /** Fiktive Personenzahl für Leerstand beim Personen-Schlüssel. */
  vacancyPersons: number;
}

export interface Unit {
  id: string;
  propertyId: string;
  label: string; // "Whg. 1 (EG links)"
  areaSqm: string; // "64,5"
}

export interface Tenancy {
  id: string;
  unitId: string;
  tenantName: string;
  persons: number;
  start: string; // Einzug (ISO)
  end?: string; // Auszug (ISO), leer = läuft
  monthlyAdvance: string; // vereinbarte monatliche NK-Vorauszahlung, z. B. "180,00"
  /** Optional: tatsächlich gezahlte Vorauszahlungen im Abrechnungszeitraum (überschreibt die Berechnung). */
  advancePaidOverride?: string;
}

export interface CostType {
  id: string;
  propertyId: string;
  name: string; // "Grundsteuer"
  key: AllocationKey;
  /** Heiz-/Warmwasserkosten → HeizkostenV-Split (Verbrauchs-/Grundkostenanteil). */
  isHeating: boolean;
  /** Einheit für Zählerstände, z. B. "m³", "kWh", "Einheiten". */
  meterUnit?: string;
}

export interface Period {
  id: string;
  propertyId: string;
  label: string; // "2025"
  start: string;
  end: string;
}

export interface CostItem {
  id: string;
  periodId: string;
  costTypeId: string;
  label?: string; // z. B. "Rechnung Stadtwerke 03/2025"
  amount: string; // Gesamtbetrag brutto, z. B. "1.234,56"
  /** Bei Schlüssel "direkt": Ziel-Einheit. */
  directUnitId?: string;
}

export interface MeterReading {
  id: string;
  periodId: string;
  costTypeId: string;
  unitId: string;
  consumption: string; // erfasster Verbrauch der Einheit im Zeitraum
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Umlagefähige Standard-Kostenarten nach § 2 BetrKV (praxisübliche Auswahl). */
export const DEFAULT_COST_TYPES: Omit<CostType, "id" | "propertyId">[] = [
  { name: "Grundsteuer", key: "flaeche", isHeating: false },
  { name: "Wasser / Abwasser", key: "verbrauch", isHeating: false, meterUnit: "m³" },
  { name: "Heizung & Warmwasser", key: "verbrauch", isHeating: true, meterUnit: "Einheiten" },
  { name: "Müllabfuhr", key: "personen", isHeating: false },
  { name: "Straßenreinigung", key: "flaeche", isHeating: false },
  { name: "Gebäudereinigung", key: "flaeche", isHeating: false },
  { name: "Gartenpflege", key: "flaeche", isHeating: false },
  { name: "Allgemeinstrom", key: "flaeche", isHeating: false },
  { name: "Schornsteinfeger", key: "flaeche", isHeating: false },
  { name: "Sach- & Haftpflichtversicherung", key: "flaeche", isHeating: false },
  { name: "Hauswart", key: "flaeche", isHeating: false },
  { name: "Aufzug", key: "flaeche", isHeating: false },
  { name: "Kabel/Antenne", key: "einheiten", isHeating: false },
  { name: "Niederschlagswasser", key: "flaeche", isHeating: false }
];
