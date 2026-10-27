import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { XMLNS, SCHEMA_LOCATION, CODELIST_GEONODE_BASE_URL } from "./constants";
import { normalizeDateValue } from "../metadata-schema";
import { stableKey } from "../value-utils";

export function createXmlDocument(xmlString?: string): Document {
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg) => {
        if (msg.includes("unclosed") || msg.includes("unexpected")) {
          console.warn("DOMParser error:", msg);
        }
      },
      fatalError: (msg) => {
        throw new Error(`Gagal mem-parsing XML: ${msg}`);
      },
    },
  });

  if (!xmlString) {
    const skeleton = `<?xml version="1.0" encoding="UTF-8"?>
<gmd:MD_Metadata xmlns:gmd="${XMLNS.GMD}" xmlns:gco="${XMLNS.GCO}" xmlns:gmx="${XMLNS.GMX}" xmlns:gml="${XMLNS.GML}" xmlns:xlink="${XMLNS.XLINK}" xmlns:xsi="${XMLNS.XSI}" xsi:schemaLocation="${SCHEMA_LOCATION}">
</gmd:MD_Metadata>`;
    return parser.parseFromString(skeleton, "text/xml");
  }

  // BOM UTF-8 di awal file (umum pada unduhan GeoNode) akan terbaca sebagai node teks oleh xmldom.
  return parser.parseFromString(xmlString.replace(/^﻿/, ""), "text/xml");
}

export function serializeXmlDocument(node: Node): string {
  const serializer = new XMLSerializer();
  // Deklarasi XML selalu ditulis ulang satu kali dengan encoding UTF-8 yang pasti.
  const body = serializer
    .serializeToString(node)
    .replace(/^﻿/, "")
    .replace(/^\s*<\?xml[^?]*\?>\s*/, "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

export function unwrapCswAndHoistNamespaces(doc: Document): {
  doc: Document;
  rootMetadata: Element;
} {
  const root = doc.documentElement;
  const rootName = root.localName || root.nodeName;

  if (rootName === "GetRecordByIdResponse" || rootName.endsWith(":GetRecordByIdResponse")) {
    let mdNode: Element | null = null;
    for (let i = 0; i < root.childNodes.length; i++) {
      const child = root.childNodes[i];
      if (child.nodeType === 1) {
        const elem = child as Element;
        const name = elem.localName || elem.nodeName;
        if (name === "MD_Metadata" || name.endsWith(":MD_Metadata")) {
          mdNode = elem;
          break;
        }
      }
    }

    if (!mdNode) {
      throw new Error("Elemen '<gmd:MD_Metadata>' tidak ditemukan di dalam respons CSW.");
    }

    // Hoist relevant namespaces from CSW root to gmd:MD_Metadata
    const prefixes = ["xmlns:gmd", "xmlns:gco", "xmlns:gml", "xmlns:gml32", "xmlns:gmx", "xmlns:xlink", "xmlns:xsi"];
    for (const p of prefixes) {
      const uri = root.getAttribute(p);
      if (uri) {
        mdNode.setAttributeNS("http://www.w3.org/2000/xmlns/", p, uri);
      }
    }

    // Ensure xsi:schemaLocation is set on MD_Metadata
    if (!mdNode.hasAttribute("xsi:schemaLocation")) {
      mdNode.setAttribute("xsi:schemaLocation", SCHEMA_LOCATION);
    }

    // Remove CSW root and set mdNode as the document element
    doc.removeChild(root);
    doc.appendChild(mdNode);

    return { doc, rootMetadata: mdNode };
  }

  return { doc, rootMetadata: root };
}

export function insertInCanonicalOrder(parentNode: Element, newNode: Element, canonicalSequence: string[]): void {
  const targetTag = newNode.nodeName;
  const targetIndex = canonicalSequence.indexOf(targetTag);

  if (targetIndex === -1) {
    parentNode.appendChild(newNode);
    return;
  }

  const children = Array.from(parentNode.childNodes).filter((n) => n.nodeType === 1) as Element[];

  for (const child of children) {
    const childTag = child.nodeName;
    const childIndex = canonicalSequence.indexOf(childTag);

    if (childIndex > targetIndex) {
      parentNode.insertBefore(newNode, child);
      return;
    }
  }

  parentNode.appendChild(newNode);
}

/* ------------------------------------------------------------------ */
/* Navigasi                                                            */
/* ------------------------------------------------------------------ */

export function childElements(parent: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === 1) result.push(child as Element);
  }
  return result;
}

