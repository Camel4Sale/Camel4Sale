import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyLicenseKey } from "../src/core/license";

const subtle = globalThis.crypto.subtle;

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Unabhängige Referenz-Implementierung der Signierung (wie tools/keygen). */
async function sign(privateKey: CryptoKey, payload: object): Promise<string> {
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = new TextEncoder().encode(`ERS1.${payloadB64}`);
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
  return `ERS1.${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

async function freshPair() {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify"
  ]);
  const pubJwk = (await subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { pair, pubJwk };
}

describe("Lizenzprüfung", () => {
  it("akzeptiert korrekt signierte Schlüssel", async () => {
    const { pair, pubJwk } = await freshPair();
    const key = await sign(pair.privateKey, {
      v: 1,
      email: "kunde@example.de",
      plan: "pro",
      iat: "2026-08-11"
    });
    const info = await verifyLicenseKey(key, pubJwk);
    expect(info).not.toBeNull();
    expect(info!.email).toBe("kunde@example.de");
    expect(info!.plan).toBe("pro");
    expect(info!.issuedAt).toBe("2026-08-11");
  });

  it("toleriert umgebende Leerzeichen", async () => {
    const { pair, pubJwk } = await freshPair();
    const key = await sign(pair.privateKey, { v: 1, email: "a@b.de", plan: "pro" });
    expect(await verifyLicenseKey(`  ${key}\n`, pubJwk)).not.toBeNull();
  });

  it("lehnt manipulierte Payloads ab", async () => {
    const { pair, pubJwk } = await freshPair();
    const key = await sign(pair.privateKey, { v: 1, email: "a@b.de", plan: "pro" });
    const [prefix, , sig] = key.split(".");
    const forged = b64url(
      new TextEncoder().encode(JSON.stringify({ v: 1, email: "boese@example.de", plan: "pro" }))
    );
    expect(await verifyLicenseKey(`${prefix}.${forged}.${sig}`, pubJwk)).toBeNull();
  });

  it("lehnt Schlüssel von fremdem Schlüsselpaar ab", async () => {
    const { pair } = await freshPair();
    const { pubJwk: otherPub } = await freshPair();
    const key = await sign(pair.privateKey, { v: 1, email: "a@b.de", plan: "pro" });
    expect(await verifyLicenseKey(key, otherPub)).toBeNull();
  });

  it("lehnt Müll ab", async () => {
    const { pubJwk } = await freshPair();
    expect(await verifyLicenseKey("", pubJwk)).toBeNull();
    expect(await verifyLicenseKey("ERS1.nur-zwei-teile", pubJwk)).toBeNull();
    expect(await verifyLicenseKey("XXX1.a.b", pubJwk)).toBeNull();
    expect(await verifyLicenseKey("ERS1.!!.!!", pubJwk)).toBeNull();
  });

  it("Dev-Demo-Lizenz passt zum eingebauten öffentlichen Schlüssel", async () => {
    const root = join(__dirname, "..");
    const demoKey = readFileSync(join(root, "tools/keygen/dev-keys/demo-license.txt"), "utf8");
    const pubJwk = JSON.parse(readFileSync(join(root, "src/license-public.jwk.json"), "utf8"));
    const info = await verifyLicenseKey(demoKey, pubJwk);
    expect(info).not.toBeNull();
    expect(info!.email).toBe("demo@erechnung.studio");
  });
});
