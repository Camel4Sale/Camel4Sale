import { expect, test } from "@playwright/test";

test("Demo laden, Abrechnung berechnen und PDF exportieren", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Objekt & Mieter" })).toBeVisible();

  // Demo-Daten (MFH, 3 Wohnungen, Mieterwechsel, Zähler)
  await page.getByRole("button", { name: "Mit Demo-Daten ausprobieren" }).click();
  await expect(page.getByText("Demo-Objekt geladen", { exact: false })).toBeVisible();
  await expect(page.getByLabel(/Objektbezeichnung/)).toHaveValue("MFH Gartenstraße 5");
  await expect(page.getByText("Familie Yilmaz").first()).toBeVisible();

  // Kosten-Seite zeigt Summe
  await page.getByRole("link", { name: "Kosten & Zähler" }).click();
  await expect(page.getByText(/Summe 10\.884,75/)).toBeVisible();

  // Abrechnung
  await page.getByRole("link", { name: "Abrechnung" }).click();
  await expect(page.getByText("10.884,75 €").first()).toBeVisible();
  await expect(page.getByText("365 Tage")).toBeVisible();

  // Mieterwechsel: alte und neue Mieter der Whg. 2 tauchen getrennt auf, plus Leerstand
  await expect(page.getByText("Petra Schneider")).toBeVisible();
  await expect(page.getByText("Lukas & Mia Hoffmann")).toBeVisible();
  await expect(page.getByText("Leerstand (Vermieter)")).toBeVisible();

  // Salden sichtbar (Guthaben oder Nachzahlung je Partei)
  const badges = page.locator("text=/Nachzahlung|Guthaben/");
  await expect(badges.first()).toBeVisible();

  // PDF-Export der ersten Partei
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "⬇ PDF" }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Nebenkostenabrechnung_2025_.+\.pdf$/);
  await expect(page.getByText(/heruntergeladen/)).toBeVisible();
});
