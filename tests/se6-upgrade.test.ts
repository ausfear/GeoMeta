import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  parseIso19139ToForm,
  patchFormToIso19139,
  createXmlDocument,
  childElements,
  findDirectChild,
  findDirectChildren,
  findPath,
  metadataFormSchema,
  normalizeDateValue,
  CANONICAL_SEQUENCE_MD_METADATA,
  CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION,
  CANONICAL_SEQUENCE_DQ_DATA_QUALITY,
  CANONICAL_SEQUENCE_DQ_ELEMENT,
  CANONICAL_SEQUENCE_DQ_CONFORMANCE_RESULT,
  CANONICAL_SEQUENCE_DQ_QUANTITATIVE_RESULT,
  CANONICAL_SEQUENCE_LI_LINEAGE,
  CANONICAL_SEQUENCE_LI_PROCESS_STEP,
  CANONICAL_SEQUENCE_LI_SOURCE,
  CANONICAL_SEQUENCE_MD_USAGE,
  CANONICAL_SEQUENCE_MD_DISTRIBUTION,
  CANONICAL_SEQUENCE_MD_DIGITAL_TRANSFER_OPTIONS,
  CANONICAL_SEQUENCE_MD_DISTRIBUTOR,
  CANONICAL_SEQUENCE_MD_FORMAT,
  CANONICAL_SEQUENCE_MD_FEATURE_CATALOGUE_DESCRIPTION,
  CANONICAL_SEQUENCE_MD_MAINTENANCE_INFORMATION,
  CANONICAL_SEQUENCE_EX_EXTENT,
  CANONICAL_SEQUENCE_CI_CITATION,
  CANONICAL_SEQUENCE_MD_GEORECTIFIED,
  CANONICAL_SEQUENCE_MD_GEOREFERENCEABLE,
  DQ_ELEMENT_TYPES,
  findEpsgPreset,
  PROMSI_THESAURUS,
} from "../src/lib/xml-engine";
import { calculateMetadataCompleteness, isFilled } from "../src/lib/completeness";
import { valuesEqual, summarizeValue } from "../src/lib/value-utils";
import { fillCompleteForm } from "./fixtures/full-form";

const SAMPLE_XML = fs.readFileSync(path.resolve(__dirname, "../jaringan_irigasi_prov_kaltim_ISO_Metadata.xml"), "utf-8");

/* ------------------------------------------------------------------ */
/* Helper urutan xs:sequence                                           */
/* ------------------------------------------------------------------ */

function names(el: Element): string[] {
  return childElements(el).map((c) => c.nodeName);
}

/** Setiap anak harus muncul dalam urutan tidak menurun pada daftar sekuens, dan semuanya dikenal. */
function expectCanonicalOrder(el: Element, sequence: string[]) {
  let last = -1;
  for (const name of names(el)) {
    const idx = sequence.indexOf(name);
    expect(idx, `${name} tidak dikenal di dalam ${el.nodeName}`).toBeGreaterThan(-1);
    expect(idx, `${name} keluar urutan di dalam ${el.nodeName} (${names(el).join(", ")})`).toBeGreaterThanOrEqual(last);
    last = idx;
  }
}

function rootOf(xml: string): Element {
  return createXmlDocument(xml).documentElement;
}

function onlineLinkages(root: Element): string[] {
  const dto = findPath(root, ["gmd:distributionInfo", "gmd:MD_Distribution", "gmd:transferOptions", "gmd:MD_DigitalTransferOptions"]);
  return dto
    ? findDirectChildren(dto, "gmd:onLine").map((o) => findPath(o, ["gmd:CI_OnlineResource", "gmd:linkage", "gmd:URL"])?.textContent?.trim() ?? "")
    : [];
}

/* ------------------------------------------------------------------ */
/* 1. Tanggal gco:DateTime                                             */
/* ------------------------------------------------------------------ */

