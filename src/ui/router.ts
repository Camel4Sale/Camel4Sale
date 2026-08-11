import { useEffect, useState } from "react";

export type Route =
  | { page: "dashboard" }
  | { page: "editor"; id?: string }
  | { page: "checker" }
  | { page: "stammdaten" }
  | { page: "settings" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h === "/neu") return { page: "editor" };
  if (h.startsWith("/rechnung/")) return { page: "editor", id: decodeURIComponent(h.slice(10)) };
  if (h === "/pruefen") return { page: "checker" };
  if (h === "/stammdaten") return { page: "stammdaten" };
  if (h === "/einstellungen") return { page: "settings" };
  return { page: "dashboard" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(hash: string): void {
  if (location.hash === hash) return;
  location.hash = hash;
}
