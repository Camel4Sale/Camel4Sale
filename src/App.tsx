import { useEffect, useState } from "react";
import { Toasts } from "./ui/toast";
import { ObjektePage } from "./ui/pages/Objekte";
import { KostenPage } from "./ui/pages/Kosten";
import { AbrechnungPage } from "./ui/pages/Abrechnung";
import { SettingsPage } from "./ui/pages/Settings";
import { APP_NAME, APP_VERSION } from "./config";

type Page = "objekte" | "kosten" | "abrechnung" | "einstellungen";

function parseHash(): Page {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("kosten")) return "kosten";
  if (h.startsWith("abrechnung")) return "abrechnung";
  if (h.startsWith("einstellungen")) return "einstellungen";
  return "objekte";
}

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5 px-1">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3 3 14h4v13h18V14h4L16 3z" fill="#0f766e" />
        <rect x="12" y="18" width="8" height="9" rx="1" fill="#99f6e4" />
        <circle cx="23" cy="23" r="7.5" fill="#14b8a6" />
        <path d="M19.8 23.2l2.1 2.1 3.9-4.2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-bold tracking-tight text-slate-800">
        Nebenkosten <span className="text-teal-700">Studio</span>
      </span>
    </a>
  );
}

const NAV: { hash: string; label: string; page: Page }[] = [
  { hash: "#/", label: "Objekt & Mieter", page: "objekte" },
  { hash: "#/kosten", label: "Kosten & Zähler", page: "kosten" },
  { hash: "#/abrechnung", label: "Abrechnung", page: "abrechnung" },
  { hash: "#/einstellungen", label: "Einstellungen", page: "einstellungen" }
];

export function App() {
  const [page, setPage] = useState<Page>(parseHash());
  useEffect(() => {
    const onChange = () => setPage(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 sm:flex">
        <Logo />
        <nav className="mt-6 flex flex-col gap-1" aria-label="Hauptnavigation">
          {NAV.map((item) => (
            <a
              key={item.hash}
              href={item.hash}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                page === item.page
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto px-3 pt-6 text-xs text-slate-400">
          <p>
            {APP_NAME} v{APP_VERSION}
          </p>
          <p className="mt-0.5">100 % lokal – keine Cloud.</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:hidden">
          <Logo />
          <nav className="flex gap-2 text-sm">
            {NAV.map((item) => (
              <a key={item.hash} href={item.hash} className="text-slate-600">
                {item.label.split(" ")[0]}
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
          {page === "objekte" && <ObjektePage />}
          {page === "kosten" && <KostenPage />}
          {page === "abrechnung" && <AbrechnungPage />}
          {page === "einstellungen" && <SettingsPage />}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
