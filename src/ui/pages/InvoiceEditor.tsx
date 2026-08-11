import { useEffect, useMemo, useState } from "react";
import type { Customer, Invoice, InvoiceLine, TaxCategory } from "../../core/model";
import { newId, TAX_CATEGORY_LABELS, UNIT_CODES } from "../../core/model";
import type { CatalogItem } from "../../core/model";
import {
  assignNextInvoiceNumber,
  countFinalized,
  getInvoice,
  listCustomers,
  listItems,
  saveInvoice
} from "../../core/db";
import { computeTotals } from "../../core/totals";
import { validateInvoice, type Finding } from "../../core/rules";
import { buildUblInvoice, xmlFileName } from "../../core/ubl";
import { buildInvoicePdf, pdfFileName } from "../../core/pdf";
import { formatEUR, formatScaledDE } from "../../core/money";
import { addDaysISO, formatDateDE, todayISO } from "../../core/dates";
import { useApp } from "../appstate";
import { navigate } from "../router";
import { ConfirmDialog, Field, FindingsList, SectionCard } from "../components";
import { downloadPdf, downloadXml } from "../download";
import { toast } from "../toast";
import { FREE_INVOICE_LIMIT, PURCHASE_URL } from "../../config";

function emptyLine(): InvoiceLine {
  return {
    id: newId(),
    name: "",
    quantity: "1",
    unitCode: "C62",
    unitPrice: "",
    taxCategory: "S",
    taxPercent: "19"
  };
}

