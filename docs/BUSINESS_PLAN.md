# Businessplan – Nebenkosten Studio (Kompakt)

Stand: August 2026. Ausführliches Vermarktungs-Playbook: siehe eRechnung Studio
(`docs/BUSINESS_PLAN.md`, `docs/MARKETING.md` dort) – Kanäle und Vorgehen sind übertragbar.

## Problem

Private Vermieter (in Deutschland mehrere Millionen, überwiegend 1–5 Einheiten) müssen
jährlich eine Betriebskostenabrechnung erstellen. Die Anforderungen sind hoch:
tagesgenaue Umlage bei Mieterwechsel, HeizkostenV-Split, 12-Monats-Frist nach
§ 556 Abs. 3 BGB (danach sind Nachforderungen ausgeschlossen). Excel ist fehleranfällig,
Hausverwaltungen lohnen sich bei kleinen Objekten nicht, viele Web-Tools sind Abos mit
Kontozwang und Cloud-Speicherung sensibler Mieterdaten.

## Lösung & Positionierung

Ein-Zweck-Werkzeug ohne Konto, ohne Cloud, ohne Abo: Daten lokal im Browser, fertige
PDF-Abrechnung je Mietpartei, eingebaute Prüfungen (§ 556, HeizkostenV, Plausibilität).
Positionierung: „Die Abrechnung, die der Mieter akzeptiert – in einer Stunde, nicht an
einem Wochenende.“

## Monetarisierung

- **Free**: unbegrenzt erfassen und rechnen, 3 PDF-Exporte (`FREE_PDF_EXPORTS`).
- **Pro**: Einmalkauf **49 €** (brutto), unbegrenzte PDF-Exporte, Lizenzschlüssel per
  E-Mail (Offline-Prüfung, ECDSA P-256). Kein Abo → geringe Support-Erwartung, passt zum
  jährlichen Nutzungsrhythmus.
- Verkauf über Zahlungsanbieter mit Merchant-of-Record (z. B. Lemon Squeezy/Paddle),
  damit USt./Rechnungen abgedeckt sind; `PURCHASE_URL` in `src/config.ts` setzen.

## Saisonalität (relevant für den Start im August)

Abrechnungen für das Kalenderjahr N sind bis 31.12. des Folgejahres fällig; die meisten
privaten Vermieter rechnen zwischen Q1 und Q4 des Folgejahres ab – es gibt ganzjährig
Nachfrage mit Spitzen zum Jahresende (Fristdruck § 556). Zusätzlich: Mieterwechsel im
Sommer/Herbst erzeugen unterjährige Abrechnungen.

## Kanäle (Priorität)

1. SEO/Content: „Nebenkostenabrechnung Vorlage/Frist/Mieterwechsel/HeizkostenV“ –
   Suchvolumen hoch, Landingpage mit Rechner-Demo.
2. Vermieter-Foren und -Communities, Haus-und-Grund-Umfeld, YouTube-Erklärvideos.
3. Cross-Selling zu eRechnung Studio (gleiche Käuferschicht: Selbstständige mit Immobilien).

## Kosten & Risiken

Fixkosten nahe null (statisches Hosting + Domain + Zahlungsanbieter-Gebühr).
Hauptrisiken: Rechtsänderungen (BetrKV/HeizkostenV beobachten), Abgrenzung zur
Rechtsberatung (Disclaimer in App und AGB – das Tool erstellt formal, berät nicht),
Wettbewerb durch Abo-Portale (Gegenposition: einmal zahlen, Daten lokal).
