import { defineConfig } from "@playwright/test";

// In der Remote-Umgebung liegt ein vorinstalliertes Chromium unter /opt/pw-browsers.
// Bei Versionskonflikten kann CHROMIUM_PATH auf die Binärdatei gesetzt werden.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1280, height: 800 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin"
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