export function findDirectChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === 1 && (child as Element).nodeName === tagName) {
      return child as Element;
    }
  }
  return null;
}

export function findDirectChildren(parent: Element, tagName: string): Element[] {
  return childElements(parent).filter((c) => c.nodeName === tagName);
}

/** Mengikuti rantai tag langsung, mis. ["gmd:citation", "gmd:CI_Citation"]. */
export function findPath(parent: Element | null, tags: string[]): Element | null {
  let current: Element | null = parent;
  for (const tag of tags) {
    if (!current) return null;
    current = findDirectChild(current, tag);
  }
  return current;
}

/** Anak langsung berdasarkan localName, untuk elemen GML yang prefiksnya bisa gml atau gml32. */
export function findChildByLocalName(parent: Element, localName: string): Element | null {
  return childElements(parent).find((c) => (c.localName || c.nodeName.split(":").pop()) === localName) ?? null;
}

export function findDescendantByLocalName(parent: Element, localName: string): Element | null {
  for (const child of childElements(parent)) {
    if ((child.localName || child.nodeName.split(":").pop()) === localName) return child;
    const nested = findDescendantByLocalName(child, localName);
    if (nested) return nested;
  }
  return null;
}

export function getTextContent(element: Element | null): string {
  if (!element) return "";
  return (element.textContent || "").trim();
}

export function findNestedText(parent: Element, childTags: string[]): string {
  return getTextContent(findPath(parent, childTags));
}

/* ------------------------------------------------------------------ */
/* Pembaca properti ISO 19139                                          */
/* ------------------------------------------------------------------ */

/**
 * Teks nilai sebuah properti, apa pun tipe isinya: gco:CharacterString, gmx:Anchor,
 * gco:LocalName, gmd:URL, gco:Decimal, dll. Properti ber-nilReason dibaca kosong.
 */
export function readValue(prop: Element | null): string {
  if (!prop) return "";
  const first = childElements(prop)[0];
  return getTextContent(first ?? prop);
}

export function readProp(parent: Element | null, tag: string): string {
  if (!parent) return "";
  return readValue(findDirectChild(parent, tag));
}

export function readProps(parent: Element | null, tag: string): string[] {
  if (!parent) return [];
  return findDirectChildren(parent, tag)
    .map((p) => readValue(p))
    .filter(Boolean);
}

/** Nilai codelist: atribut codeListValue lebih dulu, lalu teks elemennya. */
export function readCode(parent: Element | null, tag: string): string {
  if (!parent) return "";
  const prop = findDirectChild(parent, tag);
  const code = prop ? childElements(prop)[0] : null;
  if (!code) return "";
  return (code.getAttribute("codeListValue") || getTextContent(code)).trim();
}

/** Tanggal dari gco:Date atau gco:DateTime, dinormalkan ke YYYY-MM-DD. */
export function readDate(parent: Element | null, tag: string): string {
  if (!parent) return "";
  return normalizeDateValue(readProp(parent, tag));
}

/** gco:Boolean: "1"/"true" menjadi "true", "0"/"false" menjadi "false", lainnya "". */
export function readBoolean(parent: Element | null, tag: string): "" | "true" | "false" {
  const raw = readProp(parent, tag).toLowerCase();
  if (raw === "1" || raw === "true") return "true";
  if (raw === "0" || raw === "false") return "false";
  return "";
}

