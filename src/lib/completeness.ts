import { MetadataFormData, ResponsibleParty, isValidIsoDate } from "@/lib/metadata-schema";
import { SENTINEL_PLACEHOLDERS } from "@/lib/xml-engine/constants";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export const WIZARD_STEPS: Array<{ number: WizardStep; title: string; isoCode: string }> = [
  { number: 1, title: "Informasi metadata", isoCode: "MD_Metadata" },
  { number: 2, title: "Identifikasi produk data", isoCode: "MD_DataIdentification" },
  { number: 3, title: "Spasial, SRGI & KUGI", isoCode: "MD_ReferenceSystem, MD_ContentInformation" },
  { number: 4, title: "Kualitas, silsilah & distribusi", isoCode: "DQ_DataQuality, MD_Distribution" },
  { number: 5, title: "Penyajian & audit akhir", isoCode: "MD_PortrayalCatalogueReference" },
];

/* ------------------------------------------------------------------ */
/* Profil kelengkapan (SE Kepala BIG No. 6 Tahun 2021)                 */
/* ------------------------------------------------------------------ */

export type ProfileId = "iso_core" | "sdi_produsen" | "sdi_walidata";
export type RequirementLevel = "iso" | "sdi" | "walidata";

export const PROFILES: Record<ProfileId, { label: string; shortLabel: string; scoreLabel: string; description: string; levels: RequirementLevel[] }> = {
  iso_core: {
    label: "ISO Minimum",
    shortLabel: "ISO Minimum",
    scoreLabel: "ISO",
    description: "Hanya elemen wajib skema XSD ISO 19115/19139.",
    levels: ["iso"],
  },
  sdi_produsen: {
    label: "Standar SDI — Produsen",
    shortLabel: "SDI Produsen",
    scoreLabel: "SDI",
    description: "Wajib ISO + seluruh elemen yang dilengkapi Produsen Data sesuai SE 6/2021.",
    levels: ["iso", "sdi"],
  },
  sdi_walidata: {
    label: "Verifikasi SDI — Walidata",
    shortLabel: "SDI Walidata",
    scoreLabel: "Walidata",
    description: "Standar SDI + hasil Penjaminan Kualitas (QA) dan distributor sebelum publikasi JIGN.",
    levels: ["iso", "sdi", "walidata"],
  },
};

export const PROFILE_ORDER: ProfileId[] = ["iso_core", "sdi_produsen", "sdi_walidata"];
export const DEFAULT_PROFILE: ProfileId = "sdi_produsen";

export function isLevelRequired(level: RequirementLevel, profile: ProfileId): boolean {
  return PROFILES[profile].levels.includes(level);
}

/* ------------------------------------------------------------------ */
/* Kartu sub-bagian                                                    */
/* ------------------------------------------------------------------ */

export const CARDS = {
  "metadata-identity": { step: 1, title: "Identitas metadata" },
  "metadata-contact": { step: 1, title: "Penanggung jawab metadata" },
  "metadata-maintenance": { step: 1, title: "Pemeliharaan metadata" },
  "metadata-constraints": { step: 1, title: "Batasan metadata" },
  citation: { step: 2, title: "Sitasi & deskripsi produk data" },
  topics: { step: 2, title: "Kategori topik" },
  keywords: { step: 2, title: "Kata kunci" },
  extent: { step: 2, title: "Cakupan wilayah & waktu" },
  producer: { step: 2, title: "Produsen / pemilik data" },
  usage: { step: 2, title: "Hasil QA Walidata" },
  "resource-maintenance": { step: 2, title: "Pemeliharaan produk data" },
  "resource-constraints": { step: 2, title: "Batasan produk data" },
  supplemental: { step: 2, title: "Informasi tambahan" },
  "spatial-representation": { step: 3, title: "Representasi & resolusi spasial" },
  "reference-system": { step: 3, title: "Sistem referensi" },
  content: { step: 3, title: "Konten & katalog unsur" },
  lineage: { step: 4, title: "Garis silsilah" },
  "lineage-sources": { step: 4, title: "Sumber data" },
  "lineage-steps": { step: 4, title: "Tahapan proses" },
  quality: { step: 4, title: "Evaluasi kualitas data" },
  "distribution-format": { step: 4, title: "Format distribusi" },
  distributor: { step: 4, title: "Distributor" },
  transfer: { step: 4, title: "Tautan & transfer" },
  portrayal: { step: 5, title: "Katalog simbol" },
  "application-schema": { step: 5, title: "Skema aplikasi" },
  "metadata-extension": { step: 5, title: "Ekstensi metadata" },
} as const satisfies Record<string, { step: WizardStep; title: string }>;

