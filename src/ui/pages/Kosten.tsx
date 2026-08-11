import { useEffect, useState } from "react";
import type { CostItem, CostType, MeterReading, Period, Property, Unit } from "../../core/model";
import { ALLOCATION_LABELS, DEFAULT_COST_TYPES, newId } from "../../core/model";
import {
  deleteCostItem,
  listCostItems,
  listCostTypes,
  listMeters,
  listPeriods,
  listProperties,
  listUnits,
  saveCostItem,
  saveCostType,
  saveMeter,
  savePeriod
} from "../../core/db";
import { formatCents, parseDecimal } from "../../core/money";
import { EmptyState, Field, SectionCard } from "../components";
import { toast } from "../toast";

export function KostenPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [costTypes, setCostTypes] = useState<CostType[]>([]);
  const [items, setItems] = useState<CostItem[]>([]);
  const [meters, setMeters] = useState<MeterReading[]>([]);
  const [newPeriod, setNewPeriod] = useState({ label: "", start: "", end: "" });

  const reload = async () => {
    const p = (await listProperties())[0] ?? null;
    setProperty(p);
    setUnits((await listUnits()).filter((u) => !p || u.propertyId === p.id));
    const pers = (await listPeriods()).sort((a, b) => (a.start < b.start ? 1 : -1));
    setPeriods(pers);
    setPeriodId((prev) => prev || pers[0]?.id || "");
    setCostTypes(await listCostTypes());
    setItems(await listCostItems());
    setMeters(await listMeters());
  };
  useEffect(() => {
    void reload();
  }, []);

  const period = periods.find((p) => p.id === periodId) ?? null;
  const periodItems = items.filter((i) => i.periodId === periodId);
  const totalCents = periodItems.reduce((a, i) => {
    const v = parseDecimal(i.amount, 2);
    return a + (v === null ? 0 : Number(v));
  }, 0);

  if (!property) {
    return (
      <SectionCard title="Kosten & Zähler">
        <EmptyState title="Zuerst unter „Objekt & Mieter“ ein Objekt anlegen." action={<a className="btn-primary" href="#/">Zum Objekt</a>} />
      </SectionCard>
    );
  }

  const itemFor = (ct: CostType): CostItem =>
    periodItems.find((i) => i.costTypeId === ct.id) ?? {
      id: newId(),
      periodId,
      costTypeId: ct.id,
      amount: ""
    };

  const meterFor = (ct: CostType, unitId: string): MeterReading =>
    meters.find((m) => m.periodId === periodId && m.costTypeId === ct.id && m.unitId === unitId) ?? {
      id: newId(),
      periodId,
      costTypeId: ct.id,
      unitId,
      consumption: ""
    };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-slate-800">Kosten &amp; Zähler</h1>

      <SectionCard title="Abrechnungszeitraum">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Zeitraum wählen">
            <select className="select w-56" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              {periods.length === 0 ? <option value="">– noch keiner angelegt –</option> : null}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.start} – {p.end})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Neu: Bezeichnung">
            <input className="input w-28" placeholder="2025" value={newPeriod.label} onChange={(e) => setNewPeriod({ ...newPeriod, label: e.target.value })} />
          </Field>
          <Field label="Von">
            <input className="input" type="date" value={newPeriod.start} onChange={(e) => setNewPeriod({ ...newPeriod, start: e.target.value })} />
          </Field>
          <Field label="Bis">
            <input className="input" type="date" value={newPeriod.end} onChange={(e) => setNewPeriod({ ...newPeriod, end: e.target.value })} />
          </Field>
          <button
            className="btn-secondary"
            onClick={async () => {
              if (!newPeriod.label.trim() || !newPeriod.start || !newPeriod.end) {
                toast("error", "Bezeichnung, Von und Bis angeben.");
                return;
              }
              const p: Period = { id: newId(), propertyId: property.id, ...newPeriod };
              await savePeriod(p);
              setNewPeriod({ label: "", start: "", end: "" });
              await reload();
              setPeriodId(p.id);
              toast("success", `Zeitraum ${p.label} angelegt.`);
            }}
          >
            ＋ Zeitraum anlegen
          </button>
        </div>
      </SectionCard>

      {period ? (
        <>
          <SectionCard
            title={`Kosten ${period.label} · Summe ${formatCents(totalCents)} €`}
            actions={
              costTypes.length === 0 ? (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    for (const t of DEFAULT_COST_TYPES) {
                      await saveCostType({ ...t, id: newId(), propertyId: property.id });
                    }
                    await reload();
                    toast("success", "Standard-Kostenarten (§ 2 BetrKV) angelegt.");
                  }}
                >
                  Standard-Kostenarten anlegen
                </button>
              ) : undefined
            }
          >
            {costTypes.length === 0 ? (
              <EmptyState
                title="Noch keine Kostenarten."
                text="Mit einem Klick die umlagefähigen Standard-Kostenarten nach § 2 BetrKV anlegen – Beträge trägst du danach einfach ein."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {costTypes.map((ct) => {
                  const item = itemFor(ct);
                  return (
                    <div key={ct.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {ct.name}
                            {ct.isHeating ? <span className="badge-teal ml-2">HeizkostenV</span> : null}
                          </p>
                          <p className="text-xs text-slate-500">{ALLOCATION_LABELS[ct.key]}</p>
                        </div>
                        {ct.key === "direkt" ? (
                          <select
                            className="select w-44"
                            value={item.directUnitId ?? ""}
                            onChange={async (e) => {
                              await saveCostItem({ ...item, directUnitId: e.target.value || undefined });
                              await reload();
                            }}
                          >
                            <option value="">Ziel-Einheit …</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input w-32 text-right"
                            inputMode="decimal"
                            placeholder="0,00"
                            defaultValue={item.amount}
                            onBlur={async (e) => {
                              const amount = e.target.value.trim();
                              if (amount === item.amount) return;
                              if (amount === "") {
                                if (periodItems.some((i) => i.id === item.id)) {
                                  await deleteCostItem(item.id);
                                  await reload();
                                }
                                return;
                              }
                              if (parseDecimal(amount, 2) === null) {
                                toast("error", `„${amount}“ ist kein gültiger Betrag.`);
                                return;
                              }
                              await saveCostItem({ ...item, amount });
                              await reload();
                            }}
                          />
                          <span className="text-sm text-slate-500">€</span>
                        </div>
                      </div>
                      {(ct.key === "verbrauch" || ct.isHeating) && units.length > 0 ? (
                        <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3">
                          {units.map((u) => {
                            const m = meterFor(ct, u.id);
                            return (
                              <label key={u.id} className="flex items-center gap-2 text-xs text-slate-600">
                                <span className="w-24 shrink-0 truncate">{u.label}</span>
                                <input
                                  className="input py-1 text-right text-xs"
                                  inputMode="decimal"
                                  placeholder={`Verbrauch${ct.meterUnit ? ` (${ct.meterUnit})` : ""}`}
                                  defaultValue={m.consumption}
                                  onBlur={async (e) => {
                                    const consumption = e.target.value.trim();
                                    if (consumption === m.consumption) return;
                                    await saveMeter({ ...m, consumption });
                                    await reload();
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Beträge = umlagefähige Jahreskosten laut Belegen. Nicht umlagefähig (z. B. Verwaltung,
              Instandhaltung) gehört nicht in die Abrechnung.
            </p>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
