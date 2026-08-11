import { useEffect, useState } from "react";
import { clearAllData, exportBackup, importBackup, kvDelete, kvGet, kvSet } from "../../core/db";
import { verifyLicenseKey, type LicenseInfo } from "../../core/license";
import { todayISO } from "../../core/dates";
import {
  APP_NAME,
  APP_VERSION,
  FREE_PDF_EXPORTS,
  LICENSE_KEY_IS_DEV,
  LICENSE_PUBLIC_JWK,
  PURCHASE_URL
} from "../../config";
import { ConfirmDialog, Field, SectionCard } from "../components";
import { downloadJson } from "../download";
import { toast } from "../toast";

export function SettingsPage() {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [key, setKey] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);

  const reload = async () => {
    const stored = await kvGet<string>("license");
    setLicenseInfo(stored ? await verifyLicenseKey(stored, LICENSE_PUBLIC_JWK) : null);
  };
  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-slate-800">Einstellungen</h1>

      <SectionCard title="Lizenz">
        {LICENSE_KEY_IS_DEV ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <strong>Entwicklungs-Schlüssel aktiv.</strong> Vor dem Verkauf{" "}
            <code className="rounded bg-amber-100 px-1">npm run keygen -- init</code> ausführen und neu bauen
            (siehe docs/LAUNCH_CHECKLIST.md).
          </div>
        ) : null}
        {licenseInfo ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
              ✓ <strong>Pro-Lizenz aktiv</strong> – registriert für {licenseInfo.email}. Vielen Dank!
            </div>
            <button
              className="btn-secondary self-start"
              onClick={async () => {
                await kvDelete("license");
                await reload();
                toast("info", "Lizenz entfernt.");
              }}
            >
              Lizenz von diesem Gerät entfernen
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Kostenlos: Daten unbegrenzt erfassen + {FREE_PDF_EXPORTS} Abrechnungs-PDFs. Die Pro-Lizenz
              (Einmalkauf, kein Abo) schaltet unbegrenzte PDF-Exporte frei.
            </p>
            <a className="btn-primary self-start" href={PURCHASE_URL} target="_blank" rel="noreferrer">
              Pro-Lizenz kaufen
            </a>
            <Field label="Lizenzschlüssel einlösen">
              <div className="flex gap-2">
                <input className="input font-mono text-xs" placeholder="NKS1.…" value={key} onChange={(e) => setKey(e.target.value)} />
                <button
                  className="btn-primary shrink-0"
                  disabled={!key.trim()}
                  onClick={async () => {
                    const info = await verifyLicenseKey(key, LICENSE_PUBLIC_JWK);
                    if (!info) {
                      toast("error", "Der Lizenzschlüssel ist ungültig.");
                      return;
                    }
                    await kvSet("license", key.trim());
                    setKey("");
                    await reload();
                    toast("success", `Pro-Lizenz aktiviert (${info.email}).`);
                  }}
                >
                  Aktivieren
                </button>
              </div>
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Datensicherung">
        <p className="text-sm text-slate-600">
          Alle Daten liegen ausschließlich in diesem Browser. Vor Rechnerwechsel oder Browser-Bereinigung
          unbedingt ein Backup ziehen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={async () => {
              downloadJson(await exportBackup(), `NebenkostenStudio_Backup_${todayISO()}.json`);
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
                  const count = await importBackup(await file.text());
                  toast("success", `Backup importiert (${count} Datensätze).`);
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
      </SectionCard>

      <SectionCard title="Über">
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
          <dt className="text-slate-500">Version</dt>
          <dd>
            {APP_NAME} {APP_VERSION}
          </dd>
          <dt className="text-slate-500">Methodik</dt>
          <dd>Tagesgenaue Verteilung; Heiz-/Warmwasserkosten nach HeizkostenV (Verbrauchs-/Grundkostenanteil); § 556-BGB-Fristprüfung</dd>
          <dt className="text-slate-500">Datenschutz</dt>
          <dd>Alle Daten bleiben lokal in Ihrem Browser. Keine Server, kein Tracking.</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Hinweis: {APP_NAME} unterstützt bei der formalen Erstellung der Abrechnung und ersetzt keine
          Rechtsberatung (z. B. bei Streit über Umlagefähigkeit einzelner Kosten).
        </p>
      </SectionCard>

      <ConfirmDialog
        open={confirmWipe}
        title="Wirklich ALLE Daten löschen?"
        text="Objekt, Mieter, Kosten und Zählerstände werden unwiderruflich aus diesem Browser entfernt. Vorher ggf. ein Backup erstellen."
        confirmLabel="Ja, alles löschen"
        danger
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          await clearAllData();
          setConfirmWipe(false);
          toast("success", "Alle lokalen Daten wurden gelöscht.");
        }}
      />
    </div>
  );
}
