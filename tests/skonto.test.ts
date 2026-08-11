import { describe, expect, it } from "vitest";
import {
  buildPaymentTermsNote,
  buildSkontoLine,
  parseSkontoNote,
  skontoAmountCents,
  validateSkontoNote
} from "../src/core/skonto";

describe("Skonto (BR-DE-18)", () => {
  it("erzeugt exakt das offizielle Muster", () => {
    expect(buildSkontoLine(7, 200n)).toBe("#SKONTO#TAGE=7#PROZENT=2.00#");
    expect(buildSkontoLine(14, 350n)).toBe("#SKONTO#TAGE=14#PROZENT=3.50#");
    expect(buildSkontoLine(30, 1000n)).toBe("#SKONTO#TAGE=30#PROZENT=10.00#");
  });

  it("baut die BT-20-Note mit Skonto-Zeilen und Freitext", () => {
    const { note, errors } = buildPaymentTermsNote(
      [
        { days: 7, percent: "2,00" },
        { days: 14, percent: "1" }
      ],
      "Zahlbar innerhalb von 14 Tagen."
    );
    expect(errors).toHaveLength(0);
    expect(note.split("\n")).toEqual([
      "#SKONTO#TAGE=7#PROZENT=2.00#",
      "#SKONTO#TAGE=14#PROZENT=1.00#",
      "Zahlbar innerhalb von 14 Tagen."
    ]);
  });

  it("meldet ungültige Skonto-Eingaben", () => {
    const { errors } = buildPaymentTermsNote([{ days: 0, percent: "2" }], undefined);
    expect(errors).toHaveLength(1);
    const r2 = buildPaymentTermsNote([{ days: 7, percent: "abc" }], undefined);
    expect(r2.errors).toHaveLength(1);
  });

  it("validiert #-Zeilen gegen das Muster", () => {
    expect(validateSkontoNote("#SKONTO#TAGE=7#PROZENT=2.00#")).toHaveLength(0);
    expect(
      validateSkontoNote("#SKONTO#TAGE=7#PROZENT=2.00#BASISBETRAG=100.00#")
    ).toHaveLength(0);
    // VERZUG ist im aktuellen Standard nicht mehr zulässig
    expect(validateSkontoNote("#VERZUG#TAGE=30#PROZENT=9.00#")).toHaveLength(1);
    expect(validateSkontoNote("#SKONTO#TAGE=7#PROZENT=2#")).toHaveLength(1);
    expect(validateSkontoNote("#SKONTO#TAGE=7#PROZENT=2,00#")).toHaveLength(1);
    expect(validateSkontoNote("Freitext ohne Raute")).toHaveLength(0);
  });

  it("parst Skonto-Zeilen zurück", () => {
    const terms = parseSkontoNote(
      "#SKONTO#TAGE=7#PROZENT=2.00#\n#SKONTO#TAGE=14#PROZENT=1.00#BASISBETRAG=119.00#\nDanke!"
    );
    expect(terms).toHaveLength(2);
    expect(terms[0]).toMatchObject({ days: 7, percentE2: 200n });
    expect(terms[1].baseAmountCents).toBe(11900);
  });

  it("berechnet Skontobeträge kaufmännisch", () => {
    expect(skontoAmountCents(96271, 200n)).toBe(1925); // 2 % von 962,71 € = 19,2542 → 19,25
    expect(skontoAmountCents(100, 250n)).toBe(3); // 2,5 % von 1,00 € = 2,5 Cent → 3
  });
});
