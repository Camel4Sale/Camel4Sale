import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildInvoicePdf, pdfFileName } from "../src/core/pdf";
import { computeTotals } from "../src/core/totals";
import { testInvoice } from "./helpers";
import { newId } from "../src/core/model";

describe("PDF-Erzeugung", () => {
  it("erzeugt ein gültiges einseitiges PDF", async () => {
    const inv = testInvoice();
    const { totals } = computeTotals(inv);
    const bytes = await buildInvoicePdf(inv, totals!);
    expect(bytes.length).toBeGreaterThan(2000);
    expect(new TextDecoder("latin1").decode(bytes.subarray(0, 8))).toContain("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Rechnung 2026-0001");
  });

  it("bricht bei vielen Positionen auf mehrere Seiten um", async () => {
    const inv = testInvoice({
      lines: Array.from({ length: 40 }, (_, i) => ({
        id: newId(),
        name: `Position ${i + 1} mit etwas längerem Titel für den Umbruchtest`,
        description: "Beschreibungstext, der ebenfalls umgebrochen werden können muss.",
        quantity: "1,5",
        unitCode: "HUR",
        unitPrice: "80,00",
        taxCategory: "S" as const,
        taxPercent: "19"
      }))
    });
    const { totals } = computeTotals(inv);
    const bytes = await buildInvoicePdf(inv, totals!);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("verkraftet Sonderzeichen außerhalb von WinAnsi", async () => {
    const inv = testInvoice({
      note: "Grüße 😀 – Sonderzeichen → Test „Anführung“ €"
    });
    const { totals } = computeTotals(inv);
    const bytes = await buildInvoicePdf(inv, totals!);
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it("Dateiname", () => {
    expect(pdfFileName(testInvoice())).toBe("2026-0001_Rechnung.pdf");
  });
});
