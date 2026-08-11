/**
 * Offline-Lizenzprüfung.
 *
 * Lizenzschlüssel: ERS1.<base64url(JSON-Payload)>.<base64url(ECDSA-P256-Signatur)>
 * Signiert wird der String "ERS1.<payload-b64url>" (SHA-256).
 *
 * Bewusste Entscheidung: Die Prüfung läuft rein clientseitig. Das ist für
 * Einzelplatz-Software im Zielmarkt angemessen (siehe docs/BUSINESS_PLAN.md);
 * ein "perfekter" Kopierschutz ist ausdrücklich kein Ziel.
 */

export interface LicenseInfo {
  email: string;
  plan: string;
  issuedAt: string;
}

const PREFIX = "ERS1";

function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function verifyLicenseKey(
  key: string,
  publicJwk: JsonWebKey
): Promise<LicenseInfo | null> {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const payloadBytes = b64urlToBytes(parts[1]);
  const sigBytes = b64urlToBytes(parts[2]);
  if (!payloadBytes || !sigBytes) return null;
  try {
    const pub = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(`${PREFIX}.${parts[1]}`);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      sigBytes as BufferSource,
      data
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (payload?.v !== 1 || typeof payload.email !== "string" || typeof payload.plan !== "string") {
      return null;
    }
    return {
      email: payload.email,
      plan: payload.plan,
      issuedAt: typeof payload.iat === "string" ? payload.iat : ""
    };
  } catch {
    return null;
  }
}
