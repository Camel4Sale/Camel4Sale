# CLAUDE.md

Hinweise für die Arbeit mit Claude Code in diesem Repository.

## Was dieses Repository ist

**eRechnung Studio** – kommerzielle, rein clientseitige Web-App (React + TypeScript + Vite +
Tailwind v4) zum Erstellen, Prüfen und Verwalten von E-Rechnungen (XRechnung/ZUGFeRD) für den
deutschen Markt. Keine Server, alle Daten in IndexedDB.

## Befehle

```bash
npm install            # Abhängigkeiten (exakt gepinnt, keine Lockfile im Repo)
npm run dev            # Vite-Devserver
npm run typecheck      # tsc --noEmit (strict)
npm test               # Vitest (tests/**, Node-Umgebung, fake-indexeddb)
npm run build          # Typecheck + Produktions-Build
npm run e2e            # Playwright (startet vite preview auf :4173)
npm run keygen -- …    # Lizenzschlüssel-CLI (init/sign/verify)
npm run screenshots    # App-Screenshots nach docs/screenshots/ (gitignored)
```

In Umgebungen mit vorinstalliertem Chromium: `CHROMIUM_PATH=/pfad/zu/chrome npm run e2e`.

## Architektur

- `src/core/` ist **UI-frei** und vollständig unit-getestet. Kernprinzipien:
  - Geldbeträge NIE als float: skalierte BigInt (`money.ts`), kaufmännische Rundung.
  - `ubl.ts` erzeugt XRechnung-UBL mit strikter Schema-Elementreihenfolge (Sequenz!).
  - `rules.ts` = deutsche Fehlermeldungen zu EN-16931-/BR-DE-Regeln; zwei Eintrittspunkte:
    `validateInvoice` (eigene Rechnungen) und `validateParsed` (empfangene Dateien).
  - `parse.ts` parst tolerant UBL **und** CII (ZUGFeRD); `pdfExtract.ts` holt eingebettete
    XMLs aus PDFs (EmbeddedFiles-Namensbaum + AF-Array).
- `src/ui/` hält keinerlei Fachlogik; Hash-Router ohne Dependency (`ui/router.ts`).
- Lizenzsystem: ECDSA P-256, Format `ERS1.<payload>.<sig>`; öffentlicher Schlüssel wird aus
  `src/license-public.jwk.json` eingebaut, `src/license-key-meta.json.dev` steuert die
  Dev-Key-Warnung. **Keine privaten Schlüssel committen** (Ausnahme: keine – dev-keys
  enthält nur Öffentliches + Demo-Lizenz).

## Konventionen

- UI-Texte, Kommentare und Doku auf Deutsch (Zielmarkt); Code-Bezeichner Englisch.
- Neue Prüfregeln: immer mit Regel-ID, deutscher Meldung und Test in `tests/rules.test.ts`.
- Änderungen am UBL-Output brauchen einen Roundtrip-Test (bauen → parsen → `validateParsed`
  ohne Fehler) – siehe `tests/ubl.test.ts`.
- Vor Release: `docs/LAUNCH_CHECKLIST.md` befolgen (Schlüsselrotation!).

## Was bewusst NICHT im Repo ist

- `package-lock.json` (Versionen exakt in package.json gepinnt)
- Binärdateien/Screenshots (per `npm run screenshots` lokal erzeugbar)
- private Lizenzschlüssel (`tools/keygen/out/`, gitignored)
