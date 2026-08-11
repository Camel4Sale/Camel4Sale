/** Minimaler deklarativer XML-Writer mit strikter Element-Reihenfolge. */

export interface XmlNode {
  n: string; // qualifizierter Name, z. B. "cbc:ID"
  a?: Record<string, string | undefined>;
  c?: (XmlNode | null | undefined)[] | string;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderNode(node: XmlNode, indent: number, out: string[]): void {
  const pad = "  ".repeat(indent);
  let attrs = "";
  if (node.a) {
    for (const [k, v] of Object.entries(node.a)) {
      if (v !== undefined) attrs += ` ${k}="${esc(v)}"`;
    }
  }
  if (node.c === undefined || (Array.isArray(node.c) && node.c.length === 0)) {
    out.push(`${pad}<${node.n}${attrs}/>`);
    return;
  }
  if (typeof node.c === "string") {
    out.push(`${pad}<${node.n}${attrs}>${esc(node.c)}</${node.n}>`);
    return;
  }
  const children = node.c.filter((x): x is XmlNode => x != null);
  if (children.length === 0) {
    out.push(`${pad}<${node.n}${attrs}/>`);
    return;
  }
  out.push(`${pad}<${node.n}${attrs}>`);
  for (const child of children) renderNode(child, indent + 1, out);
  out.push(`${pad}</${node.n}>`);
}

export function renderXml(root: XmlNode): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  renderNode(root, 0, out);
  return out.join("\n") + "\n";
}

/** Kurzform für Elemente. */
export function el(
  n: string,
  c?: XmlNode["c"],
  a?: XmlNode["a"]
): XmlNode {
  return { n, c, a };
}
