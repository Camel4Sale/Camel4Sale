import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

test.describe.configure({ mode: "serial" });

test("Demo laden, Rechnung erstellen, finalisieren und XML exportieren", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();

  // Demo-Daten laden (legt Firma, Kunden, Artikel und 2 Rechnungen an)
  await page.getByRole("button", { name: "Mit Demo-Daten ausprobieren" }).click();
  await expect(page.getByText("Demo-Daten geladen", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /2026-0001/ })).toBeVisible();

  // Neue Rechnung
  await page.getByRole("link", { name: "＋ Neue Rechnung" }).click();
  await expect(page.getByRole("heading", { name: "Neue Rechnung" })).toBeVisible();

  // Kunde aus Stammdaten übernehmen
  await page.getByLabel("Aus Kundenstamm übernehmen").selectOption({ label: "K-1001 · Beispiel GmbH" });
  await expect(page.getByLabel("Name / Firma")).toHaveValue("Beispiel GmbH");
  await expect(page.getByLabel(/Käuferreferenz/)).toHaveValue("BEST-2026-017");

  // Position ausfüllen
  await page.getByPlaceholder("Bezeichnung der Leistung/Ware").fill("Beratung E-Rechnung");
  const qty = page.getByLabel("Menge").first();
  await qty.fill("2");
  await page.getByPlaceholder("0,00").first().fill("100,00");

  // Live-Summen prüfen (2 × 100 € + 19 % = 238 €)
  await expect(page.getByText("238,00" + " " + "€").first()).toBeVisible();

  // Finalisieren
  await page.getByRole("button", { name: "Prüfen & finalisieren" }).click();
  await expect(page.getByText(/festgeschrieben – XML und PDF/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Rechnung 2026-0002/ })).toBeVisible();

  // XML herunterladen und inhaltlich prüfen
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "⬇ XRechnung (XML)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("2026-0002_XRechnung.xml");
  const path = await download.path();
  const xml = readFileSync(path!, "utf8");
  expect(xml).toContain("urn:xeinkauf.de:kosit:xrechnung_3.0");
  expect(xml).toContain("<cbc:ID>2026-0002</cbc:ID>");
  expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">238.00</cbc:PayableAmount>');
  expect(xml).toContain("<cbc:BuyerReference>BEST-2026-017</cbc:BuyerReference>");
});

test("Empfangene Rechnung prüfen: gültige und fehlerhafte Datei", async ({ page }) => {
  await page.goto("/#/pruefen");
  await expect(page.getByRole("heading", { name: "Rechnung prüfen" })).toBeVisible();

  // Gültige Beispieldatei
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(ROOT, "samples", "xrechnung-beispiel.xml"));
  await expect(page.getByText("✓ Keine Fehler in der lokalen Vorprüfung.")).toBeVisible();
  await expect(page.getByText("RE-2026-0815")).toBeVisible();
  await expect(page.getByText("Lieferant AG").first()).toBeVisible();

  // Fehlerhafte Beispieldatei → konkrete Regelverstöße sichtbar
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(ROOT, "samples", "xrechnung-fehlerhaft.xml"));
  await expect(page.getByText(/Fehler gefunden/)).toBeVisible();
  await expect(page.getByText("BR-DE-15").first()).toBeVisible(); // Käuferreferenz fehlt
  await expect(page.getByText("BR-CO-15").first()).toBeVisible(); // Bruttosumme falsch
  await expect(page.getByText("BR-DE-18").first()).toBeVisible(); // Skonto-Format

  // Prüfbericht herunterladen
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Prüfbericht (JSON)" }).click();
  const download = await downloadPromise;
  const report = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(report.verdict).toBe("FEHLER_GEFUNDEN");
  expect(report.findings.length).toBeGreaterThan(3);
});

test("Pro-Lizenz aktivieren mit Demo-Schlüssel", async ({ page }) => {
  const demoKey = readFileSync(join(ROOT, "tools/keygen/dev-keys/demo-license.txt"), "utf8").trim();
  await page.goto("/#/einstellungen");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await page.getByPlaceholder("ERS1.…").fill(demoKey);
  await page.getByRole("button", { name: "Aktivieren" }).click();
  await expect(page.getByText("Pro-Lizenz aktiv", { exact: false }).first()).toBeVisible();

  // Ungültiger Schlüssel wird abgelehnt
  await page.getByRole("button", { name: "Lizenz von diesem Gerät entfernen" }).click();
  await page.getByPlaceholder("ERS1.…").fill("ERS1.kaputt.kaputt");
  await page.getByRole("button", { name: "Aktivieren" }).click();
  await expect(page.getByText(/ungültig/).first()).toBeVisible();
});
