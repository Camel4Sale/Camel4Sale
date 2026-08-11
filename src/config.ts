import publicJwk from "./license-public.jwk.json";
import licenseKeyMeta from "./license-key-meta.json";

export const APP_NAME = "Nebenkosten Studio";
export const APP_VERSION = "1.0.0";

/** Anzahl kostenloser Abrechnungs-PDF-Exporte ohne Lizenz. */
export const FREE_PDF_EXPORTS = 3;

export const LICENSE_PUBLIC_JWK = publicJwk as JsonWebKey;
export const LICENSE_KEY_IS_DEV = (licenseKeyMeta as { dev: boolean }).dev;

/** Kauf-Link (nach Lemon-Squeezy-Einrichtung eintragen – siehe docs/LAUNCH_CHECKLIST.md). */
export const PURCHASE_URL = "https://nebenkostenstudio.lemonsqueezy.com/checkout";

export const SUPPORT_EMAIL = "support@nebenkosten-studio.example";
