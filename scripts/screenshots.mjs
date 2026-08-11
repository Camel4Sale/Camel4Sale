#!/usr/bin/env node
/**
 * Erzeugt Screenshots der App für README/Landingpage/Marketing.
 *
 * Voraussetzung: `npm run build` wurde ausgeführt.
 * Aufruf:        node scripts/screenshots.mjs
 * Ergebnis:      docs/screenshots/*.png (nicht in Git – lokal erzeugen)
 *
 * In Umgebungen mit vorinstalliertem Chromium ggf. setzen:
 *   CHROMIUM_PATH=/pfad/zu/chrome node scripts/screenshots.mjs
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "docs/screenshots";

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Preview-Server unter ${url} nicht erreichbar`);
}

const server = spawn(
  "npx",
  ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  { stdio: "ignore" }
);

try {
  await waitForServer(BASE);
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined
  });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 850 },
    deviceScaleFactor: 2,
    locale: "de-DE",
    timezoneId: "Europe/Berlin"
  });
  const page = await context.newPage();

  // Demo-Daten laden
  await page.goto(BASE);
  await page.getByRole("button", { name: "Mit Demo-Daten ausprobieren" }).click();
  await page.getByRole("link", { name: /2026-0001/ }).waitFor();

  await page.screenshot({ path: `${OUT}/01-dashboard.png` });

  // Editor mit dem Demo-Entwurf
  await page.getByRole("link", { name: "(Entwurf)" }).first().click();
  await page.getByRole("heading", { name: "Rechnungsentwurf" }).waitFor();
  await page.screenshot({ path: `${OUT}/02-editor.png`, fullPage: false });

  // Prüfen-Ansicht mit Beispieldatei
  await page.goto(`${BASE}/#/pruefen`);
  await page
    .locator('input[type="file"]')
    .setInputFiles("samples/xrechnung-beispiel.xml");
  await page.getByText("Keine Fehler in der lokalen Vorprüfung.").waitFor();
  await page.screenshot({ path: `${OUT}/03-pruefen.png` });

  // Einstellungen
  await page.goto(`${BASE}/#/einstellungen`);
  await page.getByRole("heading", { name: "Einstellungen" }).waitFor();
  await page.screenshot({ path: `${OUT}/04-einstellungen.png` });

  await browser.close();
  console.log(`Screenshots gespeichert unter ${OUT}/`);
} finally {
  server.kill();
}
