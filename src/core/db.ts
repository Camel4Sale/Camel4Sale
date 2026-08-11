/** Lokale Persistenz (IndexedDB) – alle Daten bleiben im Browser. */

import type {
  CostItem,
  CostType,
  MeterReading,
  Period,
  Property,
  Tenancy,
  Unit
} from "./model";

const DB_NAME = "nebenkosten-studio";
const DB_VERSION = 1;
const STORES = ["kv", "properties", "units", "tenancies", "costTypes", "periods", "costItems", "meters"] as const;
type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, name === "kv" ? undefined : { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB konnte nicht geöffnet werden"));
  });
  return dbPromise;
}

export async function __resetDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise.catch(() => null))?.close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB-Fehler"));
  });
}

async function store(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await reqAsPromise((await store("kv", "readonly")).get(key))) as T | undefined;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  await reqAsPromise((await store("kv", "readwrite")).put(value, key));
}
export async function kvDelete(key: string): Promise<void> {
  await reqAsPromise((await store("kv", "readwrite")).delete(key));
}

async function listAll<T>(name: StoreName): Promise<T[]> {
  return (await reqAsPromise((await store(name, "readonly")).getAll())) as T[];
}
async function putOne(name: StoreName, value: unknown): Promise<void> {
  await reqAsPromise((await store(name, "readwrite")).put(value));
}
async function deleteOne(name: StoreName, id: string): Promise<void> {
  await reqAsPromise((await store(name, "readwrite")).delete(id));
}

export const listProperties = () => listAll<Property>("properties");
export const saveProperty = (v: Property) => putOne("properties", v);
export const deleteProperty = (id: string) => deleteOne("properties", id);

export const listUnits = () => listAll<Unit>("units");
export const saveUnit = (v: Unit) => putOne("units", v);
export const deleteUnit = (id: string) => deleteOne("units", id);

export const listTenancies = () => listAll<Tenancy>("tenancies");
export const saveTenancy = (v: Tenancy) => putOne("tenancies", v);
export const deleteTenancy = (id: string) => deleteOne("tenancies", id);

export const listCostTypes = () => listAll<CostType>("costTypes");
export const saveCostType = (v: CostType) => putOne("costTypes", v);
export const deleteCostType = (id: string) => deleteOne("costTypes", id);

export const listPeriods = () => listAll<Period>("periods");
export const savePeriod = (v: Period) => putOne("periods", v);
export const deletePeriod = (id: string) => deleteOne("periods", id);

export const listCostItems = () => listAll<CostItem>("costItems");
export const saveCostItem = (v: CostItem) => putOne("costItems", v);
export const deleteCostItem = (id: string) => deleteOne("costItems", id);

export const listMeters = () => listAll<MeterReading>("meters");
export const saveMeter = (v: MeterReading) => putOne("meters", v);
export const deleteMeter = (id: string) => deleteOne("meters", id);

export async function clearAllData(): Promise<void> {
  for (const name of STORES) {
    await reqAsPromise((await store(name, "readwrite")).clear());
  }
}

export interface BackupFile {
  app: "nebenkosten-studio";
  backupVersion: 1;
  exportedAt: string;
  kv: Record<string, unknown>;
  properties: Property[];
  units: Unit[];
  tenancies: Tenancy[];
  costTypes: CostType[];
  periods: Period[];
  costItems: CostItem[];
  meters: MeterReading[];
}

const KV_KEYS = ["license", "pdfExports", "onboarded", "demoMode"];

export async function exportBackup(): Promise<string> {
  const kv: Record<string, unknown> = {};
  for (const key of KV_KEYS) {
    const v = await kvGet(key);
    if (v !== undefined) kv[key] = v;
  }
  const backup: BackupFile = {
    app: "nebenkosten-studio",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    kv,
    properties: await listProperties(),
    units: await listUnits(),
    tenancies: await listTenancies(),
    costTypes: await listCostTypes(),
    periods: await listPeriods(),
    costItems: await listCostItems(),
    meters: await listMeters()
  };
  return JSON.stringify(backup, null, 2);
}

export async function importBackup(json: string): Promise<number> {
  let data: BackupFile;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON.");
  }
  if (data?.app !== "nebenkosten-studio" || data.backupVersion !== 1) {
    throw new Error("Die Datei ist kein Nebenkosten-Studio-Backup.");
  }
  for (const [key, value] of Object.entries(data.kv ?? {})) {
    if (KV_KEYS.includes(key)) await kvSet(key, value);
  }
  let count = 0;
  for (const v of data.properties ?? []) (await saveProperty(v), count++);
  for (const v of data.units ?? []) (await saveUnit(v), count++);
  for (const v of data.tenancies ?? []) (await saveTenancy(v), count++);
  for (const v of data.costTypes ?? []) (await saveCostType(v), count++);
  for (const v of data.periods ?? []) (await savePeriod(v), count++);
  for (const v of data.costItems ?? []) (await saveCostItem(v), count++);
  for (const v of data.meters ?? []) (await saveMeter(v), count++);
  return count;
}
