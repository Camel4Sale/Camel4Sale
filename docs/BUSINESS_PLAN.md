# Businessplan – eRechnung Studio

_Stand: August 2026. Zahlen aus Web-Recherche 08/2026 (Quellen: BMF-FAQ, xeinkauf.de/KoSIT,
Anbieter-Preisseiten)._

## 1. Das Marktfenster (warum JETZT)

| Datum | Pflicht |
|---|---|
| seit 01.01.2025 | **Alle** dt. Unternehmen müssen E-Rechnungen **empfangen** können (auch Kleinunternehmer, auch Vermieter mit USt-Option) |
| ab 01.01.2027 | **Ausstellungspflicht** B2B für Unternehmen mit Vorjahresumsatz > 800.000 € |
| ab 01.01.2028 | Ausstellungspflicht für **alle** (Ausnahmen: Kleinbetragsrechnungen ≤ 250 €, Fahrausweise; Kleinunternehmer dürfen weiter „sonstige Rechnungen“ stellen) |

August 2026 = **4,5 Monate vor der ersten Ausstellungspflicht**. Millionen Selbstständige,
Freiberufler und Kleinbetriebe müssen sich JETZT entscheiden, womit sie Rechnungen schreiben.
Zusätzlich: Das 2. BMF-Schreiben (15.10.2025) empfiehlt technische Validierung empfangener
E-Rechnungen inkl. archiviertem Prüfbericht – genau unser Prüfmodus.

## 2. Zielgruppen (in Reihenfolge der Kaufwahrscheinlichkeit)

1. **Freiberufler/Solo-Selbstständige mit B2G-Kunden** (Behörden verlangen XRechnung schon heute; Leitweg-ID-Support ist Kaufgrund Nr. 1)
2. **Selbstständige mit wenigen Rechnungen/Monat**, die kein 13–33 €/Monat-Abo wollen (sevdesk, Lexware Office & Co.)
3. **Datenschutz-Sensible** (Anwälte, Therapeuten, Berater): „Rechnungsdaten verlassen nie den Rechner“ ist ein einzigartiges Argument
4. **Empfangsseite**: Buchhaltungen/Vereine, die eingehende E-Rechnungen nur prüfen/lesen wollen (kostenloser Einstieg → Upsell)

## 3. Wettbewerb & Positionierung

| Anbieter | Modell | Preis |
|---|---|---|
| sevdesk | Abo | ab 12,90 €/Monat (Free: 3 Rechnungen/Monat) |
| Lexware Office | Abo | 7,90–32,90 €/Monat (XRechnung erst in höheren Tarifen) |
| easybill | Abo | ab ~12–17 €/Monat (Free: 3 Belege/Monat) |
| kostenlose-erechnung.de | Freemium-Web | Premium ab 9,90 €/Monat |
| Fakturama | Open Source Desktop | kostenlos, aber altbacken/komplex |
| **eRechnung Studio** | **Einmalkauf** | **49 € einmalig** (Einführungspreis) |

**USP-Dreiklang:**
1. _Einmal zahlen statt Abo_ (Abo-Müdigkeit ist real; 49 € amortisiert sich in < 4 Monaten vs. sevdesk)
2. _100 % lokal / DSGVO-Traumstory_ (kein AVV nötig, keine Cloud, kein Tracking)
3. _Deutsch & fokussiert_ (verständliche Fehlermeldungen zu BR-DE-Regeln statt Schematron-Kauderwelsch)

## 4. Preis & Angebot

- **Free**: unbegrenzt Rechnungen prüfen/ansehen + 3 Rechnungen erstellen (Produkt beweist sich selbst)
- **Pro – 49 € einmalig** (Einführungspreis, regulär 79 € ab v1.1): unbegrenzte Rechnungen, alle 1.x-Updates inklusive
- Später: **Team-Lizenz 99 €** (3 Geräte), **v2-Upgrade** kostenpflichtig (ZUGFeRD-Export, Peppol)
- Verkauf über **Lemon Squeezy** (Merchant of Record → übernimmt EU-USt/OSS komplett; 5 % + 0,50 $ Gebühr). Alternative: Polar.sh (5 % + 0,40 $). Gumroad ist teurer (10 % + Kartengebühren).

**Deckungsbeitrag je Verkauf (49 €):** ≈ 44 € nach LS-Gebühr. Keine variablen Kosten (statisches Hosting ≈ 0 €).

## 5. Umsatzpfad (konservativ)

| Szenario | Verkäufe/Monat | Umsatz/Monat |
|---|---|---|
| Start (Monat 1–2, organisch LinkedIn + Foren) | 5–10 | 245–490 € |
| SEO greift (Monat 3–6, „xrechnung erstellen kostenlos“-Funnel) | 20–40 | 980–1.960 € |
| Deadline-Panik Q4/2027 | 50–150 | 2.450–7.350 € |

Hebel: Der **kostenlose Prüfmodus** ist das SEO-Zugpferd („e-rechnung prüfen“, „zugferd öffnen“,
„xrechnung lesen“ – hohes Suchvolumen, kaum gute kostenlose lokale Tools).

## 6. Risiken & Antworten

- **„Kostenlos-Konkurrenz“**: Web-Generatoren senden Daten an Server → unser Datenschutz-USP; Fakturama ist zu komplex für die Zielgruppe.
- **Kopierbarkeit der Lizenz** (clientseitige Prüfung): bewusst akzeptiert – Zielgruppe zahlt für Bequemlichkeit + Updates + gutes Gewissen; kein DRM-Wettrüsten.
- **Standard-Wechsel XRechnung 4.0 (Ende 2026)**: CustomizationID zentral konfiguriert; Update = kostenloses 1.x-Release = Marketing-Anlass.
- **Browserdaten-Verlust**: Backup-Funktion + deutliche Hinweise; Roadmap: Datei-basierte Speicherung (File System Access API).
- **Rechtsrisiko Namensgebung**: „eRechnung Studio“ ist beschreibend; vor Launch Markenrecherche (DPMA) – siehe Launch-Checkliste.

## 7. Warum dieses Produkt zu dir passt

- Kein Server-Betrieb, kein Support-Notdienst: statische Website + E-Mail-Support.
- LinkedIn-Präsenz vorhanden → Content-Marketing zur E-Rechnungspflicht funktioniert organisch (Entwürfe in docs/MARKETING.md).
- Einmalkauf-Modell = kein Churn-Management, keine Abo-Verwaltung.
