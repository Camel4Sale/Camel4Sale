/**
 * Lokale Persistenz über IndexedDB. Es verlassen keine Daten den Browser.
 *
 * Stores:
 *   kv        – Einstellungen (Firmenprofil, Lizenz, Zählerstände)
 *   customers – Kundenstamm
 *   items     – Artikel-/Leistungsstamm
 *   invoices  – Rechnungen (Entwürfe + finalisierte)
 */

import type { CatalogItem, Customer, Invoice, SellerProfile } from "./model";
import { yearOf } from "./dates";
import { formatInvoiceNumber } from "./numbering";

const DB_NAME = "erechnung-studio";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("customers"))
        db.createObjectStore("customers", { keyPath: "id" });
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
      if (!db.objectStoreNames.contains("invoices"))
        db.createObjectStore("invoices", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB konnte nicht geöffnet werden"));
  });
  return dbPromise;
}

/** Nur für Tests: Verbindung + Datenbank zurücksetzen. */
export async function __resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB-Fehler"));
  });
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

// ---------- KV ----------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const s = await store("kv", "readonly");
  const v = await reqAsPromise(s.get(key));
  return v as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const s = await store("kv", "readwrite");
  await reqAsPromise(s.put(value, key));
}

export async function kvDelete(key: string): Promise<void> {
  const s = await store("kv", "readwrite");
  await reqAsPromise(s.delete(key));
}

// ---------- Stammdaten ----------

export async function getSeller(): Promise<SellerProfile | undefined> {
  return kvGet<SellerProfile>("seller");
}

export async function saveSeller(seller: SellerProfile): Promise<void> {
  await kvSet("seller", seller);
}

export async function listCustomers(): Promise<Customer[]> {
  const s = await store("customers", "readonly");
  const all = await reqAsPromise(s.getAll());
  return (all as Customer[]).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function saveCustomer(c: Customer): Promise<void> {
  const s = await store("customers", "readwrite");
  await reqAsPromise(s.put(c));
}

export async function deleteCustomer(id: string): Promise<void> {
  const s = await store("customers", "readwrite");
  await reqAsPromise(s.delete(id));
}

export async function listItems(): Promise<CatalogItem[]> {
  const s = await store("items", "readonly");
  const all = await reqAsPromise(s.getAll());
  return (all as CatalogItem[]).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function saveItem(item: CatalogItem): Promise<void> {
  const s = await store("items", "readwrite");
  await reqAsPromise(s.put(item));
}

export async function deleteItem(id: string): Promise<void> {
  const s = await store("items", "readwrite");
  await reqAsPromise(s.delete(id));
}

// ---------- Rechnungen ----------

export async function listInvoices(): Promise<Invoice[]> {
  const s = await store("invoices", "readonly");
  const all = (await reqAsPromise(s.getAll())) as Invoice[];
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const s = await store("invoices", "readonly");
  return (await reqAsPromise(s.get(id))) as Invoice | undefined;
}

export async function saveInvoice(inv: Invoice): Promise<void> {
  const s = await store("invoices", "readwrite");
  await reqAsPromise(s.put(inv));
}

/** Nur Entwürfe dürfen gelöscht werden (GoBD: finalisierte bleiben erhalten). */
export async function deleteDraft(id: string): Promise<boolean> {
  const inv = await getInvoice(id);
  if (!inv || inv.status !== "draft") return false;
  const s = await store("invoices", "readwrite");
  await reqAsPromise(s.delete(id));
  return true;
}

export async function countFinalized(): Promise<number> {
  const all = await listInvoices();
  return all.filter((i) => i.status === "final").length;
}

// ---------- Nummernkreis ----------

type Counters = Record<string, number>;

/** Vergibt die nächste Rechnungsnummer für das Jahr des Belegdatums (persistiert den Zähler). */
export async function assignNextInvoiceNumber(
  template: string,
  issueDate: string
): Promise<string> {
  const year = yearOf(issueDate);
  const counters = (await kvGet<Counters>("counters")) ?? {};
  const seq = (counters[year] ?? 0) + 1;
  counters[year] = seq;
  await kvSet("counters", counters);
  return formatInvoiceNumber(template, issueDate, seq);
}

/** Vorschau der nächsten Nummer ohne Zähler zu erhöhen. */
export async function previewNextInvoiceNumber(
  template: string,
  issueDate: string
): Promise<string> {
  const year = yearOf(issueDate);
  const counters = (await kvGet<Counters>("counters")) ?? {};
  return formatInvoiceNumber(template, issueDate, (counters[year] ?? 0) + 1);
}

export async function getCounters(): Promise<Record<string, number>> {
  return (await kvGet<Counters>("counters")) ?? {};
}

export async function setCounter(year: string, value: number): Promise<void> {
  const counters = (await kvGet<Counters>("counters")) ?? {};
  counters[year] = value;
  await kvSet("counters", counters);
}

// ---------- Backup ----------

/** Löscht ALLE lokalen Daten (für Demo-Modus-Reset und „Alles löschen“). */
export async function clearAllData(): Promise<void> {
  for (const name of ["kv", "customers", "items", "invoices"]) {
    const s = await store(name, "readwrite");
    await reqAsPromise(s.clear());
  }
}

export interface BackupFile {
  app: "erechnung-studio";
  backupVersion: 1;
  exportedAt: string;
  kv: Record<string, unknown>;
  customers: Customer[];
  items: CatalogItem[];
  invoices: Invoice[];
}

const KV_KEYS = ["seller", "license", "licenseInfo", "counters", "onboarded"];

export async function exportBackup(): Promise<string> {
  const kv: Record<string, unknown> = {};
  for (const key of KV_KEYS) {
    const v = await kvGet(key);
    if (v !== undefined) kv[key] = v;
  }
  const backup: BackupFile = {
    app: "erechnung-studio",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    kv,
    customers: await listCustomers(),
    items: await listItems(),
    invoices: await listInvoices()
  };
  return JSON.stringify(backup, null, 2);
}

export async function importBackup(
  json: string
): Promise<{ customers: number; items: number; invoices: number }> {
  let data: BackupFile;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON.");
  }
  if (data?.app !== "erechnung-studio" || data.backupVersion !== 1) {
    throw new Error("Die Datei ist kein eRechnung-Studio-Backup.");
  }
  for (const [key, value] of Object.entries(data.kv ?? {})) {
    if (KV_KEYS.includes(key)) await kvSet(key, value);
  }
  for (const c of data.customers ?? []) await saveCustomer(c);
  for (const item of data.items ?? []) await saveItem(item);
  for (const inv of data.invoices ?? []) await saveInvoice(inv);
  return {
    customers: data.customers?.length ?? 0,
    items: data.items?.length ?? 0,
    invoices: data.invoices?.length ?? 0
  };
}
