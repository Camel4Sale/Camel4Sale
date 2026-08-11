import { useEffect, useMemo, useState } from "react";
import type { Period, Property } from "../../core/model";
import {
  kvGet,
  kvSet,
  listCostItems,
  listCostTypes,
  listMeters,
  listPeriods,
  listProperties,
  listTenancies,
  listUnits
} from "../../core/db";
import { allocate, deadlineFinding, type AllocationInput, type AllocationResult } from "../../core/allocation";
import { buildStatementPdf, statementFileName } from "../../core/pdf";
import { formatCents } from "../../core/money";
import { formatDateDE, todayISO } from "../../core/dates";
import { verifyLicenseKey } from "../../core/license";
import { FREE_PDF_EXPORTS, LICENSE_PUBLIC_JWK, PURCHASE_URL } from "../../config";
import { ConfirmDialog, EmptyState, FindingsList, SectionCard, StatBox } from "../components";
import { downloadBlob } from "../download";
import { toast } from "../toast";

export function AbrechnungPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [input, setInput] = useState<AllocationInput | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [exportsUsed, setExportsUsed] = useState(0);
  const [limitDialog, setLimitDialog] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = (await listProperties())[0] ?? null;
      setProperty(p);
      const pers = (await listPeriods()).sort((a, b) => (a.start < b.start ? 1 : -1));
      setPeriods(pers);
      setPeriodId((prev) => prev || pers[0]?.id || "");
      const key = await kvGet<string>("license");
      if (key) setLicensed((await verifyLicenseKey(key, LICENSE_PUBLIC_JWK)) !== null);
      setExportsUsed((await kvGet<number>("pdfExports")) ?? 0);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!property || !periodId) {
        setInput(null);
        return;
      }
      const period = periods.find((p) => p.id === periodId);
      if (!period) return;
      setInput({
        property,
        units: (await listUnits()).filter((u) => u.propertyId === property.id),
        tenancies: await listTenancies(),
        period,
        costTypes: await listCostTypes(),
        costItems: await listCostItems(),
        meterReadings: await listMeters()
      });
    })();
  }, [property, periodId, periods]);

  const result: AllocationResult | null = useMemo(() => (input ? allocate(input) : null), [input]);
  const findings = useMemo(() => {
    if (!result || !input) return [];
    const extra = deadlineFinding(input.period, todayISO());
    return extra ? [...result.findings, extra] : result.findings;
  }, [result, input]);

  if (!property || periods.length === 0) {
    return (
      <SectionCard title="Abrechnung">
        <EmptyState
          title="Es fehlen noch Daten."
          text="Unter „Objekt & Mieter“ das Objekt anlegen, dann unter „Kosten & Zähler“ einen Zeitraum mit Kosten erfassen."
          action={<a className="btn-primary" href="#/">Loslegen</a>}
        />
      </SectionCard>
    );
  }

  const tenantResults = result?.segments.filter((s) => s.totalCents !== 0 || s.segment.tenancyId) ?? [];
  const errorCount = findings.filter((x) => x.severity === "error").length;

  async function exportPdf(index: number) {
    if (!input || !result) return;
    if (!licensed && exportsUsed >= FREE_PDF_EXPORTS) {
      setLimitDialog(true);
      return;
    }
    const r = result.segments[index];
    const bytes = await buildStatementPdf(input.property, input.period, r);
    downloadBlob(bytes as unknown as BlobPart, statementFileName(input.period, r), "application/pdf");
    if (!licensed) {
      const used = exportsUsed + 1;
      setExportsUsed(used);
      await kvSet("pdfExports", used);
    }
    toast("success", `Abrechnung für ${r.segment.tenantName} heruntergeladen.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Abrechnung</h1>
        <select className="select w-64" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({formatDateDE(p.start)} – {formatDateDE(p.end)})
            </option>
          ))}
        </select>
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Gesamtkosten" value={`${formatCents(result.totalCostCents)} €`} accent />
            <StatBox label="Zeitraum" value={`${result.periodDays} Tage`} />
            <StatBox label="Abrechnungen" value={String(tenantResults.filter((r) => r.segment.tenancyId).length)} />
            <StatBox
              label="Status"
              value={errorCount === 0 ? "bereit" : `${errorCount} Fehler`}
            />
          </div>

          <SectionCard title="Prüfung">
            <FindingsList findings={findings} emptyText="Keine Auffälligkeiten – die Abrechnung kann erstellt werden." />
          </SectionCard>

          <SectionCard title="Ergebnis je Partei">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className="th">Partei</th>
                    <th className="th">Einheit / Zeitraum</th>
                    <th className="th text-right">Kostenanteil</th>
                    <th className="th text-right">Vorauszahlungen</th>
                    <th className="th text-right">Saldo</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.segments.map((r, i) => (
                    <tr key={i} className={r.segment.tenancyId ? "" : "bg-slate-50/60"}>
                      <td className="td font-medium">{r.segment.tenantName}</td>
                      <td className="td text-xs text-slate-500">
                        {r.segment.unitLabel} · {formatDateDE(r.segment.start)} – {formatDateDE(r.segment.end)} ({r.segment.days} T.)
                      </td>
                      <td className="td text-right tabular-nums">{formatCents(r.totalCents)} €</td>
                      <td className="td text-right tabular-nums">
                        {r.segment.tenancyId ? `${formatCents(r.advanceCents)} €` : "–"}
                      </td>
                      <td className="td text-right tabular-nums">
                        {r.segment.tenancyId ? (
                          r.balanceCents >= 0 ? (
                            <span className="badge-green">Guthaben {formatCents(r.balanceCents)} €</span>
                          ) : (
                            <span className="badge-amber">Nachzahlung {formatCents(-r.balanceCents)} €</span>
                          )
                        ) : (
                          <span className="badge-gray">Vermieteranteil</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => void exportPdf(i)}>
                          ⬇ PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!licensed ? (
              <p className="mt-3 text-xs text-slate-500">
                Kostenlose Version: {Math.max(0, FREE_PDF_EXPORTS - exportsUsed)} von {FREE_PDF_EXPORTS} PDF-Exporten übrig – die
                Pro-Lizenz (Einmalkauf) hebt das Limit auf.
              </p>
            ) : null}
          </SectionCard>
        </>
      ) : (
        <p className="text-sm text-slate-500">Lade …</p>
      )}

      <ConfirmDialog
        open={limitDialog}
        title="Limit der kostenlosen Version erreicht"
        text={`Die kostenlose Version umfasst ${FREE_PDF_EXPORTS} Abrechnungs-PDFs. Mit der Pro-Lizenz (Einmalkauf, kein Abo) exportieren Sie unbegrenzt – alle erfassten Daten bleiben natürlich erhalten.`}
        confirmLabel="Pro-Lizenz ansehen"
        onCancel={() => setLimitDialog(false)}
        onConfirm={() => {
          setLimitDialog(false);
          window.open(PURCHASE_URL, "_blank", "noopener");
        }}
      />
    </div>
  );
}
