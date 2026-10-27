/**
 * Utilitas nilai form yang dipakai bersama oleh fitur undo per kolom dan patcher XML.
 * String kosong, null, dan undefined dianggap setara ("belum diisi").
 */

function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalize((value as Record<string, unknown>)[key]);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
}

/** Representasi string stabil (urutan kunci diurutkan) untuk perbandingan isi. */
export function stableKey(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  return stableKey(a) === stableKey(b);
}

/** Membaca nilai berdasarkan path ala react-hook-form, mis. "metadataInfo.contacts.0.city". */
export function getAtPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function hasPath(source: unknown, path: string): boolean {
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return false;
    if (!(key in (current as Record<string, unknown>))) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

const BOOLEAN_TEXT: Record<string, string> = { true: "Ya", false: "Tidak" };

/** Ringkasan satu baris untuk tooltip "Kembalikan ke nilai awal: ...". */
export function summarizeValue(value: unknown, max = 60): string {
  let text = "";
  if (value === null || value === undefined) text = "";
  else if (typeof value === "string") text = BOOLEAN_TEXT[value] && value.length <= 5 ? BOOLEAN_TEXT[value] : value;
  else if (typeof value === "number" || typeof value === "boolean") text = typeof value === "boolean" ? (value ? "Ya" : "Tidak") : String(value);
  else if (Array.isArray(value)) {
    text = value
      .map((item) => (typeof item === "object" && item !== null ? summarizeValue(item, max) : String(item ?? "")))
      .filter(Boolean)
      .join(", ");
  } else if (typeof value === "object") {
    text = Object.values(value as Record<string, unknown>)
      .filter((v) => typeof v === "string" && v.trim())
      .slice(0, 2)
      .join(", ");
  }
  text = text.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

/** ID elemen DOM yang stabil untuk sebuah path field, dipakai lompat-ke-kolom. */
export function fieldDomId(path: string): string {
  return `f-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}
