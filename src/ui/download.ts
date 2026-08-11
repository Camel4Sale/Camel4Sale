/** Datei-Download aus dem Browser heraus (alles bleibt lokal). */

export function downloadBlob(data: BlobPart, fileName: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadXml(xml: string, fileName: string): void {
  downloadBlob(xml, fileName, "application/xml");
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  downloadBlob(bytes as unknown as BlobPart, fileName, "application/pdf");
}

export function downloadJson(json: string, fileName: string): void {
  downloadBlob(json, fileName, "application/json");
}
