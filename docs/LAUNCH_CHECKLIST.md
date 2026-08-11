# Launch-Checkliste – vom Repo zum ersten Verkauf

Geschätzter Aufwand: **1 Arbeitstag** (ohne Wartezeiten). Reihenfolge einhalten.

## Phase 0 – Pflicht vor allem anderen (30 min)

- [ ] **Lizenz-Schlüssel rotieren**: `npm run keygen -- init` (erzeugt `tools/keygen/out/private.jwk.json`).
      Privaten Schlüssel in den Passwort-Manager legen. Danach `npm run build` – die
      Dev-Key-Warnung in den Einstellungen muss verschwunden sein.
- [ ] `src/config.ts` ausfüllen: `PURCHASE_URL` (kommt aus Phase 2), `SUPPORT_EMAIL` (echte Adresse).
- [ ] `npm test && npm run e2e && npm run build` – alles grün?
- [ ] Eigene Test-Rechnung erstellen und beim offiziellen Validator hochladen:
      https://erechnungsvalidator.service-bw.de → Ergebnis dokumentieren.

## Phase 1 – Hosting (30 min)

- [ ] Domain registrieren (z. B. erechnung-studio.de; vorher DPMA-Kurzrecherche
      https://register.dpma.de wegen Markenkollision).
- [ ] `dist/` deployen: Cloudflare Pages oder Netlify (Free-Tier reicht; Build-Command
      `npm run build`, Output `dist`). App unter app.… oder /app, Landingpage (docs/landing/) auf der Hauptdomain.
- [ ] HTTPS prüfen, PWA-Installation testen (Chrome: „App installieren“).

## Phase 2 – Lemon Squeezy einrichten (60 min)

1. [ ] Account auf lemonsqueezy.com → Store anlegen (Währung EUR). Identitäts-/Auszahlungsdaten
       ausfüllen (Auszahlung via Stripe/PayPal-Alternativen gemäß LS-Onboarding).
2. [ ] Produkt „eRechnung Studio Pro“ anlegen: Typ _Digital product / Single payment_, **49 €**
       (Steuer-Einstellung: LS ist Merchant of Record und führt USt/OSS selbst ab – du stellst
       deine Rechnung an LS, nicht an Endkunden).
3. [ ] **Lizenz-Zustellung**: Für jeden Verkauf einen Schlüssel ausliefern. Einfachster Start
       (manuell, bis ~10 Verkäufe/Tag): Bestell-Benachrichtigung per Mail →
       `npm run keygen -- sign --email kunde@example.de` → Schlüssel per Antwort-Mail.
       Automatisierung (später): kleiner Webhook-Worker (Cloudflare Worker), der bei
       `order_created` signiert und per LS-API als _License/Custom data_ zurücksendet –
       Roadmap v1.1.
4. [ ] Checkout-Link in `src/config.ts` → `PURCHASE_URL` eintragen, neu bauen, deployen.
5. [ ] **Testkauf** im LS-Testmodus durchspielen: Kauf → Schlüssel erhalten → in App aktivieren.

## Phase 3 – Rechtliches (60 min, docs/RECHTLICHES.md lesen)

- [ ] Impressum + Datenschutzerklärung auf die Landingpage (Vorlagen/Hinweise in RECHTLICHES.md;
      Datenschutz ist hier trivial: keine Datenverarbeitung durch die App, nur Hosting-Logs + LS als MoR).
- [ ] `docs/EULA.md` durchlesen, Namen/Adresse eintragen, idealerweise 30 min anwaltlich prüfen lassen.
- [ ] Gewerbe: Verkauf ist gewerblich → Gewerbeanmeldung (falls noch nicht vorhanden) und
      steuerliche Erfassung klären (Steuerberater; Kleinunternehmerregelung möglich).
- [ ] Widerruf: Bei LS-Checkout Haken für digitale Inhalte (Verzicht auf Widerruf bei sofortiger
      Bereitstellung) aktivieren.

## Phase 4 – Launch (halber Tag)

- [ ] `npm run screenshots` → Bilder auf Landingpage/LinkedIn verwenden.
- [ ] 3 LinkedIn-Posts aus docs/MARKETING.md veröffentlichen (Tag 1, 3, 7).
- [ ] In 3–5 Communities vorstellen (r/selbststaendig, r/Finanzen-DE-Wiki-Threads,
      Xing-/LinkedIn-Gruppen „Selbstständige“, wer-liefert-was-Foren, IHK-Newsletter anfragen).
- [ ] Produkt bei Verzeichnissen eintragen: alternativeto.net, OMR Reviews (kostenlos), Google
      Business Profile.
- [ ] SEO-Basics: Landingpage-Title „XRechnung erstellen & prüfen – ohne Abo, 100 % lokal“,
      eine Unterseite „E-Rechnung prüfen (kostenlos)“ als Funnel.

## Phase 5 – Betrieb (laufend, < 2 h/Woche)

- [ ] Support-Postfach täglich checken (Antwortzeit < 24 h als Verkaufsargument).
- [ ] Wöchentlich: Verkäufe/Traffic notieren, 1 Content-Piece (LinkedIn/Blog).
- [ ] Bei KoSIT-Updates (XRechnung 4.0 Ende 2026): CustomizationID/Regeln aktualisieren →
      kostenloses Update + Newsletter/Post „Schon bereit für XRechnung 4.0“.
- [ ] Monatlich: Backup-Erinnerung an Kunden? Nein – in-App gelöst. Stattdessen: Changelog pflegen.

## Kill-Kriterien (ehrlich bleiben)

Nach 90 Tagen < 10 Verkäufe trotz 12+ Posts und Foren-Präsenz → Preis testen (29 €),
Zielgruppe schärfen (nur B2G-Freelancer) oder als Lead-Magnet für Beratungsleistungen nutzen.
