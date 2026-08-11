# Changelog

## 1.0.0 – 2026-08-11

Erstes vollständiges Release.

- Tagesgenaue Betriebskostenabrechnung mit Umlage nach Wohnfläche, Personen,
  Wohneinheiten, Verbrauch (Zähler, tagesanteilig bei Mieterwechsel) und Direktzuordnung
- Leerstands-Segmente automatisch zulasten des Vermieters (fiktive Personenzahl einstellbar)
- HeizkostenV-Split (Verbrauchsanteil 50–70 %) mit Warnung inkl. 15-%-Kürzungsrecht-Hinweis
- Fristen- und Plausibilitätsprüfung: § 556 BGB (Zeitraum, Abrechnungsfrist), Flächen-,
  Personen-, Zähler- und Betrags-Findings mit deutschen Meldungen (`NK-…`)
- Centgenaue Verteilung per Größte-Reste-Verfahren (Summen-Invariante), Vorauszahlungen
  monatsanteilig, Saldo je Partei (Nachzahlung/Guthaben)
- PDF-Abrechnung je Mietpartei (A4, mehrseitig, Umlageschlüssel-Erläuterung)
- Objekt-/Mieter-/Kosten-/Zählerverwaltung, Demo-Objekt, JSON-Backup, IndexedDB
- Offline-Lizenzsystem (ECDSA P-256, `NKS1.…`) mit Keygen-CLI, Freemium-Limit (3 PDFs)
- 22 Unit-Tests (Engine inkl. Invarianten), E2E-Flow (Playwright), CI
