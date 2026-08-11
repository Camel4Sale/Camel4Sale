/** PDF-Abrechnung je Mieter (A4, eine übersichtliche Seite, ggf. Folgeseiten). */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Period, Property } from "./model";
import type { SegmentResult } from "./allocation";
import { formatCents } from "./money";
import { formatDateDE } from "./dates";

const A4 = { width: 595.28, height: 841.89 };
const ML = 56.7;
const MR = 42.5;
const CW = A4.width - ML - MR;
const INK = rgb(0.13, 0.16, 0.2);
const GRAY = rgb(0.45, 0.5, 0.55);
const LIGHT = rgb(0.93, 0.95, 0.96);
const RULE = rgb(0.8, 0.84, 0.87);
const BRAND = rgb(0.06, 0.46, 0.43);

function safe(s: string): string {
  const extras = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ ";
  let out = "";
  for (const ch of s.replace(/\r\n?/g, "\n")) {
    if (ch === "\n" || ch === "\t") out += " ";
    else if (ch.charCodeAt(0) <= 0xff || extras.includes(ch)) out += ch;
    else out += "?";
  }
  return out;
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; alignRight?: number } = {}
): void {
  const font = opts.bold ? ctx.bold : ctx.font;
  const size = opts.size ?? 9;
  const str = safe(s);
  const drawX =
    opts.alignRight !== undefined ? opts.alignRight - font.widthOfTextAtSize(str, size) : x;
  ctx.page.drawText(str, { x: drawX, y, size, font, color: opts.color ?? INK });
}

function wrap(ctx: Ctx, s: string, size: number, maxWidth: number): string[] {
  const words = safe(s).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.font.widthOfTextAtSize(cand, size) <= maxWidth) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([A4.width, A4.height]);
  ctx.y = A4.height - 70;
}