describe("Tahap A: normalisasi tanggal gco:DateTime", () => {
  const { formData } = parseIso19139ToForm(SAMPLE_XML);

  it("membaca 2026-10-13T01:56:05Z sebagai 2026-10-13", () => {
    expect(formData.metadataInfo.dateStamp).toBe("2026-10-13");
    expect(formData.identification.dates).toEqual([{ date: "2026-10-13", dateType: "publication" }]);
  });

  it("lolos validasi skema Zod tanpa error saat XML GeoNode pertama kali dimuat", () => {
    const result = metadataFormSchema.safeParse(formData);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it("z.preprocess menormalkan timestamp ISO sebelum regex YYYY-MM-DD", () => {
    const withTimestamp = structuredClone(formData);
    withTimestamp.metadataInfo.dateStamp = "2026-10-13T01:56:05Z";
    withTimestamp.qualityAndDistribution.processSteps = [];
    const result = metadataFormSchema.safeParse(withTimestamp);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.metadataInfo.dateStamp).toBe("2026-10-13");

    withTimestamp.metadataInfo.dateStamp = "2026-02-31";
    expect(metadataFormSchema.safeParse(withTimestamp).success).toBe(false);
  });

  it("normalizeDateValue menerima variasi format umum", () => {
    expect(normalizeDateValue("2026-10-13T01:56:05Z")).toBe("2026-10-13");
    expect(normalizeDateValue("2026-10-13T01:56:05.123+07:00")).toBe("2026-10-13");
    expect(normalizeDateValue("13/10/2026")).toBe("2026-10-13");
    expect(normalizeDateValue(undefined)).toBe("");
  });

  it("mempertahankan jam asli gco:DateTime bila tanggal tidak berubah, dan menulis T00:00:00Z bila berubah", () => {
    const untouched = patchFormToIso19139(formData, SAMPLE_XML);
    expect(untouched).toContain("<gco:DateTime>2026-10-13T01:56:05Z</gco:DateTime>");
    expect(untouched).toContain("<gco:DateTime>2026-10-13T01:56:01Z</gco:DateTime>");

    const changed = structuredClone(formData);
    changed.metadataInfo.dateStamp = "2026-10-27";
    changed.identification.dates[0].date = "2026-10-20";
    const xml = patchFormToIso19139(changed, SAMPLE_XML);
    expect(xml).toContain("<gco:DateTime>2026-10-27T00:00:00Z</gco:DateTime>");
    expect(xml).toContain("<gco:DateTime>2026-10-20T00:00:00Z</gco:DateTime>");
    expect(parseIso19139ToForm(xml).formData.metadataInfo.dateStamp).toBe("2026-10-27");
  });

  it("menulis tanggal baru sebagai gco:Date, kecuali LI_ProcessStep/dateTime dan usageDateTime", () => {
    const xml = patchFormToIso19139(fillCompleteForm(formData), SAMPLE_XML);
    expect(xml).toContain("<gco:Date>2024-06-30</gco:Date>");
    expect(xml).toContain("<gco:DateTime>2024-05-01T00:00:00Z</gco:DateTime>");
    expect(xml).toContain("<gco:DateTime>2026-10-20T00:00:00Z</gco:DateTime>");
  });

  it("tidak menulis BOM atau deklarasi XML ganda", () => {
    const xml = patchFormToIso19139(formData, SAMPLE_XML);
    expect(xml.charCodeAt(0)).not.toBe(0xfeff);
    expect(xml.match(/<\?xml/g)?.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Serialisasi SE 6/2021 sesuai xs:sequence                         */
/* ------------------------------------------------------------------ */

describe("Tahap B: serialisasi elemen SE 6/2021 dalam urutan xs:sequence ISO 19139", () => {
  const parsed = parseIso19139ToForm(SAMPLE_XML).formData;
  const full = fillCompleteForm(parsed);
  const xml = patchFormToIso19139(full, SAMPLE_XML);
  const root = rootOf(xml);
  const dataIdent = findPath(root, ["gmd:identificationInfo", "gmd:MD_DataIdentification"])!;
  const dq = findPath(root, ["gmd:dataQualityInfo", "gmd:DQ_DataQuality"])!;

  it("mempertahankan ke-13 <gmd:onLine> bawaan GeoNode tanpa perubahan urutan", () => {
    const original = onlineLinkages(rootOf(patchFormToIso19139(parsed, SAMPLE_XML)));
    expect(original).toHaveLength(13);
    expect(onlineLinkages(root)).toEqual(original);
    expect(onlineLinkages(root).every((l) => l.includes("jigd.kaltimprov.go.id"))).toBe(true);
  });

  it("menulis ke-15 kelas DQ_* dengan nama kelas XSD gmd: yang tepat", () => {
    const classes = findDirectChildren(dq, "gmd:report").map((r) => childElements(r)[0].nodeName);
    expect(classes).toEqual(DQ_ELEMENT_TYPES.map((d) => `gmd:${d.code}`));
  });

  it("menjaga urutan AbstractDQ_Element_Type di setiap laporan kualitas", () => {
    for (const report of findDirectChildren(dq, "gmd:report")) {
      const element = childElements(report)[0];
      expectCanonicalOrder(element, CANONICAL_SEQUENCE_DQ_ELEMENT);
      expect(names(element)).toEqual([
        "gmd:nameOfMeasure",
        "gmd:measureDescription",
        "gmd:evaluationMethodType",
        "gmd:evaluationMethodDescription",
        "gmd:evaluationProcedure",
        "gmd:dateTime",
        "gmd:result",
        ...(names(element).length === 8 ? ["gmd:result"] : []),
      ]);
      for (const result of findDirectChildren(element, "gmd:result")) {
        const conformance = findDirectChild(result, "gmd:DQ_ConformanceResult");
        const quantitative = findDirectChild(result, "gmd:DQ_QuantitativeResult");
        if (conformance) expect(names(conformance)).toEqual(CANONICAL_SEQUENCE_DQ_CONFORMANCE_RESULT);
        if (quantitative) expectCanonicalOrder(quantitative, CANONICAL_SEQUENCE_DQ_QUANTITATIVE_RESULT);
      }
    }
  });

  it("menempatkan report di antara scope dan lineage pada DQ_DataQuality", () => {
    expectCanonicalOrder(dq, CANONICAL_SEQUENCE_DQ_DATA_QUALITY);
    const n = names(dq);
    expect(n[0]).toBe("gmd:scope");
    expect(n[n.length - 1]).toBe("gmd:lineage");
  });

  it("menulis LI_Lineage, LI_ProcessStep, dan LI_Source dalam urutan XSD", () => {
    const lineage = findPath(dq, ["gmd:lineage", "gmd:LI_Lineage"])!;
    expectCanonicalOrder(lineage, CANONICAL_SEQUENCE_LI_LINEAGE);
    expect(names(lineage)).toEqual(["gmd:statement", "gmd:processStep", "gmd:processStep", "gmd:source"]);

    const steps = findDirectChildren(lineage, "gmd:processStep").map((p) => findDirectChild(p, "gmd:LI_ProcessStep")!);
    expect(names(steps[0])).toEqual(["gmd:description", "gmd:rationale", "gmd:dateTime", "gmd:processor"]);
    steps.forEach((s) => expectCanonicalOrder(s, CANONICAL_SEQUENCE_LI_PROCESS_STEP));

    const source = findPath(lineage, ["gmd:source", "gmd:LI_Source"])!;
    expect(names(source)).toEqual(["gmd:description", "gmd:scaleDenominator", "gmd:sourceCitation"]);
    expectCanonicalOrder(source, CANONICAL_SEQUENCE_LI_SOURCE);
  });

  it("menulis MD_Usage (QA Walidata) pada posisi resourceSpecificUsage", () => {
    const usage = findPath(dataIdent, ["gmd:resourceSpecificUsage", "gmd:MD_Usage"])!;
    expect(names(usage)).toEqual(CANONICAL_SEQUENCE_MD_USAGE);
    expectCanonicalOrder(dataIdent, CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION);
    const maintenance = findPath(dataIdent, ["gmd:resourceMaintenance", "gmd:MD_MaintenanceInformation"])!;
    expectCanonicalOrder(maintenance, CANONICAL_SEQUENCE_MD_MAINTENANCE_INFORMATION);
  });

  it("menjaga urutan anak MD_Metadata, EX_Extent, dan CI_Citation", () => {
    expectCanonicalOrder(root, CANONICAL_SEQUENCE_MD_METADATA);
    expect(names(root)).toContain("gmd:metadataMaintenance");
    expect(names(root)).toContain("gmd:portrayalCatalogueInfo");
    expect(names(root)).toContain("gmd:applicationSchemaInfo");
    expectCanonicalOrder(findPath(dataIdent, ["gmd:extent", "gmd:EX_Extent"])!, CANONICAL_SEQUENCE_EX_EXTENT);
    expectCanonicalOrder(findPath(dataIdent, ["gmd:citation", "gmd:CI_Citation"])!, CANONICAL_SEQUENCE_CI_CITATION);
  });

  it("menulis MD_Distributor, MD_Format, dan transferSize sebelum onLine", () => {
    const dist = findPath(root, ["gmd:distributionInfo", "gmd:MD_Distribution"])!;
    expect(names(dist)).toEqual(CANONICAL_SEQUENCE_MD_DISTRIBUTION);
    expectCanonicalOrder(findPath(dist, ["gmd:distributor", "gmd:MD_Distributor"])!, CANONICAL_SEQUENCE_MD_DISTRIBUTOR);
    expectCanonicalOrder(findPath(dist, ["gmd:distributionFormat", "gmd:MD_Format"])!, CANONICAL_SEQUENCE_MD_FORMAT);
    const dto = findPath(dist, ["gmd:transferOptions", "gmd:MD_DigitalTransferOptions"])!;
    expectCanonicalOrder(dto, CANONICAL_SEQUENCE_MD_DIGITAL_TRANSFER_OPTIONS);
    expect(names(dto)[0]).toBe("gmd:transferSize");
  });

  it("menulis KUGI MD_FeatureCatalogueDescription tanpa membuang uuidref & xlink:href GeoNode", () => {
    const fcd = findPath(root, ["gmd:contentInfo", "gmd:MD_FeatureCatalogueDescription"])!;
    expectCanonicalOrder(fcd, CANONICAL_SEQUENCE_MD_FEATURE_CATALOGUE_DESCRIPTION);
    const citation = findDirectChild(fcd, "gmd:featureCatalogueCitation")!;
    expect(citation.getAttribute("uuidref")).toBe("7ca717a3-420e-47be-97a9-894c3b3f2fdc");
    expect(citation.getAttribute("xlink:href")).toContain("/dataset/737/feature_catalogue");
    expect(xml).toContain("<gco:LocalName>JaringanIrigasi_LN</gco:LocalName>");
    expect(xml).not.toMatch(/<gco:Boolean>[01]<\/gco:Boolean>/);
  });

  it("membaca kembali seluruh isian (round trip) dan menghasilkan XML yang sama bila ditambal ulang", () => {
    const reparsed = parseIso19139ToForm(xml).formData;
    expect(reparsed.qualityAndDistribution.reports).toEqual(full.qualityAndDistribution.reports);
    expect(reparsed.qualityAndDistribution.sources).toEqual(full.qualityAndDistribution.sources);
    expect(reparsed.qualityAndDistribution.processSteps[0].processor.organisationName).toBe("Dinas PUPR-PERA Provinsi Kalimantan Timur");
    expect(reparsed.identification.usage).toEqual(full.identification.usage);
    expect(reparsed.identification.maintenance).toEqual(full.identification.maintenance);
    expect(reparsed.identification.constraints).toEqual(full.identification.constraints);
    expect(reparsed.identification.extent).toEqual(full.identification.extent);
    expect(reparsed.metadataInfo.maintenance).toEqual(full.metadataInfo.maintenance);
    expect(reparsed.metadataInfo.hierarchyLevelName).toBe("Provinsi");
    expect(reparsed.spatialAndContent.vectorDetail).toEqual(full.spatialAndContent.vectorDetail);
    expect(reparsed.spatialAndContent.referenceSystems).toEqual(full.spatialAndContent.referenceSystems);
    expect(reparsed.spatialAndContent.contentInfo.catalogueCitation).toEqual(full.spatialAndContent.contentInfo.catalogueCitation);
    expect(reparsed.spatialAndContent.contentInfo.attributes).toEqual(full.spatialAndContent.contentInfo.attributes);
    expect(reparsed.qualityAndDistribution.distributor).toEqual(full.qualityAndDistribution.distributor);
    expect(reparsed.qualityAndDistribution.distributionFormat).toEqual(full.qualityAndDistribution.distributionFormat);
    expect(reparsed.qualityAndDistribution.transferSize).toBe(12.4);
    expect(reparsed.advanced.applicationSchema).toEqual(full.advanced.applicationSchema);

    expect(patchFormToIso19139(reparsed, xml)).toBe(xml);
  });
});

describe("Tahap B: jembatan topik ProMSI 20 & 21 dan sub-kelas grid", () => {
  const parsed = parseIso19139ToForm(SAMPLE_XML).formData;

  it("menulis Bencana sebagai environment + kata kunci SNI 8843-1:2019 dan membacanya kembali sebagai topik 21", () => {
    const form = structuredClone(parsed);
    form.identification.topicCategories = ["disaster", "extraTerrestrial"];
    const xml = patchFormToIso19139(form, SAMPLE_XML);
    expect(xml).toContain("<gmd:MD_TopicCategoryCode>environment</gmd:MD_TopicCategoryCode>");
    expect(xml).toContain("<gmd:MD_TopicCategoryCode>geoscientificInformation</gmd:MD_TopicCategoryCode>");
    expect(xml).not.toContain(">disaster<");
    expect(xml).toContain(PROMSI_THESAURUS);

    const back = parseIso19139ToForm(xml).formData.identification;
    expect(back.topicCategories).toEqual(expect.arrayContaining(["disaster", "extraTerrestrial"]));
    expect(back.keywordGroups.some((g) => g.thesaurusName === PROMSI_THESAURUS)).toBe(false);
  });

  it.each([
    ["georectified", "gmd:MD_Georectified", CANONICAL_SEQUENCE_MD_GEORECTIFIED],
    ["georeferenceable", "gmd:MD_Georeferenceable", CANONICAL_SEQUENCE_MD_GEOREFERENCEABLE],
  ] as const)("menulis sub-kelas %s dalam urutan XSD dan membacanya kembali", (cls, tag, sequence) => {
    const form = structuredClone(parsed);
    form.spatialAndContent.spatialRepresentationType = "grid";
    form.spatialAndContent.gridDetail = {
      ...form.spatialAndContent.gridDetail,
      representationClass: cls,
      numberOfDimensions: 2,
      rowSize: 4000,
      columnSize: 3500,
      cellGeometry: "area",
      transformationParameterAvailability: "true",
      checkPointAvailability: "true",
      checkPointDescription: "12 titik GCP",
      pointInPixel: "center",
      controlPointAvailability: "true",
      orientationParameterAvailability: "false",
      georeferencedParameters: "RPC",
    };
    const xml = patchFormToIso19139(form, SAMPLE_XML);
    const grid = findPath(rootOf(xml), ["gmd:spatialRepresentationInfo", tag])!;
    expect(grid).not.toBeNull();
    expectCanonicalOrder(grid, sequence);
    const back = parseIso19139ToForm(xml).formData.spatialAndContent;
    expect(back.gridDetail.representationClass).toBe(cls);
    expect([back.gridDetail.rowSize, back.gridDetail.columnSize]).toEqual([4000, 3500]);
  });

  it("memakai kode EPSG SRGI 2013 sesuai registri EPSG", () => {
    expect(findEpsgPreset("9470")?.label).toBe("SRGI 2013 Geografis 2D");
    expect(findEpsgPreset("9480")?.label).toBe("SRGI 2013 / UTM 50N");
    expect(findEpsgPreset("9490")?.label).toBe("SRGI 2013 / UTM 50S");
    expect(findEpsgPreset("9476")?.label).toBe("SRGI 2013 / UTM 46N");
    expect(findEpsgPreset("9494")?.label).toBe("SRGI 2013 / UTM 54S");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Kalkulator kelengkapan per bab untuk ketiga profil               */
/* ------------------------------------------------------------------ */

describe("Tahap C: kalkulator kelengkapan per bab & per kartu", () => {
  const parsed = parseIso19139ToForm(SAMPLE_XML).formData;

  it("menghitung placeholder GeoNode sebagai belum terisi", () => {
    expect(isFilled("None")).toBe(false);
    expect(isFilled("No abstract provided")).toBe(false);
    expect(isFilled("No information provided")).toBe(false);
    expect(isFilled("  Samarinda ")).toBe(true);
  });

  it("ISO Minimum: 10/12 (abstrak & kategori topik belum ada)", () => {
    const r = calculateMetadataCompleteness(parsed, "iso_core");
    expect([r.done, r.total, r.percent]).toEqual([10, 12, 83]);
    expect([r.steps[1].done, r.steps[1].total, r.steps[1].percent]).toEqual([7, 7, 100]);
    expect([r.steps[2].done, r.steps[2].total, r.steps[2].percent]).toEqual([3, 5, 60]);
    expect([r.steps[3].total, r.steps[4].total]).toEqual([0, 0]);
    expect(r.missing.map((m) => m.id).sort()).toEqual(["abstract", "topicCategory"]);
  });

  it("Standar SDI — Produsen: 26/45 dengan rincian per bab", () => {
    const r = calculateMetadataCompleteness(parsed, "sdi_produsen");
    expect([r.done, r.total, r.percent]).toEqual([26, 45, 57]);
    expect([r.steps[1].done, r.steps[1].total]).toEqual([12, 14]);
    expect([r.steps[2].done, r.steps[2].total]).toEqual([9, 18]);
    expect([r.steps[3].done, r.steps[3].total]).toEqual([1, 5]);
    expect([r.steps[4].done, r.steps[4].total]).toEqual([4, 8]);
    expect(r.cards.citation).toEqual({ done: 5, total: 7, percent: 71 });
    expect(r.cards.usage).toBeUndefined();
  });

  it("Verifikasi SDI — Walidata: menambah QA (MD_Usage) dan distributor", () => {
    const r = calculateMetadataCompleteness(parsed, "sdi_walidata");
    expect([r.done, r.total, r.percent]).toEqual([26, 50, 52]);
    expect([r.steps[2].done, r.steps[2].total, r.steps[2].percent]).toEqual([9, 21, 42]);
    expect([r.steps[4].done, r.steps[4].total, r.steps[4].percent]).toEqual([4, 10, 40]);
    expect(r.cards.usage).toEqual({ done: 0, total: 3, percent: 0 });
  });

  it("mencapai 100% di ketiga profil setelah seluruh isian SE 6/2021 dilengkapi", () => {
    const full = fillCompleteForm(parsed);
    for (const profile of ["iso_core", "sdi_produsen", "sdi_walidata"] as const) {
      const r = calculateMetadataCompleteness(full, profile);
      expect(r.missing.map((m) => m.id), profile).toEqual([]);
      expect(r.percent).toBe(100);
    }
  });

  it("otherConstraints hanya dihitung bila otherRestrictions dipilih", () => {
    const form = structuredClone(parsed);
    const base = calculateMetadataCompleteness(form, "sdi_produsen").total;
    form.identification.constraints.accessConstraints = "otherRestrictions";
    expect(calculateMetadataCompleteness(form, "sdi_produsen").total).toBe(base + 1);
  });
});

describe("Tahap A: utilitas undo per kolom", () => {
  it("menganggap string kosong, null, dan undefined setara", () => {
    expect(valuesEqual("", undefined)).toBe(true);
    expect(valuesEqual(null, "")).toBe(true);
    expect(valuesEqual({ a: "", b: [1] }, { b: [1] })).toBe(true);
    expect(valuesEqual("Samarinda", "")).toBe(false);
  });

  it("memotong pratinjau nilai awal lebih dari 60 karakter", () => {
    expect(summarizeValue("Jl. Tengkawang No. 1")).toBe("Jl. Tengkawang No. 1");
    expect(summarizeValue("x".repeat(80))).toBe(`${"x".repeat(60)}...`);
  });
});
