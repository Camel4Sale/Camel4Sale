import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatCentsPlain,
  formatPercentPlain,
  formatScaledDE,
  formatScaledPlain,
  lineNetCents,
  parseAmountToCents,
  parseDecimal,
  parsePercent,
  parseQuantity,
  parseUnitPrice,
  roundHalfAwayDiv,
  taxCents
} from "../src/core/money";

describe("parseDecimal", () => {
  it("parst deutsche Schreibweise mit Tausenderpunkt", () => {
    expect(parseDecimal("1.234,56", 2)).toBe(123456n);
    expect(parseDecimal("12.345.678,90", 2)).toBe(1234567890n);
  });
  it("parst internationale Schreibweise", () => {
    expect(parseDecimal("1234.56", 2)).toBe(123456n);
    expect(parseDecimal("0.01", 2)).toBe(1n);
  });
  it("parst ganze Zahlen und Vorzeichen", () => {
    expect(parseDecimal("42", 2)).toBe(4200n);
    expect(parseDecimal("-7,5", 2)).toBe(-750n);
    expect(parseDecimal("+3", 2)).toBe(300n);
  });
  it("lehnt Unsinn ab", () => {
    expect(parseDecimal("", 2)).toBeNull();
    expect(parseDecimal("abc", 2)).toBeNull();
    expect(parseDecimal("1,2,3", 2)).toBeNull();
    // "1.234" ohne Komma ist mehrdeutig (Tausenderpunkt vs. Dezimalpunkt mit
    // 3 Stellen) und wird bei 2 erlaubten Nachkommastellen abgelehnt
    expect(parseDecimal("1.234", 2)).toBeNull();
    expect(parseDecimal("1.23", 2)).toBe(123n);
    expect(parseDecimal("12,345", 2)).toBeNull(); // zu viele Nachkommastellen
  });
  it("erlaubt Leerzeichen und Eurozeichen", () => {
    expect(parseDecimal(" 1 234,50 € ", 2)).toBe(123450n);
  });
});

describe("roundHalfAwayDiv", () => {
  it("rundet kaufmännisch", () => {
    expect(roundHalfAwayDiv(25n, 10n)).toBe(3n); // 2,5 → 3
    expect(roundHalfAwayDiv(24n, 10n)).toBe(2n);
    expect(roundHalfAwayDiv(-25n, 10n)).toBe(-3n); // -2,5 → -3 (weg von Null)
    expect(roundHalfAwayDiv(-24n, 10n)).toBe(-2n);
    expect(roundHalfAwayDiv(0n, 10n)).toBe(0n);
  });
});

describe("lineNetCents", () => {
  it("berechnet Menge × Preis exakt", () => {
    // 8 h × 95,00 € = 760,00 €
    expect(lineNetCents(80000n, 950000n)).toBe(76000);
    // 2,5 × 10,10 € = 25,25 €
    expect(lineNetCents(25000n, 101000n)).toBe(2525);
  });
  it("rundet auf Cent (halbe weg von Null)", () => {
    // 0,333 × 0,10 € = 0,0333 € → 3 Cent
    expect(lineNetCents(3330n, 1000n)).toBe(3);
    // 1,5 × 0,01 € = 0,015 € → 2 Cent
    expect(lineNetCents(15000n, 100n)).toBe(2);
    // klassischer Gleitkomma-Killer: 0,1 + 0,2-artige Fälle treten nicht auf
    expect(lineNetCents(1000n, 1000n)).toBe(1); // 0,1 × 0,10 € = 0,01 €
  });
  it("verarbeitet negative Mengen (Storno)", () => {
    expect(lineNetCents(-80000n, 950000n)).toBe(-76000);
  });
  it("verarbeitet 4 Nachkommastellen im Preis", () => {
    // 1000 × 0,0123 € = 12,30 €
    expect(lineNetCents(10000000n, 123n)).toBe(1230);
  });
});

describe("taxCents", () => {
  it("berechnet 19 % korrekt", () => {
    expect(taxCents(80900, 1900n)).toBe(15371); // 809,00 € → 153,71 €
    expect(taxCents(10000, 1900n)).toBe(1900);
  });
  it("rundet kaufmännisch", () => {
    expect(taxCents(50, 1900n)).toBe(10); // 9,5 Cent → 10
    expect(taxCents(49, 1900n)).toBe(9); // 9,31 → 9
    expect(taxCents(1, 1900n)).toBe(0); // 0,19 → 0
  });
  it("negativ (Storno)", () => {
    expect(taxCents(-80900, 1900n)).toBe(-15371);
  });
});

describe("Formatierung", () => {
  it("formatCents deutsch", () => {
    expect(formatCents(123456)).toBe("1.234,56");
    expect(formatCents(-99)).toBe("-0,99");
    expect(formatCents(0)).toBe("0,00");
    expect(formatCents(100000000)).toBe("1.000.000,00");
  });
  it("formatCentsPlain für XML", () => {
    expect(formatCentsPlain(123456)).toBe("1234.56");
    expect(formatCentsPlain(-50)).toBe("-0.50");
  });
  it("formatScaledPlain kürzt Nullen", () => {
    expect(formatScaledPlain(80000n, 4)).toBe("8");
    expect(formatScaledPlain(25000n, 4)).toBe("2.5");
    expect(formatScaledPlain(123n, 4)).toBe("0.0123");
  });
  it("formatPercentPlain", () => {
    expect(formatPercentPlain(1900n)).toBe("19");
    expect(formatPercentPlain(700n)).toBe("7");
    expect(formatPercentPlain(850n)).toBe("8.5");
    expect(formatPercentPlain(0n)).toBe("0");
  });
  it("formatScaledDE", () => {
    expect(formatScaledDE(25000n, 4)).toBe("2,5");
  });
});

describe("Eingabe-Parser", () => {
  it("parseQuantity erlaubt 0 und negativ", () => {
    expect(parseQuantity("0")).toBe(0n);
    expect(parseQuantity("-8")).toBe(-80000n);
    expect(parseQuantity("x")).toBeNull();
  });
  it("parseUnitPrice", () => {
    expect(parseUnitPrice("95,00")).toBe(950000n);
    expect(parseUnitPrice("0,0123")).toBe(123n);
  });
  it("parsePercent begrenzt auf 0–100", () => {
    expect(parsePercent("19")).toBe(1900n);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
  it("parseAmountToCents", () => {
    expect(parseAmountToCents("962,71")).toBe(96271);
    expect(parseAmountToCents("962.71")).toBe(96271);
  });
});