export function readNumber(parent: Element | null, tag: string): number | null {
  const raw = readProp(parent, tag);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Pembangun elemen                                                    */
/* ------------------------------------------------------------------ */

export function createCharacterString(doc: Document, parentTagName: string, value: string): Element {
  const parent = doc.createElement(parentTagName);
  const cs = doc.createElement("gco:CharacterString");
  cs.appendChild(doc.createTextNode(value));
  parent.appendChild(cs);
  return parent;
}

export function createCodelistElement(
  doc: Document,
  parentTagName: string,
  codeTagName: string,
  codelistName: string,
  value: string,
  codeSpace: string = "ISOTC211/19115"
): Element {
  const parent = doc.createElement(parentTagName);
  const codeElem = doc.createElement(codeTagName);
  codeElem.setAttribute("codeSpace", codeSpace);
  codeElem.setAttribute("codeList", `${CODELIST_GEONODE_BASE_URL}#${codelistName}`);
  codeElem.setAttribute("codeListValue", value);
  codeElem.appendChild(doc.createTextNode(value));
  parent.appendChild(codeElem);
  return parent;
}

/** Anak bernilai falsy (hasil `kondisi && elemen`) dilewati, agar blok opsional bisa ditulis sebaris. */
type Child = Element | null | undefined | false | "";

/** Pembangun ringkas yang terikat pada satu dokumen. */
export class XmlBuilder {
  constructor(public readonly doc: Document, public readonly gml: GmlInfo) {}

  private idCounter = 0;

  nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  el(tag: string, children: Child[] = [], attrs: Record<string, string> = {}): Element {
    const node = this.doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const child of children) if (child) node.appendChild(child);
    return node;
  }

  text(tag: string, value: string, attrs: Record<string, string> = {}): Element {
    const node = this.el(tag, [], attrs);
    node.appendChild(this.doc.createTextNode(value));
    return node;
  }

  /** Properti kosong dengan gco:nilReason="missing" untuk elemen wajib yang belum diketahui. */
  nil(tag: string): Element {
    return this.el(tag, [], { "gco:nilReason": "missing" });
  }

  cs(tag: string, value: string): Element {
    return this.el(tag, [this.text("gco:CharacterString", value)]);
  }

  /** CharacterString bila terisi, nilReason bila kosong (untuk elemen wajib). */
  csOrNil(tag: string, value: string): Element {
    return value.trim() ? this.cs(tag, value.trim()) : this.nil(tag);
  }

  /** CharacterString bila terisi, tidak ada elemen bila kosong (untuk elemen opsional). */
  csOpt(tag: string, value: string): Element | null {
    return value.trim() ? this.cs(tag, value.trim()) : null;
  }

  code(tag: string, codeTag: string, listName: string, value: string): Element {
    return createCodelistElement(this.doc, tag, codeTag, listName, value);
  }

  codeOpt(tag: string, codeTag: string, listName: string, value: string): Element | null {
    return value.trim() ? this.code(tag, codeTag, listName, value.trim()) : null;
  }

  codeOrNil(tag: string, codeTag: string, listName: string, value: string): Element {
    return value.trim() ? this.code(tag, codeTag, listName, value.trim()) : this.nil(tag);
  }

  date(tag: string, value: string, kind: "Date" | "DateTime" = "Date"): Element {
    const text = kind === "DateTime" ? `${value}T00:00:00Z` : value;
    return this.el(tag, [this.text(`gco:${kind}`, text)]);
  }

  dateOpt(tag: string, value: string, kind: "Date" | "DateTime" = "Date"): Element | null {
    return value ? this.date(tag, value, kind) : null;
  }

  bool(tag: string, value: "true" | "false"): Element {
    return this.el(tag, [this.text("gco:Boolean", value)]);
  }

  boolOpt(tag: string, value: "" | "true" | "false"): Element | null {
    return value ? this.bool(tag, value) : null;
  }

  boolOrNil(tag: string, value: "" | "true" | "false"): Element {
    return value ? this.bool(tag, value) : this.nil(tag);
  }

  number(tag: string, valueType: "Integer" | "Decimal" | "Real", value: number | null): Element | null {
    if (value === null || !Number.isFinite(value)) return null;
    return this.el(tag, [this.text(`gco:${valueType}`, String(value))]);
  }

  url(tag: string, value: string): Element {
    return this.el(tag, [this.text("gmd:URL", value)]);
  }

  gmlTag(localName: string): string {
    return `${this.gml.prefix}:${localName}`;
  }
}

