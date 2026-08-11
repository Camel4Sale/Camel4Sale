import { AppStateProvider, useApp } from "./ui/appstate";
import { useRoute, type Route } from "./ui/router";
import { Toasts } from "./ui/toast";
import { Dashboard } from "./ui/pages/Dashboard";
import { InvoiceEditor } from "./ui/pages/InvoiceEditor";
import { Checker } from "./ui/pages/Checker";
import { Stammdaten } from "./ui/pages/Stammdaten";
import { Settings } from "./ui/pages/Settings";
import { APP_NAME, APP_VERSION } from "./config";

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5 px-1">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="2" width="20" height="26" rx="3" fill="#0f766e" />
        <rect x="7" y="8" width="12" height="2" rx="1" fill="#99f6e4" />
        <rect x="7" y="13" width="12" height="2" rx="1" fill="#99f6e4" />
        <rect x="7" y="18" width="7" height="2" rx="1" fill="#99f6e4" />
        <circle cx="23" cy="23" r="8" fill="#14b8a6" />
        <path
          d="M19.5 23.2l2.3 2.3 4.2-4.5"
          stroke="white"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-bold tracking-tight text-slate-800">
        eRechnung <span className="text-teal-700">Studio</span>
      </span>
    </a>
  );
}

const NAV: { hash: string; label: string; icon: string; match: Route["page"][] }[] = [
  { hash: "#/", label: "Übersicht", icon: "▤", match: ["dashboard"] },
  { hash: "#/neu", label: "Neue Rechnung", icon: "＋", match: ["editor"] },
  { hash: "#/pruefen", label: "Rechnung prüfen", icon: "✓", match: ["checker"] },
  { hash: "#/stammdaten", label: "Stammdaten", icon: "☰", match: ["stammdaten"] },
  { hash: "#/einstellungen", label: "Einstellungen", icon: "⚙", match: ["settings"] }
];

function Shell() {
  const route = useRoute();
  const app = useApp();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 sm:flex">
        <Logo />
        <nav className="mt-6 flex flex-col gap-1" aria-label="Hauptnavigation">
          {NAV.map((item) => {
            const active = item.match.includes(route.page);
            return (
              <a
                key={item.hash}
                href={item.hash}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <span aria-hidden className="w-4 text-center">
                  {item.icon}
                </span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto px-3 pt-6 text-xs text-slate-400">
          <p>
            {app.licenseInfo ? (
              <span className="badge-teal">Pro-Lizenz aktiv</span>
            ) : (
              <span className="badge-gray">Kostenlose Version</span>
            )}
          </p>
          <p className="mt-2">
            {APP_NAME} v{APP_VERSION}
          </p>
          <p className="mt-0.5">100 % lokal – keine Cloud.</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:hidden">
          <Logo />
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <a key={item.hash} href={item.hash} className="btn-ghost px-2" title={item.label}>
                <span aria-hidden>{item.icon}</span>
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
          {route.page === "dashboard" && <Dashboard />}
          {route.page === "editor" && <InvoiceEditor id={route.id} key={route.id ?? "neu"} />}
          {route.page === "checker" && <Checker />}
          {route.page === "stammdaten" && <Stammdaten />}
          {route.page === "settings" && <Settings />}
        </main>
      </div>
      <Toasts />
    </div>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
