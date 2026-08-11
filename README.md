# eRechnung Studio

**XRechnungen erstellen, prüfen und verwalten – 100 % lokal in Ihrem Browser.**
Keine Cloud, keine Abos, keine Datenweitergabe. Einmal kaufen, dauerhaft nutzen.

> Seit 1.1.2025 muss jedes deutsche Unternehmen E-Rechnungen **empfangen** können.
> Ab 2027 (Umsatz > 800 T€) bzw. 2028 (alle) wird auch das **Ausstellen** Pflicht.
> eRechnung Studio deckt beides ab – ohne monatliche Kosten.

## Funktionen (v1.0)

- **Erstellen**: XRechnung 3.0 (UBL, EN 16931) mit allen deutschen Pflichtangaben –
  Leitweg-ID/Käuferreferenz, Skonto nach BR-DE-18, Reverse Charge (§ 13b),
  Kleinunternehmer (§ 19), innergemeinschaftliche Lieferungen, Storno/Korrektur (Typ 384)
- **PDF-Sichtkopie**: ansprechende A4-Rechnung (DIN-5008-Anmutung) zusätzlich zur XML
- **Prüfen**: empfangene XRechnung (XML) oder ZUGFeRD/Factur-X (PDF) ansehen und lokal
  validieren – rechnerische Prüfung (BR-CO), deutsche Pflichtregeln (BR-DE), IBAN-Prüfziffern;
  Prüfbericht als JSON exportierbar (BMF empfiehlt Validierung + Archivierung des Berichts)
- **Verwalten**: Kunden- und Artikelstamm, lückenlose Nummernkreise pro Jahr,
  Entwürfe, festgeschriebene Rechnungen (GoBD-freundlich unveränderlich), JSON-Backup
- **Privat by Design**: alle Daten bleiben in IndexedDB des Browsers; als PWA installierbar

## Schnellstart (Entwicklung)

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # 96 Unit-Tests (Vitest)
npm run build      # Typecheck + Produktions-Build nach dist/
npm run e2e        # Playwright-E2E (ggf. CHROMIUM_PATH setzen)
```

Die fertige App in `dist/` ist rein statisch – sie läuft auf jedem Webspace,
Netlify, Cloudflare Pages, GitHub Pages o. ä. (keine Serverlogik nötig).

## Verkauf & Lizenzierung

Das Produkt ist für den Verkauf als Einmalkauf konzipiert (Freemium: Prüfen kostenlos,
3 Rechnungen frei, Pro-Lizenz schaltet unbegrenzt frei). Lizenzschlüssel werden offline
mit ECDSA P-256 signiert – siehe `tools/keygen/` und **docs/LAUNCH_CHECKLIST.md** für
den kompletten Weg zum ersten Verkauf (Lemon Squeezy, Preise, Rechtliches).

⚠️ **Vor dem Launch zwingend:** `npm run keygen -- init` ausführen (neues Schlüsselpaar,
der eingecheckte Dev-Schlüssel ist öffentlich). Die App warnt in den Einstellungen,
solange der Dev-Schlüssel aktiv ist.

## Wichtige Hinweise

- Die eingebaute Validierung ist eine **lokale Vorprüfung** (praxisrelevante Teilmenge der
  EN-16931-/BR-DE-Regeln in verständlichem Deutsch). Für die verbindliche
  Konformitätsprüfung: [KoSIT-Referenzvalidator](https://github.com/itplr-kosit/validator)
  bzw. https://erechnungsvalidator.service-bw.de
- eRechnung Studio ersetzt keine Steuer- oder Rechtsberatung.
- Stand des Standards: XRechnung 3.0.2 (Bundle 2026-01-31). XRechnung 4.0 ist für Ende 2026
  angekündigt – Update siehe docs/ROADMAP.md.

## Projektstruktur

```
src/core/    Fachlogik: Geldarithmetik, UBL-Builder, Regelwerk, Parser, PDF, Lizenz, DB
src/ui/      React-UI (5 Seiten, deutsch)
tests/       96 Unit-Tests (Vitest)
e2e/         Playwright-Tests (komplette Nutzerpfade)
tools/       Lizenz-Keygen-CLI
samples/     Beispiel-XRechnungen (gültig + fehlerhaft)
docs/        Businessplan, Launch-Checkliste, Marketing, Rechtliches, Landingpage
```

© 2026 – Alle Rechte vorbehalten. Siehe LICENSE.md.