function LineRow(props: {
  line: InvoiceLine;
  index: number;
  kleinunternehmer: boolean;
  onChange: (patch: Partial<InvoiceLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { line } = props;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid gap-2.5 sm:grid-cols-12">
        <Field label={`Position ${props.index + 1}`} className="sm:col-span-6">
          <input
            className="input"
            placeholder="Bezeichnung der Leistung/Ware"
            value={line.name}
            onChange={(e) => props.onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="Menge" className="sm:col-span-2">
          <input
            className="input text-right"
            inputMode="decimal"
            value={line.quantity}
            onChange={(e) => props.onChange({ quantity: e.target.value })}
          />
        </Field>
        <Field label="Einheit" className="sm:col-span-2">
          <select
            className="select"
            value={line.unitCode}
            onChange={(e) => props.onChange({ unitCode: e.target.value })}
          >
            {UNIT_CODES.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Einzelpreis netto €" className="sm:col-span-2">
          <input
            className="input text-right"
            inputMode="decimal"
            placeholder="0,00"
            value={line.unitPrice}
            onChange={(e) => props.onChange({ unitPrice: e.target.value })}
          />
        </Field>
        <Field label="Beschreibung (optional)" className="sm:col-span-6">
          <input
            className="input"
            value={line.description ?? ""}
            onChange={(e) => props.onChange({ description: e.target.value })}
          />
        </Field>
        <Field label="USt-Kategorie" className="sm:col-span-4">
          <select
            className="select"
            value={line.taxCategory}
            onChange={(e) => {
              const cat = e.target.value as TaxCategory;
              props.onChange({ taxCategory: cat, taxPercent: cat === "S" ? line.taxPercent || "19" : "0" });
            }}
          >
            {(Object.keys(TAX_CATEGORY_LABELS) as TaxCategory[]).map((cat) => (
              <option key={cat} value={cat} disabled={props.kleinunternehmer && cat === "S"}>
                {TAX_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </Field>
        {line.taxCategory === "S" ? (
          <Field label="USt-Satz" className="sm:col-span-2">
            <select
              className="select"
              value={line.taxPercent}
              onChange={(e) => props.onChange({ taxPercent: e.target.value })}
            >
              <option value="19">19 %</option>
              <option value="7">7 %</option>
            </select>
          </Field>
        ) : (
          <div className="sm:col-span-2" />
        )}
      </div>
      {props.canRemove ? (
        <button className="btn-ghost mt-2 px-2 py-1 text-xs text-red-600" onClick={props.onRemove}>
          Position entfernen
        </button>
      ) : null}
    </div>
  );
}

function FinalView(props: { inv: Invoice }) {
  const { inv } = props;
  const app = useApp();
  const result = computeTotals(inv);
  const [confirmStorno, setConfirmStorno] = useState(false);

  async function createStorno() {
    const storno: Invoice = {
      ...inv,
      id: newId(),
      status: "draft",
      typeCode: 384,
      number: undefined,
      issueDate: todayISO(),
      dueDate: undefined,
      precedingInvoiceNumber: inv.number,
      precedingInvoiceDate: inv.issueDate,
      lines: inv.lines.map((l) => ({
        ...l,
        id: newId(),
        quantity: l.quantity.startsWith("-") ? l.quantity.slice(1) : `-${l.quantity}`
      })),
      skonto: [],
      note: `Storno zur Rechnung ${inv.number} vom ${formatDateDE(inv.issueDate)}.`,
      createdAt: new Date().toISOString(),
      finalizedAt: undefined,
      xml: undefined
    };
    await saveInvoice(storno);
    setConfirmStorno(false);
    toast("success", "Storno-Entwurf erstellt – bitte prüfen und finalisieren.");
    navigate(`#/rechnung/${storno.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {inv.typeCode === 384 ? "Rechnungskorrektur" : "Rechnung"} {inv.number}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <span className="badge-green">Festgeschrieben</span>
            <span className="ml-2">
              {inv.buyer.name} · {formatDateDE(inv.issueDate)}
              {inv.finalizedAt ? ` · finalisiert am ${formatDateDE(inv.finalizedAt.slice(0, 10))}` : ""}
            </span>
          </p>
        </div>
        <a className="btn-ghost" href="#/">
          ← Zur Übersicht
        </a>
      </div>

      <SectionCard title="Export">
        <p className="text-sm text-slate-600">
          Die XRechnung-XML ist das rechtlich maßgebliche Format – versenden Sie diese Datei an Ihren
          Kunden. Die PDF ist eine Sichtkopie für Menschen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              if (inv.xml) {
                downloadXml(inv.xml, xmlFileName(inv));
                toast("success", "XRechnung (XML) heruntergeladen.");
              }
            }}
          >
            ⬇ XRechnung (XML)
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              if (result.totals) {
                downloadPdf(await buildInvoicePdf(inv, result.totals), pdfFileName(inv));
                toast("success", "PDF-Sichtkopie heruntergeladen.");
              }
            }}
          >
            ⬇ PDF (Sichtkopie)
          </button>
          {inv.typeCode !== 384 ? (
            <button className="btn-danger" onClick={() => setConfirmStorno(true)}>
              Storno / Korrektur erstellen
            </button>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Positionen">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr>
                <th className="th">Pos.</th>
                <th className="th">Bezeichnung</th>
                <th className="th text-right">Menge</th>
                <th className="th text-right">Einzelpreis</th>
                <th className="th text-right">Netto</th>
              </tr>
            </thead>
            <tbody>
              {result.totals?.lines.map((c, i) => (
                <tr key={c.line.id}>
                  <td className="td">{i + 1}</td>
                  <td className="td">{c.line.name}</td>
                  <td className="td text-right tabular-nums">
                    {formatScaledDE(c.qtyE4, 4)}{" "}
                    {UNIT_CODES.find((u) => u.code === c.line.unitCode)?.label ?? c.line.unitCode}
                  </td>
                  <td className="td text-right tabular-nums">{c.line.unitPrice} €</td>
                  <td className="td text-right tabular-nums">{formatEUR(c.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.totals ? (
          <div className="mt-3 flex justify-end">
            <dl className="grid w-64 grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Netto</dt>
              <dd className="text-right tabular-nums">{formatEUR(result.totals.taxExclusiveCents)}</dd>
              <dt className="text-slate-500">USt</dt>
              <dd className="text-right tabular-nums">{formatEUR(result.totals.taxTotalCents)}</dd>
              <dt className="font-semibold">Gesamt</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatEUR(result.totals.taxInclusiveCents)}
              </dd>
            </dl>
          </div>
        ) : null}
      </SectionCard>

      <ConfirmDialog
        open={confirmStorno}
        title="Storno / Korrektur erstellen?"
        text={`Es wird ein neuer Entwurf (Typ 384) mit negierten Mengen zur Rechnung ${inv.number} angelegt. Die Originalrechnung bleibt unverändert erhalten (GoBD).`}
        confirmLabel="Storno-Entwurf anlegen"
        onCancel={() => setConfirmStorno(false)}
        onConfirm={() => void createStorno()}
      />
      {app.licenseInfo === null && (
        <p className="text-xs text-slate-400">
          Hinweis: Storno-Rechnungen zählen ebenfalls zum Limit der kostenlosen Version.
        </p>
      )}
    </div>
  );
}

export function InvoiceEditor(props: { id?: string }) {
  const app = useApp();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);

  useEffect(() => {
    void (async () => {
      setCustomers(await listCustomers());
      setItems(await listItems());
      if (props.id) {
        const existing = await getInvoice(props.id);
        if (!existing) setNotFound(true);
        else setInv(existing);
      }
    })();
  }, [props.id]);

  // Neue Rechnung anlegen, sobald Firmendaten geladen sind
  useEffect(() => {
    if (!props.id && !inv && app.ready && app.seller) {
      const s = app.seller;
      const today = todayISO();
      setInv({
        id: newId(),
        status: "draft",
        typeCode: 380,
        issueDate: today,
        dueDate: addDaysISO(today, s.defaultPaymentDays || 14),
        deliveryDate: today,
        buyerReference: "",
        seller: s,
        buyer: { name: "", street: "", zip: "", city: "", countryCode: "DE" },
        lines: [emptyLine()],
        skonto:
          s.defaultSkontoDays && s.defaultSkontoPercent
            ? [{ days: s.defaultSkontoDays, percent: s.defaultSkontoPercent }]
            : [],
        currency: "EUR",
        createdAt: new Date().toISOString()
      });
    }
  }, [props.id, inv, app.ready, app.seller]);

  const computed = useMemo(() => (inv ? computeTotals(inv) : null), [inv]);
  const findings: Finding[] = useMemo(
    () => (inv && computed ? validateInvoice(inv, computed.totals, computed.errors) : []),
    [inv, computed]
  );
  const errorCount = findings.filter((f) => f.severity === "error").length;

  if (notFound) {
    return (
      <SectionCard title="Rechnung nicht gefunden">
        <a className="btn-secondary" href="#/">
          Zur Übersicht
        </a>
      </SectionCard>
    );
  }

  if (app.ready && !app.seller && !props.id) {
    return (
      <SectionCard title="Zuerst Firmendaten anlegen">
        <p className="text-sm text-slate-600">
          Für eine XRechnung sind Angaben zu Ihrer Firma Pflicht (Anschrift, Kontakt, IBAN,
          Steuernummer/USt-IdNr.). Einmal hinterlegen – dann geht jede Rechnung schnell.
        </p>
        <a className="btn-primary mt-4 inline-flex" href="#/stammdaten">
          Firmendaten anlegen
        </a>
      </SectionCard>
    );
  }

  if (!inv) return <p className="text-sm text-slate-500">Lade …</p>;
  if (inv.status === "final") return <FinalView inv={inv} />;

  const set = (patch: Partial<Invoice>) => {
    setInv((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };
  const setBuyer = (patch: Partial<Invoice["buyer"]>) => set({ buyer: { ...inv.buyer, ...patch } });

  async function saveDraft(silent = false) {
    if (!inv) return;
    await saveInvoice(inv);
    setDirty(false);
    if (!silent) toast("success", "Entwurf gespeichert.");
  }

  async function finalize() {
    if (!inv) return;
    setShowFindings(true);
    if (!computed?.totals || errorCount > 0) {
      toast("error", `Es gibt noch ${errorCount || "offene"} Fehler – siehe Prüfungsergebnis.`);
      return;
    }
    if (!app.licenseInfo) {
      const count = await countFinalized();
      if (count >= FREE_INVOICE_LIMIT) {
        setLimitReached(true);
        return;
      }
    }
    const number =
      inv.number ?? (await assignNextInvoiceNumber(inv.seller.numberTemplate, inv.issueDate));
    const finalInv: Invoice = {
      ...inv,
      number,
      status: "final",
      finalizedAt: new Date().toISOString()
    };
    const finalTotals = computeTotals(finalInv);
    if (!finalTotals.totals) return;
    finalInv.xml = buildUblInvoice(finalInv, finalTotals.totals);
    await saveInvoice(finalInv);
    await app.refresh();
    setInv(finalInv);
    setJustFinalized(true);
    toast("success", `Rechnung ${number} festgeschrieben – XML und PDF stehen bereit.`);
  }

  if (justFinalized && inv.status !== "draft") {
    return <FinalView inv={inv} />;
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {inv.typeCode === 384
              ? "Rechnungskorrektur (Storno)"
              : props.id
                ? "Rechnungsentwurf"
                : "Neue Rechnung"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <span className="badge-gray">Entwurf</span>
            {dirty ? <span className="ml-2 text-amber-600">● ungespeichert</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => void saveDraft()}>
            Entwurf speichern
          </button>
          <button className="btn-primary" onClick={() => void finalize()}>
            Prüfen &amp; finalisieren
          </button>
        </div>
      </div>

      {inv.typeCode === 384 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Storno zur Rechnung <strong>{inv.precedingInvoiceNumber}</strong>
          {inv.precedingInvoiceDate ? ` vom ${formatDateDE(inv.precedingInvoiceDate)}` : ""}. Mengen
          sind negiert – bei Finalisierung entsteht eine Rechnungskorrektur (Typ 384).
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Empfänger">
            {customers.length > 0 ? (
              <Field label="Aus Kundenstamm übernehmen" className="mb-3">
                <select
                  className="select"
                  value=""
                  onChange={(e) => {
                    const c = customers.find((x) => x.id === e.target.value);
                    if (c) {
                      set({
                        customerId: c.id,
                        buyerReference: c.buyerReference ?? inv.buyerReference,
                        buyer: {
                          name: c.name,
                          street: c.street,
                          zip: c.zip,
                          city: c.city,
                          countryCode: c.countryCode,
                          email: c.email,
                          vatId: c.vatId,
                          customerNumber: c.number
                        }
                      });
                    }
                  }}
                >
                  <option value="">– Kunde wählen –</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.number} · {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name / Firma" required className="sm:col-span-2">
                <input className="input" value={inv.buyer.name} onChange={(e) => setBuyer({ name: e.target.value })} />
              </Field>
              <Field label="Straße" className="sm:col-span-2">
                <input className="input" value={inv.buyer.street} onChange={(e) => setBuyer({ street: e.target.value })} />
              </Field>
              <Field label="PLZ">
                <input className="input" value={inv.buyer.zip} onChange={(e) => setBuyer({ zip: e.target.value })} />
              </Field>
              <Field label="Ort">
                <input className="input" value={inv.buyer.city} onChange={(e) => setBuyer({ city: e.target.value })} />
              </Field>
              <Field label="Land (ISO)">
                <input className="input" value={inv.buyer.countryCode} onChange={(e) => setBuyer({ countryCode: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="E-Mail">
                <input className="input" value={inv.buyer.email ?? ""} onChange={(e) => setBuyer({ email: e.target.value })} />
              </Field>
              <Field label="USt-IdNr. des Kunden">
                <input className="input" value={inv.buyer.vatId ?? ""} onChange={(e) => setBuyer({ vatId: e.target.value })} />
              </Field>
              <Field
                label="Käuferreferenz (BT-10)"
                required
                hint="Behörden: Leitweg-ID. Unternehmen: Bestellzeichen/Kundennummer, sonst „n/a“."
              >
                <input className="input" value={inv.buyerReference} onChange={(e) => set({ buyerReference: e.target.value })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Daten & Referenzen">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Rechnungsdatum" required>
                <input className="input" type="date" value={inv.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
              </Field>
              <Field label="Fällig am">
                <input className="input" type="date" value={inv.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || undefined })} />
              </Field>
              <Field label="Leistungsdatum">
                <input className="input" type="date" value={inv.deliveryDate ?? ""} onChange={(e) => set({ deliveryDate: e.target.value || undefined })} />
              </Field>
              <Field label="Leistungszeitraum von">
                <input className="input" type="date" value={inv.periodStart ?? ""} onChange={(e) => set({ periodStart: e.target.value || undefined })} />
              </Field>
              <Field label="Leistungszeitraum bis">
                <input className="input" type="date" value={inv.periodEnd ?? ""} onChange={(e) => set({ periodEnd: e.target.value || undefined })} />
              </Field>
              <Field label="Bestellnummer (optional)">
                <input className="input" value={inv.orderReference ?? ""} onChange={(e) => set({ orderReference: e.target.value || undefined })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Positionen"
            actions={
              items.length > 0 ? (
                <select
                  className="select w-56"
                  value=""
                  onChange={(e) => {
                    const item = items.find((x) => x.id === e.target.value);
                    if (item) {
                      set({
                        lines: [
                          ...inv.lines.filter((l) => l.name.trim() || l.unitPrice.trim()),
                          {
                            id: newId(),
                            itemNumber: item.number,
                            name: item.name,
                            description: item.description,
                            quantity: "1",
                            unitCode: item.unitCode,
                            unitPrice: item.unitPrice,
                            taxCategory: item.taxCategory,
                            taxPercent: item.taxPercent
                          }
                        ]
                      });
                    }
                  }}
                >
                  <option value="">＋ Aus Artikelstamm …</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unitPrice} €)
                    </option>
                  ))}
                </select>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-3">
              {inv.lines.map((line, i) => (
                <LineRow
                  key={line.id}
                  line={line}
                  index={i}
                  kleinunternehmer={inv.seller.kleinunternehmer}
                  canRemove={inv.lines.length > 1}
                  onChange={(patch) =>
                    set({ lines: inv.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l)) })
                  }
                  onRemove={() => set({ lines: inv.lines.filter((l) => l.id !== line.id) })}
                />
              ))}
            </div>
            <button className="btn-secondary mt-3" onClick={() => set({ lines: [...inv.lines, emptyLine()] })}>
              ＋ Position hinzufügen
            </button>
          </SectionCard>

          <SectionCard title="Zahlung & Texte">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Skonto" hint="Wird XRechnung-konform (BR-DE-18) in die XML übernommen.">
                <div className="flex flex-col gap-2">
                  {inv.skonto.map((sk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <input
                        className="input w-20 text-right"
                        inputMode="numeric"
                        value={sk.days}
                        onChange={(e) =>
                          set({
                            skonto: inv.skonto.map((x, j) =>
                              j === i ? { ...x, days: Math.max(1, Number(e.target.value) || 1) } : x
                            )
                          })
                        }
                      />
                      <span>Tage →</span>
                      <input
                        className="input w-24 text-right"
                        inputMode="decimal"
                        value={sk.percent}
                        onChange={(e) =>
                          set({ skonto: inv.skonto.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)) })
                        }
                      />
                      <span>%</span>
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => set({ skonto: inv.skonto.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn-secondary self-start"
                    onClick={() => set({ skonto: [...inv.skonto, { days: 7, percent: "2,00" }] })}
                  >
                    ＋ Skonto-Staffel
                  </button>
                </div>
              </Field>
              <div className="flex flex-col gap-3">
                <Field label="Zahlungsbedingungen (Freitext)">
                  <input
                    className="input"
                    placeholder="z. B. Zahlbar innerhalb von 14 Tagen ohne Abzug."
                    value={inv.paymentTermsText ?? ""}
                    onChange={(e) => set({ paymentTermsText: e.target.value || undefined })}
                  />
                </Field>
                <Field label="Bemerkung auf der Rechnung (optional)">
                  <input
                    className="input"
                    placeholder="z. B. Vielen Dank für Ihren Auftrag!"
                    value={inv.note ?? ""}
                    onChange={(e) => set({ note: e.target.value || undefined })}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={`Prüfungsergebnis ${errorCount > 0 ? `(${errorCount} Fehler)` : "✓"}`}>
            {showFindings || findings.length > 0 ? (
              <FindingsList findings={findings} emptyText="Alle Pflichtangaben vorhanden – bereit zur Finalisierung." />
            ) : null}
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700">Summen</h3>
            {computed?.totals ? (
              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Netto</dt>
                  <dd className="tabular-nums">{formatEUR(computed.totals.taxExclusiveCents)}</dd>
                </div>
                {computed.totals.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between">
                    <dt className="text-slate-500">
                      {b.category === "S" ? `USt ${formatScaledDE(b.percentE2, 2)} %` : "USt 0 %"}
                    </dt>
                    <dd className="tabular-nums">{formatEUR(b.taxCents)}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                  <dt>Gesamt</dt>
                  <dd className="tabular-nums">{formatEUR(computed.totals.taxInclusiveCents)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Summen erscheinen, sobald Mengen und Preise gültig sind.
              </p>
            )}
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>
                Status:{" "}
                {errorCount === 0 ? (
                  <span className="font-medium text-emerald-700">bereit zur Finalisierung</span>
                ) : (
                  <span className="font-medium text-red-700">{errorCount} Fehler offen</span>
                )}
              </p>
              <p className="mt-1">
                Beim Finalisieren wird die Rechnungsnummer vergeben und die XRechnung-XML
                festgeschrieben.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={limitReached}
        title="Limit der kostenlosen Version erreicht"
        text={`Sie haben bereits ${FREE_INVOICE_LIMIT} Rechnungen finalisiert. Mit der Pro-Lizenz (Einmalkauf, keine Abos) erstellen Sie unbegrenzt Rechnungen – der Entwurf bleibt selbstverständlich erhalten.`}
        confirmLabel="Pro-Lizenz ansehen"
        onCancel={() => setLimitReached(false)}
        onConfirm={() => {
          setLimitReached(false);
          void saveDraft(true);
          window.open(PURCHASE_URL, "_blank", "noopener");
        }}
      />
    </div>
  );
}
