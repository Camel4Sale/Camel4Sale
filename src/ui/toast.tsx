import { useEffect, useState } from "react";

export interface ToastMessage {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(kind: ToastMessage["kind"], text: string): void {
  const msg: ToastMessage = { id: nextId++, kind, text };
  for (const l of listeners) l(msg);
}

export function Toasts() {
  const [items, setItems] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const listener: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 4500);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  if (items.length === 0) return null;
  const styles: Record<ToastMessage["kind"], string> = {
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    error: "border-red-300 bg-red-50 text-red-900",
    info: "border-slate-300 bg-white text-slate-800"
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-lg border px-3.5 py-2.5 text-sm shadow-md ${styles[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
