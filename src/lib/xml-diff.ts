import { createXmlDocument, prettyPrint, serializeXmlDocument, unwrapCswAndHoistNamespaces } from "./xml-engine/dom-utils";

export type DiffLine = { kind: "same" | "added" | "removed"; text: string; oldNo?: number; newNo?: number };
export type DiffHunk = { kind: "lines"; lines: DiffLine[] } | { kind: "skip"; count: number };

/** Batas sel tabel LCS (~16 MB Uint32). Dokumen lebih besar ditampilkan sebagai ringkasan saja. */
const MAX_CELLS = 4_000_000;

/** XML asli dirapikan dengan aturan indentasi yang sama seperti keluaran patcher agar diff hanya memuat perubahan isi. */
export function normalizeOriginalXml(xml: string): string {
  const { doc, rootMetadata } = unwrapCswAndHoistNamespaces(createXmlDocument(xml));
  prettyPrint(doc, rootMetadata);
  return serializeXmlDocument(doc);
}

/** Diff baris berbasis LCS, dipadatkan dengan konteks `context` baris di sekitar setiap perubahan. */
export function computeLineDiff(before: string, after: string, context = 3): { hunks: DiffHunk[]; added: number; removed: number } | null {
  const a = before.split("\n");
  const b = after.split("\n");

  // Pangkas awalan & akhiran yang sama untuk memperkecil tabel.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const n = endA - start;
  const m = endB - start;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;

  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[start + i] === b[start + j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  for (let k = 0; k < start; k++) lines.push({ kind: "same", text: a[k], oldNo: k + 1, newNo: k + 1 });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i] === b[start + j]) {
      lines.push({ kind: "same", text: a[start + i], oldNo: start + i + 1, newNo: start + j + 1 });
      i++;
      j++;
    } else if (j < m && (i >= n || table[i * width + j + 1] >= table[(i + 1) * width + j])) {
      lines.push({ kind: "added", text: b[start + j], newNo: start + j + 1 });
      j++;
    } else {
      lines.push({ kind: "removed", text: a[start + i], oldNo: start + i + 1 });
      i++;
    }
  }
  for (let k = 0; k < a.length - endA; k++) {
    lines.push({ kind: "same", text: a[endA + k], oldNo: endA + k + 1, newNo: endB + k + 1 });
  }

  const keep = lines.map(() => false);
  lines.forEach((line, idx) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });

  const hunks: DiffHunk[] = [];
  let skipped = 0;
  lines.forEach((line, idx) => {
    if (!keep[idx]) {
      skipped++;
      return;
    }
    if (skipped) hunks.push({ kind: "skip", count: skipped });
    skipped = 0;
    const last = hunks[hunks.length - 1];
    if (last?.kind === "lines") last.lines.push(line);
    else hunks.push({ kind: "lines", lines: [line] });
  });
  if (skipped) hunks.push({ kind: "skip", count: skipped });

  return {
    hunks,
    added: lines.filter((l) => l.kind === "added").length,
    removed: lines.filter((l) => l.kind === "removed").length,
  };
}
