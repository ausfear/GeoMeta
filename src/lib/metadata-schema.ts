import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Tanggal                                                             */
/* ------------------------------------------------------------------ */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const DAY_MONTH_YEAR = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * Menormalkan nilai tanggal ke YYYY-MM-DD untuk state form.
 * GeoNode (pycsw) menulis <gco:DateTime>2026-10-13T01:56:05Z</gco:DateTime>; komponen jamnya
 * dibuang di sini dan dipertahankan oleh patcher langsung dari DOM asli bila tanggalnya tidak berubah.
 */
export function normalizeDateValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw !== "string") return String(raw);
  const value = raw.trim();
  const iso = value.match(ISO_TIMESTAMP);
  if (iso) return iso[1];
  const dmy = value.match(DAY_MONTH_YEAR);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return value;
}

/** Benar bila YYYY-MM-DD dan tanggalnya benar-benar ada di kalender (menolak 2026-02-31). */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function todayIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dateString = z.preprocess(
  normalizeDateValue,
  z.string().refine((v) => v === "" || isValidIsoDate(v), "Gunakan format tanggal TTTT-BB-HH, mis. 2026-10-13.")
);

/* ------------------------------------------------------------------ */
/* Primitif bervalidasi format                                         */
/* ------------------------------------------------------------------ */
// Kewajiban isi (Wajib ISO / Wajib SDI / Walidata) ditentukan profil di completeness.ts,
// jadi skema ini hanya memeriksa format agar XML GeoNode yang belum lengkap tetap lolos saat dimuat.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailString = z.string().refine((v) => v.trim() === "" || EMAIL_PATTERN.test(v.trim()), "Format alamat email tidak valid.");

const urlString = z.string().refine((v) => {
  const t = v.trim();
  if (!t) return true;
  try {
    const url = new URL(t);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:";
  } catch {
    return false;
  }
}, "Alamat URL harus diawali http:// atau https://.");

const positiveInt = z.number().int("Gunakan bilangan bulat.").positive("Harus lebih besar dari nol.").nullable();
const nonNegative = z.number().nonnegative("Tidak boleh negatif.").nullable();

/** Nilai boolean tiga keadaan untuk select: belum ditentukan, ya, tidak. */
const triBool = z.enum(["", "true", "false"]);
export type TriBool = z.infer<typeof triBool>;

/* ------------------------------------------------------------------ */
/* Blok yang dipakai berulang                                          */
/* ------------------------------------------------------------------ */

export const responsiblePartySchema = z.object({
  individualName: z.string(),
  organisationName: z.string(),
  positionName: z.string(),
  phone: z.string(),
  facsimile: z.string(),
  deliveryPoint: z.string(),
  city: z.string(),
  administrativeArea: z.string(),
  postalCode: z.string(),
  country: z.string(),
  electronicMailAddress: emailString,
  onlineUrl: urlString,
  role: z.string(),
});
export type ResponsibleParty = z.infer<typeof responsiblePartySchema>;

export const citationDateSchema = z.object({
  date: dateString,
  dateType: z.string(),
});
export type CitationDate = z.infer<typeof citationDateSchema>;

/** Sitasi ringkas untuk katalog unsur, katalog simbol, skema aplikasi, dan dokumen acuan. */
export const citationRefSchema = z.object({
  title: z.string(),
  date: dateString,
  dateType: z.string(),
  edition: z.string(),
  url: urlString,
  publisher: z.string(),
});
export type CitationRef = z.infer<typeof citationRefSchema>;

export const keywordGroupSchema = z.object({
  type: z.string(),
  thesaurusName: z.string(),
  keywords: z.array(z.string()),
});
export type KeywordGroup = z.infer<typeof keywordGroupSchema>;

export const onlineResourceSchema = z.object({
  linkage: urlString,
  protocol: z.string(),
  name: z.string(),
  description: z.string(),
  functionCode: z.string(),
  isLockedGeoNode: z.boolean(),
});
export type OnlineResource = z.infer<typeof onlineResourceSchema>;

export const referenceSystemSchema = z.object({
  code: z.string(),
  codeSpace: z.string(),
  version: z.string(),
});
export type ReferenceSystem = z.infer<typeof referenceSystemSchema>;

export const lineageSourceSchema = z.object({
  description: z.string(),
  scaleDenominator: positiveInt,
  citationTitle: z.string(),
  citationDate: dateString,
});
export type LineageSource = z.infer<typeof lineageSourceSchema>;

