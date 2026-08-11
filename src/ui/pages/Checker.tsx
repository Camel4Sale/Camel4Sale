import { useRef, useState, type DragEvent } from "react";
import { extractEmbeddedXml, looksLikePdf } from "../../core/pdfExtract";
import { isParseFailure, parseInvoiceXml, type ParsedInvoice } from "../../core/parse";
import { validateParsed, countBySeverity, type Finding } from "../../core/rules";
import { formatCents } from "../../core/money";
import { formatDateDE } from "../../core/dates";
import { FindingsList, SectionCard } from "../components";
import { downloadJson } from "../download";
import { APP_VERSION, OFFICIAL_VALIDATOR_URL } from "../../config";
import { toast } from "../toast";

interface CheckResult {
  fileName: string;
  sourceNote?: string;
  parsed: ParsedInvoice;
  findings: Finding[];
}

function fmtOpt(cents: number | undefined): string {
  return cents === undefined ? "–" : `${formatCents(cents)} €`;
}

export function Checker() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let xml: string;
      let sourceNote: string | undefined;
      if (looksLikePdf(bytes)) {
        const embedded = await extractEmbeddedXml(bytes);
        if (!embedded) {
          setError(
            "In diesem PDF ist keine E-Rechnung eingebettet. Ein reines Bild-/Text-PDF ist keine E-Rechnung im Sinne des Gesetzes – fordern Sie ggf. eine XRechnung oder ZUGFeRD-Datei an."
          );
          return;
        }
        xml = embedded.xml;
        sourceNote = `Eingebettetes XML „${embedded.fileName}“ aus dem PDF extrahiert (ZUGFeRD/Factur-X).`;
      } else {
        xml = new TextDecoder("utf-8").decode(bytes);
      }
      const parsed = parseInvoiceXml(xml);
      if (isParseFailure(parsed)) {
        setError(parsed.error);
        return;
      }
      setResult({ fileName: file.name, sourceNote, parsed, findings: validateParsed(parsed) });
    } catch (e) {
      setError(`Die Datei konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function downloadReport() {
    if (!result) return;
    const counts = countBySeverity(result.findings);
    const report = {
      tool: `eRechnung Studio ${APP_VERSION} (lokale Vorprüfung)`,
      checkedAt: new Date().toISOString(),
      file: result.fileName,
      profile: result.parsed.customizationId ?? null,
      syntax: result.parsed.syntax,
      invoiceNumber: result.parsed.number ?? null,
      sellerName: result.parsed.seller.name ?? null,
      summary: counts,
      verdict: counts.error === 0 ? "OHNE_BEFUND" : "FEHLER_GEFUNDEN",
      note: "Diese Prüfung ist eine lokale Vorprüfung (Teilmenge der EN-16931-/BR-DE-Regeln). Für die verbindliche Konformitätsprüfung den KoSIT-Referenzvalidator verwenden.",
      findings: result.findings
    };
    downloadJson(
      JSON.stringify(report, null, 2),
      `Pruefbericht_${(result.parsed.number ?? result.fileName).replace(/[^A-Za-z0-9_-]+/g, "-")}.json`
    );
    toast("success", "Prüfbericht heruntergeladen (JSON).");
  }

  const p = result?.parsed;
  const counts = result ? countBySeverity(result.findings) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Rechnung prüfen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Empfangene E-Rechnung ansehen und validieren – XRechnung (XML), ZUGFeRD/Factur-X (PDF)
          oder jede EN-16931-Rechnung. Die Datei bleibt auf Ihrem Gerät.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Datei zum Prüfen auswählen"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-white hover:border-teal-400"
        }`}
      >
        <span className="text-3xl" aria-hidden>
          📄
        </span>
        <p className="text-sm font-medium text-slate-700">
          XML- oder PDF-Datei hierher ziehen – oder klicken zum Auswählen
        </p>
        <p className="text-xs text-slate-500">.xml (XRechnung/UBL/CII) · .pdf (ZUGFeRD/Factur-X)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.pdf,application/xml,text/xml,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {result && p && counts ? (
        <>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              counts.error === 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            <strong>
              {counts.error === 0
                ? "✓ Keine Fehler in der lokalen Vorprüfung."
                : `✗ ${counts.error} Fehler gefunden.`}
            </strong>{" "}
            {counts.warning > 0 ? `${counts.warning} Hinweis(e). ` : ""}
            Datei: {result.fileName}
            {result.sourceNote ? <span className="block text-xs opacity-80">{result.sourceNote}</span> : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Rechnungsdaten">
              <dl className="grid grid-cols-[9.5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-slate-500">Rechnungsnummer</dt>
                <dd className="font-medium">{p.number ?? "–"}</dd>
                <dt className="text-slate-500">Typ / Syntax</dt>
                <dd>
                  {p.typeCode ?? "–"} · {p.syntax === "cii" ? "CII (ZUGFeRD)" : "UBL"}
                </dd>
                <dt className="text-slate-500">Rechnungsdatum</dt>
                <dd>{formatDateDE(p.issueDate) || "–"}</dd>
                <dt className="text-slate-500">Fällig am</dt>
                <dd>{formatDateDE(p.dueDate) || "–"}</dd>
                <dt className="text-slate-500">Verkäufer</dt>
                <dd>
                  {p.seller.name ?? "–"}
                  {p.seller.vatId ? <span className="block text-xs text-slate-500">USt-IdNr. {p.seller.vatId}</span> : null}
                </dd>
                <dt className="text-slate-500">Käufer</dt>
                <dd>{p.buyer.name ?? "–"}</dd>
                <dt className="text-slate-500">Käuferreferenz</dt>
                <dd>{p.buyerReference ?? "–"}</dd>
                <dt className="text-slate-500">IBAN</dt>
                <dd className="font-mono text-xs">{p.iban ?? "–"}</dd>
              </dl>
            </SectionCard>

            <SectionCard title="Beträge">
              <dl className="grid grid-cols-[9.5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-slate-500">Summe Positionen</dt>
                <dd className="tabular-nums">{fmtOpt(p.declared.lineExtensionCents)}</dd>
                <dt className="text-slate-500">Netto</dt>
                <dd className="tabular-nums">{fmtOpt(p.declared.taxExclusiveCents)}</dd>
                <dt className="text-slate-500">Umsatzsteuer</dt>
                <dd className="tabular-nums">{fmtOpt(p.declared.taxTotalCents)}</dd>
                <dt className="text-slate-500">Brutto</dt>
                <dd className="font-semibold tabular-nums">{fmtOpt(p.declared.taxInclusiveCents)}</dd>
                <dt className="text-slate-500">Zahlbetrag</dt>
                <dd className="font-semibold tabular-nums">{fmtOpt(p.declared.payableCents)}</dd>
              </dl>
              {p.subtotals.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {p.subtotals.map((s, i) => (
                    <p key={i}>
                      USt {s.category ?? "?"} {s.percentE2 !== undefined ? `${Number(s.percentE2) / 100} %` : ""}:{" "}
                      {fmtOpt(s.taxCents)} auf {fmtOpt(s.taxableCents)}
                    </p>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          </div>

          <SectionCard title={`Positionen (${p.lines.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className="th">Pos.</th>
                    <th className="th">Bezeichnung</th>
                    <th className="th text-right">Menge</th>
                    <th className="th text-right">USt %</th>
                    <th className="th text-right">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((line, i) => (
                    <tr key={i}>
                      <td className="td">{line.id ?? i + 1}</td>
                      <td className="td">
                        {line.name ?? "–"}
                        {line.description ? (
                          <span className="block text-xs text-slate-500">{line.description}</span>
                        ) : null}
                      </td>
                      <td className="td text-right tabular-nums">
                        {line.quantity ?? "–"} {line.unitCode ?? ""}
                      </td>
                      <td className="td text-right tabular-nums">{line.percent ?? "–"}</td>
                      <td className="td text-right tabular-nums">{fmtOpt(line.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Prüfergebnis"
            actions={
              <button className="btn-secondary" onClick={downloadReport}>
                Prüfbericht (JSON)
              </button>
            }
          >
            <FindingsList findings={result.findings} emptyText="Alle geprüften Regeln bestanden." />
            <p className="mt-4 text-xs text-slate-500">
              Lokale Vorprüfung mit einer praxisrelevanten Teilmenge der EN-16931-/BR-DE-Regeln. Das
              BMF empfiehlt, E-Rechnungen technisch zu validieren und den Prüfbericht zu
              archivieren. Verbindliche Konformitätsprüfung:{" "}
              <a
                className="text-teal-700 underline"
                href={OFFICIAL_VALIDATOR_URL}
                target="_blank"
                rel="noreferrer"
              >
                offizieller Validator (KoSIT-basiert)
              </a>
              .
            </p>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
