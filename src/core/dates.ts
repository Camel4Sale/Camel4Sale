/** Datums-Helfer (ISO yyyy-mm-dd). Tagesgenaue Zeitraum-Arithmetik, Enden inklusiv. */

export function isValidISODate(s: string | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Tage im Zeitraum, beide Enden inklusiv (01.01.–31.12.2025 = 365). */
export function daysInclusive(startISO: string, endISO: string): number {
  return Math.round((toUTC(endISO) - toUTC(startISO)) / 86_400_000) + 1;
}

/** Überlappung zweier inklusiver Zeiträume in Tagen (0 wenn keine). */
export function overlapDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): { days: number; start: string; end: string } | null {
  const start = compareISO(aStart, bStart) >= 0 ? aStart : bStart;
  const end = compareISO(aEnd, bEnd) <= 0 ? aEnd : bEnd;
  if (compareISO(start, end) > 0) return null;
  return { days: daysInclusive(start, end), start, end };
}

export function addDaysISO(iso: string, days: number): string {
  const t = new Date(toUTC(iso) + days * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate()
  ).padStart(2, "0")}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function formatDateDE(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export interface MonthSegment {
  year: number;
  month: number; // 1-basiert
  daysInMonth: number;
  overlapDays: number;
}

/** Zerlegt einen inklusiven Zeitraum in Kalendermonats-Segmente (für anteilige Monatsbeträge). */
export function monthSegments(startISO: string, endISO: string): MonthSegment[] {
  const out: MonthSegment[] = [];
  let [y, m] = [Number(startISO.slice(0, 4)), Number(startISO.slice(5, 7))];
  const endY = Number(endISO.slice(0, 4));
  const endM = Number(endISO.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    const ov = overlapDays(startISO, endISO, monthStart, monthEnd);
    if (ov) out.push({ year: y, month: m, daysInMonth: dim, overlapDays: ov.days });
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
