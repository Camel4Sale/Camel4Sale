/**
 * Extrahiert eingebettete E-Rechnungs-XMLs aus PDF-Dateien
 * (ZUGFeRD 2.x / Factur-X / XRechnung-Hybrid).
 *
 * Sucht in zwei Quellen:
 *   1. Namensbaum  /Catalog → /Names → /EmbeddedFiles
 *   2. /AF-Array   (Associated Files, PDF/A-3-üblich)
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream
} from "pdf-lib";

export interface EmbeddedXml {
  fileName: string;
  xml: string;
}

const KNOWN_NAMES = [
  "factur-x.xml",
  "zugferd-invoice.xml",
  "xrechnung.xml",
  "order-x.xml",
  "cii.xml"
];

function decodeUtf8(bytes: Uint8Array): string {
  let view = bytes;
  if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
    view = view.subarray(3);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(view);
}

export async function extractEmbeddedXml(
  pdfBytes: Uint8Array | ArrayBuffer
): Promise<EmbeddedXml | null> {
  const doc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
    throwOnInvalidObject: false
  });
  const catalog = doc.catalog;
  const candidates: { name: string; bytes: Uint8Array }[] = [];
  const seen = new Set<unknown>();

  const collectFileSpec = (specRaw: unknown): void => {
    const spec = specRaw instanceof PDFDict ? specRaw : undefined;
    if (!spec || seen.has(spec)) return;
    seen.add(spec);
    const nameObj = spec.lookup(PDFName.of("UF")) ?? spec.lookup(PDFName.of("F"));
    let name = "";
    if (nameObj instanceof PDFString || nameObj instanceof PDFHexString) {
      name = nameObj.decodeText();
    }
    const ef = spec.lookup(PDFName.of("EF"));
    if (!(ef instanceof PDFDict)) return;
    const stream = ef.lookup(PDFName.of("F")) ?? ef.lookup(PDFName.of("UF"));
    if (stream instanceof PDFRawStream) {
      try {
        candidates.push({ name, bytes: decodePDFRawStream(stream).decode() });
      } catch {
        // defekter Stream – überspringen
      }
    }
  };

  const walkNameTree = (nodeRaw: unknown): void => {
    const node = nodeRaw instanceof PDFDict ? nodeRaw : undefined;
    if (!node || seen.has(node)) return;
    seen.add(node);
    const names = node.lookup(PDFName.of("Names"));
    if (names instanceof PDFArray) {
      for (let i = 1; i < names.size(); i += 2) {
        collectFileSpec(names.lookup(i));
      }
    }
    const kids = node.lookup(PDFName.of("Kids"));
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) walkNameTree(kids.lookup(i));
    }
  };

  const namesDict = catalog.lookup(PDFName.of("Names"));
  if (namesDict instanceof PDFDict) {
    walkNameTree(namesDict.lookup(PDFName.of("EmbeddedFiles")));
  }
  const af = catalog.lookup(PDFName.of("AF"));
  if (af instanceof PDFArray) {
    for (let i = 0; i < af.size(); i++) collectFileSpec(af.lookup(i));
  }

  if (candidates.length === 0) return null;

  const lower = (s: string) => s.toLowerCase();
  const byKnownName = candidates.find((c) => KNOWN_NAMES.includes(lower(c.name)));
  const byExtension = candidates.find((c) => lower(c.name).endsWith(".xml"));
  const byContent = candidates.find((c) => decodeUtf8(c.bytes).trimStart().startsWith("<"));
  const best = byKnownName ?? byExtension ?? byContent;
  if (!best) return null;
  return { fileName: best.name || "eingebettet.xml", xml: decodeUtf8(best.bytes) };
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  // %PDF- am Dateianfang (BOM/Whitespace tolerieren)
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}
