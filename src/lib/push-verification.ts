import { parseIso19139ToForm } from "@/lib/xml-engine";
import type { MetadataFormData } from "@/lib/metadata-schema";
import type { WizardStep } from "@/lib/completeness";
import { valuesEqual } from "@/lib/value-utils";

/** Satu bagian metadata yang diperiksa setelah disimpan ke GeoNode. */
interface VerifiedPart {
  label: string;
  step: WizardStep;
  pick: (f: MetadataFormData) => unknown;
}

const PARTS: VerifiedPart[] = [
  { step: 1, label: "UUID dokumen metadata", pick: (f) => f.metadataInfo.fileIdentifier },
  { step: 1, label: "Bahasa & set karakter", pick: (f) => [f.metadataInfo.language, f.metadataInfo.characterSet] },
  { step: 1, label: "Jenis sumber daya & level jangkauan", pick: (f) => [f.metadataInfo.hierarchyLevel, f.metadataInfo.hierarchyLevelName] },
  { step: 1, label: "Tanggal metadata", pick: (f) => f.metadataInfo.dateStamp },
  { step: 1, label: "Standar metadata", pick: (f) => [f.metadataInfo.metadataStandardName, f.metadataInfo.metadataStandardVersion] },
  { step: 1, label: "UUID induk & URI dataset", pick: (f) => [f.metadataInfo.parentIdentifier, f.metadataInfo.dataSetURI] },
  { step: 1, label: "Kontak metadata", pick: (f) => f.metadataInfo.contacts },
  { step: 1, label: "Pemeliharaan metadata", pick: (f) => f.metadataInfo.maintenance },
  { step: 1, label: "Batasan metadata", pick: (f) => f.metadataInfo.constraints },

  { step: 2, label: "Judul & judul alternatif", pick: (f) => [f.identification.title, f.identification.alternateTitle] },
  { step: 2, label: "Tanggal referensi", pick: (f) => f.identification.dates },
  { step: 2, label: "Edisi, kode pengenal & bentuk penyajian", pick: (f) => [f.identification.edition, f.identification.identifierCode, f.identification.presentationForm] },
  { step: 2, label: "Abstrak", pick: (f) => f.identification.abstract },
  { step: 2, label: "Tujuan", pick: (f) => f.identification.purpose },
  { step: 2, label: "Kredit & status", pick: (f) => [f.identification.credit, f.identification.status] },
  { step: 2, label: "Kontak produsen data", pick: (f) => f.identification.pointOfContacts },
  { step: 2, label: "Kategori topik", pick: (f) => [...f.identification.topicCategories].sort() },
  { step: 2, label: "Kata kunci", pick: (f) => f.identification.keywordGroups },
  {
    step: 2,
    label: "Batas koordinat",
    pick: (f) => {
      const e = f.identification.extent;
      return [e.westBoundLongitude, e.eastBoundLongitude, e.southBoundLatitude, e.northBoundLatitude];
    },
  },
  { step: 2, label: "Deskripsi wilayah", pick: (f) => f.identification.extent.geographicDescription },
  {
    step: 2,
    label: "Cakupan waktu & vertikal",
    pick: (f) => {
      const e = f.identification.extent;
      return [e.temporalBegin, e.temporalEnd, e.verticalMin, e.verticalMax];
    },
  },
  { step: 2, label: "Hasil QA Walidata", pick: (f) => f.identification.usage },
  { step: 2, label: "Pemeliharaan produk data", pick: (f) => f.identification.maintenance },
  { step: 2, label: "Batasan produk data", pick: (f) => f.identification.constraints },
  { step: 2, label: "Informasi tambahan", pick: (f) => f.identification.supplementalInformation },

  {
    step: 3,
    label: "Tipe representasi & resolusi",
    pick: (f) => {
      const s = f.spatialAndContent;
      return [s.spatialRepresentationType, s.scaleDenominator, s.groundDistance];
    },
  },
  { step: 3, label: "Rincian vektor / grid", pick: (f) => [f.spatialAndContent.vectorDetail, f.spatialAndContent.gridDetail] },
  { step: 3, label: "Sistem referensi", pick: (f) => f.spatialAndContent.referenceSystems },
  { step: 3, label: "Katalog unsur (KUGI)", pick: (f) => f.spatialAndContent.contentInfo },

  { step: 4, label: "Pernyataan silsilah", pick: (f) => f.qualityAndDistribution.lineageStatement },
  { step: 4, label: "Sumber data", pick: (f) => f.qualityAndDistribution.sources },
  { step: 4, label: "Tahapan proses", pick: (f) => f.qualityAndDistribution.processSteps },
  { step: 4, label: "Laporan kualitas data", pick: (f) => [f.qualityAndDistribution.scope, f.qualityAndDistribution.reports] },
  { step: 4, label: "Format distribusi", pick: (f) => f.qualityAndDistribution.distributionFormat },
  { step: 4, label: "Distributor", pick: (f) => f.qualityAndDistribution.distributor },
  { step: 4, label: "Tautan unduhan & layanan", pick: (f) => f.qualityAndDistribution.onlineResources.map((r) => [r.linkage, r.protocol, r.name]) },
  { step: 4, label: "Ukuran file", pick: (f) => f.qualityAndDistribution.transferSize },

  { step: 5, label: "Katalog simbol", pick: (f) => f.advanced.portrayalCatalogue },
  { step: 5, label: "Skema aplikasi", pick: (f) => f.advanced.applicationSchema },
  { step: 5, label: "Ekstensi metadata", pick: (f) => f.advanced.metadataExtension },
];

export interface StoredMetadataReport {
  /** Bagian yang tersimpan persis seperti yang dikirim. */
  kept: Array<{ label: string; step: WizardStep }>;
  /** Bagian yang dikirim tetapi isinya berbeda atau hilang saat dibaca ulang dari GeoNode. */
  lost: Array<{ label: string; step: WizardStep }>;
}

/**
 * Membandingkan XML yang dikirim dengan XML yang dibaca ulang dari CSW GeoNode setelah disimpan.
 * Keduanya dilewatkan ke parser yang sama, jadi perbedaan format (indentasi, gco:Date vs gco:DateTime,
 * placeholder GeoNode) tidak dihitung sebagai kehilangan; hanya isi yang berubah.
 */
export function compareStoredMetadata(sentXml: string, storedXml: string): StoredMetadataReport {
  const sent = parseIso19139ToForm(sentXml).formData;
  const stored = parseIso19139ToForm(storedXml).formData;
  const empty = parseIso19139ToForm(EMPTY_METADATA_XML).formData;

  const kept: StoredMetadataReport["kept"] = [];
  const lost: StoredMetadataReport["lost"] = [];
  for (const part of PARTS) {
    const expected = part.pick(sent);
    // Bagian yang memang tidak diisi tidak dilaporkan sebagai tersimpan maupun hilang.
    if (valuesEqual(expected, part.pick(empty))) continue;
    (valuesEqual(expected, part.pick(stored)) ? kept : lost).push({ label: part.label, step: part.step });
  }
  return { kept, lost };
}

/** Pembanding "belum diisi": dokumen tanpa isi apa pun, dibaca lewat parser yang sama. */
const EMPTY_METADATA_XML = '<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"/>';