export type CardId = keyof typeof CARDS;

export function cardDomId(card: CardId): string {
  return `card-${card}`;
}

/* ------------------------------------------------------------------ */
/* Pemeriksaan nilai                                                   */
/* ------------------------------------------------------------------ */

/** Placeholder GeoNode ("None", "No abstract provided", ...) dihitung belum terisi. */
export function isFilled(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed !== "" && !SENTINEL_PLACEHOLDERS.includes(trimmed);
}

type Extent = MetadataFormData["identification"]["extent"];

export function getExtentError(extent: Extent): string | null {
  const { westBoundLongitude: w, eastBoundLongitude: e, southBoundLatitude: s, northBoundLatitude: n } = extent;
  const values = [w, e, s, n];
  if (!values.every((v): v is number => typeof v === "number" && Number.isFinite(v))) {
    return "Keempat batas koordinat wajib diisi dengan angka.";
  }
  const [W, E, S, N] = values as number[];
  if (W < -180 || W > 180 || E < -180 || E > 180) return "Bujur Barat dan Timur harus berada di antara -180 dan 180.";
  if (S < -90 || S > 90 || N < -90 || N > 90) return "Lintang Selatan dan Utara harus berada di antara -90 dan 90.";
  if (W >= E) return "Batas Barat harus lebih kecil dari batas Timur.";
  if (S >= N) return "Batas Selatan harus lebih kecil dari batas Utara.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Daftar elemen wajib                                                 */
/* ------------------------------------------------------------------ */

type Values = MetadataFormData;

export interface Requirement {
  id: string;
  label: string;
  card: CardId;
  level: RequirementLevel;
  check: (v: Values) => boolean;
  /** Path field untuk lompat-ke-kolom; tanpa path, lompat ke kartunya. */
  focus?: (v: Values) => string;
  /** Persyaratan bersyarat, mis. otherConstraints bila otherRestrictions dipilih. */
  applies?: (v: Values) => boolean;
}

/** Memeriksa satu kolom pada setiap kontak; fokus diarahkan ke kontak pertama yang belum terisi. */
function everyContact(
  pick: (v: Values) => ResponsibleParty[],
  base: string,
  key: keyof ResponsibleParty
): Pick<Requirement, "check" | "focus"> {
  return {
    check: (v) => pick(v).length > 0 && pick(v).every((c) => isFilled(c[key])),
    focus: (v) => {
      const idx = pick(v).findIndex((c) => !isFilled(c[key]));
      return `${base}.${Math.max(0, idx)}.${key}`;
    },
  };
}

const at = (path: string) => () => path;
const metadataContacts = (v: Values) => v.metadataInfo.contacts;
const producerContacts = (v: Values) => v.identification.pointOfContacts;

function hasReportResult(v: Values) {
  return v.qualityAndDistribution.reports.some((r) => r.conformance.pass !== "" || isFilled(r.quantitative.value));
}

export const REQUIREMENTS: Requirement[] = [
  // Bab 1
  { id: "fileIdentifier", label: "UUID dokumen metadata", card: "metadata-identity", level: "iso", check: (v) => isFilled(v.metadataInfo.fileIdentifier), focus: at("metadataInfo.fileIdentifier") },
  { id: "language", label: "Bahasa metadata", card: "metadata-identity", level: "iso", check: (v) => isFilled(v.metadataInfo.language), focus: at("metadataInfo.language") },
  { id: "characterSet", label: "Set karakter", card: "metadata-identity", level: "iso", check: (v) => isFilled(v.metadataInfo.characterSet), focus: at("metadataInfo.characterSet") },
  { id: "dateStamp", label: "Tanggal metadata", card: "metadata-identity", level: "iso", check: (v) => isValidIsoDate(v.metadataInfo.dateStamp), focus: at("metadataInfo.dateStamp") },
  { id: "hierarchyLevel", label: "Jenis sumber daya", card: "metadata-identity", level: "sdi", check: (v) => isFilled(v.metadataInfo.hierarchyLevel), focus: at("metadataInfo.hierarchyLevel") },
  { id: "hierarchyLevelName", label: "Level jangkauan produk data", card: "metadata-identity", level: "sdi", check: (v) => isFilled(v.metadataInfo.hierarchyLevelName), focus: at("metadataInfo.hierarchyLevelName") },
  { id: "metadataStandardName", label: "Nama standar metadata", card: "metadata-identity", level: "sdi", check: (v) => isFilled(v.metadataInfo.metadataStandardName), focus: at("metadataInfo.metadataStandardName") },
  { id: "metadataStandardVersion", label: "Versi standar metadata", card: "metadata-identity", level: "sdi", check: (v) => isFilled(v.metadataInfo.metadataStandardVersion), focus: at("metadataInfo.metadataStandardVersion") },
  { id: "contactOrg", label: "Instansi kontak metadata", card: "metadata-contact", level: "iso", ...everyContact(metadataContacts, "metadataInfo.contacts", "organisationName") },
  { id: "contactEmail", label: "Email kontak metadata", card: "metadata-contact", level: "iso", ...everyContact(metadataContacts, "metadataInfo.contacts", "electronicMailAddress") },
  { id: "contactRole", label: "Peran kontak metadata", card: "metadata-contact", level: "iso", ...everyContact(metadataContacts, "metadataInfo.contacts", "role") },
  { id: "contactPosition", label: "Jabatan kontak metadata", card: "metadata-contact", level: "sdi", ...everyContact(metadataContacts, "metadataInfo.contacts", "positionName") },
  { id: "contactAddress", label: "Alamat kontak metadata", card: "metadata-contact", level: "sdi", ...everyContact(metadataContacts, "metadataInfo.contacts", "deliveryPoint") },
  { id: "metadataMaintenance", label: "Frekuensi pemutakhiran metadata", card: "metadata-maintenance", level: "sdi", check: (v) => isFilled(v.metadataInfo.maintenance.frequency), focus: at("metadataInfo.maintenance.frequency") },

  // Bab 2
  { id: "title", label: "Judul produk data", card: "citation", level: "iso", check: (v) => isFilled(v.identification.title), focus: at("identification.title") },
  {
    id: "citationDate",
    label: "Tanggal referensi",
    card: "citation",
    level: "iso",
    check: (v) => v.identification.dates.some((d) => isValidIsoDate(d.date)),
    focus: (v) => (v.identification.dates.length ? "identification.dates.0.date" : "card:citation"),
  },
  { id: "alternateTitle", label: "Judul alternatif / nama layer", card: "citation", level: "sdi", check: (v) => isFilled(v.identification.alternateTitle), focus: at("identification.alternateTitle") },
  { id: "presentationForm", label: "Bentuk penyajian", card: "citation", level: "sdi", check: (v) => isFilled(v.identification.presentationForm), focus: at("identification.presentationForm") },
  { id: "abstract", label: "Abstrak", card: "citation", level: "iso", check: (v) => isFilled(v.identification.abstract), focus: at("identification.abstract") },
  { id: "purpose", label: "Tujuan pembuatan data", card: "citation", level: "sdi", check: (v) => isFilled(v.identification.purpose), focus: at("identification.purpose") },
  { id: "status", label: "Status produk data", card: "citation", level: "sdi", check: (v) => isFilled(v.identification.status), focus: at("identification.status") },
  { id: "topicCategory", label: "Kategori topik", card: "topics", level: "iso", check: (v) => v.identification.topicCategories.length > 0 },
  { id: "keywords", label: "Minimal satu kata kunci", card: "keywords", level: "sdi", check: (v) => v.identification.keywordGroups.some((g) => g.keywords.some(isFilled)) },
  { id: "bbox", label: "Batas koordinat geografis", card: "extent", level: "iso", check: (v) => getExtentError(v.identification.extent) === null, focus: at("identification.extent.westBoundLongitude") },
  { id: "geographicDescription", label: "Deskripsi wilayah administrasi", card: "extent", level: "sdi", check: (v) => isFilled(v.identification.extent.geographicDescription), focus: at("identification.extent.geographicDescription") },
  { id: "producerOrg", label: "Instansi produsen data", card: "producer", level: "sdi", ...everyContact(producerContacts, "identification.pointOfContacts", "organisationName") },
  { id: "producerEmail", label: "Email produsen data", card: "producer", level: "sdi", ...everyContact(producerContacts, "identification.pointOfContacts", "electronicMailAddress") },
  { id: "specificUsage", label: "Kelas penggunaan hasil QA", card: "usage", level: "walidata", check: (v) => isFilled(v.identification.usage.specificUsage), focus: at("identification.usage.specificUsage") },
  { id: "usageDate", label: "Tanggal penjaminan kualitas", card: "usage", level: "walidata", check: (v) => isValidIsoDate(v.identification.usage.usageDate), focus: at("identification.usage.usageDate") },
  { id: "usageContact", label: "Instansi Walidata pemeriksa", card: "usage", level: "walidata", check: (v) => isFilled(v.identification.usage.contact.organisationName), focus: at("identification.usage.contact.organisationName") },
  { id: "resourceMaintenance", label: "Frekuensi pembaruan data", card: "resource-maintenance", level: "sdi", check: (v) => isFilled(v.identification.maintenance.frequency), focus: at("identification.maintenance.frequency") },
  { id: "useLimitation", label: "Batasan penggunaan umum", card: "resource-constraints", level: "sdi", check: (v) => isFilled(v.identification.constraints.useLimitation), focus: at("identification.constraints.useLimitation") },
  { id: "accessConstraints", label: "Batasan akses", card: "resource-constraints", level: "sdi", check: (v) => isFilled(v.identification.constraints.accessConstraints), focus: at("identification.constraints.accessConstraints") },
  { id: "useConstraints", label: "Batasan penggunaan", card: "resource-constraints", level: "sdi", check: (v) => isFilled(v.identification.constraints.useConstraints), focus: at("identification.constraints.useConstraints") },
  {
    id: "otherConstraints",
    label: "Keterangan batasan lainnya",
    card: "resource-constraints",
    level: "sdi",
    applies: (v) => needsOtherConstraints(v.identification.constraints),
    check: (v) => isFilled(v.identification.constraints.otherConstraints),
    focus: at("identification.constraints.otherConstraints"),
  },
  { id: "classification", label: "Klasifikasi keamanan", card: "resource-constraints", level: "sdi", check: (v) => isFilled(v.identification.constraints.securityClassification), focus: at("identification.constraints.securityClassification") },

  // Bab 3
  { id: "spatialRepresentationType", label: "Tipe representasi spasial", card: "spatial-representation", level: "sdi", check: (v) => isFilled(v.spatialAndContent.spatialRepresentationType), focus: at("spatialAndContent.spatialRepresentationType") },
  {
    id: "spatialResolution",
    label: "Resolusi spasial (skala atau jarak)",
    card: "spatial-representation",
    level: "sdi",
    check: (v) => (v.spatialAndContent.resolutionMode === "distance" ? Boolean(v.spatialAndContent.groundDistance) : Boolean(v.spatialAndContent.scaleDenominator)),
    focus: (v) => (v.spatialAndContent.resolutionMode === "distance" ? "spatialAndContent.groundDistance" : "spatialAndContent.scaleDenominator"),
  },
  {
    id: "geometricObjectType",
    label: "Objek geometri vektor",
    card: "spatial-representation",
    level: "sdi",
    applies: (v) => v.spatialAndContent.spatialRepresentationType === "vector",
    check: (v) => isFilled(v.spatialAndContent.vectorDetail.geometricObjectType),
    focus: at("spatialAndContent.vectorDetail.geometricObjectType"),
  },
  {
    id: "gridSize",
    label: "Ukuran baris & kolom grid",
    card: "spatial-representation",
    level: "sdi",
    applies: (v) => v.spatialAndContent.spatialRepresentationType === "grid",
    check: (v) => Boolean(v.spatialAndContent.gridDetail.rowSize && v.spatialAndContent.gridDetail.columnSize),
    focus: at("spatialAndContent.gridDetail.rowSize"),
  },
  {
    id: "referenceSystem",
    label: "Kode sistem referensi (SRGI)",
    card: "reference-system",
    level: "sdi",
    check: (v) => v.spatialAndContent.referenceSystems.some((r) => isFilled(r.code)),
    focus: (v) => (v.spatialAndContent.referenceSystems.length ? "spatialAndContent.referenceSystems.0.code" : "card:reference-system"),
  },
  {
    id: "featureTypes",
    label: "Nama / kode unsur KUGI",
    card: "content",
    level: "sdi",
    applies: (v) => v.spatialAndContent.contentInfo.type === "vector",
    check: (v) => v.spatialAndContent.contentInfo.featureTypes.some(isFilled),
    focus: at("spatialAndContent.contentInfo.featureTypes"),
  },
  {
    id: "featureCatalogueCitation",
    label: "Judul sitasi katalog unsur",
    card: "content",
    level: "sdi",
    applies: (v) => v.spatialAndContent.contentInfo.type === "vector",
    check: (v) => isFilled(v.spatialAndContent.contentInfo.catalogueCitation.title),
    focus: at("spatialAndContent.contentInfo.catalogueCitation.title"),
  },
  {
    id: "attributeDescription",
    label: "Deskripsi atribut raster",
    card: "content",
    level: "sdi",
    applies: (v) => v.spatialAndContent.contentInfo.type === "raster",
    check: (v) => isFilled(v.spatialAndContent.contentInfo.attributeDescription),
    focus: at("spatialAndContent.contentInfo.attributeDescription"),
  },
  {
    id: "coverageContentType",
    label: "Tipe konten raster",
    card: "content",
    level: "sdi",
    applies: (v) => v.spatialAndContent.contentInfo.type === "raster",
    check: (v) => isFilled(v.spatialAndContent.contentInfo.coverageContentType),
    focus: at("spatialAndContent.contentInfo.coverageContentType"),
  },

  // Bab 4
  { id: "lineageStatement", label: "Pernyataan garis silsilah", card: "lineage", level: "sdi", check: (v) => isFilled(v.qualityAndDistribution.lineageStatement), focus: at("qualityAndDistribution.lineageStatement") },
  { id: "lineageSource", label: "Minimal satu sumber data", card: "lineage-sources", level: "sdi", check: (v) => v.qualityAndDistribution.sources.some((s) => isFilled(s.description)) },
  { id: "processStep", label: "Minimal satu tahapan proses", card: "lineage-steps", level: "sdi", check: (v) => v.qualityAndDistribution.processSteps.some((s) => isFilled(s.description)) },
  { id: "qualityScope", label: "Cakupan kualitas", card: "quality", level: "sdi", check: (v) => isFilled(v.qualityAndDistribution.scope), focus: at("qualityAndDistribution.scope") },
  { id: "qualityReport", label: "Minimal satu laporan kualitas berisi hasil", card: "quality", level: "sdi", check: hasReportResult },
  { id: "formatName", label: "Nama format distribusi", card: "distribution-format", level: "sdi", check: (v) => isFilled(v.qualityAndDistribution.distributionFormat.name), focus: at("qualityAndDistribution.distributionFormat.name") },
  { id: "formatVersion", label: "Versi format distribusi", card: "distribution-format", level: "sdi", check: (v) => isFilled(v.qualityAndDistribution.distributionFormat.version), focus: at("qualityAndDistribution.distributionFormat.version") },
  { id: "distributorOrg", label: "Instansi distributor", card: "distributor", level: "walidata", check: (v) => isFilled(v.qualityAndDistribution.distributor.contact.organisationName), focus: at("qualityAndDistribution.distributor.contact.organisationName") },
  {
    id: "distributorOrder",
    label: "Ketentuan pemerolehan data",
    card: "distributor",
    level: "walidata",
    check: (v) => isFilled(v.qualityAndDistribution.distributor.orderingInstructions) || isFilled(v.qualityAndDistribution.distributor.fees),
    focus: at("qualityAndDistribution.distributor.orderingInstructions"),
  },
  { id: "onlineLink", label: "Minimal satu tautan akses data", card: "transfer", level: "sdi", check: (v) => v.qualityAndDistribution.onlineResources.some((r) => isFilled(r.linkage)) },
];

export function needsOtherConstraints(c: MetadataFormData["identification"]["constraints"]): boolean {
  return c.accessConstraints === "otherRestrictions" || c.useConstraints === "otherRestrictions";
}

/* ------------------------------------------------------------------ */
/* Kalkulator                                                          */
/* ------------------------------------------------------------------ */

export interface CompletenessStat {
  done: number;
  total: number;
  percent: number;
}

export interface CompletenessResult extends CompletenessStat {
  profile: ProfileId;
  steps: Record<WizardStep, CompletenessStat & { missing: Requirement[] }>;
  cards: Partial<Record<CardId, CompletenessStat>>;
  missing: Requirement[];
}

function percentOf(done: number, total: number): number {
  return total === 0 ? 100 : Math.floor((done / total) * 100);
}

export function stepOfRequirement(req: Requirement): WizardStep {
  return CARDS[req.card].step;
}

/**
 * Fungsi murni: menghitung kelengkapan keseluruhan, per bab, dan per kartu untuk profil aktif.
 * Persentase dibulatkan ke bawah agar 100% hanya muncul bila semuanya benar-benar terisi.
 */
export function calculateMetadataCompleteness(values: MetadataFormData, profile: ProfileId): CompletenessResult {
  const steps = {} as CompletenessResult["steps"];
  for (const s of [1, 2, 3, 4, 5] as WizardStep[]) steps[s] = { done: 0, total: 0, percent: 100, missing: [] };
  const cards: CompletenessResult["cards"] = {};
  const missing: Requirement[] = [];
  let done = 0;
  let total = 0;

  for (const req of REQUIREMENTS) {
    if (!isLevelRequired(req.level, profile)) continue;
    if (req.applies && !req.applies(values)) continue;

    const ok = req.check(values);
    const step = steps[stepOfRequirement(req)];
    const card = (cards[req.card] ??= { done: 0, total: 0, percent: 0 });

    total += 1;
    step.total += 1;
    card.total += 1;
    if (ok) {
      done += 1;
      step.done += 1;
      card.done += 1;
    } else {
      missing.push(req);
      step.missing.push(req);
    }
  }

  for (const s of Object.values(steps)) s.percent = percentOf(s.done, s.total);
  for (const c of Object.values(cards)) if (c) c.percent = percentOf(c.done, c.total);

  return { profile, done, total, percent: percentOf(done, total), steps, cards, missing };
}
