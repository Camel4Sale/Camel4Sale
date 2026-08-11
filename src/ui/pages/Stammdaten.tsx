import { useEffect, useState } from "react";
import type { CatalogItem, Customer, SellerProfile, TaxCategory } from "../../core/model";
import { newId, TAX_CATEGORY_LABELS, UNIT_CODES } from "../../core/model";
import {
  deleteCustomer,
  deleteItem,
  listCustomers,
  listItems,
  saveCustomer,
  saveItem,
  saveSeller
} from "../../core/db";
import { DEFAULT_NUMBER_TEMPLATE } from "../../core/numbering";
import { useApp } from "../appstate";
import { ConfirmDialog, EmptyState, Field, SectionCard } from "../components";
import { toast } from "../toast";

type Tab = "firma" | "kunden" | "artikel";

const EMPTY_SELLER: SellerProfile = {
  name: "",
  legalForm: "",
  registerInfo: "",
  street: "",
  zip: "",
  city: "",
  countryCode: "DE",
  contactName: "",
  phone: "",
  email: "",
  vatId: "",
  taxNumber: "",
  iban: "",
  bic: "",
  bankLabel: "",
  kleinunternehmer: false,
  numberTemplate: DEFAULT_NUMBER_TEMPLATE,
  defaultPaymentDays: 14,
  defaultSkontoDays: undefined,
  defaultSkontoPercent: ""
};

