import { DQ_ELEMENT_TYPES } from "../../src/lib/iso-codelists";
import { MetadataFormData, createDefaultContact, createEmptyReport } from "../../src/lib/metadata-schema";

const dpupr = {
  ...createDefaultContact("pointOfContact"),
  organisationName: "Dinas PUPR-PERA Provinsi Kalimantan Timur",
  positionName: "Kepala Bidang Sumber Daya Air",
  deliveryPoint: "Jl. Tengkawang No. 1",
  city: "Samarinda",
  electronicMailAddress: "pu@kaltimprov.go.id",
};

/** Mengisi seluruh elemen SE 6/2021 di atas hasil parse XML GeoNode Kaltim. */
export function fillCompleteForm(form: MetadataFormData): MetadataFormData {
  const f = structuredClone(form);
  const m = f.metadataInfo;
  m.language = "ind";
  m.hierarchyLevelName = "Provinsi";
  m.metadataStandardName = "SNI 8843-1:2019 / ISO 19115";
  m.metadataStandardVersion = "1.0";
  m.maintenance = { frequency: "annually", updateScope: "dataset", note: "Metadata ditinjau setiap tahun." };
  m.constraints = { classification: "unclassified", useLimitation: "" };

  const id = f.identification;
  id.title = "Jaringan Irigasi Provinsi Kalimantan Timur";
  id.dates = [
    { date: "2026-10-13", dateType: "publication" },
    { date: "2024-06-30", dateType: "creation" },
  ];
  id.abstract = "Sebaran saluran irigasi primer dan sekunder kewenangan Provinsi Kalimantan Timur hasil inventarisasi 2024.";
  id.purpose = "Mendukung perencanaan pengelolaan sumber daya air provinsi.";
  id.topicCategories = ["inlandWaters", "farming", "disaster"];
  id.keywordGroups = [
    { type: "theme", thesaurusName: "", keywords: ["irigasi", "sumber daya air"] },
    { type: "place", thesaurusName: "", keywords: ["Kalimantan Timur"] },
  ];
  id.pointOfContacts = [{ ...dpupr, role: "owner" }];
  id.extent.geographicDescription = "Provinsi Kalimantan Timur";
  id.extent.temporalBegin = "2024-01-01";
  id.extent.temporalEnd = "2024-12-31";
  id.usage = {
    specificUsage: "Telah lulus Penjaminan Kualitas (QA) Walidata Daerah; layak dibagi-pakaikan skala 1:25.000.",
    usageDate: "2026-10-20",
    userDeterminedLimitations: "Belum mencakup jaringan tersier.",
    contact: { ...dpupr, organisationName: "Diskominfo Provinsi Kalimantan Timur", role: "user" },
  };
  id.maintenance = { frequency: "annually", dateOfNextUpdate: "2027-10-13", updateScope: "dataset", note: "Disimpan di server JIGD." };
  id.constraints = {
    useLimitation: "Wajib mencantumkan sumber data.",
    accessConstraints: "otherRestrictions",
    useConstraints: "license",
    otherConstraints: "Data terbuka sesuai kebijakan Satu Data Indonesia.",
    securityClassification: "unclassified",
    securityUserNote: "",
  };

  const s = f.spatialAndContent;
  s.spatialRepresentationType = "vector";
  s.resolutionMode = "scale";
  s.scaleDenominator = 25000;
  s.vectorDetail = { topologyLevel: "geometryOnly", geometricObjectType: "curve", geometricObjectCount: 1520 };
  s.referenceSystems = [
    { code: "4326", codeSpace: "EPSG", version: "6.11" },
    { code: "9480", codeSpace: "EPSG", version: "" },
  ];
  s.contentInfo.featureTypes = ["JaringanIrigasi_LN"];
  s.contentInfo.complianceCode = "true";
  s.contentInfo.language = "ind";
  s.contentInfo.catalogueCitation = {
    title: "Katalog Unsur Geografi Indonesia (KUGI)",
    date: "2023-01-01",
    dateType: "publication",
    edition: "5.0",
    url: "https://kugi.ina-sdi.or.id",
    publisher: "Badan Informasi Geospasial",
  };
  s.contentInfo.attributes = [{ name: "NAMOBJ", dataType: "String", definition: "Nama saluran", domain: "" }];

  const q = f.qualityAndDistribution;
  q.lineageStatement = "Digitasi as-built drawing dan survei lapangan DPUPR 2024.";
  q.sources = [
    { description: "Citra satelit resolusi tinggi 2024", scaleDenominator: 5000, citationTitle: "CSRT BIG 2024", citationDate: "2024-03-01" },
  ];
  q.processSteps = [
    { description: "Digitasi on-screen", rationale: "Membentuk geometri saluran", date: "2024-05-01", processor: { ...dpupr, role: "processor" } },
    { description: "Uji topologi", rationale: "", date: "2024-06-01", processor: createDefaultContact("processor") },
  ];
  q.reports = DQ_ELEMENT_TYPES.map((d, i) => ({
    ...createEmptyReport(d.code),
    nameOfMeasure: d.measureHint,
    measureDescription: `Deskripsi ${d.label}`,
    evaluationMethodType: "directInternal",
    evaluationMethodDescription: "Pemeriksaan otomatis",
    procedureTitle: "KAK Inventarisasi Irigasi 2024",
    procedureDate: "2024-01-15",
    dateTime: "2024-06-15",
    conformance: { specificationTitle: "SNI 19-6502.1-2000", specificationDate: "2000-01-01", explanation: "Sesuai spesifikasi", pass: "true" },
    quantitative: i % 2 === 0 ? { valueUnit: "persen", value: "1.5" } : { valueUnit: "", value: "" },
  }));
  q.distributionFormat = { name: "ESRI Shapefile", version: "1.0", specification: "ESRI Shapefile Technical Description", fileDecompressionTechnique: "ZIP" };
  q.distributor = { contact: { ...dpupr, role: "distributor" }, fees: "Tanpa biaya", orderingInstructions: "Unduh melalui JIGD Kaltim." };
  q.transferSize = 12.4;

  f.advanced.portrayalCatalogue = { title: "Standar Simbolisasi Peta Tematik", date: "2022-01-01", dateType: "publication", edition: "", url: "", publisher: "" };
  f.advanced.applicationSchema = {
    citation: { title: "Kamus Data Irigasi", date: "2024-01-01", dateType: "publication", edition: "", url: "", publisher: "" },
    schemaLanguage: "XML Schema",
    constraintLanguage: "OCL",
  };
  return f;
}
