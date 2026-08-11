#!/usr/bin/env node
/**
 * eRechnung Studio – Lizenzschlüssel-Werkzeug (Verkäuferseite).
 *
 * Erzeugt ECDSA-P-256-Schlüsselpaare und signiert Lizenzschlüssel im Format
 *   ERS1.<base64url(payload)>.<base64url(signatur)>
 *
 * Befehle:
 *   node tools/keygen/keygen.mjs init            Neues Schlüsselpaar → tools/keygen/out/ (nicht in Git!)
 *   node tools/keygen/keygen.mjs init --dev      Dev-Schlüsselpaar → tools/keygen/dev-keys/ (in Git, NUR für Entwicklung)
 *   node tools/keygen/keygen.mjs sign --email kunde@example.de [--plan pro]
 *   node tools/keygen/keygen.mjs verify --key ERS1....
 *
 * `init` aktualisiert zusätzlich src/license-public.jwk.json (der öffentliche
 * Schlüssel, der in die App eingebaut wird).
 *
 * WICHTIG VOR DEM LAUNCH:
 *   1. `npm run keygen -- init` ausführen (erzeugt out/private.jwk.json).
 *   2. Den privaten Schlüssel sicher verwahren (Passwort-Manager) – wer ihn hat,
 *      kann gültige Lizenzen ausstellen.
 *   3. Niemals tools/keygen/out/ committen (steht in .gitignore).
 *
 * Es liegen KEINE privaten Schlüssel im Repository. In dev-keys/ sind nur der
 * öffentliche Dev-Schlüssel und eine damit signierte Demo-Lizenz eingecheckt
 * (beides keine Geheimnisse) – sie werden von Unit-/E2E-Tests verwendet.
 */

import { webcrypto as crypto } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const OUT_DIR = join(HERE, "out");
const DEV_DIR = join(HERE, "dev-keys");
const PUBLIC_JWK_PATH = join(ROOT, "src", "license-public.jwk.json");
const KEY_META_PATH = join(ROOT, "src", "license-key-meta.json");

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function generateKeyPair() {
  return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify"
  ]);
}

async function cmdInit(args) {
  const dev = Boolean(args.dev);
  const dir = dev ? DEV_DIR : OUT_DIR;
  mkdirSync(dir, { recursive: true });
  const privPath = join(dir, "private.jwk.json");
  if (existsSync(privPath) && !args.force) {
    console.error(`Abbruch: ${privPath} existiert bereits. Mit --force überschreiben.`);
    process.exit(1);
  }
  const pair = await generateKeyPair();
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  writeFileSync(privPath, JSON.stringify(privJwk, null, 2) + "\n");
  writeFileSync(join(dir, "public.jwk.json"), JSON.stringify(pubJwk, null, 2) + "\n");
  writeFileSync(PUBLIC_JWK_PATH, JSON.stringify(pubJwk, null, 2) + "\n");
  writeFileSync(KEY_META_PATH, JSON.stringify({ dev }, null, 2) + "\n");
  console.log(`Schlüsselpaar erzeugt (${dev ? "DEV" : "PRODUKTION"}):`);
  console.log(`  privat:     ${privPath}`);
  console.log(`  öffentlich: ${PUBLIC_JWK_PATH} (in die App eingebaut)`);
  if (!dev) {
    console.log("\n⚠️  Den privaten Schlüssel SICHER verwahren und NIEMALS committen!");
    console.log("⚠️  Danach `npm run build` ausführen, damit der neue öffentliche");
    console.log("    Schlüssel in die App übernommen wird.");
  }
}

function loadPrivateKeyPath(args) {
  if (args.priv) return resolve(String(args.priv));
  const prod = join(OUT_DIR, "private.jwk.json");
  if (existsSync(prod)) return prod;
  const dev = join(DEV_DIR, "private.jwk.json");
  if (existsSync(dev)) {
    console.error("Hinweis: Es wird der DEV-Schlüssel verwendet (tools/keygen/dev-keys/).");
    return dev;
  }
  console.error("Kein privater Schlüssel gefunden. Zuerst `npm run keygen -- init` ausführen.");
  process.exit(1);
}

async function importPrivate(path) {
  const jwk = JSON.parse(readFileSync(path, "utf8"));
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign"
  ]);
}

export async function signLicense(privateKey, { email, plan = "pro", iat }) {
  const payload = { v: 1, email, plan, iat: iat ?? new Date().toISOString().slice(0, 10) };
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = new TextEncoder().encode(`ERS1.${payloadB64}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
  return `ERS1.${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

async function cmdSign(args) {
  const email = args.email;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    console.error("Bitte --email angeben, z. B.: npm run keygen -- sign --email kunde@example.de");
    process.exit(1);
  }
  const privPath = loadPrivateKeyPath(args);
  const key = await importPrivate(privPath);
  const license = await signLicense(key, { email, plan: String(args.plan ?? "pro") });
  console.log(license);
}

async function cmdVerify(args) {
  const keyStr = String(args.key ?? "");
  const pubPath = args.pub ? resolve(String(args.pub)) : PUBLIC_JWK_PATH;
  const jwk = JSON.parse(readFileSync(pubPath, "utf8"));
  const pub = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "verify"
  ]);
  const parts = keyStr.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ERS1") {
    console.error("Ungültiges Format (erwartet: ERS1.<payload>.<signatur>).");
    process.exit(1);
  }
  const data = new TextEncoder().encode(`ERS1.${parts[1]}`);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pub,
    Buffer.from(parts[2], "base64url"),
    data
  );
  if (!ok) {
    console.error("Signatur UNGÜLTIG.");
    process.exit(1);
  }
  console.log("Signatur gültig. Payload:");
  console.log(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

// Nur ausführen, wenn direkt aufgerufen (nicht bei Import in Tests/Skripten)
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (cmd === "init") await cmdInit(args);
  else if (cmd === "sign") await cmdSign(args);
  else if (cmd === "verify") await cmdVerify(args);
  else {
    console.log("Befehle: init [--dev] [--force] | sign --email … [--plan pro] | verify --key …");
    process.exit(cmd ? 1 : 0);
  }
}