export const processStepSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  date: dateString,
  processor: responsiblePartySchema,
});
export type ProcessStep = z.infer<typeof processStepSchema>;

export const qualityReportSchema = z.object({
  /** Nama kelas XSD tanpa prefiks, mis. "DQ_CompletenessOmission". */
  elementType: z.string(),
  nameOfMeasure: z.string(),
  measureDescription: z.string(),
  evaluationMethodType: z.string(),
  evaluationMethodDescription: z.string(),
  procedureTitle: z.string(),
  procedureDate: dateString,
  dateTime: dateString,
  conformance: z.object({
    specificationTitle: z.string(),
    specificationDate: dateString,
    explanation: z.string(),
    pass: triBool,
  }),
  quantitative: z.object({
    valueUnit: z.string(),
    value: z.string(),
  }),
});
export type QualityReport = z.infer<typeof qualityReportSchema>;

export const featureAttributeSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  definition: z.string(),
  domain: z.string(),
});
export type FeatureAttribute = z.infer<typeof featureAttributeSchema>;

export const extendedElementSchema = z.object({
  name: z.string(),
  definition: z.string(),
  dataType: z.string(),
  obligation: z.string(),
  parentEntity: z.string(),
  rule: z.string(),
  rationale: z.string(),
});
export type ExtendedElement = z.infer<typeof extendedElementSchema>;

const coordinate = (min: number, max: number) =>
  z.number().min(min, `Minimal ${min}.`).max(max, `Maksimal ${max}.`).nullable();

/* ------------------------------------------------------------------ */
/* Skema form lengkap (5 Bab, SE Kepala BIG No. 6 Tahun 2021)          */
/* ------------------------------------------------------------------ */

export const metadataFormSchema = z.object({
  // Bab 1: Informasi Metadata (MD_Metadata)
  metadataInfo: z.object({
    fileIdentifier: z.string(),
    language: z.string(),
    characterSet: z.string(),
    parentIdentifier: z.string(),
    hierarchyLevel: z.string(),
    hierarchyLevelName: z.string(),
    dateStamp: dateString,
    metadataStandardName: z.string(),
    metadataStandardVersion: z.string(),
    dataSetURI: urlString,
    contacts: z.array(responsiblePartySchema),
    maintenance: z.object({
      frequency: z.string(),
      updateScope: z.string(),
      note: z.string(),
    }),
    constraints: z.object({
      classification: z.string(),
      useLimitation: z.string(),
    }),
  }),

  // Bab 2: Identifikasi Produk Data, QA Walidata, Pemeliharaan & Batasan
  identification: z.object({
    title: z.string(),
    alternateTitle: z.string(),
    dates: z.array(citationDateSchema),
    edition: z.string(),
    identifierCode: z.string(),
    presentationForm: z.string(),
    abstract: z.string(),
    purpose: z.string(),
    credit: z.string(),
    status: z.string(),
    pointOfContacts: z.array(responsiblePartySchema),
    topicCategories: z.array(z.string()),
    keywordGroups: z.array(keywordGroupSchema),
    extent: z.object({
      westBoundLongitude: coordinate(-180, 180),
      eastBoundLongitude: coordinate(-180, 180),
      southBoundLatitude: coordinate(-90, 90),
      northBoundLatitude: coordinate(-90, 90),
      geographicDescription: z.string(),
      temporalBegin: dateString,
      temporalEnd: dateString,
      verticalMin: z.number().nullable(),
      verticalMax: z.number().nullable(),
    }),
    usage: z.object({
      specificUsage: z.string(),
      usageDate: dateString,
      userDeterminedLimitations: z.string(),
      contact: responsiblePartySchema,
    }),
    maintenance: z.object({
      frequency: z.string(),
      dateOfNextUpdate: dateString,
      updateScope: z.string(),
      note: z.string(),
    }),
    constraints: z.object({
      useLimitation: z.string(),
      accessConstraints: z.string(),
      useConstraints: z.string(),
      otherConstraints: z.string(),
      securityClassification: z.string(),
      securityUserNote: z.string(),
    }),
    graphicOverview: z.object({
      fileName: z.string(),
      fileDescription: z.string(),
      fileType: z.string(),
    }),
    supplementalInformation: z.string(),
  }),

  // Bab 3: Representasi Spasial, Sistem Referensi (SRGI) & Konten (KUGI)
  spatialAndContent: z.object({
    spatialRepresentationType: z.string(),
    resolutionMode: z.enum(["scale", "distance"]),
    scaleDenominator: positiveInt,
    groundDistance: z.number().positive("Harus lebih besar dari nol.").nullable(),
    vectorDetail: z.object({
      topologyLevel: z.string(),
      geometricObjectType: z.string(),
      geometricObjectCount: z.number().int("Gunakan bilangan bulat.").nonnegative("Tidak boleh negatif.").nullable(),
    }),
    gridDetail: z.object({
      representationClass: z.enum(["grid", "georectified", "georeferenceable"]),
      numberOfDimensions: positiveInt,
      rowSize: positiveInt,
      columnSize: positiveInt,
      cellGeometry: z.string(),
      transformationParameterAvailability: triBool,
      checkPointAvailability: triBool,
      checkPointDescription: z.string(),
      pointInPixel: z.string(),
      transformationDescription: z.string(),
      controlPointAvailability: triBool,
      orientationParameterAvailability: triBool,
      orientationParameterDescription: z.string(),
      georeferencedParameters: z.string(),
    }),
    referenceSystems: z.array(referenceSystemSchema),
    contentInfo: z.object({
      type: z.enum(["vector", "raster", "none"]),
      featureTypes: z.array(z.string()),
      complianceCode: triBool,
      includedWithDataset: z.boolean(),
      language: z.string(),
      catalogueCitation: citationRefSchema,
      featureCitationUuid: z.string(),
      featureCitationHref: z.string(),
      attributes: z.array(featureAttributeSchema),
      attributeDescription: z.string(),
      coverageContentType: z.string(),
    }),
  }),

  // Bab 4: Kualitas Data (SNI ISO 19157), Garis Silsilah & Distribusi
  qualityAndDistribution: z.object({
    scope: z.string(),
    lineageStatement: z.string(),
    sources: z.array(lineageSourceSchema),
    processSteps: z.array(processStepSchema),
    reports: z.array(qualityReportSchema),
    distributionFormat: z.object({
      name: z.string(),
      version: z.string(),
      specification: z.string(),
      fileDecompressionTechnique: z.string(),
    }),
    distributor: z.object({
      contact: responsiblePartySchema,
      fees: z.string(),
      orderingInstructions: z.string(),
    }),
    transferSize: nonNegative,
    onlineResources: z.array(onlineResourceSchema),
  }),

  // Bab 5: Penyajian, Skema Aplikasi & Ekstensi
  advanced: z.object({
    portrayalCatalogue: citationRefSchema,
    applicationSchema: z.object({
      citation: citationRefSchema,
      schemaLanguage: z.string(),
      constraintLanguage: z.string(),
    }),
    metadataExtension: z.object({
      url: urlString,
      elements: z.array(extendedElementSchema),
    }),
  }),
});

