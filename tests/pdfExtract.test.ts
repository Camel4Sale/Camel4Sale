import { describe, expect, it } from "vitest";
import { AFRelationship, PDFDocument } from "pdf-lib";
import { extractEmbeddedXml, looksLikePdf } from "../src/core/pdfExtract";

const XML = `<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><rsm:ExchangedDocument><ram:ID xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">ZF-1</ram:ID></rsm:ExchangedDocument></rsm:CrossIndustryInvoice>`;

async function makePdfWithAttachment(fileName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  await doc.attach(new TextEncoder().encode(XML), fileName, {
    mimeType: "text/xml",
    description: "Factur-X",
    creationDate: new Date("2026-08-11"),
    modificationDate: new Date("2026-08-11"),
    afRelationship: AFRelationship.Alternative
  });
  return doc.save();
}

describe("ZUGFeRD-Extraktion", () => {
  it("extrahiert factur-x.xml aus einem PDF", async () => {
    const pdf = await makePdfWithAttachment("factur-x.xml");
    const result = await extractEmbeddedXml(pdf);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("factur-x.xml");
    expect(result!.xml).toContain("CrossIndustryInvoice");
    expect(result!.xml).toContain("ZF-1");
  });

  it("findet auch abweichend benannte XML-Anhänge", async () => {
    const pdf = await makePdfWithAttachment("rechnung_2026.xml");
    const result = await extractEmbeddedXml(pdf);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("rechnung_2026.xml");
  });

  it("liefert null für PDFs ohne Anhang", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const pdf = await doc.save();
    expect(await extractEmbeddedXml(pdf)).toBeNull();
  });

  it("looksLikePdf", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const pdf = await doc.save();
    expect(looksLikePdf(pdf)).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("<?xml version=\"1.0\"?>"))).toBe(false);
  });
});
