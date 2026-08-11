# Nebenkosten Studio

**Betriebskostenabrechnungen für private Vermieter – tagesgenau, HeizkostenV-konform, 100 % lokal im Browser.**

Nebenkosten Studio erstellt aus Objekt, Mietverhältnissen, Kosten und Zählerständen fertige
Nebenkostenabrechnungen als PDF – inklusive Mieterwechsel, Leerstand, Heizkostensplit nach
HeizkostenV und Fristprüfung nach § 556 Abs. 3 BGB. Keine Server, kein Konto, kein Abo:
Alle Daten bleiben in der IndexedDB des Browsers.

## Funktionen

- **Tagesgenaue Umlage** nach Wohnfläche, Personen, Wohneinheiten, Verbrauch (Zähler) oder
  Direktzuordnung – jeweils anteilig nach Tagen (Mieterwechsel wird automatisch aufgeteilt)
- **Leerstand** wird automatisch erkannt und dem Vermieter zugerechnet
  (bei Personen-Umlage mit fiktiver Personenzahl je Objekt konfigurierbar)
- **HeizkostenV**: Heiz-/Warmwasserkosten werden in Verbrauchs- und Grundkostenanteil
  (50–70 % einstellbar) gesplittet; Warnung inkl. Hinweis auf das 15-%-Kürzungsrecht,
  wenn keine Verbrauchsdaten vorliegen
- **§ 556 BGB**: Prüfung von Abrechnungszeitraum (max. 12 Monate) und Abrechnungsfrist
  (12 Monate nach Periodenende) mit deutschen Meldungen
- **Centgenau**: Geldbeträge als skalierte BigInt, Verteilung nach dem
  Größte-Reste-Verfahren – die Summe der Anteile ergibt immer exakt den Gesamtbetrag
- **Vorauszahlungen** monatsanteilig aus dem Mietverhältnis berechnet (Override möglich),
  Saldo je Partei als Nachzahlung oder Guthaben
- **PDF-Abrechnung** je Mietpartei (A4, mehrseitig, Kostenaufstellung + Erläuterung der
  Umlageschlüssel), Dateiname `Nebenkostenabrechnung_<Jahr>_<Mieter>.pdf`
- **Demo-Modus** (Mehrfamilienhaus mit Mieterwechsel und Zählern), JSON-Backup/-Restore
- **Freemium**: Datenerfassung unbegrenzt kostenlos, 3 PDF-Exporte frei; Pro-Lizenz
  (Einmalkauf) schaltet unbegrenzt frei – Offline-Lizenzprüfung per ECDSA P-256

## Schnellstart

```bash
npm install        # Abhängigkeiten (Versionen exakt gepinnt)
npm run dev        # Entwicklungsserver (Vite)
npm run typecheck  # tsc --noEmit (strict)
npm test           # Vitest-Unit-Tests (Engine)
npm run build      # Typecheck + Produktions-Build nach dist/
npm run e2e        # Playwright-E2E (vite preview auf :4173)
npm run keygen -- …# Lizenzschlüssel-CLI (init/sign/verify)
```

In Umgebungen mit vorinstalliertem Chromium: `CHROMIUM_PATH=/pfad/zu/chrome npm run e2e`.

## Architektur

- `src/core/` ist UI-frei und vollständig unit-getestet:
  - `allocation.ts` – die Abrechnungs-Engine (Segmente, Umlageschlüssel, HeizkostenV,
    Prüf-Findings, Vorauszahlungen, Salden)
  - `money.ts` – skalierte BigInt-Beträge, kaufmännische Rundung, deutsche Formatierung
  - `dates.ts` – tagesgenaue Zeitraumrechnung (inklusive Monatssegmente)
  - `pdf.ts` – PDF-Erzeugung mit pdf-lib, `db.ts` – IndexedDB, `license.ts` – Lizenzprüfung
- `src/ui/` enthält keinerlei Fachlogik (React 19, Tailwind v4, Hash-Navigation)
- `tests/` (Vitest, fake-indexeddb) und `e2e/` (Playwright) sichern Engine und Nutzerfluss ab

## Dokumentation

- `docs/BUSINESS_PLAN.md` – Zielmarkt, Preismodell, Vertriebskanäle
- `docs/LAUNCH_CHECKLIST.md` – Schritte bis zum Verkaufsstart (u. a. **Schlüsselrotation!**)
- `CHANGELOG.md` – Versionshistorie

## Lizenz

Proprietär – siehe `LICENSE.md`. Der ausgelieferte Entwicklungs-Lizenzschlüssel ist nur für
Tests gedacht; vor dem Verkauf `npm run keygen -- init` ausführen (siehe Launch-Checkliste).
