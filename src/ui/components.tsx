import type { ReactNode } from "react";
import type { Finding } from "../core/rules";

export function Field(props: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  // <label> umschließt das Eingabefeld (implizite Zuordnung für Screenreader).
  return (
    <label className={`block ${props.className ?? ""}`}>
      <span className="label">
        {props.label}
        {props.required ? <span className="text-red-600"> *</span> : null}
      </span>
      {props.children}
      {props.hint ? <span className="mt-1 block text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

export function SectionCard(props: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{props.title}</h2>
        {props.actions}
      </div>
      <div className="p-5">{props.children}</div>
    </section>
  );
}

export function EmptyState(props: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{props.title}</p>
      {props.text ? <p className="max-w-md text-sm text-slate-500">{props.text}</p> : null}
      {props.action ? <div className="mt-2">{props.action}</div> : null}
    </div>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-md p-5">
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-2 text-sm text-slate-600">{props.text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={props.onCancel}>
            Abbrechen
          </button>
          <button
            className={props.danger ? "btn-danger" : "btn-primary"}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const severityStyle: Record<Finding["severity"], { badge: string; label: string }> = {
  error: { badge: "badge-red", label: "Fehler" },
  warning: { badge: "badge-amber", label: "Hinweis" },
  info: { badge: "badge-gray", label: "Info" }
};

export function FindingsList(props: { findings: Finding[]; emptyText?: string }) {
  if (props.findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <span aria-hidden>✓</span>
        {props.emptyText ?? "Keine Probleme gefunden."}
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {props.findings.map((f, i) => (
        <li
          key={`${f.id}-${i}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
        >
          <div className="flex items-start gap-2">
            <span className={severityStyle[f.severity].badge}>
              {severityStyle[f.severity].label}
            </span>
            <div className="min-w-0">
              <p className="text-slate-800">{f.message}</p>
              {f.hint ? <p className="mt-0.5 text-xs text-slate-500">{f.hint}</p> : null}
            </div>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{f.id}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatBox(props: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <p className={`mt-1 text-xl font-semibold ${props.accent ? "text-teal-700" : "text-slate-800"}`}>
        {props.value}
      </p>
    </div>
  );
}