export type MetadataFormData = z.infer<typeof metadataFormSchema>;

/* ------------------------------------------------------------------ */
/* Nilai bawaan                                                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_STANDARD_NAME = "SNI 8843-1:2019 / ISO 19115";

export const createDefaultContact = (role = "pointOfContact"): ResponsibleParty => ({
  individualName: "",
  organisationName: "",
  positionName: "",
  phone: "",
  facsimile: "",
  deliveryPoint: "",
  city: "",
  administrativeArea: "",
  postalCode: "",
  country: "Indonesia",
  electronicMailAddress: "",
  onlineUrl: "",
  role,
});

export const createEmptyCitation = (dateType = "publication"): CitationRef => ({
  title: "",
  date: "",
  dateType,
  edition: "",
  url: "",
  publisher: "",
});

export const createEmptySource = (): LineageSource => ({
  description: "",
  scaleDenominator: null,
  citationTitle: "",
  citationDate: "",
});

export const createEmptyProcessStep = (): ProcessStep => ({
  description: "",
  rationale: "",
  date: "",
  processor: createDefaultContact("processor"),
});

export const createEmptyReport = (elementType = "DQ_CompletenessOmission"): QualityReport => ({
  elementType,
  nameOfMeasure: "",
  measureDescription: "",
  evaluationMethodType: "",
  evaluationMethodDescription: "",
  procedureTitle: "",
  procedureDate: "",
  dateTime: "",
  conformance: { specificationTitle: "", specificationDate: "", explanation: "", pass: "" },
  quantitative: { valueUnit: "", value: "" },
});

export const createEmptyKeywordGroup = (type = "theme"): KeywordGroup => ({ type, thesaurusName: "", keywords: [] });

export const createEmptyAttribute = (): FeatureAttribute => ({ name: "", dataType: "", definition: "", domain: "" });

export const createEmptyExtendedElement = (): ExtendedElement => ({
  name: "",
  definition: "",
  dataType: "characterString",
  obligation: "optional",
  parentEntity: "",
  rule: "",
  rationale: "",
});

export const createEmptyOnlineResource = (): OnlineResource => ({
  linkage: "",
  protocol: "WWW:LINK-1.0-http--link",
  name: "",
  description: "",
  functionCode: "download",
  isLockedGeoNode: false,
});

/**
 * Kerangka form untuk Buat Baru. Parser juga memulai dari sini, lalu mengosongkan
 * nilai bawaan yang tidak ada di XML agar kelengkapan dihitung jujur.
 */
