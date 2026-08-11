import { useEffect, useState } from "react";
import type { Property, Tenancy, Unit } from "../../core/model";
import { newId } from "../../core/model";
import {
  deleteTenancy,
  deleteUnit,
  listProperties,
  listTenancies,
  listUnits,
  saveProperty,
  saveTenancy,
  saveUnit
} from "../../core/db";
import { loadDemoData } from "../../core/demo";
import { formatDateDE } from "../../core/dates";
import { ConfirmDialog, EmptyState, Field, SectionCard } from "../components";
import { toast } from "../toast";

const EMPTY_PROPERTY: Property = {
  id: "",
  name: "",
  street: "",
  zip: "",
  city: "",
  landlordName: "",
  landlordAddress: "",
  landlordEmail: "",
  landlordPhone: "",
  iban: "",
  heatingConsumptionSharePct: 70,
  vacancyPersons: 1
};

export function ObjektePage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [form, setForm] = useState<Property>(EMPTY_PROPERTY);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [editTenancy, setEditTenancy] = useState<Tenancy | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "unit" | "tenancy"; id: string; label: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const props = await listProperties();
    const p = props[0] ?? null;
    setProperty(p);
    if (p) setForm(p);
    setUnits((await listUnits()).filter((u) => !p || u.propertyId === p.id));
    setTenancies(await listTenancies());
    setLoaded(true);
  };
  useEffect(() => {
    void reload();
  }, []);

  const set = (patch: Partial<Property>) => setForm((f) => ({ ...f, ...patch }));

  if (!loaded) return <p className="text-sm text-slate-500">Lade …</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Objekt &amp; Mieter</h1>
        {!property ? (
          <button
            className="btn-secondary"
            onClick={async () => {
              await loadDemoData();
              await reload();
              toast("success", "Demo-Objekt geladen (MFH mit 3 Wohnungen, Mieterwechsel, Zählern).");
            }}
          >
            Mit Demo-Daten ausprobieren
          </button>
        ) : null}
      </div>

      <SectionCard title="Objekt & Vermieter">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Objektbezeichnung" required>
            <input className="input" placeholder="z. B. MFH Gartenstraße 5" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Straße & Hausnummer" required>
            <input className="input" value={form.street} onChange={(e) => set({ street: e.target.value })} />
          </Field>
          <Field label="PLZ" required>
            <input className="input" value={form.zip} onChange={(e) => set({ zip: e.target.value })} />
          </Field>
          <Field label="Ort" required>
            <input className="input" value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Vermieter (Name)" required>
            <input className="input" value={form.landlordName} onChange={(e) => set({ landlordName: e.target.value })} />
          </Field>
          <Field label="Vermieter-Anschrift" required hint="Eine Zeile, erscheint im Briefkopf">
            <input className="input" value={form.landlordAddress} onChange={(e) => set({ landlordAddress: e.target.value })} />
          </Field>
          <Field label="E-Mail (optional)">
            <input className="input" value={form.landlordEmail ?? ""} onChange={(e) => set({ landlordEmail: e.target.value })} />
          </Field>
          <Field label="IBAN für Nachzahlungen (optional)">
            <input className="input font-mono" value={form.iban ?? ""} onChange={(e) => set({ iban: e.target.value })} />
          </Field>
          <Field label="Heizkosten: Verbrauchsanteil (%)" hint="HeizkostenV erlaubt 50–70 %, üblich sind 70 %">
            <input
              className="input"
              type="number"
              min={50}
              max={70}
              value={form.heatingConsumptionSharePct}
              onChange={(e) => set({ heatingConsumptionSharePct: Number(e.target.value) || 70 })}
            />
          </Field>
          <Field label="Fiktive Personen bei Leerstand" hint="Für den Personen-Schlüssel; Leerstand trägt der Vermieter">
            <input
              className="input"
              type="number"
              min={0}
              value={form.vacancyPersons}
              onChange={(e) => set({ vacancyPersons: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        </div>
        <button
          className="btn-primary mt-4"
          onClick={async () => {
            if (!form.name.trim() || !form.landlordName.trim()) {
              toast("error", "Bitte mindestens Objektbezeichnung und Vermieter angeben.");
              return;
            }
            const toSave = { ...form, id: form.id || newId() };
            await saveProperty(toSave);
            await reload();
            toast("success", "Objekt gespeichert.");
          }}
        >
          Speichern
        </button>
      </SectionCard>

      <SectionCard
        title={`Wohneinheiten (${units.length})`}
        actions={
          property ? (
            <button className="btn-primary" onClick={() => setEditUnit({ id: newId(), propertyId: property.id, label: `Whg. ${units.length + 1}`, areaSqm: "" })}>
              ＋ Einheit
            </button>
          ) : undefined
        }
      >
        {!property ? (
          <EmptyState title="Zuerst das Objekt speichern." />
        ) : units.length === 0 && !editUnit ? (
          <EmptyState title="Noch keine Einheiten." text="Jede Wohnung mit Wohnfläche anlegen – die Fläche ist Basis vieler Verteilerschlüssel." />
        ) : (
          <div className="flex flex-col gap-2">
            {units.map((u) => {
              const ts = tenancies.filter((t) => t.unitId === u.id);
              return (
                <div key={u.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {u.label} <span className="text-slate-500">· {u.areaSqm} m²</span>
                    </p>
                    <div className="flex gap-1">
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() =>
                          setEditTenancy({ id: newId(), unitId: u.id, tenantName: "", persons: 1, start: "", monthlyAdvance: "" })
                        }
                      >
                        ＋ Mieter
                      </button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditUnit(u)}>
                        Bearbeiten
                      </button>
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => setConfirmDelete({ kind: "unit", id: u.id, label: u.label })}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                  {ts.length > 0 ? (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {ts.map((t) => (
                        <li key={t.id} className="flex items-center justify-between rounded bg-slate-50 px-2.5 py-1.5 text-xs">
                          <span>
                            <strong>{t.tenantName}</strong> · {t.persons} Pers. · {formatDateDE(t.start)} –{" "}
                            {t.end ? formatDateDE(t.end) : "heute"} · VZ {t.monthlyAdvance} €/Monat
                          </span>
                          <span className="flex gap-1">
                            <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={() => setEditTenancy(t)}>
                              Bearbeiten
                            </button>
                            <button
                              className="btn-ghost px-1.5 py-0.5 text-xs text-red-600"
                              onClick={() => setConfirmDelete({ kind: "tenancy", id: t.id, label: t.tenantName })}
                            >
                              ✕
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">Kein Mietverhältnis erfasst – Zeitraum zählt als Leerstand (Vermieter).</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {editUnit ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2">
            <Field label="Bezeichnung" required>
              <input className="input" value={editUnit.label} onChange={(e) => setEditUnit({ ...editUnit, label: e.target.value })} />
            </Field>
            <Field label="Wohnfläche (m²)" required>
              <input className="input" inputMode="decimal" placeholder="z. B. 64,5" value={editUnit.areaSqm} onChange={(e) => setEditUnit({ ...editUnit, areaSqm: e.target.value })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!editUnit.label.trim() || !editUnit.areaSqm.trim()) {
                    toast("error", "Bezeichnung und Wohnfläche angeben.");
                    return;
                  }
                  await saveUnit(editUnit);
                  setEditUnit(null);
                  await reload();
                  toast("success", "Einheit gespeichert.");
                }}
              >
                Speichern
              </button>
              <button className="btn-secondary" onClick={() => setEditUnit(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}

        {editTenancy ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2">
            <Field label="Mieter (Name)" required className="sm:col-span-2">
              <input className="input" value={editTenancy.tenantName} onChange={(e) => setEditTenancy({ ...editTenancy, tenantName: e.target.value })} />
            </Field>
            <Field label="Personen im Haushalt" required>
              <input className="input" type="number" min={1} value={editTenancy.persons} onChange={(e) => setEditTenancy({ ...editTenancy, persons: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
            <Field label="Monatliche NK-Vorauszahlung (€)" required>
              <input className="input" inputMode="decimal" placeholder="z. B. 180,00" value={editTenancy.monthlyAdvance} onChange={(e) => setEditTenancy({ ...editTenancy, monthlyAdvance: e.target.value })} />
            </Field>
            <Field label="Einzug" required>
              <input className="input" type="date" value={editTenancy.start} onChange={(e) => setEditTenancy({ ...editTenancy, start: e.target.value })} />
            </Field>
            <Field label="Auszug (leer = läuft)">
              <input className="input" type="date" value={editTenancy.end ?? ""} onChange={(e) => setEditTenancy({ ...editTenancy, end: e.target.value || undefined })} />
            </Field>
            <Field label="Gezahlte VZ im Zeitraum überschreiben (optional)" hint="Nur setzen, wenn die tatsächlichen Zahlungen abweichen" className="sm:col-span-2">
              <input className="input" inputMode="decimal" value={editTenancy.advancePaidOverride ?? ""} onChange={(e) => setEditTenancy({ ...editTenancy, advancePaidOverride: e.target.value || undefined })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!editTenancy.tenantName.trim() || !editTenancy.start) {
                    toast("error", "Name und Einzugsdatum angeben.");
                    return;
                  }
                  await saveTenancy(editTenancy);
                  setEditTenancy(null);
                  await reload();
                  toast("success", "Mietverhältnis gespeichert.");
                }}
              >
                Speichern
              </button>
              <button className="btn-secondary" onClick={() => setEditTenancy(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.kind === "unit" ? "Einheit löschen?" : "Mietverhältnis löschen?"}
        text={`„${confirmDelete?.label ?? ""}“ wird entfernt.`}
        confirmLabel="Löschen"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          if (confirmDelete.kind === "unit") await deleteUnit(confirmDelete.id);
          else await deleteTenancy(confirmDelete.id);
          setConfirmDelete(null);
          await reload();
          toast("success", "Gelöscht.");
        }}
      />
    </div>
  );
}
