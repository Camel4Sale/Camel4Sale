import { useEffect, useState } from "react";
import {
  clearAllData,
  exportBackup,
  getCounters,
  importBackup,
  kvDelete,
  kvSet,
  previewNextInvoiceNumber,
  saveSeller,
  setCounter
} from "../../core/db";
import { verifyLicenseKey } from "../../core/license";
import { templateIsValid } from "../../core/numbering";
import { todayISO } from "../../core/dates";
import { useApp } from "../appstate";
import { ConfirmDialog, Field, SectionCard } from "../components";
import { downloadJson } from "../download";
import { toast } from "../toast";
import {
  APP_NAME,
  APP_VERSION,
  FREE_INVOICE_LIMIT,
  LICENSE_KEY_IS_DEV,
  LICENSE_PUBLIC_JWK,
  OFFICIAL_VALIDATOR_URL,
  PURCHASE_URL
} from "../../config";

function LicenseCard() {
  const app = useApp();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <SectionCard title="Lizenz">
      {LICENSE_KEY_IS_DEV ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <strong>Entwicklungs-Schlüssel aktiv.</strong> Vor dem Verkauf unbedingt{" "}
          <code className="rounded bg-amber-100 px-1">npm run keygen -- init</code> ausführen und neu
          bauen (siehe docs/LAUNCH_CHECKLIST.md) – sonst funktionieren Demo-Lizenzen bei allen Kunden.
        </div>
      ) : null}
      {app.licenseInfo ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
            ✓ <strong>Pro-Lizenz aktiv</strong> – registriert für {app.licenseInfo.email}
            {app.licenseInfo.issuedAt ? ` (ausgestellt ${app.licenseInfo.issuedAt})` : ""}. Vielen
            Dank für Ihre Unterstützung!
          </div>
          <button
            className="btn-secondary self-start"
            onClick={async () => {
              await kvDelete("license");
              await app.refresh();
              toast("info", "Lizenz entfernt.");
            }}
          >
            Lizenz von diesem Gerät entfernen
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            In der kostenlosen Version können Sie unbegrenzt Rechnungen <em>prüfen</em> und bis zu{" "}
            {FREE_INVOICE_LIMIT} Rechnungen finalisieren ({app.finalizedCount} bereits genutzt). Die
            Pro-Lizenz (Einmalkauf) hebt das Limit dauerhaft auf.
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={PURCHASE_URL} target="_blank" rel="noreferrer">
              Pro-Lizenz kaufen
            </a>
          </div>
          <Field label="Lizenzschlüssel einlösen" hint="Den Schlüssel erhalten Sie nach dem Kauf per E-Mail.">
            <div className="flex gap-2">
              <input
                className="input font-mono text-xs"
                placeholder="ERS1.…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <button
                className="btn-primary shrink-0"
                disabled={busy || !key.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const info = await verifyLicenseKey(key, LICENSE_PUBLIC_JWK);
                    if (!info) {
                      toast("error", "Der Lizenzschlüssel ist ungültig. Bitte vollständig kopieren und erneut versuchen.");
                      return;
                    }
                    await kvSet("license", key.trim());
                    await app.refresh();
                    setKey("");
                    toast("success", `Pro-Lizenz aktiviert (${info.email}).`);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Aktivieren
              </button>
            </div>
          </Field>
        </div>
      )}
    </SectionCard>
  );
}

