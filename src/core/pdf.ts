/**
 * Erzeugt die menschenlesbare PDF-Sichtkopie einer Rechnung (DIN-5008-Anmutung).
 *
 * Hinweis: Die PDF ist eine Zweitschrift für Menschen – das rechtlich
 * maßgebliche strukturierte Format ist die XRechnung-XML. Ein hybrides
 * ZUGFeRD-PDF (PDF/A-3 mit eingebettetem XML) steht auf der Roadmap (v1.1).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Invoice } from "./model";
import { unitLabel } from "./model";
import type { Totals } from "./totals";
import { formatCents, formatScaledDE } from "./money";
import { formatDateDE } from "./dates";
import { formatIban } from "./iban";
import { skontoAmountCents } from "./skonto";
import { parseDecimal } from "./money";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_L = 56.7; // 20 mm
const MARGIN_R = 42.5; // 15 mm
const CONTENT_W = A4.width - MARGIN_L - MARGIN_R;

const INK = rgb(0.13, 0.16, 0.2);
const GRAY = rgb(0.45, 0.5, 0.55);
const LIGHT = rgb(0.93, 0.95, 0.96);
const RULE = rgb(0.8, 0.84, 0.87);
const BRAND = rgb(0.06, 0.46, 0.43);

/** Zeichen außerhalb von WinAnsi (CP1252) ersetzen, damit Helvetica nicht wirft. */
function safe(s: string): string {
  const extras = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ ";
  let out = "";
  for (const ch of s.replace(/\r\n?/g, "\n")) {
    if (ch === "\n" || ch === "\t") {
      out += " ";
    } else if (ch.charCodeAt(0) <= 0xff || extras.includes(ch)) {
      out += ch;
    } else {
      out += "?";
    }
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Überlange Einzelwörter hart umbrechen
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNo: number;
  inv: Invoice;
  totals: Totals;
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
  let drawX = x;
  if (opts.alignRight !== undefined) {
    drawX = opts.alignRight - font.widthOfTextAtSize(str, size);
  }
  ctx.page.drawText(str, { x: drawX, y, size, font, color: opts.color ?? INK });
}

function footer(ctx: Ctx): void {
  const s = ctx.inv.seller;
  const yTop = 88;
  ctx.page.drawLine({
    start: { x: MARGIN_L, y: yTop },
    end: { x: A4.width - MARGIN_R, y: yTop },
    thickness: 0.5,
    color: RULE
  });
  const size = 6.8;
  const col = (lines: string[], x: number) => {
    let y = yTop - 12;
    for (const line of lines.filter(Boolean)) {
      text(ctx, line, x, y, { size, color: GRAY });
      y -= 9;
    }
  };
  col(
    [s.name, s.legalForm ?? "", `${s.street}, ${s.zip} ${s.city}`, s.registerInfo ?? ""],
    MARGIN_L
  );
  col(
    ["Kontakt", s.contactName, s.phone, s.email],
    MARGIN_L + 200
  );
  col(
    [
      "Bankverbindung",
      `IBAN ${formatIban(s.iban)}`,
      s.bic ? `BIC ${s.bic}${s.bankLabel ? ` (${s.bankLabel})` : ""}` : (s.bankLabel ?? ""),
      s.vatId ? `USt-IdNr. ${s.vatId}` : s.taxNumber ? `Steuernr. ${s.taxNumber}` : ""
    ],
    MARGIN_L + 330
  );
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([A4.width, A4.height]);
  ctx.pageNo += 1;
  ctx.y = A4.height - 70;
  footer(ctx);
  text(ctx, `${docTitle(ctx.inv)} ${ctx.inv.number ?? "(Entwurf)"} – Fortsetzung`, MARGIN_L, ctx.y, {
    size: 9,
    color: GRAY
  });
  ctx.y -= 26;
}

function docTitle(inv: Invoice): string {
  return inv.typeCode === 384 ? "Rechnungskorrektur" : "Rechnung";
}

const COLS = {
  pos: { x: MARGIN_L, w: 24 },
  name: { x: MARGIN_L + 28, w: 194 },
  qty: { right: MARGIN_L + 262 },
  unit: { x: MARGIN_L + 268, w: 44 },
  price: { right: MARGIN_L + 382 },
  vat: { right: MARGIN_L + 420 },
  total: { right: MARGIN_L + CONTENT_W }
};

function tableHeader(ctx: Ctx): void {
  ctx.page.drawRectangle({
    x: MARGIN_L - 4,
    y: ctx.y - 5,
    width: CONTENT_W + 8,
    height: 18,
    color: LIGHT
  });
  const size = 8;
  const o = { size, bold: true as const };
  text(ctx, "Pos.", COLS.pos.x, ctx.y, o);
  text(ctx, "Bezeichnung", COLS.name.x, ctx.y, o);
  text(ctx, "Menge", 0, ctx.y, { ...o, alignRight: COLS.qty.right });
  text(ctx, "Einheit", COLS.unit.x, ctx.y, o);
  text(ctx, "Einzelpreis", 0, ctx.y, { ...o, alignRight: COLS.price.right });
  text(ctx, "USt", 0, ctx.y, { ...o, alignRight: COLS.vat.right });
  text(ctx, "Betrag (netto)", 0, ctx.y, { ...o, alignRight: COLS.total.right });
  ctx.y -= 22;
}

export async function buildInvoicePdf(inv: Invoice, totals: Totals): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${docTitle(inv)} ${inv.number ?? "Entwurf"}`);
  doc.setAuthor(inv.seller.name);
  doc.setProducer("eRechnung Studio");
  doc.setCreator("eRechnung Studio");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.width, A4.height]);
  const ctx: Ctx = { doc, page, font, bold, y: 0, pageNo: 1, inv, totals };
  const s = inv.seller;
  const b = inv.buyer;

  footer(ctx);

  // Kopf: Absender rechts
  let y = A4.height - 60;
  text(ctx, s.name, 0, y, { size: 12, bold: true, alignRight: A4.width - MARGIN_R, color: BRAND });
  y -= 15;
  for (const line of [`${s.street}`, `${s.zip} ${s.city}`, s.phone, s.email]) {
    if (!line) continue;
    text(ctx, line, 0, y, { size: 8.5, color: GRAY, alignRight: A4.width - MARGIN_R });
    y -= 11;
  }

  // Anschriftfeld (DIN: ca. 45 mm von oben)
  const windowTop = A4.height - 130;
  text(ctx, `${s.name} · ${s.street} · ${s.zip} ${s.city}`, MARGIN_L, windowTop, {
    size: 6.8,
    color: GRAY
  });
  let ay = windowTop - 16;
  for (const line of [b.name, b.street, `${b.zip} ${b.city}`, b.countryCode !== "DE" ? b.countryCode : ""]) {
    if (!line) continue;
    text(ctx, line, MARGIN_L, ay, { size: 10 });
    ay -= 13;
  }

  // Infoblock rechts
  const infoX = A4.width - MARGIN_R - 190;
  let iy = windowTop - 4;
  const info: [string, string][] = [];
  info.push([`${docTitle(inv)}s-Nr.`, inv.number ?? "(Entwurf)"]);
  info.push(["Datum", formatDateDE(inv.issueDate)]);
  if (inv.dueDate) info.push(["Fällig am", formatDateDE(inv.dueDate)]);
  if (inv.deliveryDate) info.push(["Leistungsdatum", formatDateDE(inv.deliveryDate)]);
  if (inv.periodStart || inv.periodEnd)
    info.push([
      "Leistungszeitraum",
      `${formatDateDE(inv.periodStart)} – ${formatDateDE(inv.periodEnd)}`
    ]);
  if (b.customerNumber) info.push(["Kundennummer", b.customerNumber]);
  info.push(["Referenz (BT-10)", inv.buyerReference]);
  if (inv.orderReference) info.push(["Bestellnummer", inv.orderReference]);
  if (s.vatId) info.push(["USt-IdNr.", s.vatId]);
  else if (s.taxNumber) info.push(["Steuernummer", s.taxNumber]);
  for (const [label, value] of info) {
    text(ctx, label, infoX, iy, { size: 7.8, color: GRAY });
    text(ctx, value, 0, iy, { size: 8.6, alignRight: A4.width - MARGIN_R });
    iy -= 12.5;
  }

  // Titel
  ctx.y = Math.min(windowTop - 90, iy - 26);
  text(ctx, `${docTitle(inv)} Nr. ${inv.number ?? "(Entwurf)"}`, MARGIN_L, ctx.y, {
    size: 13,
    bold: true
  });
  ctx.y -= 14;
  if (inv.typeCode === 384 && inv.precedingInvoiceNumber) {
    text(
      ctx,
      `zur Rechnung Nr. ${inv.precedingInvoiceNumber}${
        inv.precedingInvoiceDate ? ` vom ${formatDateDE(inv.precedingInvoiceDate)}` : ""
      }`,
      MARGIN_L,
      ctx.y,
      { size: 9, color: GRAY }
    );
    ctx.y -= 14;
  }
  ctx.y -= 8;

  // Positionstabelle
  tableHeader(ctx);
  totals.lines.forEach((c, i) => {
    const nameLines = wrap(c.line.name, bold, 9, COLS.name.w);
    const descLines = c.line.description
      ? wrap(c.line.description, font, 7.8, COLS.name.w)
      : [];
    const rowHeight = nameLines.length * 11 + descLines.length * 9.5 + 8;
    if (ctx.y - rowHeight < 130) {
      newPage(ctx);
      tableHeader(ctx);
    }
    const yStart = ctx.y;
    text(ctx, String(i + 1), COLS.pos.x, yStart, { size: 9 });
    let ny = yStart;
    for (const line of nameLines) {
      text(ctx, line, COLS.name.x, ny, { size: 9, bold: true });
      ny -= 11;
    }
    for (const line of descLines) {
      text(ctx, line, COLS.name.x, ny, { size: 7.8, color: GRAY });
      ny -= 9.5;
    }
    const qty = parseDecimal(c.line.quantity, 4);
    text(ctx, qty !== null ? formatScaledDE(qty, 4) : c.line.quantity, 0, yStart, {
      size: 9,
      alignRight: COLS.qty.right
    });
    text(ctx, unitLabel(c.line.unitCode), COLS.unit.x, yStart, { size: 9 });
    const price = parseDecimal(c.line.unitPrice, 4);
    text(ctx, price !== null ? `${formatScaledDE(price, 4)} €` : c.line.unitPrice, 0, yStart, {
      size: 9,
      alignRight: COLS.price.right
    });
    text(
      ctx,
      c.line.taxCategory === "S" ? `${formatScaledDE(c.pctE2, 2)} %` : "0 %",
      0,
      yStart,
      { size: 9, alignRight: COLS.vat.right }
    );
    text(ctx, `${formatCents(c.netCents)} €`, 0, yStart, { size: 9, alignRight: COLS.total.right });
    ctx.y = ny - 6;
    ctx.page.drawLine({
      start: { x: MARGIN_L - 4, y: ctx.y + 3 },
      end: { x: A4.width - MARGIN_R + 4, y: ctx.y + 3 },
      thickness: 0.4,
      color: RULE
    });
    ctx.y -= 8;
  });

  // Summenblock
  if (ctx.y < 210) newPage(ctx);
  const sumLabelX = MARGIN_L + 250;
  const sumRight = COLS.total.right;
  ctx.y -= 4;
  const sumLine = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    text(ctx, label, sumLabelX, ctx.y, { size: opts.size ?? 9, bold: opts.bold });
    text(ctx, value, 0, ctx.y, { size: opts.size ?? 9, bold: opts.bold, alignRight: sumRight });
    ctx.y -= 14;
  };
  sumLine("Summe (netto)", `${formatCents(totals.taxExclusiveCents)} €`);
  for (const entry of totals.breakdown) {
    if (entry.category === "S") {
      sumLine(
        `zzgl. ${formatScaledDE(entry.percentE2, 2)} % USt auf ${formatCents(entry.taxableCents)} €`,
        `${formatCents(entry.taxCents)} €`
      );
    }
  }
  ctx.page.drawLine({
    start: { x: sumLabelX, y: ctx.y + 9 },
    end: { x: sumRight, y: ctx.y + 9 },
    thickness: 0.7,
    color: INK
  });
  ctx.y -= 2;
  sumLine("Gesamtbetrag", `${formatCents(totals.taxInclusiveCents)} €`, { bold: true, size: 10.5 });

  // Hinweise
  ctx.y -= 8;
  const noteWidth = CONTENT_W;
  const writeNote = (note: string, color = INK, size = 8.6) => {
    for (const line of wrap(note, font, size, noteWidth)) {
      if (ctx.y < 110) newPage(ctx);
      text(ctx, line, MARGIN_L, ctx.y, { size, color });
      ctx.y -= 11.5;
    }
    ctx.y -= 3;
  };
  for (const entry of totals.breakdown) {
    if (entry.category !== "S" && entry.category !== "Z" && entry.exemptionReason) {
      writeNote(entry.exemptionReason, GRAY);
    }
  }
  if (inv.dueDate) {
    writeNote(
      `Zahlbar ohne Abzug bis ${formatDateDE(inv.dueDate)}. Bitte geben Sie bei der Überweisung die ${docTitle(inv)}s-Nr. ${inv.number ?? ""} an.`
    );
  }
  for (const sk of inv.skonto) {
    const pct = parseDecimal(sk.percent, 2);
    if (pct !== null) {
      const reduced = totals.payableCents - skontoAmountCents(totals.payableCents, pct);
      writeNote(
        `Bei Zahlung innerhalb von ${sk.days} Tagen gewähren wir ${formatScaledDE(pct, 2)} % Skonto: Zahlbetrag dann ${formatCents(reduced)} €.`
      );
    }
  }
  if (inv.paymentTermsText?.trim()) writeNote(inv.paymentTermsText.trim());
  if (inv.note?.trim()) writeNote(inv.note.trim());
  writeNote(
    `Überweisung bitte auf: IBAN ${formatIban(s.iban)}${s.bic ? `, BIC ${s.bic}` : ""}${
      s.bankLabel ? ` (${s.bankLabel})` : ""
    }, Kontoinhaber: ${s.accountHolder?.trim() || s.name}.`,
    GRAY
  );

  // Seitenzahlen
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const str = `Seite ${i + 1} von ${pages.length}`;
    p.drawText(str, {
      x: A4.width - MARGIN_R - font.widthOfTextAtSize(str, 7),
      y: 74,
      size: 7,
      font,
      color: GRAY
    });
  });

  return doc.save();
}

export function pdfFileName(inv: Invoice): string {
  const num = (inv.number ?? "Entwurf").replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${num}_Rechnung.pdf`;
}
