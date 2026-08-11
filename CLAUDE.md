# CLAUDE.md

Hinweise für die Arbeit mit Claude Code in diesem Repository.

## Was dieses Repository ist

**Nebenkosten Studio** – kommerzielle, rein clientseitige Web-App (React + TypeScript + Vite +
Tailwind v4) zum Erstellen von Betriebskostenabrechnungen (§ 556 BGB, § 2 BetrKV,
HeizkostenV) für private Vermieter in Deutschland. Keine Server, alle Daten in IndexedDB.

## Befehle

```bash
npm install            # Abhängigkeiten (exakt gepinnt, keine Lockfile im Repo)
npm run dev            # Vite-Devserver
npm run typecheck      # tsc --noEmit (strict)
npm test               # Vitest (tests/**, Node-Umgebung, fake-indexeddb)
npm run build          # Typecheck + Produktions-Build
npm run e2e            # Playwright (startet vite preview auf :4173)
npm run keygen -- …    # Lizenzschlüssel-CLI (init/sign/verify)
```

In Umgebungen mit vorinstalliertem Chromium: `CHROMIUM_PATH=/pfad/zu/chrome npm run e2e`.

## Architektur

- `src/core/` ist **UI-frei** und vollständig unit-getestet. Kernprinzipien:
  - Geldbeträge NIE als float: skalierte BigInt (`money.ts`), kaufmännische Rundung.
  - `allocation.ts` ist die einzige Abrechnungs-Engine: baut aus Mietverhältnissen
    tagesgenaue Segmente (inkl. Leerstands-Segmente, die der Vermieter trägt), verteilt
    jede Kostenart nach ihrem Umlageschlüssel (Fläche/Personen/Einheiten/Verbrauch/direkt)
    und splittet Heizkosten nach HeizkostenV in Verbrauchs- und Grundkostenanteil.
  - Centverteilung immer über `distributeByWeights` (Größte-Reste-Verfahren):
    Invariante `Summe der Anteile == Gesamtbetrag` gilt für jede Kostenzeile.
  - Prüf-Findings (`NK-…`) mit deutschen Meldungen entstehen in der Engine, nie in der UI.
- `src/ui/` hält keinerlei Fachlogik; Navigation über `location.hash`.
- Lizenzsystem: ECDSA P-256, Format `NKS1.<payload>.<sig>`; öffentlicher Schlüssel wird aus
  `src/license-public.jwk.json` eingebaut, `src/license-key-meta.json` steuert die
  Dev-Key-Warnung. **Keine privaten Schlüssel committen** (`tools/keygen/dev-keys/` enthält
  nur Öffentliches + Demo-Lizenz).

## Konventionen

- UI-Texte, Kommentare und Doku auf Deutsch (Zielmarkt); Code-Bezeichner Englisch.
- Änderungen an der Engine: immer mit Test in `tests/allocation.test.ts`; bei
  Centverteilungen die Summen-Invariante explizit testen.
- Neue Prüf-Findings: Regel-ID (`NK-…`), deutsche Meldung, Test.
- Vor Release: `docs/LAUNCH_CHECKLIST.md` befolgen (Schlüsselrotation!).

## Was bewusst NICHT im Repo ist

- `package-lock.json` (Versionen exakt in package.json gepinnt)
- Binärdateien/Screenshots
- private Lizenzschlüssel (`tools/keygen/out/`, `tools/keygen/dev-keys/private.jwk.json`)