function NumberingCard() {
  const app = useApp();
  const [template, setTemplate] = useState("{JJJJ}-{lfd4}");
  const [preview, setPreview] = useState("");
  const [counters, setCounters] = useState<Record<string, number>>({});
  const year = todayISO().slice(0, 4);

  useEffect(() => {
    if (app.seller) setTemplate(app.seller.numberTemplate);
  }, [app.seller]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (templateIsValid(template)) {
        const p = await previewNextInvoiceNumber(template, todayISO());
        if (active) setPreview(p);
      } else {
        setPreview("");
      }
      const c = await getCounters();
      if (active) setCounters(c);
    })();
    return () => {
      active = false;
    };
  }, [template, app.finalizedCount]);

  return (
    <SectionCard title="Rechnungsnummern">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nummernformat"
          hint="Platzhalter: {JJJJ} {JJ} {MM} {lfd} {lfd3} {lfd4} {lfd5} – der Zähler läuft pro Kalenderjahr lückenlos."
        >
          <input className="input font-mono" value={template} onChange={(e) => setTemplate(e.target.value)} />
        </Field>
        <Field label="Nächste Nummer (Vorschau)">
          <input className="input font-mono" value={preview || "– Format ungültig –"} readOnly />
        </Field>
        <Field label={`Zählerstand ${year}`} hint="Nur anpassen, wenn Sie aus einem anderen System umsteigen.">
          <input
            className="input"
            type="number"
            min={0}
            value={counters[year] ?? 0}
            onChange={async (e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              await setCounter(year, v);
              setCounters({ ...counters, [year]: v });
            }}
          />
        </Field>
      </div>
      <button
        className="btn-primary mt-4"
        disabled={!app.seller}
        onClick={async () => {
          if (!templateIsValid(template)) {
            toast("error", "Das Format braucht eine laufende Nummer, z. B. {lfd4}.");
            return;
          }
          if (app.seller) {
            await saveSeller({ ...app.seller, numberTemplate: template });
            await app.refresh();
            toast("success", "Nummernformat gespeichert.");
          }
        }}
      >
        Speichern
      </button>
      {!app.seller ? (
        <p className="mt-2 text-xs text-slate-500">Zuerst unter Stammdaten die Firmendaten anlegen.</p>
      ) : null}
    </SectionCard>
  );
}

function BackupCard() {
  const app = useApp();
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <SectionCard title="Datensicherung">
      <p className="text-sm text-slate-600">
        Alle Daten liegen ausschließlich in diesem Browser (IndexedDB). Sichern Sie regelmäßig per
        Backup – z. B. vor Browser- oder Rechnerwechsel. Aufbewahrungspflichten (GoBD): Rechnungen
        zusätzlich als XML/PDF exportieren und revisionssicher ablegen.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            const json = await exportBackup();
            downloadJson(json, `eRechnungStudio_Backup_${todayISO()}.json`);
            toast("success", "Backup heruntergeladen.");
          }}
        >
          Backup herunterladen
        </button>
        <label className="btn-secondary cursor-pointer">
          Backup importieren
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const result = await importBackup(await file.text());
                await app.refresh();
                toast(
                  "success",
                  `Backup importiert: ${result.invoices} Rechnungen, ${result.customers} Kunden, ${result.items} Artikel.`
                );
              } catch (err) {
                toast("error", err instanceof Error ? err.message : "Import fehlgeschlagen.");
              }
            }}
          />
        </label>
        <button className="btn-danger" onClick={() => setConfirmWipe(true)}>
          Alle Daten löschen
        </button>
      </div>
      <ConfirmDialog
        open={confirmWipe}
        title="Wirklich ALLE Daten löschen?"
        text="Firmendaten, Kunden, Artikel und sämtliche Rechnungen werden unwiderruflich aus diesem Browser entfernt. Erstellen Sie vorher ein Backup, falls Sie die Daten noch benötigen."
        confirmLabel="Ja, alles löschen"
        danger
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          await clearAllData();
          setConfirmWipe(false);
          await app.refresh();
          toast("success", "Alle lokalen Daten wurden gelöscht.");
        }}
      />
    </SectionCard>
  );
}

export function Settings() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-slate-800">Einstellungen</h1>
      <LicenseCard />
      <NumberingCard />
      <BackupCard />
      <SectionCard title="Über">
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
          <dt className="text-slate-500">Version</dt>
          <dd>
            {APP_NAME} {APP_VERSION}
          </dd>
          <dt className="text-slate-500">Standard</dt>
          <dd>XRechnung 3.0 (EN 16931), Anzeige von UBL &amp; CII/ZUGFeRD</dd>
          <dt className="text-slate-500">Datenschutz</dt>
          <dd>Alle Daten bleiben lokal in Ihrem Browser. Keine Server, kein Tracking.</dd>
          <dt className="text-slate-500">Offizieller Validator</dt>
          <dd>
            <a className="text-teal-700 underline" href={OFFICIAL_VALIDATOR_URL} target="_blank" rel="noreferrer">
              {OFFICIAL_VALIDATOR_URL}
            </a>
          </dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Hinweis: {APP_NAME} unterstützt bei der formal korrekten Rechnungsstellung, ersetzt aber
          keine Steuer- oder Rechtsberatung.
        </p>
      </SectionCard>
    </div>
  );
}
