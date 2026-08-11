import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetDbForTests,
  assignNextInvoiceNumber,
  clearAllData,
  countFinalized,
  deleteDraft,
  exportBackup,
  getInvoice,
  getSeller,
  importBackup,
  kvGet,
  kvSet,
  listCustomers,
  listInvoices,
  previewNextInvoiceNumber,
  saveCustomer,
  saveInvoice,
  saveSeller
} from "../src/core/db";
import { testInvoice, testSeller } from "./helpers";
import { newId } from "../src/core/model";

beforeEach(async () => {
  await __resetDbForTests();
});

describe("IndexedDB-Persistenz", () => {
  it("speichert und liest Firmenprofil", async () => {
    await saveSeller(testSeller());
    const seller = await getSeller();
    expect(seller?.name).toBe("Muster Webdesign");
  });

  it("speichert Rechnungen und zählt finalisierte", async () => {
    await saveInvoice(testInvoice({ id: "a", status: "final" }));
    await saveInvoice(testInvoice({ id: "b", status: "draft", number: undefined }));
    expect((await listInvoices()).length).toBe(2);
    expect(await countFinalized()).toBe(1);
    expect((await getInvoice("a"))?.status).toBe("final");
  });

  it("löscht nur Entwürfe", async () => {
    await saveInvoice(testInvoice({ id: "final1", status: "final" }));
    await saveInvoice(testInvoice({ id: "draft1", status: "draft" }));
    expect(await deleteDraft("final1")).toBe(false);
    expect(await deleteDraft("draft1")).toBe(true);
    expect((await listInvoices()).map((i) => i.id)).toEqual(["final1"]);
  });

  it("vergibt fortlaufende Nummern pro Jahr", async () => {
    expect(await previewNextInvoiceNumber("{JJJJ}-{lfd4}", "2026-08-11")).toBe("2026-0001");
    expect(await assignNextInvoiceNumber("{JJJJ}-{lfd4}", "2026-08-11")).toBe("2026-0001");
    expect(await assignNextInvoiceNumber("{JJJJ}-{lfd4}", "2026-12-31")).toBe("2026-0002");
    expect(await assignNextInvoiceNumber("{JJJJ}-{lfd4}", "2027-01-01")).toBe("2027-0001");
    expect(await previewNextInvoiceNumber("{JJJJ}-{lfd4}", "2026-01-01")).toBe("2026-0003");
  });

  it("Backup-Roundtrip", async () => {
    await saveSeller(testSeller());
    await saveCustomer({
      id: newId(),
      number: "K-1",
      name: "Kunde",
      street: "Weg 1",
      zip: "10115",
      city: "Berlin",
      countryCode: "DE"
    });
    await saveInvoice(testInvoice({ id: "x" }));
    await kvSet("counters", { "2026": 5 });
    const json = await exportBackup();

    await clearAllData();
    expect(await getSeller()).toBeUndefined();
    expect(await listInvoices()).toHaveLength(0);

    const result = await importBackup(json);
    expect(result.invoices).toBe(1);
    expect((await getSeller())?.name).toBe("Muster Webdesign");
    expect((await listCustomers())[0].name).toBe("Kunde");
    expect(await kvGet("counters")).toEqual({ "2026": 5 });
  });

  it("lehnt fremde Dateien beim Import ab", async () => {
    await expect(importBackup("{}")).rejects.toThrow("kein eRechnung-Studio-Backup");
    await expect(importBackup("kein json")).rejects.toThrow("kein gültiges JSON");
  });
});
