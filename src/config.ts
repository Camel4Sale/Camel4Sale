import publicJwk from "./license-public.jwk.json";
import licenseKeyMeta from "./license-key-meta.json";

export const APP_NAME = "eRechnung Studio";
export const APP_VERSION = "1.0.0";

/**
 * XRechnung 3.0 (Spezifikation 3.0.2, Bundle 2026-01-31). XRechnung 4.0 ist für
 * Ende 2026 angekündigt – bei Umstellung nur diese Konstante aktualisieren und
 * die Regeltexte prüfen.
 */
export const XRECHNUNG_CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
export const XRECHNUNG_PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

/** Anzahl finalisierter Rechnungen, die ohne Lizenz möglich sind. */
export const FREE_INVOICE_LIMIT = 3;

/** Öffentlicher Schlüssel für die Lizenzprüfung (per `npm run keygen -- init` erneuern). */
export const LICENSE_PUBLIC_JWK = publicJwk as JsonWebKey;

/**
 * true, solange der eingecheckte Entwicklungs-Schlüssel aktiv ist.
 * `npm run keygen -- init` (ohne --dev) setzt dies auf false – Pflicht vor dem
 * ersten Verkauf, siehe docs/LAUNCH_CHECKLIST.md. Die App zeigt sonst eine
 * deutliche Warnung in den Einstellungen.
 */
export const LICENSE_KEY_IS_DEV = (licenseKeyMeta as { dev: boolean }).dev;

/** Offizieller Web-Validator (KoSIT-basiert, Land Baden-Württemberg). */
export const OFFICIAL_VALIDATOR_URL = "https://erechnungsvalidator.service-bw.de";

/** Kauf-Link (nach Lemon-Squeezy-Einrichtung eintragen – siehe docs/LAUNCH_CHECKLIST.md). */
export const PURCHASE_URL = "https://erechnungstudio.lemonsqueezy.com/checkout";

export const SUPPORT_EMAIL = "support@erechnung-studio.example";
