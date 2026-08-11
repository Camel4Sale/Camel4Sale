# Launch-Checkliste – Nebenkosten Studio

Kompakt; das ausführliche Vorgehen (Domain, Impressum/Datenschutz, Zahlungsanbieter
einrichten, Testkauf) steht im Launch-Playbook von eRechnung Studio und gilt hier analog.

## Vor dem ersten Verkauf (Pflicht)

1. **Schlüsselrotation** – der committete Schlüssel ist ein Entwicklungs-Schlüssel:
   ```bash
   npm run keygen -- init          # neues Schlüsselpaar in tools/keygen/out/ (gitignored)
   # public.jwk.json nach src/license-public.jwk.json kopieren
   # src/license-key-meta.json auf {"dev": false} setzen
   npm run build                   # Dev-Key-Warnung verschwindet
   ```
   Privaten Schlüssel (`tools/keygen/out/private.jwk.json`) sicher ablegen (Passwort-Manager
   + Offline-Backup). **Niemals committen.**
2. **Testlizenz** ausstellen und in der App aktivieren:
   `npm run keygen -- sign --email kaeufer@example.org` → Schlüssel `NKS1.…` einlösen.
3. `PURCHASE_URL` in `src/config.ts` auf die echte Bezahlseite setzen.
4. Zahlungsanbieter (Merchant of Record, z. B. Lemon Squeezy/Paddle): Produkt „Pro-Lizenz
   49 €“, Webhook/Zapier → Keygen `sign` → Lizenzmail. Testkauf durchführen.
5. Impressum + Datenschutzerklärung auf der Landingpage (App selbst speichert nur lokal).
6. `npm run build` + `npm test` + `npm run e2e` grün; `dist/` auf statisches Hosting.

## Nach dem Launch

- Preis-/Conversion-Test (39/49/59 €), FAQ aus Support-Mails pflegen.
- Rechtsstand beobachten (BetrKV, HeizkostenV, § 556 BGB) und `CHANGELOG.md` führen.
- Backups der Verkaufs-/Lizenzliste (E-Mail + ausgestellter Schlüssel) außerhalb des Repos.
