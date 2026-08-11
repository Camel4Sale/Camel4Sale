import { describe, expect, it } from "vitest";
import {
  formatIban,
  isPlausibleTaxNumber,
  isPlausibleVatId,
  isValidIban,
  normalizeIban
} from "../src/core/iban";

describe("IBAN (Mod-97)", () => {
  it("akzeptiert gültige IBANs", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("AT611904300234573201")).toBe(true);
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true);
  });
  it("erkennt Zahlendreher", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE98370400440532013000")).toBe(false);
  });
  it("erkennt falsche Länge fürs Land", () => {
    expect(isValidIban("DE8937040044053201300")).toBe(false);
  });
  it("lehnt Unsinn ab", () => {
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("HALLO")).toBe(false);
    expect(isValidIban("1234567890")).toBe(false);
  });
  it("normalisiert und formatiert", () => {
    expect(normalizeIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
    expect(formatIban("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});

describe("USt-IdNr / Steuernummer", () => {
  it("USt-IdNr", () => {
    expect(isPlausibleVatId("DE123456789")).toBe(true);
    expect(isPlausibleVatId("DE 123 456 789")).toBe(true);
    expect(isPlausibleVatId("DE12345678")).toBe(false);
    expect(isPlausibleVatId("ATU12345678")).toBe(true);
    expect(isPlausibleVatId("X")).toBe(false);
  });
  it("Steuernummer", () => {
    expect(isPlausibleTaxNumber("35012/34567")).toBe(true);
    expect(isPlausibleTaxNumber("1234567890123")).toBe(true);
    expect(isPlausibleTaxNumber("123")).toBe(false);
    expect(isPlausibleTaxNumber("abc")).toBe(false);
  });
});
