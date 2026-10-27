import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  sanitizeAndValidateXml,
  XmlSecurityError,
  parseIso19139ToForm,
  patchFormToIso19139,
  createXmlDocument,
  unwrapCswAndHoistNamespaces,
  createEmptyMetadataForm,
  CANONICAL_SEQUENCE_MD_METADATA,
  CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION,
} from "../src/lib/xml-engine";

const SAMPLE_XML_PATH = path.resolve(__dirname, "../jaringan_irigasi_prov_kaltim_ISO_Metadata.xml");

describe("Fase 2: XML Engine - Pengujian Nyata File GeoNode Kaltim", () => {
  const rawSampleXml = fs.readFileSync(SAMPLE_XML_PATH, "utf-8");

  describe("1. Keamanan & Sanitasi XXE", () => {
    it("harus meloloskan file sampel GeoNode yang sah", () => {
      expect(() => sanitizeAndValidateXml(rawSampleXml)).not.toThrow();
    });

    it("harus menolak XML dengan deklarasi <!DOCTYPE berbahaya", () => {
      const maliciousXml = `<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test "xxe">]><root>&test;</root>`;
      expect(() => sanitizeAndValidateXml(maliciousXml)).toThrowError(XmlSecurityError);
    });

    it("harus menolak XML dengan deklarasi <!ENTITY berbahaya", () => {
      const maliciousXml = `<root><!ENTITY xxe "evil"></root>`;
      expect(() => sanitizeAndValidateXml(maliciousXml)).toThrowError(XmlSecurityError);
    });

    it("harus menolak payload XML yang melebihi batas 5 MB", () => {
      const hugeXml = "<root>" + "a".repeat(6 * 1024 * 1024) + "</root>";
      expect(() => sanitizeAndValidateXml(hugeXml)).toThrowError(XmlSecurityError);
    });
  });

  describe("2. Unwrapping CSW & Hoisting Namespace", () => {
    it("harus mengekstrak gmd:MD_Metadata dari pembungkus csw:GetRecordByIdResponse dan menyalin namespace", () => {
      const parsedDoc = createXmlDocument(rawSampleXml);
      expect(parsedDoc.documentElement.nodeName).toBe("csw:GetRecordByIdResponse");

      const { doc, rootMetadata } = unwrapCswAndHoistNamespaces(parsedDoc);
      expect(rootMetadata.nodeName).toBe("gmd:MD_Metadata");

      // Verify hoisted namespaces
      expect(rootMetadata.getAttribute("xmlns:gmd")).toBe("http://www.isotc211.org/2005/gmd");
      expect(rootMetadata.getAttribute("xmlns:gco")).toBe("http://www.isotc211.org/2005/gco");
      expect(rootMetadata.getAttribute("xmlns:gml")).toBe("http://www.opengis.net/gml");
      expect(rootMetadata.getAttribute("xmlns:xlink")).toBe("http://www.w3.org/1999/xlink");
      expect(rootMetadata.getAttribute("xsi:schemaLocation")).toContain("http://www.isotc211.org/2005/gmd");
    });
  });

  describe("3. Parsing XML Riil ke State Form (parseIso19139ToForm)", () => {
    const { formData, datasetMeta } = parseIso19139ToForm(rawSampleXml);

    it("harus mengekstrak metadata identitas dan fileIdentifier UUID dengan tepat", () => {
      expect(formData.metadataInfo.fileIdentifier).toBe("7ca717a3-420e-47be-97a9-894c3b3f2fdc");
      expect(formData.metadataInfo.hierarchyLevel).toBe("dataset");
      expect(formData.metadataInfo.characterSet).toBe("utf8");
    });

    it("harus menormalisasi CI_RoleCode non-standar GeoNode", () => {
      expect(formData.metadataInfo.contacts.length).toBe(2);

      // Contact 1: "Metadata Author" -> "author"
      expect(formData.metadataInfo.contacts[0].role).toBe("author");
      expect(formData.metadataInfo.contacts[0].organisationName).toContain("Dinas Pekerjaan Umum");
      expect(formData.metadataInfo.contacts[0].city).toBe("Samarinda");
      expect(formData.metadataInfo.contacts[0].administrativeArea).toBe("Kalimantan Timur");

      // Contact 2: "Point of Contact" -> "pointOfContact"
      expect(formData.metadataInfo.contacts[1].role).toBe("pointOfContact");
    });

    it("harus membersihkan string placeholder sentinel bawaan GeoNode", () => {
      // Abstract "No abstract provided" -> ""
      expect(formData.identification.abstract).toBe("");

      // Purpose "None" -> ""
      expect(formData.identification.purpose).toBe("");

      // Supplemental info "No information provided" -> ""
      expect(formData.identification.supplementalInformation).toBe("");

      // Other constraints "Not Specified: The original author did not specify a license." -> ""
      expect(formData.identification.constraints.otherConstraints).toBe("");

      // Lineage statement "None" -> ""
      expect(formData.qualityAndDistribution.lineageStatement).toBe("");
    });

    it("harus mempertahankan thumbnail graphicOverview meskipun bernilai 'None'", () => {
      expect(formData.identification.graphicOverview.fileName).toBe("None");
      expect(formData.identification.graphicOverview.fileDescription).toBe(
        "Thumbnail for 'jaringan_irigasi_prov_kaltim'"
      );
      expect(formData.identification.graphicOverview.fileType).toBe("image/png");
    });

    it("harus mengekstrak Bounding Box secara presisi", () => {
      expect(formData.identification.extent.westBoundLongitude).toBeCloseTo(117.268, 2);
      expect(formData.identification.extent.eastBoundLongitude).toBeCloseTo(118.106, 2);
      expect(formData.identification.extent.southBoundLatitude).toBeCloseTo(0.848, 2);
      expect(formData.identification.extent.northBoundLatitude).toBeCloseTo(2.208, 2);
    });

    it("harus mengekstrak seluruh 13 link online distributionInfo dan menguncinya (isLockedGeoNode: true)", () => {
      expect(formData.qualityAndDistribution.onlineResources.length).toBe(13);
      for (const res of formData.qualityAndDistribution.onlineResources) {
        expect(res.isLockedGeoNode).toBe(true);
        expect(res.linkage).toContain("jigd.kaltimprov.go.id");
      }
    });

    it("harus mengauto-deteksi informasi dataset (PK, UUID, Host GeoNode)", () => {
      expect(datasetMeta.uuid).toBe("7ca717a3-420e-47be-97a9-894c3b3f2fdc");
      expect(datasetMeta.pk).toBe("737");
      expect(datasetMeta.baseUrl).toBe("https://jigd.kaltimprov.go.id");
      expect(datasetMeta.title).toBe("jaringan_irigasi_prov_kaltim");
      expect(datasetMeta.alternateTitle).toBe("geonode:jaringan_irigasi_prov_kaltim");
    });
  });

  describe("4. Non-Destructive Patching & Canonical Order (patchFormToIso19139)", () => {
    it("harus menambal data baru tanpa menghilangkan 13 link asli GeoNode", () => {
      const { formData } = parseIso19139ToForm(rawSampleXml);

      // Ubah data
      formData.identification.abstract = "Jaringan irigasi primer dan sekunder kewenangan Provinsi Kalimantan Timur.";
      formData.identification.topicCategories = ["inlandWaters", "farming"];
      formData.qualityAndDistribution.lineageStatement = "Hasil digitasi dan survei lapangan DPUPR Kaltim tahun 2024.";

      // Tambah link eksternal kustom baru
      formData.qualityAndDistribution.onlineResources.push({
        linkage: "https://dpu.kaltimprov.go.id/dokumen-irigasi.pdf",
        protocol: "WWW:LINK-1.0-http--link",
        name: "Laporan Teknis Jaringan Irigasi",
        description: "Dokumen rincian inventarisasi irigasi Kaltim",
        functionCode: "information",
        isLockedGeoNode: false,
      });

      const patchedXml = patchFormToIso19139(formData, rawSampleXml);

      // Parse ulang hasil patch untuk verifikasi
      const reParsed = parseIso19139ToForm(patchedXml);

      // Pastikan data baru masuk
      expect(reParsed.formData.identification.abstract).toBe(
        "Jaringan irigasi primer dan sekunder kewenangan Provinsi Kalimantan Timur."
      );
      expect(reParsed.formData.identification.topicCategories).toEqual(["inlandWaters", "farming"]);
      expect(reParsed.formData.qualityAndDistribution.lineageStatement).toBe(
        "Hasil digitasi dan survei lapangan DPUPR Kaltim tahun 2024."
      );

      // Pastikan seluruh 13 link asli GeoNode tetap ada
      const geoNodeLinks = reParsed.formData.qualityAndDistribution.onlineResources.filter((r) =>
        r.linkage.includes("jigd.kaltimprov.go.id")
      );
      expect(geoNodeLinks.length).toBe(13);

      // Pastikan thumbnail tetap ada
      expect(reParsed.formData.identification.graphicOverview.fileName).toBe("None");
      expect(reParsed.formData.identification.graphicOverview.fileDescription).toBe(
        "Thumbnail for 'jaringan_irigasi_prov_kaltim'"
      );
    });

    it("harus membersihkan tag kosong <gmd:spatialRepresentationInfo/> agar valid XSD", () => {
      const { formData } = parseIso19139ToForm(rawSampleXml);
      const patchedXml = patchFormToIso19139(formData, rawSampleXml);

      // Jangan ada tag kosong <gmd:spatialRepresentationInfo/>
      expect(patchedXml).not.toContain("<gmd:spatialRepresentationInfo/>");
      expect(patchedXml).not.toContain("<gmd:spatialRepresentationInfo />");
    });

    it("harus menjaga urutan sekuens kanonik XSD (xs:sequence) pada MD_Metadata & MD_DataIdentification", () => {
      const { formData } = parseIso19139ToForm(rawSampleXml);
      formData.identification.abstract = "Uji urutan sekuens XSD ISO/TS 19139.";
      formData.identification.topicCategories = ["inlandWaters"];
      formData.qualityAndDistribution.lineageStatement = "Uji silsilah data.";

      const patchedXml = patchFormToIso19139(formData, rawSampleXml);
      const doc = createXmlDocument(patchedXml);
      const root = doc.documentElement;

      // Verifikasi urutan anak MD_Metadata
      const childNames: string[] = [];
      for (let i = 0; i < root.childNodes.length; i++) {
        if (root.childNodes[i].nodeType === 1) {
          childNames.push((root.childNodes[i] as Element).nodeName);
        }
      }

      let lastIndex = -1;
      for (const name of childNames) {
        const canonicalIndex = CANONICAL_SEQUENCE_MD_METADATA.indexOf(name);
        if (canonicalIndex !== -1) {
          expect(canonicalIndex).toBeGreaterThanOrEqual(lastIndex);
          lastIndex = canonicalIndex;
        }
      }

      // Verifikasi urutan anak MD_DataIdentification
      let dataIdentNode: Element | null = null;
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i] as Element;
        if (node.nodeName === "gmd:identificationInfo") {
          for (let j = 0; j < node.childNodes.length; j++) {
            if (node.childNodes[j].nodeName === "gmd:MD_DataIdentification") {
              dataIdentNode = node.childNodes[j] as Element;
              break;
            }
          }
        }
      }

      expect(dataIdentNode).not.toBeNull();
      if (dataIdentNode) {
        const identChildNames: string[] = [];
        for (let i = 0; i < dataIdentNode.childNodes.length; i++) {
          if (dataIdentNode.childNodes[i].nodeType === 1) {
            identChildNames.push((dataIdentNode.childNodes[i] as Element).nodeName);
          }
        }

        let lastIdentIndex = -1;
        for (const name of identChildNames) {
          const canonicalIndex = CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION.indexOf(name);
          if (canonicalIndex !== -1) {
            expect(canonicalIndex).toBeGreaterThanOrEqual(lastIdentIndex);
            lastIdentIndex = canonicalIndex;
          }
        }
      }
    });

    it("harus mampu menghasilkan XML ISO 19139 baru dari template kosong (createEmptyMetadataForm)", () => {
      const emptyForm = createEmptyMetadataForm("11111111-2222-4333-8444-555555555555");
      emptyForm.identification.title = "Peta Batas Administrasi Desa Baru";
      emptyForm.identification.abstract = "Dataset batas administrasi wilayah desa dibuat baru dari nol.";

      const generatedXml = patchFormToIso19139(emptyForm);
      expect(generatedXml).toContain("<gmd:MD_Metadata");
      expect(generatedXml).toContain("11111111-2222-4333-8444-555555555555");
      expect(generatedXml).toContain("Peta Batas Administrasi Desa Baru");
      expect(generatedXml).toContain("Dataset batas administrasi wilayah desa dibuat baru dari nol.");
    });
  });
});