/* ------------------------------------------------------------------ */
/* Namespace GML                                                       */
/* ------------------------------------------------------------------ */

export interface GmlInfo {
  prefix: string;
  is32: boolean;
}

/**
 * Memakai prefiks GML yang sudah dideklarasikan dokumen asli (SPEC 5.A).
 * Prefiks "gml" didahulukan karena itulah yang dipakai pycsw GeoNode.
 */
export function detectGmlNamespace(root: Element): GmlInfo {
  const declared: Array<{ prefix: string; uri: string }> = [];
  for (let i = 0; i < root.attributes.length; i++) {
    const attr = root.attributes[i];
    if (attr.name.startsWith("xmlns:") && attr.value.startsWith("http://www.opengis.net/gml")) {
      declared.push({ prefix: attr.name.slice(6), uri: attr.value });
    }
  }
  const chosen = declared.find((d) => d.prefix === "gml") ?? declared[0];
  if (chosen) return { prefix: chosen.prefix, is32: chosen.uri.endsWith("/3.2") };

  root.setAttribute("xmlns:gml", XMLNS.GML);
  return { prefix: "gml", is32: false };
}

/* ------------------------------------------------------------------ */
/* Sinkronisasi node: pertahankan node asli bila isinya tidak berubah  */
/* ------------------------------------------------------------------ */

function isBlankProperty(el: Element): boolean {
  return el.hasAttribute("gco:nilReason") || readValue(el) === "";
}

/**
 * Menyetel properti teks tunggal. Node asli dibiarkan utuh bila nilainya sama.
 * Bila nilai kosong: "remove" menghapus elemen opsional, "nil" menulis gco:nilReason untuk elemen wajib.
 */
export function setTextProperty(
  b: XmlBuilder,
  parent: Element,
  tag: string,
  value: string,
  sequence: string[],
  emptyMode: "remove" | "nil" = "remove"
): void {
  const existing = findDirectChild(parent, tag);
  const trimmed = value.trim();

  if (!trimmed) {
    if (emptyMode === "nil") {
      if (existing?.hasAttribute("gco:nilReason")) return;
      replaceOrInsert(parent, existing, b.nil(tag), sequence);
    } else if (existing) parent.removeChild(existing);
    return;
  }

  if (existing && !isBlankProperty(existing) && readValue(existing) === trimmed) return;
  replaceOrInsert(parent, existing, b.cs(tag, trimmed), sequence);
}

/** Menyetel properti codelist tunggal. */
export function setCodeProperty(
  b: XmlBuilder,
  parent: Element,
  tag: string,
  codeTag: string,
  listName: string,
  value: string,
  sequence: string[],
  emptyMode: "remove" | "nil" = "remove"
): void {
  const existing = findDirectChild(parent, tag);
  const trimmed = value.trim();
  if (!trimmed) {
    if (emptyMode === "nil") {
      if (existing?.hasAttribute("gco:nilReason")) return;
      replaceOrInsert(parent, existing, b.nil(tag), sequence);
    } else if (existing) parent.removeChild(existing);
    return;
  }
  if (existing && readCode(parent, tag) === trimmed) return;
  replaceOrInsert(parent, existing, b.code(tag, codeTag, listName, trimmed), sequence);
}

/**
 * Menyetel tanggal tunggal sesuai SPEC upgrade 1.A.3: bila node asli memakai gco:DateTime dan
 * tanggalnya tidak berubah, jam aslinya dipertahankan; bila berubah ditulis YYYY-MM-DDT00:00:00Z.
 * Elemen baru memakai gco:Date kecuali `kind` meminta DateTime.
 */
