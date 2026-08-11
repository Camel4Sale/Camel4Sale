import { describe, expect, it } from "vitest";
import { computeTotals } from "../src/core/totals";
import { testInvoice, testSeller } from "./helpers";
import { newId } from "../src/core/model";

describe("computeTotals", () => {
  it("berechnet die Demo-Rechnung korrekt (8×95 + 1×49, 19 %)", () => {
    const { totals, errors } = computeTotals(testInvoice());
    expect(errors).toHaveLength(0);
    expect(totals).not.toBeNull();
    expect(totals!.lineExtensionCents).toBe(80900);
    expect(totals!.taxTotalCents).toBe(15371);
    expect(totals!.taxInclusiveCents).toBe(96271);
    expect(totals!.payableCents).toBe(96271);
    expect(totals!.breakdown).toHaveLength(1);
    expect(totals!.breakdown[0]).toMatchObject({
      category: "S",
      taxableCents: 80900,
      taxCents: 15371
    });
  });

  it("gruppiert gemischte Steuersätze (19 % + 7 %)", () => {
    const inv = testInvoice({
      lines: [
        {
          id: newId(),
          name: "Beratung",
          quantity: "1",
          unitCode: "C62",
          unitPrice: "100,00",
          taxCategory: "S",
          taxPercent: "19"
        },
        {
          id: newId(),
          name: "Buch",
          quantity: "2",
          unitCode: "C62",
          unitPrice: "10,00",
          taxCategory: "S",
          taxPercent: "7"
        }
      ]
    });
    const { totals } = computeTotals(inv);
    expect(totals!.breakdown).toHaveLength(2);
    const s19 = totals!.breakdown.find((b) => b.percentE2 === 1900n)!;
    const s7 = totals!.breakdown.find((b) => b.percentE2 === 700n)!;
    expect(s19.taxCents).toBe(1900);
    expect(s7.taxableCents).toBe(2000);
    expect(s7.taxCents).toBe(140);
    expect(totals!.taxTotalCents).toBe(2040);
    expect(totals!.taxInclusiveCents).toBe(14040);
  });

  it("Kleinunternehmer: Kategorie E ohne Steuer, mit § 19-Hinweis", () => {
    const inv = testInvoice({
      seller: testSeller({ kleinunternehmer: true, vatId: undefined }),
      lines: [
        {
          id: newId(),
          name: "Nachhilfe",
          quantity: "10",
          unitCode: "HUR",
          unitPrice: "40,00",
          taxCategory: "E",
          taxPercent: "0"
        }
      ]
    });
    const { totals } = computeTotals(inv);
    expect(totals!.taxTotalCents).toBe(0);
    expect(totals!.payableCents).toBe(40000);
    expect(totals!.breakdown[0].category).toBe("E");
    expect(totals!.breakdown[0].exemptionReason).toContain("§ 19");
  });

  it("Reverse Charge: Kategorie AE mit Befreiungscode", () => {
    const inv = testInvoice({
      lines: [
        {
          id: newId(),
          name: "Software-Entwicklung",
          quantity: "1",
          unitCode: "C62",
          unitPrice: "5.000,00",
          taxCategory: "AE",
          taxPercent: "0"
        }
      ]
    });
    const { totals } = computeTotals(inv);
    expect(totals!.taxTotalCents).toBe(0);
    expect(totals!.breakdown[0].exemptionReasonCode).toBe("VATEX-EU-AE");
    expect(totals!.breakdown[0].exemptionReason).toContain("13b");
  });

  it("Storno: negative Mengen ergeben negative Summen", () => {
    const inv = testInvoice({
      typeCode: 384,
      precedingInvoiceNumber: "2026-0001",
      lines: testInvoice().lines.map((l) => ({ ...l, quantity: `-${l.quantity}` }))
    });
    const { totals } = computeTotals(inv);
    expect(totals!.lineExtensionCents).toBe(-80900);
    expect(totals!.taxTotalCents).toBe(-15371);
    expect(totals!.payableCents).toBe(-96271);
  });

  it("meldet unparsbare Eingaben je Position", () => {
    const inv = testInvoice({
      lines: [
        {
          id: newId(),
          name: "Kaputt",
          quantity: "abc",
          unitCode: "C62",
          unitPrice: "1,0x",
          taxCategory: "S",
          taxPercent: "19"
        }
      ]
    });
    const { totals, errors } = computeTotals(inv);
    expect(totals).toBeNull();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("Position 1");
  });

  it("Rundung je Position, dann Summierung (EN-16931-Stil)", () => {
    // 3 × (0,1 × 0,10 €) = 3 × 0,01 € – nicht 0,03 € aus 0,030 gerundet, sondern je Zeile
    const inv = testInvoice({
      lines: [1, 2, 3].map((i) => ({
        id: newId(),
        name: `Kleinstposition ${i}`,
        quantity: "0,1",
        unitCode: "C62",
        unitPrice: "0,10",
        taxCategory: "S",
        taxPercent: "19"
      }))
    });
    const { totals } = computeTotals(inv);
    expect(totals!.lineExtensionCents).toBe(3);
    expect(totals!.taxTotalCents).toBe(1); // 19 % von 0,03 € = 0,0057 € → 0,01 €
  });
});