function SellerForm() {
  const app = useApp();
  const [form, setForm] = useState<SellerProfile>(EMPTY_SELLER);
  useEffect(() => {
    if (app.seller) setForm({ ...EMPTY_SELLER, ...app.seller });
  }, [app.seller]);

  const set = (patch: Partial<SellerProfile>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <SectionCard title="Meine Firma (Rechnungssteller)">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firmenname / Name" required className="sm:col-span-2">
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Muster Webdesign" />
        </Field>
        <Field label="Rechtsform / Inhaber" hint="Erscheint als Zusatz, z. B. „Inhaber: Max Muster“">
          <input className="input" value={form.legalForm ?? ""} onChange={(e) => set({ legalForm: e.target.value })} />
        </Field>
        <Field label="Registereintrag (optional)" hint="z. B. „HRB 12345, AG Mannheim“">
          <input className="input" value={form.registerInfo ?? ""} onChange={(e) => set({ registerInfo: e.target.value })} />
        </Field>
        <Field label="Straße und Hausnummer" required className="sm:col-span-2">
          <input className="input" value={form.street} onChange={(e) => set({ street: e.target.value })} />
        </Field>
        <Field label="PLZ" required>
          <input className="input" value={form.zip} onChange={(e) => set({ zip: e.target.value })} />
        </Field>
        <Field label="Ort" required>
          <input className="input" value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Ansprechpartner" required hint="XRechnung-Pflicht (BT-41)">
          <input className="input" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label="Telefon" required hint="XRechnung-Pflicht (BT-42)">
          <input className="input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="E-Mail" required hint="XRechnung-Pflicht (BT-43) und elektronische Adresse">
          <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="USt-IdNr." hint="z. B. DE123456789 – USt-IdNr. oder Steuernummer ist Pflicht">
          <input className="input" value={form.vatId ?? ""} onChange={(e) => set({ vatId: e.target.value })} />
        </Field>
        <Field label="Steuernummer">
          <input className="input" value={form.taxNumber ?? ""} onChange={(e) => set({ taxNumber: e.target.value })} />
        </Field>
        <Field label="IBAN" required hint="Für die Zahlungsangaben (XRechnung-Pflicht)" className="sm:col-span-2">
          <input className="input font-mono" value={form.iban} onChange={(e) => set({ iban: e.target.value })} />
        </Field>
        <Field label="BIC (optional)">
          <input className="input font-mono" value={form.bic ?? ""} onChange={(e) => set({ bic: e.target.value })} />
        </Field>
        <Field label="Bankname (optional)">
          <input className="input" value={form.bankLabel ?? ""} onChange={(e) => set({ bankLabel: e.target.value })} />
        </Field>
        <Field label="Standard-Zahlungsziel (Tage)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.defaultPaymentDays}
            onChange={(e) => set({ defaultPaymentDays: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={form.kleinunternehmer}
              onChange={(e) => set({ kleinunternehmer: e.target.checked })}
            />
            Kleinunternehmer nach § 19 UStG (keine USt auf Rechnungen)
          </label>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          className="btn-primary"
          onClick={async () => {
            if (!form.name.trim()) {
              toast("error", "Bitte mindestens den Firmennamen angeben.");
              return;
            }
            await saveSeller({ ...form, numberTemplate: form.numberTemplate || DEFAULT_NUMBER_TEMPLATE });
            await app.refresh();
            toast("success", "Firmendaten gespeichert.");
          }}
        >
          Speichern
        </button>
        <p className="text-xs text-slate-500">
          Diese Angaben werden als Snapshot in jede neue Rechnung übernommen.
        </p>
      </div>
    </SectionCard>
  );
}

const EMPTY_CUSTOMER: Customer = {
  id: "",
  number: "",
  name: "",
  street: "",
  zip: "",
  city: "",
  countryCode: "DE",
  email: "",
  vatId: "",
  buyerReference: ""
};

function CustomerTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const reload = async () => setCustomers(await listCustomers());
  useEffect(() => {
    void reload();
  }, []);

  return (
    <SectionCard
      title="Kunden"
      actions={
        <button
          className="btn-primary"
          onClick={() => setEditing({ ...EMPTY_CUSTOMER, id: newId(), number: `K-${1001 + customers.length}` })}
        >
          ＋ Kunde
        </button>
      }
    >
      {customers.length === 0 && !editing ? (
        <EmptyState
          title="Noch keine Kunden."
          text="Kunden lassen sich auch direkt beim Erstellen einer Rechnung anlegen."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.number} · {c.zip} {c.city}
                  {c.buyerReference ? ` · Referenz: ${c.buyerReference}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(c)}>
                  Bearbeiten
                </button>
                <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => setConfirmDelete(c)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required className="sm:col-span-2">
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Kundennummer">
              <input className="input" value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} />
            </Field>
            <Field label="Käuferreferenz (BT-10)" hint="Bei Behörden: Leitweg-ID">
              <input className="input" value={editing.buyerReference ?? ""} onChange={(e) => setEditing({ ...editing, buyerReference: e.target.value })} />
            </Field>
            <Field label="Straße" className="sm:col-span-2">
              <input className="input" value={editing.street} onChange={(e) => setEditing({ ...editing, street: e.target.value })} />
            </Field>
            <Field label="PLZ">
              <input className="input" value={editing.zip} onChange={(e) => setEditing({ ...editing, zip: e.target.value })} />
            </Field>
            <Field label="Ort">
              <input className="input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </Field>
            <Field label="Land (ISO-Code)">
              <input className="input" value={editing.countryCode} onChange={(e) => setEditing({ ...editing, countryCode: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="E-Mail (elektronische Adresse)">
              <input className="input" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="USt-IdNr. (bei Reverse Charge / EU nötig)">
              <input className="input" value={editing.vatId ?? ""} onChange={(e) => setEditing({ ...editing, vatId: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                if (!editing.name.trim()) {
                  toast("error", "Bitte einen Namen angeben.");
                  return;
                }
                await saveCustomer(editing);
                setEditing(null);
                await reload();
                toast("success", "Kunde gespeichert.");
              }}
            >
              Speichern
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Kunde löschen?"
        text={`„${confirmDelete?.name ?? ""}“ wird aus dem Kundenstamm entfernt. Bestehende Rechnungen bleiben unverändert.`}
        confirmLabel="Löschen"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteCustomer(confirmDelete.id);
            setConfirmDelete(null);
            await reload();
            toast("success", "Kunde gelöscht.");
          }
        }}
      />
    </SectionCard>
  );
}

const EMPTY_ITEM: CatalogItem = {
  id: "",
  number: "",
  name: "",
  description: "",
  unitCode: "C62",
  unitPrice: "",
  taxCategory: "S",
  taxPercent: "19"
};

function ItemTab() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogItem | null>(null);
  const reload = async () => setItems(await listItems());
  useEffect(() => {
    void reload();
  }, []);

  return (
    <SectionCard
      title="Artikel & Leistungen"
      actions={
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY_ITEM, id: newId() })}>
          ＋ Artikel
        </button>
      }
    >
      {items.length === 0 && !editing ? (
        <EmptyState
          title="Noch keine Artikel."
          text="Häufige Leistungen hier anlegen und im Rechnungseditor mit einem Klick übernehmen."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.number ? `${item.number} · ` : ""}
                  {item.unitPrice} € / {UNIT_CODES.find((u) => u.code === item.unitCode)?.label ?? item.unitCode} ·{" "}
                  {item.taxCategory === "S" ? `${item.taxPercent} % USt` : TAX_CATEGORY_LABELS[item.taxCategory]}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(item)}>
                  Bearbeiten
                </button>
                <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => setConfirmDelete(item)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bezeichnung" required className="sm:col-span-2">
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Beschreibung (optional)" className="sm:col-span-2">
              <input className="input" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <Field label="Artikelnummer">
              <input className="input" value={editing.number ?? ""} onChange={(e) => setEditing({ ...editing, number: e.target.value })} />
            </Field>
            <Field label="Einheit">
              <select className="select" value={editing.unitCode} onChange={(e) => setEditing({ ...editing, unitCode: e.target.value })}>
                {UNIT_CODES.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Einzelpreis netto (€)">
              <input className="input" value={editing.unitPrice} onChange={(e) => setEditing({ ...editing, unitPrice: e.target.value })} placeholder="z. B. 95,00" />
            </Field>
            <Field label="USt-Kategorie">
              <select
                className="select"
                value={editing.taxCategory}
                onChange={(e) => {
                  const cat = e.target.value as TaxCategory;
                  setEditing({ ...editing, taxCategory: cat, taxPercent: cat === "S" ? editing.taxPercent || "19" : "0" });
                }}
              >
                {(Object.keys(TAX_CATEGORY_LABELS) as TaxCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {TAX_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </Field>
            {editing.taxCategory === "S" ? (
              <Field label="USt-Satz (%)">
                <select className="select" value={editing.taxPercent} onChange={(e) => setEditing({ ...editing, taxPercent: e.target.value })}>
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                </select>
              </Field>
            ) : null}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                if (!editing.name.trim()) {
                  toast("error", "Bitte eine Bezeichnung angeben.");
                  return;
                }
                await saveItem(editing);
                setEditing(null);
                await reload();
                toast("success", "Artikel gespeichert.");
              }}
            >
              Speichern
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Artikel löschen?"
        text={`„${confirmDelete?.name ?? ""}“ wird aus dem Artikelstamm entfernt.`}
        confirmLabel="Löschen"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteItem(confirmDelete.id);
            setConfirmDelete(null);
            await reload();
            toast("success", "Artikel gelöscht.");
          }
        }}
      />
    </SectionCard>
  );
}

export function Stammdaten() {
  const [tab, setTab] = useState<Tab>("firma");
  const tabs: { key: Tab; label: string }[] = [
    { key: "firma", label: "Meine Firma" },
    { key: "kunden", label: "Kunden" },
    { key: "artikel", label: "Artikel & Leistungen" }
  ];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-slate-800">Stammdaten</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3.5 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "firma" && <SellerForm />}
      {tab === "kunden" && <CustomerTab />}
      {tab === "artikel" && <ItemTab />}
    </div>
  );
}