export function setDateProperty(
  b: XmlBuilder,
  parent: Element,
  tag: string,
  value: string,
  sequence: string[],
  options: { emptyMode?: "remove" | "nil"; kind?: "Date" | "DateTime" } = {}
): void {
  const existing = findDirectChild(parent, tag);
  if (!value) {
    if (options.emptyMode === "nil") {
      if (existing?.hasAttribute("gco:nilReason")) return;
      replaceOrInsert(parent, existing, b.nil(tag), sequence);
    } else if (existing) parent.removeChild(existing);
    return;
  }

  const holder = existing ? childElements(existing)[0] : null;
  if (existing && holder && (holder.nodeName === "gco:DateTime" || holder.nodeName === "gco:Date")) {
    if (normalizeDateValue(getTextContent(holder)) === value) return;
    const kind = holder.nodeName === "gco:DateTime" ? "DateTime" : "Date";
    replaceOrInsert(parent, existing, b.date(tag, value, kind), sequence);
    return;
  }
  replaceOrInsert(parent, existing, b.date(tag, value, options.kind ?? "Date"), sequence);
}

export function replaceOrInsert(parent: Element, existing: Element | null, replacement: Element, sequence: string[]): void {
  if (existing) parent.replaceChild(replacement, existing);
  else insertInCanonicalOrder(parent, replacement, sequence);
}

/**
 * Menyinkronkan elemen tunggal yang isinya dibangun penuh dari form (mis. resourceMaintenance).
 * Bila hasil parse node asli sama dengan nilai form, node asli dipertahankan apa adanya.
 */
export function syncSingle<T>(
  parent: Element,
  tag: string,
  sequence: string[],
  value: T,
  parse: (el: Element) => T | null,
  build: (value: T) => Element | null,
  filter: (el: Element) => boolean = () => true
): void {
  const existing = findDirectChildren(parent, tag).find(filter) ?? null;
  if (existing && stableKey(parse(existing)) === stableKey(value)) return;
  const built = build(value);
  if (built) replaceOrInsert(parent, existing, built, sequence);
  else if (existing) parent.removeChild(existing);
}

/**
 * Menyinkronkan elemen berulang (kontak, kata kunci, laporan kualitas, ...).
 * Setiap item yang isinya identik dengan salah satu node asli memakai ulang node itu, sehingga
 * atribut dan struktur yang tidak dikelola form (xlink, nilReason, Anchor) tidak hilang.
 */
export function syncRepeated<T>(
  parent: Element,
  tag: string,
  sequence: string[],
  items: T[],
  parse: (el: Element) => T | null,
  build: (item: T) => Element | null,
  filter: (el: Element) => boolean = () => true
): void {
  const existing = findDirectChildren(parent, tag).filter(filter);
  const pool = existing.map((el) => ({ el, key: stableKey(parse(el)), used: false }));
  for (const el of existing) parent.removeChild(el);

  for (const item of items) {
    const key = stableKey(item);
    const match = pool.find((p) => !p.used && p.key === key);
    let node: Element | null;
    if (match) {
      match.used = true;
      node = match.el;
    } else {
      node = build(item);
    }
    if (node) insertInCanonicalOrder(parent, node, sequence);
  }
}

export function getOrCreateChild(b: XmlBuilder, parent: Element, tag: string, sequence: string[]): Element {
  const existing = findDirectChild(parent, tag);
  if (existing) return existing;
  const created = b.el(tag);
  insertInCanonicalOrder(parent, created, sequence);
  return created;
}

/* ------------------------------------------------------------------ */
/* Format keluaran                                                     */
/* ------------------------------------------------------------------ */

/**
 * Merapikan indentasi seluruh pohon setelah penambalan, karena node sisipan tidak membawa
 * spasi. Teks bermakna tidak disentuh; hanya node teks berisi spasi di antara elemen yang diganti.
 */
export function prettyPrint(doc: Document, root: Element, indentUnit = "  "): void {
  const walk = (el: Element, depth: number) => {
    const elements = childElements(el);
    const strip = elements.length > 0 || el.hasAttribute("gco:nilReason");
    if (strip) {
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === 3 && !(child.nodeValue || "").trim()) el.removeChild(child);
      }
    }
    if (elements.length === 0) return;

    const pad = "\n" + indentUnit.repeat(depth + 1);
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1 || child.nodeType === 8) el.insertBefore(doc.createTextNode(pad), child);
    }
    el.appendChild(doc.createTextNode("\n" + indentUnit.repeat(depth)));
    for (const child of elements) walk(child, depth + 1);
  };
  walk(root, 0);
}
