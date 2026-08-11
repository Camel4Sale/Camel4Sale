import { useEffect, useState } from "react";
import type { Invoice } from "../../core/model";
import { deleteDraft, listInvoices } from "../../core/db";
import { loadDemoData } from "../../core/demo";
import { computeTotals } from "../../core/totals";
import { formatEUR } from "../../core/money";
import { formatDateDE } from "../../core/dates";
import { useApp } from "../appstate";
import { ConfirmDialog, EmptyState, SectionCard, StatBox } from "../components";
import { toast } from "../toast";
import { FREE_INVOICE_LIMIT } from "../../config";

function invoiceTotal(inv: Invoice): string {
  const { totals } = computeTotals(inv);
  return totals ? formatEUR(totals.taxInclusiveCents) : "–";
}

export function Dashboard() {
  const app = useApp();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  const reload = async () => setInvoices(await listInvoices());
  useEffect(() => {
    void reload();
  }, []);

  const filtered = (invoices ?? []).filter((inv) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (inv.number ?? "").toLowerCase().includes(q) ||
      inv.buyer.name.toLowerCase().includes(q)
    );
  });

  const finalized = (invoices ?? []).filter((i) => i.status === "final");
  const openDrafts = (invoices ?? []).filter((i) => i.status === "draft");
  const yearTotal = finalized
    .filter((i) => i.issueDate.startsWith(String(new Date().getFullYear())))
    .reduce((sum, inv) => {
      const { totals } = computeTotals(inv);
      return sum + (totals?.taxInclusiveCents ?? 0);
    }, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Übersicht</h1>
        <div className="flex gap-2">
          <a className="btn-secondary" href="#/pruefen">
            Rechnung prüfen
          </a>
          <a className="btn-primary" href="#/neu">
            ＋ Neue Rechnung
          </a>
        </div>
      </div>

      {app.ready && !app.seller ? (
        <SectionCard title="Erste Schritte">
          <p className="text-sm text-slate-600">
            Willkommen! Hinterlegen Sie zunächst Ihre Firmendaten – sie werden für jede
            XRechnung benötigt (Pflichtangaben nach § 14 UStG und XRechnung BR-DE).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href="#/stammdaten">
              Firmendaten anlegen
            </a>
            <button
              className="btn-secondary"
              onClick={async () => {
                await loadDemoData();
                await app.refresh();
                await reload();
                toast("success", "Demo-Daten geladen. Alles lässt sich in den Einstellungen zurücksetzen.");
              }}
            >
              Mit Demo-Daten ausprobieren
            </button>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Rechnungen gesamt" value={String(finalized.length)} />
        <StatBox label="Entwürfe" value={String(openDrafts.length)} />
        <StatBox label={`Umsatz ${new Date().getFullYear()} (brutto)`} value={formatEUR(yearTotal)} accent />
        <StatBox
          label="Lizenz"
          value={app.licenseInfo ? "Pro" : `Frei (${Math.max(0, FREE_INVOICE_LIMIT - app.finalizedCount)} übrig)`}
        />
      </div>

      <SectionCard
        title="Rechnungen"
        actions={
          <input
            className="input w-56"
            placeholder="Suchen (Nr. oder Kunde) …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        {invoices === null ? (
          <p className="text-sm text-slate-500">Lade …</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? "Keine Treffer." : "Noch keine Rechnungen."}
            text={
              query
                ? undefined
                : "Erstellen Sie Ihre erste XRechnung – der Editor prüft alle Pflichtangaben live."
            }
            action={query ? undefined : <a className="btn-primary" href="#/neu">Erste Rechnung erstellen</a>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">Nummer</th>
                  <th className="th">Kunde</th>
                  <th className="th">Datum</th>
                  <th className="th text-right">Betrag (brutto)</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="td font-medium">
                      <a className="text-teal-700 hover:underline" href={`#/rechnung/${inv.id}`}>
                        {inv.number ?? "(Entwurf)"}
                      </a>
                      {inv.typeCode === 384 ? (
                        <span className="badge-amber ml-2">Korrektur</span>
                      ) : null}
                    </td>
                    <td className="td">{inv.buyer.name || "–"}</td>
                    <td className="td">{formatDateDE(inv.issueDate)}</td>
                    <td className="td text-right tabular-nums">{invoiceTotal(inv)}</td>
                    <td className="td">
                      {inv.status === "final" ? (
                        <span className="badge-green">Festgeschrieben</span>
                      ) : (
                        <span className="badge-gray">Entwurf</span>
                      )}
                    </td>
                    <td className="td text-right">
                      {inv.status === "draft" ? (
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => setConfirmDelete(inv)}
                        >
                          Löschen
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Entwurf löschen?"
        text={`Der Entwurf ${confirmDelete?.number ?? "(ohne Nummer)"} für „${confirmDelete?.buyer.name ?? ""}“ wird endgültig gelöscht.`}
        confirmLabel="Löschen"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteDraft(confirmDelete.id);
            toast("success", "Entwurf gelöscht.");
            setConfirmDelete(null);
            await reload();
          }
        }}
      />
    </div>
  );
}