export async function buildStatementPdf(
  property: Property,
  period: Period,
  result: SegmentResult
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const isVacancy = result.segment.tenancyId === null;
  doc.setTitle(`Betriebskostenabrechnung ${period.label} – ${result.segment.tenantName}`);
  doc.setAuthor(property.landlordName);
  doc.setProducer("Nebenkosten Studio");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([A4.width, A4.height]), font, bold, y: 0 };

  // Kopf rechts: Vermieter
  let y = A4.height - 60;
  text(ctx, property.landlordName, 0, y, { size: 11, bold: true, alignRight: A4.width - MR, color: BRAND });
  y -= 13;
  for (const line of [property.landlordAddress, property.landlordPhone ?? "", property.landlordEmail ?? ""]) {
    if (!line) continue;
    text(ctx, line, 0, y, { size: 8.5, color: GRAY, alignRight: A4.width - MR });
    y -= 11;
  }

  // Empfänger
  const windowTop = A4.height - 130;
  text(ctx, `${property.landlordName} · ${property.landlordAddress}`, ML, windowTop, { size: 6.8, color: GRAY });
  let ay = windowTop - 16;
  for (const line of [result.segment.tenantName, result.segment.unitLabel, `${property.street}, ${property.zip} ${property.city}`]) {
    text(ctx, line, ML, ay, { size: 10 });
    ay -= 13;
  }

  // Titel + Metadaten
  ctx.y = windowTop - 92;
  text(ctx, `Betriebskostenabrechnung ${period.label}`, ML, ctx.y, { size: 13, bold: true });
  ctx.y -= 16;
  text(
    ctx,
    `Objekt: ${property.name} · Einheit: ${result.segment.unitLabel} · Nutzungszeitraum: ${formatDateDE(result.segment.start)} – ${formatDateDE(result.segment.end)} (${result.segment.days} Tage)`,
    ML,
    ctx.y,
    { size: 8.6, color: GRAY }
  );
  ctx.y -= 8;
  text(
    ctx,
    `Abrechnungszeitraum: ${formatDateDE(period.start)} – ${formatDateDE(period.end)}`,
    ML,
    ctx.y - 3,
    { size: 8.6, color: GRAY }
  );
  ctx.y -= 26;

  // Tabellenkopf
  const col = { name: ML, basis: ML + 168, total: ML + 356, share: ML + CW };
  ctx.page.drawRectangle({ x: ML - 4, y: ctx.y - 5, width: CW + 8, height: 18, color: LIGHT });
  text(ctx, "Kostenart", col.name, ctx.y, { size: 8, bold: true });
  text(ctx, "Verteilung", col.basis, ctx.y, { size: 8, bold: true });
  text(ctx, "Gesamtkosten", 0, ctx.y, { size: 8, bold: true, alignRight: col.total });
  text(ctx, "Ihr Anteil", 0, ctx.y, { size: 8, bold: true, alignRight: col.share });
  ctx.y -= 20;

  for (const share of result.shares) {
    if (ctx.y < 200) newPage(ctx);
    text(ctx, share.costTypeName, col.name, ctx.y, { size: 9 });
    const basisLines = wrap(ctx, `${share.keyLabel} · ${share.basis}`, 7.6, 176);
    let by = ctx.y;
    for (const line of basisLines.slice(0, 2)) {
      text(ctx, line, col.basis, by, { size: 7.6, color: GRAY });
      by -= 9;
    }
    text(ctx, `${formatCents(share.totalCents)} €`, 0, ctx.y, { size: 9, alignRight: col.total });
    text(ctx, `${formatCents(share.shareCents)} €`, 0, ctx.y, { size: 9, alignRight: col.share });
    ctx.y = Math.min(ctx.y - 13, by - 4);
    ctx.page.drawLine({
      start: { x: ML - 4, y: ctx.y + 4 },
      end: { x: A4.width - MR + 4, y: ctx.y + 4 },
      thickness: 0.4,
      color: RULE
    });
    ctx.y -= 8;
  }

  // Summenblock
  if (ctx.y < 190) newPage(ctx);
  const sumLine = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    text(ctx, label, col.basis, ctx.y, { size: opts.size ?? 9.5, bold: opts.bold });
    text(ctx, value, 0, ctx.y, { size: opts.size ?? 9.5, bold: opts.bold, alignRight: col.share });
    ctx.y -= 15;
  };
  ctx.y -= 4;
  sumLine("Ihr Kostenanteil gesamt", `${formatCents(result.totalCents)} €`);
  if (!isVacancy) {
    sumLine("Geleistete Vorauszahlungen", `${formatCents(result.advanceCents)} €`);
    ctx.page.drawLine({
      start: { x: col.basis, y: ctx.y + 10 },
      end: { x: col.share, y: ctx.y + 10 },
      thickness: 0.7,
      color: INK
    });
    ctx.y -= 2;
    const balance = result.balanceCents;
    sumLine(
      balance >= 0 ? "Ihr Guthaben" : "Ihre Nachzahlung",
      `${formatCents(Math.abs(balance))} €`,
      { bold: true, size: 11.5 }
    );
  }

  // Hinweise
  ctx.y -= 10;
  const notes: string[] = [];
  if (!isVacancy) {
    const balance = result.balanceCents;
    if (balance < 0) {
      notes.push(
        `Bitte überweisen Sie die Nachzahlung von ${formatCents(Math.abs(balance))} € innerhalb von 30 Tagen${property.iban ? ` auf IBAN ${property.iban}` : ""}.`
      );
    } else if (balance > 0) {
      notes.push(
        `Ihr Guthaben von ${formatCents(balance)} € wird innerhalb von 30 Tagen erstattet bzw. mit der nächsten Miete verrechnet.`
      );
    }
    notes.push(
      "Sie haben das Recht, die zugrunde liegenden Belege einzusehen (§ 556 BGB). Vereinbaren Sie dazu gern einen Termin."
    );
  } else {
    notes.push("Interne Übersicht: Diese Anteile entfallen auf Leerstandszeiten und werden vom Eigentümer getragen.");
  }
  notes.push(
    "Erstellt mit Nebenkosten Studio – tagesgenaue Verteilung; Heiz- und Warmwasserkosten nach HeizkostenV (Verbrauchs-/Grundkostenanteil)."
  );
  for (const note of notes) {
    for (const line of wrap(ctx, note, 8.4, CW)) {
      if (ctx.y < 90) newPage(ctx);
      text(ctx, line, ML, ctx.y, { size: 8.4, color: GRAY });
      ctx.y -= 11;
    }
    ctx.y -= 4;
  }

  // Fußzeile
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const str = `Seite ${i + 1} von ${pages.length} · Betriebskostenabrechnung ${period.label} · ${property.name}`;
    p.drawText(safe(str), { x: ML, y: 60, size: 7, font, color: GRAY });
  });

  return doc.save();
}

export function statementFileName(period: Period, r: SegmentResult): string {
  const who = r.segment.tenantName.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `Nebenkostenabrechnung_${period.label}_${who}.pdf`;
}
