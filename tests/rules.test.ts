import { describe, expect, it } from "vitest";
import { validateInvoice } from "../src/core/rules";
import { computeTotals } from "../src/core/totals";
import { testInvoice, testSeller } from "./helpers";
import type { Invoice } from "../src/core/model";

function findingsFor(inv: Invoice) {
  const result = computeTotals(inv);
  return validateInvoice(inv, result.totals, result.errors);
}

function ids(inv: Invoice): string[] {
  return findingsFor(inv).map((x) => x.id);
}

describe("validateInvoice (Editor-Prüfung)", () => {
  it("vollständige Rechnung hat keine Fehler", () => {
    const errors = findingsFor(testInvoice()).filter((x) => x.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  it("meldet fehlende XRechnung-Pflichtfelder (BR-DE)", () => {
    const inv = testInvoice({
      seller: testSeller({ contactName: "", phone: "", email: "", iban: "" })
    });
    const found = ids(inv);
    expect(found).toContain("BR-DE-5");
    expect(found).toContain("BR-DE-6");
    expect(found).toContain("BR-DE-7");
    expect(found).toContain("BR-DE-1");
  });

  it("meldet fehlende Käuferreferenz (BR-DE-15)", () => {
    expect(ids(testInvoice({ buyerReference: "  " }))).toContain("BR-DE-15");
  });

  it("meldet ungültige IBAN", () => {
    expect(ids(testInvoice({ seller: testSeller({ iban: "DE00123456781234567890" }) }))).toContain(
      "XR-IBAN"
    );
  });

  it("meldet fehlende Steuernummer/USt-IdNr (BR-CO-26)", () => {
    expect(
      ids(testInvoice({ seller: testSeller({ vatId: undefined, taxNumber: undefined }) }))
    ).toContain("BR-CO-26");
  });

  it("Fälligkeit vor Rechnungsdatum", () => {
    expect(ids(testInvoice({ dueDate: "2026-08-01" }))).toContain("XR-DATUM");
  });

  it("BR-CO-25: weder Fälligkeit noch Zahlungsbedingungen", () => {
    expect(
      ids(testInvoice({ dueDate: undefined, skonto: [], paymentTermsText: undefined }))
    ).toContain("BR-CO-25");
  });

  it("warnt bei fehlendem Leistungsdatum (§ 14 UStG)", () => {
    const inv = testInvoice({ deliveryDate: undefined, periodStart: undefined, periodEnd: undefined });
    const finding = findingsFor(inv).find((x) => x.id === "DE-UST-14");
    expect(finding?.severity).toBe("warning");
  });

  it("Kleinunternehmer mit Steuerausweis ist ein Fehler", () => {
    const inv = testInvoice({ seller: testSeller({ kleinunternehmer: true }) });
    expect(ids(inv)).toContain("DE-19-UST");
  });

  it("S-Kategorie mit 0 % ist ein Fehler", () => {
    const inv = testInvoice({
      lines: [{ ...testInvoice().lines[0], taxPercent: "0" }]
    });
    expect(ids(inv)).toContain("BR-S-05");
  });

  it("Reverse Charge ohne Käufer-USt-IdNr", () => {
    const base = testInvoice();
    const inv = testInvoice({
      lines: [{ ...base.lines[0], taxCategory: "AE", taxPercent: "0" }],
      buyer: { ...base.buyer, vatId: undefined }
    });
    expect(ids(inv)).toContain("BR-AE-04");
  });

  it("Storno ohne Ursprungsrechnung", () => {
    expect(ids(testInvoice({ typeCode: 384, precedingInvoiceNumber: undefined }))).toContain(
      "XR-STORNO"
    );
  });

  it("negativer Einzelpreis (BR-27)", () => {
    const base = testInvoice();
    const inv = testInvoice({ lines: [{ ...base.lines[0], unitPrice: "-95,00" }] });
    expect(ids(inv)).toContain("BR-27");
  });

  it("Freitext, der wie eine kaputte Skonto-Zeile aussieht (BR-DE-18)", () => {
    const inv = testInvoice({ paymentTermsText: "#SKONTO#TAGE=7#PROZENT=2#" });
    expect(ids(inv)).toContain("BR-DE-18");
  });

  it("keine Positionen (BR-16)", () => {
    expect(ids(testInvoice({ lines: [] }))).toContain("BR-16");
  });
});
