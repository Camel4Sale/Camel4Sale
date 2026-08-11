import { describe, expect, it } from "vitest";
import {
  DEFAULT_NUMBER_TEMPLATE,
  formatInvoiceNumber,
  templateIsValid
} from "../src/core/numbering";

describe("Rechnungsnummern", () => {
  it("formatiert das Standard-Template", () => {
    expect(formatInvoiceNumber(DEFAULT_NUMBER_TEMPLATE, "2026-08-11", 42)).toBe("2026-0042");
  });
  it("unterstützt alle Platzhalter", () => {
    expect(formatInvoiceNumber("RE-{JJ}{MM}-{lfd3}", "2026-08-11", 7)).toBe("RE-2608-007");
    expect(formatInvoiceNumber("{JJJJ}/{lfd}", "2026-01-01", 123)).toBe("2026/123");
    expect(formatInvoiceNumber("{lfd5}", "2026-01-01", 9)).toBe("00009");
  });
  it("prüft Templates auf laufende Nummer", () => {
    expect(templateIsValid("{JJJJ}-{lfd4}")).toBe(true);
    expect(templateIsValid("{JJJJ}")).toBe(false);
    expect(templateIsValid("")).toBe(false);
  });
});