export const createEmptyMetadataForm = (uuid?: string): MetadataFormData => {
  const today = todayIsoDate();

  return {
    metadataInfo: {
      fileIdentifier: uuid || "00000000-0000-4000-8000-000000000000",
      language: "ind",
      characterSet: "utf8",
      parentIdentifier: "",
      hierarchyLevel: "dataset",
      hierarchyLevelName: "",
      dateStamp: today,
      metadataStandardName: DEFAULT_STANDARD_NAME,
      metadataStandardVersion: "1.0",
      dataSetURI: "",
      contacts: [createDefaultContact()],
      maintenance: { frequency: "", updateScope: "", note: "" },
      constraints: { classification: "", useLimitation: "" },
    },
    identification: {
      title: "",
      alternateTitle: "",
      dates: [{ date: today, dateType: "creation" }],
      edition: "",
      identifierCode: "",
      presentationForm: "mapDigital",
      abstract: "",
      purpose: "",
      credit: "",
      status: "completed",
      pointOfContacts: [createDefaultContact("owner")],
      topicCategories: [],
      keywordGroups: [createEmptyKeywordGroup("theme")],
      extent: {
        westBoundLongitude: 95.0,
        eastBoundLongitude: 141.0,
        southBoundLatitude: -11.0,
        northBoundLatitude: 6.0,
        geographicDescription: "",
        temporalBegin: "",
        temporalEnd: "",
        verticalMin: null,
        verticalMax: null,
      },
      usage: {
        specificUsage: "",
        usageDate: "",
        userDeterminedLimitations: "",
        contact: createDefaultContact("user"),
      },
      maintenance: { frequency: "", dateOfNextUpdate: "", updateScope: "dataset", note: "" },
      constraints: {
        useLimitation: "",
        accessConstraints: "license",
        useConstraints: "license",
        otherConstraints: "",
        securityClassification: "unclassified",
        securityUserNote: "",
      },
      graphicOverview: { fileName: "", fileDescription: "", fileType: "" },
      supplementalInformation: "",
    },
    spatialAndContent: {
      spatialRepresentationType: "vector",
      resolutionMode: "scale",
      scaleDenominator: 25000,
      groundDistance: null,
      vectorDetail: { topologyLevel: "geometryOnly", geometricObjectType: "", geometricObjectCount: null },
      gridDetail: {
        representationClass: "grid",
        numberOfDimensions: 2,
        rowSize: null,
        columnSize: null,
        cellGeometry: "area",
        transformationParameterAvailability: "",
        checkPointAvailability: "",
        checkPointDescription: "",
        pointInPixel: "center",
        transformationDescription: "",
        controlPointAvailability: "",
        orientationParameterAvailability: "",
        orientationParameterDescription: "",
        georeferencedParameters: "",
      },
      referenceSystems: [{ code: "9470", codeSpace: "EPSG", version: "" }],
      contentInfo: {
        type: "vector",
        featureTypes: [],
        complianceCode: "",
        includedWithDataset: false,
        language: "ind",
        catalogueCitation: createEmptyCitation(),
        featureCitationUuid: "",
        featureCitationHref: "",
        attributes: [],
        attributeDescription: "",
        coverageContentType: "",
      },
    },
    qualityAndDistribution: {
      scope: "dataset",
      lineageStatement: "",
      sources: [],
      processSteps: [],
      reports: [],
      distributionFormat: { name: "ESRI Shapefile", version: "1.0", specification: "", fileDecompressionTechnique: "" },
      distributor: { contact: createDefaultContact("distributor"), fees: "", orderingInstructions: "" },
      transferSize: null,
      onlineResources: [],
    },
    advanced: {
      portrayalCatalogue: createEmptyCitation(),
      applicationSchema: { citation: createEmptyCitation(), schemaLanguage: "", constraintLanguage: "" },
      metadataExtension: { url: "", elements: [] },
    },
  };
};
