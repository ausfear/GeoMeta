import { sanitizeAndValidateXml } from "./xxe-sanitizer";
import {
  createXmlDocument,
  unwrapCswAndHoistNamespaces,
  childElements,
  findDirectChild,
  findDirectChildren,
  findPath,
  findChildByLocalName,
  findDescendantByLocalName,
  getTextContent,
  readValue,
  readProp,
  readProps,
  readCode,
  readDate,
  readBoolean,
  readNumber,
} from "./dom-utils";
import { SENTINEL_PLACEHOLDERS } from "./constants";
import {
  MetadataFormData,
  ResponsibleParty,
  OnlineResource,
  CitationRef,
  CitationDate,
  KeywordGroup,
  ReferenceSystem,
  LineageSource,
  ProcessStep,
  QualityReport,
  FeatureAttribute,
  ExtendedElement,
  createDefaultContact,
  createEmptyCitation,
  createEmptyMetadataForm,
  createEmptyReport,
  normalizeDateValue,
} from "../metadata-schema";
import { PROMSI_THESAURUS, TOPIC_XSD_BRIDGE } from "../iso-codelists";

export interface ParsedMetadataResult {
  formData: MetadataFormData;
  rawDoc: Document;
  datasetMeta: {
    uuid: string;
    baseUrl?: string;
    pk?: string;
    title: string;
    alternateTitle: string;
    typename?: string;
  };
}

/* ------------------------------------------------------------------ */
/* Normalisasi                                                         */
/* ------------------------------------------------------------------ */

export function cleanSentinel(value: string, keepNone: boolean = false): string {
  const trimmed = value.trim();
  if (trimmed === "None" && keepNone) return trimmed;
  return SENTINEL_PLACEHOLDERS.includes(trimmed) ? "" : trimmed;
}

/** Teks properti setelah placeholder GeoNode dibersihkan. */
function txt(parent: Element | null, tag: string): string {
  return cleanSentinel(readProp(parent, tag));
}

const STANDARD_ROLES = [
  "resourceProvider",
  "custodian",
  "owner",
  "user",
  "distributor",
  "originator",
  "pointOfContact",
  "principalInvestigator",
  "processor",
  "publisher",
  "author",
];

export function normalizeRoleCode(rawRole: string): string {
  const compact = rawRole.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (compact === "metadataauthor") return "author";
  const match = STANDARD_ROLES.find((r) => r.toLowerCase() === compact);
  return match ?? (rawRole.trim() || "pointOfContact");
}

/* ------------------------------------------------------------------ */
/* Blok berulang                                                       */
/* ------------------------------------------------------------------ */

export function parseResponsibleParty(partyElem: Element): ResponsibleParty {
  const contact = createDefaultContact();
  contact.individualName = txt(partyElem, "gmd:individualName");
  contact.organisationName = txt(partyElem, "gmd:organisationName");
  contact.positionName = txt(partyElem, "gmd:positionName");

  const ciContact = findPath(partyElem, ["gmd:contactInfo", "gmd:CI_Contact"]);
  const phone = findPath(ciContact, ["gmd:phone", "gmd:CI_Telephone"]);
  contact.phone = txt(phone, "gmd:voice");
  contact.facsimile = txt(phone, "gmd:facsimile");

  const address = findPath(ciContact, ["gmd:address", "gmd:CI_Address"]);
  contact.deliveryPoint = txt(address, "gmd:deliveryPoint");
  contact.city = txt(address, "gmd:city");
  contact.administrativeArea = txt(address, "gmd:administrativeArea");
  contact.postalCode = txt(address, "gmd:postalCode");
  contact.country = txt(address, "gmd:country");
  contact.electronicMailAddress = txt(address, "gmd:electronicMailAddress");

  contact.onlineUrl = readProp(findPath(ciContact, ["gmd:onlineResource", "gmd:CI_OnlineResource"]), "gmd:linkage");
  contact.role = normalizeRoleCode(readCode(partyElem, "gmd:role"));
  return contact;
}

/** Properti pembungkus (gmd:contact, gmd:pointOfContact, gmd:processor, ...) ke kontak. */
export function parseContactProperty(prop: Element): ResponsibleParty | null {
  const party = findDirectChild(prop, "gmd:CI_ResponsibleParty");
  return party ? parseResponsibleParty(party) : null;
}

/** Seperti parseContactProperty, tetapi menolak kode peran non-standar agar patcher menulis ulang ke camelCase ISO. */
export function parseContactPropertyStrict(prop: Element): ResponsibleParty | null {
  const party = findDirectChild(prop, "gmd:CI_ResponsibleParty");
  if (!party) return null;
  const rawRole = readCode(party, "gmd:role");
  const parsed = parseResponsibleParty(party);
  return rawRole === parsed.role ? parsed : null;
}

export function parseCitation(ciCitation: Element | null): CitationRef {
  const ref = createEmptyCitation();
  if (!ciCitation) return ref;
  ref.title = txt(ciCitation, "gmd:title");
  const firstDate = findPath(ciCitation, ["gmd:date", "gmd:CI_Date"]);
  ref.date = readDate(firstDate, "gmd:date");
  ref.dateType = readCode(firstDate, "gmd:dateType") || "publication";
  ref.edition = txt(ciCitation, "gmd:edition");
  const party = findPath(ciCitation, ["gmd:citedResponsibleParty", "gmd:CI_ResponsibleParty"]);
  if (party) {
    ref.publisher = txt(party, "gmd:organisationName");
    ref.url = readProp(findPath(party, ["gmd:contactInfo", "gmd:CI_Contact", "gmd:onlineResource", "gmd:CI_OnlineResource"]), "gmd:linkage");
  }
  return ref;
}

/** Properti CI_Citation (mis. gmd:portrayalCatalogueCitation) ke CitationRef. */
export function parseCitationProperty(prop: Element | null): CitationRef {
  return parseCitation(prop ? findDirectChild(prop, "gmd:CI_Citation") : null);
}

export function parseCitationDate(dateProp: Element): CitationDate | null {
  const ciDate = findDirectChild(dateProp, "gmd:CI_Date");
  if (!ciDate) return null;
  const date = readDate(ciDate, "gmd:date");
  if (!date) return null;
  return { date, dateType: readCode(ciDate, "gmd:dateType") || "publication" };
}

export function parseKeywordsProperty(prop: Element): KeywordGroup | null {
  const mdKeywords = findDirectChild(prop, "gmd:MD_Keywords");
  if (!mdKeywords) return null;
  return {
    type: readCode(mdKeywords, "gmd:type"),
    thesaurusName: txt(findPath(mdKeywords, ["gmd:thesaurusName", "gmd:CI_Citation"]), "gmd:title"),
    keywords: readProps(mdKeywords, "gmd:keyword").map((k) => cleanSentinel(k)).filter(Boolean),
  };
}

export function parseReferenceSystemProperty(prop: Element): ReferenceSystem | null {
  const identifier = findPath(prop, ["gmd:MD_ReferenceSystem", "gmd:referenceSystemIdentifier", "gmd:RS_Identifier"]);
  if (!identifier) return null;
  return {
    code: readProp(identifier, "gmd:code"),
    codeSpace: readProp(identifier, "gmd:codeSpace"),
    version: readProp(identifier, "gmd:version"),
  };
}

export function parseMaintenance(prop: Element | null) {
  const info = prop ? findDirectChild(prop, "gmd:MD_MaintenanceInformation") : null;
  return {
    frequency: readCode(info, "gmd:maintenanceAndUpdateFrequency"),
    dateOfNextUpdate: readDate(info, "gmd:dateOfNextUpdate"),
    updateScope: readCode(info, "gmd:updateScope"),
    note: txt(info, "gmd:maintenanceNote"),
  };
}

export function parseMetadataMaintenance(prop: Element | null): MetadataFormData["metadataInfo"]["maintenance"] {
  const { frequency, updateScope, note } = parseMaintenance(prop);
  return { frequency, updateScope, note };
}

export function parseUsage(prop: Element | null): MetadataFormData["identification"]["usage"] {
  const usage = prop ? findDirectChild(prop, "gmd:MD_Usage") : null;
  const contactProp = usage ? findDirectChild(usage, "gmd:userContactInfo") : null;
  return {
    specificUsage: txt(usage, "gmd:specificUsage"),
    usageDate: readDate(usage, "gmd:usageDateTime"),
    userDeterminedLimitations: txt(usage, "gmd:userDeterminedLimitations"),
    contact: (contactProp && parseContactProperty(contactProp)) || createDefaultContact("user"),
  };
}

export function parseOnlineResource(ciOnline: Element, locked: boolean): OnlineResource {
  return {
    linkage: readProp(ciOnline, "gmd:linkage"),
    protocol: readProp(ciOnline, "gmd:protocol"),
    name: readProp(ciOnline, "gmd:name"),
    description: readProp(ciOnline, "gmd:description"),
    functionCode: readCode(ciOnline, "gmd:function"),
    isLockedGeoNode: locked,
  };
}

export function parseSource(prop: Element): LineageSource | null {
  const src = findDirectChild(prop, "gmd:LI_Source");
  if (!src) return null;
  const citation = parseCitationProperty(findDirectChild(src, "gmd:sourceCitation"));
  return {
    description: txt(src, "gmd:description"),
    scaleDenominator: readNumber(findPath(src, ["gmd:scaleDenominator", "gmd:MD_RepresentativeFraction"]), "gmd:denominator"),
    citationTitle: citation.title,
    citationDate: citation.date,
  };
}

export function parseProcessStep(prop: Element): ProcessStep | null {
  const step = findDirectChild(prop, "gmd:LI_ProcessStep");
  if (!step) return null;
  const processorProp = findDirectChild(step, "gmd:processor");
  return {
    description: txt(step, "gmd:description"),
    rationale: txt(step, "gmd:rationale"),
    date: readDate(step, "gmd:dateTime"),
    processor: (processorProp && parseContactProperty(processorProp)) || createDefaultContact("processor"),
  };
}

export function parseLineage(prop: Element | null) {
  const lineage = prop ? findDirectChild(prop, "gmd:LI_Lineage") : null;
  return {
    statement: txt(lineage, "gmd:statement"),
    processSteps: lineage
      ? findDirectChildren(lineage, "gmd:processStep").map(parseProcessStep).filter((s): s is ProcessStep => s !== null)
      : [],
    sources: lineage ? findDirectChildren(lineage, "gmd:source").map(parseSource).filter((s): s is LineageSource => s !== null) : [],
  };
}

function localNameOf(el: Element): string {
  return el.localName || el.nodeName.split(":").pop() || el.nodeName;
}

export function parseReportProperty(prop: Element): QualityReport | null {
  const element = childElements(prop)[0];
  if (!element) return null;
  const report = createEmptyReport(localNameOf(element));

  report.nameOfMeasure = txt(element, "gmd:nameOfMeasure");
  report.measureDescription = txt(element, "gmd:measureDescription");
  report.evaluationMethodType = readCode(element, "gmd:evaluationMethodType");
  report.evaluationMethodDescription = txt(element, "gmd:evaluationMethodDescription");
  const procedure = parseCitationProperty(findDirectChild(element, "gmd:evaluationProcedure"));
  report.procedureTitle = procedure.title;
  report.procedureDate = procedure.date;
  report.dateTime = readDate(element, "gmd:dateTime");

  for (const resultProp of findDirectChildren(element, "gmd:result")) {
    const conformance = findDirectChild(resultProp, "gmd:DQ_ConformanceResult");
    if (conformance) {
      const spec = parseCitationProperty(findDirectChild(conformance, "gmd:specification"));
      report.conformance = {
        specificationTitle: spec.title,
        specificationDate: spec.date,
        explanation: txt(conformance, "gmd:explanation"),
        pass: readBoolean(conformance, "gmd:pass"),
      };
    }
    const quantitative = findDirectChild(resultProp, "gmd:DQ_QuantitativeResult");
    if (quantitative) {
      const unitProp = findDirectChild(quantitative, "gmd:valueUnit");
      let unit = "";
      if (unitProp) {
        const definition = childElements(unitProp)[0];
        const named = definition ? findChildByLocalName(definition, "identifier") || findChildByLocalName(definition, "name") : null;
        unit = getTextContent(named) || unitProp.getAttribute("xlink:href") || "";
      }
      report.quantitative = {
        valueUnit: unit,
        value: readProps(quantitative, "gmd:value").join(", "),
      };
    }
  }
  return report;
}

/* ------------------------------------------------------------------ */
/* Katalog unsur: tabel struktur atribut di otherCitationDetails       */
/* ------------------------------------------------------------------ */
// ISO 19139 tidak punya kelas atribut untuk MD_FeatureCatalogueDescription (itu ranah ISO 19110),
// jadi tabel pembantu KUGI diserialisasikan sebagai teks terstruktur yang tetap valid XSD.

export const ATTRIBUTE_TABLE_MARKER = "Struktur atribut unsur (Nama | Tipe data | Definisi | Domain/Satuan):";

export function serializeAttributeTable(attributes: FeatureAttribute[]): string {
  const rows = attributes
    .filter((a) => a.name.trim())
    .map((a) => `- ${[a.name, a.dataType, a.definition, a.domain].map((v) => v.trim().replace(/\|/g, "/")).join(" | ")}`);
  return rows.length ? [ATTRIBUTE_TABLE_MARKER, ...rows].join("\n") : "";
}

export function parseAttributeTable(text: string): FeatureAttribute[] {
  const start = text.indexOf(ATTRIBUTE_TABLE_MARKER);
  if (start === -1) return [];
  return text
    .slice(start + ATTRIBUTE_TABLE_MARKER.length)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const [name = "", dataType = "", definition = "", domain = ""] = line.slice(2).split("|").map((v) => v.trim());
      return { name, dataType, definition, domain };
    });
}

export function parseFeatureCatalogueDescription(desc: Element) {
  const citationProp = findDirectChild(desc, "gmd:featureCatalogueCitation");
  const ciCitation = citationProp ? findDirectChild(citationProp, "gmd:CI_Citation") : null;
  return {
    featureTypes: readProps(desc, "gmd:featureTypes"),
    complianceCode: readBoolean(desc, "gmd:complianceCode"),
    includedWithDataset: readBoolean(desc, "gmd:includedWithDataset") === "true",
    language: readProp(desc, "gmd:language"),
    catalogueCitation: parseCitation(ciCitation),
    featureCitationUuid: citationProp?.getAttribute("uuidref") || "",
    featureCitationHref: citationProp?.getAttribute("xlink:href") || "",
    attributes: parseAttributeTable(readProp(ciCitation, "gmd:otherCitationDetails")),
  };
}

export function parseExtendedElement(prop: Element): ExtendedElement | null {
  const info = findDirectChild(prop, "gmd:MD_ExtendedElementInformation");
  if (!info) return null;
  return {
    name: txt(info, "gmd:name"),
    definition: txt(info, "gmd:definition"),
    dataType: readCode(info, "gmd:dataType"),
    obligation: readCode(info, "gmd:obligation"),
    parentEntity: readProps(info, "gmd:parentEntity").join(", "),
    rule: txt(info, "gmd:rule"),
    rationale: txt(info, "gmd:rationale"),
  };
}

export function parseApplicationSchemaProperty(prop: Element | null): MetadataFormData["advanced"]["applicationSchema"] {
  const schema = prop ? findDirectChild(prop, "gmd:MD_ApplicationSchemaInformation") : null;
  return {
    citation: parseCitationProperty(schema ? findDirectChild(schema, "gmd:name") : null),
    schemaLanguage: txt(schema, "gmd:schemaLanguage"),
    constraintLanguage: txt(schema, "gmd:constraintLanguage"),
  };
}

export function parseMetadataExtensionProperty(prop: Element | null): MetadataFormData["advanced"]["metadataExtension"] {
  const extension = prop ? findDirectChild(prop, "gmd:MD_MetadataExtensionInformation") : null;
  return {
    url: readProp(findPath(extension, ["gmd:extensionOnLineResource", "gmd:CI_OnlineResource"]), "gmd:linkage"),
    elements: extension
      ? findDirectChildren(extension, "gmd:extendedElementInformation")
          .map(parseExtendedElement)
          .filter((e): e is ExtendedElement => e !== null)
      : [],
  };
}

export function parsePortrayalProperty(prop: Element | null): CitationRef {
  return parseCitationProperty(findPath(prop, ["gmd:MD_PortrayalCatalogueReference", "gmd:portrayalCatalogueCitation"]));
}

/** Membaca semua blok constraints ke bentuk form (dipakai parser dan patcher untuk deteksi perubahan). */
export function parseResourceConstraints(props: Element[]): MetadataFormData["identification"]["constraints"] {
  const target = { useLimitation: "", accessConstraints: "", useConstraints: "", otherConstraints: "", classification: "", userNote: "" };
  parseConstraintsInto(props, target);
  return {
    useLimitation: target.useLimitation,
    accessConstraints: target.accessConstraints,
    useConstraints: target.useConstraints,
    otherConstraints: target.otherConstraints,
    securityClassification: target.classification,
    securityUserNote: target.userNote,
  };
}

export function parseMetadataConstraints(props: Element[]): MetadataFormData["metadataInfo"]["constraints"] {
  const target = { useLimitation: "", classification: "" };
  parseConstraintsInto(props, target);
  return target;
}

/** Duplikat cacat GeoNode: MD_LegalConstraints tanpa kode pembatasan dan otherConstraints "None". */
export function isCorruptedGeoNodeConstraint(prop: Element): boolean {
  const legal = findDirectChild(prop, "gmd:MD_LegalConstraints");
  if (!legal) return false;
  return !readCode(legal, "gmd:accessConstraints") && !readCode(legal, "gmd:useConstraints") && readProp(legal, "gmd:otherConstraints") === "None";
}

/* ------------------------------------------------------------------ */
/* Parser utama                                                        */
/* ------------------------------------------------------------------ */

type Identification = MetadataFormData["identification"];

function parseConstraintsInto(
  constraintProps: Element[],
  target: { useLimitation: string; accessConstraints?: string; useConstraints?: string; otherConstraints?: string; classification: string; userNote?: string }
) {
  for (const prop of constraintProps) {
    const legal = findDirectChild(prop, "gmd:MD_LegalConstraints");
    const security = findDirectChild(prop, "gmd:MD_SecurityConstraints");
    const general = findDirectChild(prop, "gmd:MD_Constraints");
    const block = legal || security || general;
    if (!block) continue;

    if (legal) {
      const access = readCode(legal, "gmd:accessConstraints");
      const use = readCode(legal, "gmd:useConstraints");
      const other = readProp(legal, "gmd:otherConstraints");
      // Duplikat cacat bawaan GeoNode: codeListValue kosong + otherConstraints "None".
      if (!access && !use && other === "None") continue;
      if (access && target.accessConstraints === "") target.accessConstraints = access;
      if (use && target.useConstraints === "") target.useConstraints = use;
      const cleaned = cleanSentinel(other);
      if (cleaned && target.otherConstraints === "") target.otherConstraints = cleaned;
    }
    if (security) {
      const classification = readCode(security, "gmd:classification");
      if (classification && !target.classification) target.classification = classification;
      const note = txt(security, "gmd:userNote");
      if (note && target.userNote === "") target.userNote = note;
    }
    const limitation = txt(block, "gmd:useLimitation");
    if (limitation && !target.useLimitation) target.useLimitation = limitation;
  }
}

function parseExtent(dataIdent: Element, extent: Identification["extent"]) {
  extent.westBoundLongitude = null;
  extent.eastBoundLongitude = null;
  extent.southBoundLatitude = null;
  extent.northBoundLatitude = null;

  for (const extentProp of findDirectChildren(dataIdent, "gmd:extent")) {
    const exExtent = findDirectChild(extentProp, "gmd:EX_Extent");
    if (!exExtent) continue;

    for (const geo of findDirectChildren(exExtent, "gmd:geographicElement")) {
      const bbox = findDirectChild(geo, "gmd:EX_GeographicBoundingBox");
      if (bbox && extent.westBoundLongitude === null) {
        extent.westBoundLongitude = readNumber(bbox, "gmd:westBoundLongitude");
        extent.eastBoundLongitude = readNumber(bbox, "gmd:eastBoundLongitude");
        extent.southBoundLatitude = readNumber(bbox, "gmd:southBoundLatitude");
        extent.northBoundLatitude = readNumber(bbox, "gmd:northBoundLatitude");
      }
      const description = findDirectChild(geo, "gmd:EX_GeographicDescription");
      if (description && !extent.geographicDescription) {
        const identifier = findDirectChild(description, "gmd:geographicIdentifier");
        const id = identifier ? childElements(identifier)[0] : null;
        extent.geographicDescription = cleanSentinel(readProp(id, "gmd:code"));
      }
    }

    for (const temporal of findDirectChildren(exExtent, "gmd:temporalElement")) {
      const extentEl = findPath(temporal, ["gmd:EX_TemporalExtent", "gmd:extent"]);
      if (!extentEl || extent.temporalBegin || extent.temporalEnd) continue;
      const begin = findDescendantByLocalName(extentEl, "beginPosition");
      const end = findDescendantByLocalName(extentEl, "endPosition");
      const instant = findDescendantByLocalName(extentEl, "timePosition");
      extent.temporalBegin = normalizeDateValue(getTextContent(begin ?? instant));
      extent.temporalEnd = normalizeDateValue(getTextContent(end));
    }

    const vertical = findPath(exExtent, ["gmd:verticalElement", "gmd:EX_VerticalExtent"]);
    if (vertical && extent.verticalMin === null && extent.verticalMax === null) {
      extent.verticalMin = readNumber(vertical, "gmd:minimumValue");
      extent.verticalMax = readNumber(vertical, "gmd:maximumValue");
    }
  }
}

function parseSpatialRepresentation(root: Element, form: MetadataFormData) {
  const spatial = form.spatialAndContent;
  for (const prop of findDirectChildren(root, "gmd:spatialRepresentationInfo")) {
    const vector = findDirectChild(prop, "gmd:MD_VectorSpatialRepresentation");
    if (vector) {
      spatial.vectorDetail.topologyLevel = readCode(vector, "gmd:topologyLevel");
      const objects = findPath(vector, ["gmd:geometricObjects", "gmd:MD_GeometricObjects"]);
      spatial.vectorDetail.geometricObjectType = readCode(objects, "gmd:geometricObjectType");
      spatial.vectorDetail.geometricObjectCount = readNumber(objects, "gmd:geometricObjectCount");
      if (!spatial.spatialRepresentationType) spatial.spatialRepresentationType = "vector";
      continue;
    }

    const grid =
      findDirectChild(prop, "gmd:MD_Georectified") ||
      findDirectChild(prop, "gmd:MD_Georeferenceable") ||
      findDirectChild(prop, "gmd:MD_GridSpatialRepresentation");
    if (!grid) continue;

    const detail = spatial.gridDetail;
    detail.representationClass =
      grid.nodeName === "gmd:MD_Georectified" ? "georectified" : grid.nodeName === "gmd:MD_Georeferenceable" ? "georeferenceable" : "grid";
    detail.numberOfDimensions = readNumber(grid, "gmd:numberOfDimensions");
    for (const dimProp of findDirectChildren(grid, "gmd:axisDimensionProperties")) {
      const dim = findDirectChild(dimProp, "gmd:MD_Dimension");
      const name = readCode(dim, "gmd:dimensionName");
      const size = readNumber(dim, "gmd:dimensionSize");
      if (name === "row") detail.rowSize = size;
      if (name === "column") detail.columnSize = size;
    }
    detail.cellGeometry = readCode(grid, "gmd:cellGeometry");
    detail.transformationParameterAvailability = readBoolean(grid, "gmd:transformationParameterAvailability");
    detail.checkPointAvailability = readBoolean(grid, "gmd:checkPointAvailability");
    detail.checkPointDescription = txt(grid, "gmd:checkPointDescription");
    detail.pointInPixel = readCode(grid, "gmd:pointInPixel");
    detail.transformationDescription = txt(grid, "gmd:transformationDimensionDescription");
    detail.controlPointAvailability = readBoolean(grid, "gmd:controlPointAvailability");
    detail.orientationParameterAvailability = readBoolean(grid, "gmd:orientationParameterAvailability");
    detail.orientationParameterDescription = txt(grid, "gmd:orientationParameterDescription");
    detail.georeferencedParameters = txt(grid, "gmd:georeferencedParameters");
    if (!spatial.spatialRepresentationType) spatial.spatialRepresentationType = "grid";
  }
}

export function parseIso19139ToForm(xmlContent: string): ParsedMetadataResult {
  sanitizeAndValidateXml(xmlContent);

  const parsedDoc = createXmlDocument(xmlContent);
  const { doc, rootMetadata: root } = unwrapCswAndHoistNamespaces(parsedDoc);

  // Mulai dari kerangka kosong, lalu kosongkan nilai bawaan yang tidak ada di XML
  // agar kelengkapan tidak menghitung isian yang sebenarnya belum ada.
  const form = createEmptyMetadataForm();
  const info = form.metadataInfo;
  const ident = form.identification;
  const spatial = form.spatialAndContent;
  const quality = form.qualityAndDistribution;

  /* ---------------------------- Bab 1 ---------------------------- */
  info.fileIdentifier = readProp(root, "gmd:fileIdentifier") || info.fileIdentifier;
  info.language = readProp(root, "gmd:language") || readCode(root, "gmd:language");
  info.characterSet = readCode(root, "gmd:characterSet");
  info.parentIdentifier = readProp(root, "gmd:parentIdentifier");
  info.hierarchyLevel = readCode(root, "gmd:hierarchyLevel");
  info.hierarchyLevelName = txt(root, "gmd:hierarchyLevelName");
  info.dateStamp = readDate(root, "gmd:dateStamp");
  info.metadataStandardName = txt(root, "gmd:metadataStandardName");
  info.metadataStandardVersion = txt(root, "gmd:metadataStandardVersion");
  info.dataSetURI = readProp(root, "gmd:dataSetURI");

  const contacts = findDirectChildren(root, "gmd:contact")
    .map(parseContactProperty)
    .filter((c): c is ResponsibleParty => c !== null);
  info.contacts = contacts.length ? contacts : [createDefaultContact()];

  info.maintenance = parseMetadataMaintenance(findDirectChild(root, "gmd:metadataMaintenance"));
  info.constraints = parseMetadataConstraints(findDirectChildren(root, "gmd:metadataConstraints"));

  /* ---------------------------- Bab 3 (bagian root) ---------------------------- */
  spatial.spatialRepresentationType = "";
  spatial.scaleDenominator = null;
  spatial.vectorDetail = { topologyLevel: "", geometricObjectType: "", geometricObjectCount: null };
  spatial.gridDetail = { ...spatial.gridDetail, numberOfDimensions: null, cellGeometry: "", pointInPixel: "" };

  spatial.referenceSystems = findDirectChildren(root, "gmd:referenceSystemInfo")
    .map(parseReferenceSystemProperty)
    .filter((r): r is ReferenceSystem => r !== null);

  /* ---------------------------- Bab 2 ---------------------------- */
  const dataIdent = findPath(root, ["gmd:identificationInfo", "gmd:MD_DataIdentification"]);
  const ciCitation = findPath(dataIdent, ["gmd:citation", "gmd:CI_Citation"]);

  ident.title = txt(ciCitation, "gmd:title");
  ident.alternateTitle = txt(ciCitation, "gmd:alternateTitle");
  ident.dates = ciCitation
    ? findDirectChildren(ciCitation, "gmd:date")
        .map(parseCitationDate)
        .filter((d): d is CitationDate => d !== null)
    : [];
  ident.edition = txt(ciCitation, "gmd:edition");
  const identifierProp = findPath(ciCitation, ["gmd:identifier"]);
  ident.identifierCode = readProp(identifierProp ? childElements(identifierProp)[0] ?? null : null, "gmd:code");
  ident.presentationForm = readCode(ciCitation, "gmd:presentationForm");

  ident.abstract = txt(dataIdent, "gmd:abstract");
  ident.purpose = txt(dataIdent, "gmd:purpose");
  ident.credit = txt(dataIdent, "gmd:credit");
  ident.status = readCode(dataIdent, "gmd:status");

  const pocs = dataIdent
    ? findDirectChildren(dataIdent, "gmd:pointOfContact")
        .map(parseContactProperty)
        .filter((c): c is ResponsibleParty => c !== null)
    : [];
  ident.pointOfContacts = pocs.length ? pocs : [createDefaultContact("owner")];

  const maintenance = parseMaintenance(dataIdent ? findDirectChild(dataIdent, "gmd:resourceMaintenance") : null);
  ident.maintenance = maintenance;

  const graphic = findPath(dataIdent, ["gmd:graphicOverview", "gmd:MD_BrowseGraphic"]);
  ident.graphicOverview = {
    fileName: readProp(graphic, "gmd:fileName"),
    fileDescription: readProp(graphic, "gmd:fileDescription"),
    fileType: readProp(graphic, "gmd:fileType"),
  };

  // Kata kunci + jembatan topik ProMSI 20 & 21
  const bridgedTopics: string[] = [];
  const keywordGroups: KeywordGroup[] = [];
  for (const prop of dataIdent ? findDirectChildren(dataIdent, "gmd:descriptiveKeywords") : []) {
    const group = parseKeywordsProperty(prop);
    if (!group) continue;
    if (group.thesaurusName === PROMSI_THESAURUS) {
      const remaining: string[] = [];
      for (const kw of group.keywords) {
        const topic = Object.entries(TOPIC_XSD_BRIDGE).find(([, b]) => b.keyword.toLowerCase() === kw.toLowerCase());
        if (topic) bridgedTopics.push(topic[0]);
        else remaining.push(kw);
      }
      if (remaining.length) keywordGroups.push({ ...group, keywords: remaining });
      continue;
    }
    keywordGroups.push(group);
  }
  ident.keywordGroups = keywordGroups;

  ident.usage = parseUsage(dataIdent ? findDirectChild(dataIdent, "gmd:resourceSpecificUsage") : null);

  ident.constraints = parseResourceConstraints(dataIdent ? findDirectChildren(dataIdent, "gmd:resourceConstraints") : []);

  spatial.spatialRepresentationType = readCode(dataIdent, "gmd:spatialRepresentationType");
  const resolution = findPath(dataIdent, ["gmd:spatialResolution", "gmd:MD_Resolution"]);
  if (resolution) {
    const denominator = readNumber(findPath(resolution, ["gmd:equivalentScale", "gmd:MD_RepresentativeFraction"]), "gmd:denominator");
    const distance = readNumber(resolution, "gmd:distance");
    spatial.scaleDenominator = denominator;
    spatial.groundDistance = distance;
    spatial.resolutionMode = denominator === null && distance !== null ? "distance" : "scale";
  }

  const topics: string[] = [];
  for (const prop of dataIdent ? findDirectChildren(dataIdent, "gmd:topicCategory") : []) {
    const code = readValue(prop);
    if (code && !topics.includes(code)) topics.push(code);
  }
  for (const t of bridgedTopics) if (!topics.includes(t)) topics.push(t);
  ident.topicCategories = topics;

  if (dataIdent) parseExtent(dataIdent, ident.extent);
  ident.supplementalInformation = txt(dataIdent, "gmd:supplementalInformation");

  /* ---------------------------- Bab 3 ---------------------------- */
  parseSpatialRepresentation(root, form);

  let detectedPk: string | undefined;
  let detectedBaseUrl: string | undefined;

  const content = spatial.contentInfo;
  content.type = spatial.spatialRepresentationType === "grid" ? "raster" : "vector";
  content.language = "";
  for (const prop of findDirectChildren(root, "gmd:contentInfo")) {
    const featureCatalogue = findDirectChild(prop, "gmd:MD_FeatureCatalogueDescription");
    if (featureCatalogue) {
      content.type = "vector";
      Object.assign(content, parseFeatureCatalogueDescription(featureCatalogue));

      // Contoh: https://jigd.kaltimprov.go.id/catalogue/#/dataset/737/feature_catalogue
      const href = content.featureCitationHref;
      const pkMatch = href.match(/\/dataset\/(\d+)\//);
      if (pkMatch) detectedPk = pkMatch[1];
      try {
        detectedBaseUrl = new URL(href).origin;
      } catch {
        // href bukan URL absolut
      }
      break;
    }
    const coverage = findDirectChild(prop, "gmd:MD_CoverageDescription") || findDirectChild(prop, "gmd:MD_ImageDescription");
    if (coverage) {
      content.type = "raster";
      content.attributeDescription = txt(coverage, "gmd:attributeDescription");
      content.coverageContentType = readCode(coverage, "gmd:contentType");
      break;
    }
  }

  /* ---------------------------- Bab 4 ---------------------------- */
  const distribution = findPath(root, ["gmd:distributionInfo", "gmd:MD_Distribution"]);
  const format =
    findPath(distribution, ["gmd:distributionFormat", "gmd:MD_Format"]) || findPath(dataIdent, ["gmd:resourceFormat", "gmd:MD_Format"]);
  quality.distributionFormat = {
    name: txt(format, "gmd:name"),
    version: txt(format, "gmd:version"),
    specification: txt(format, "gmd:specification"),
    fileDecompressionTechnique: txt(format, "gmd:fileDecompressionTechnique"),
  };

  const distributor = findPath(distribution, ["gmd:distributor", "gmd:MD_Distributor"]);
  const orderProcess = findPath(distributor, ["gmd:distributionOrderProcess", "gmd:MD_StandardOrderProcess"]);
  const distributorContact = distributor ? findDirectChild(distributor, "gmd:distributorContact") : null;
  quality.distributor = {
    contact: (distributorContact && parseContactProperty(distributorContact)) || createDefaultContact("distributor"),
    fees: txt(orderProcess, "gmd:fees"),
    orderingInstructions: txt(orderProcess, "gmd:orderingInstructions"),
  };

  const transfer = findPath(distribution, ["gmd:transferOptions", "gmd:MD_DigitalTransferOptions"]);
  quality.transferSize = readNumber(transfer, "gmd:transferSize");
  quality.onlineResources = [];
  for (const onLine of transfer ? findDirectChildren(transfer, "gmd:onLine") : []) {
    const ciOnline = findDirectChild(onLine, "gmd:CI_OnlineResource");
    if (!ciOnline) continue;
    const resource = parseOnlineResource(ciOnline, true);
    if (!detectedBaseUrl && resource.linkage) {
      try {
        detectedBaseUrl = new URL(resource.linkage).origin;
      } catch {
        // abaikan
      }
    }
    quality.onlineResources.push(resource);
  }

  const dq = findPath(root, ["gmd:dataQualityInfo", "gmd:DQ_DataQuality"]);
  quality.scope = readCode(findPath(dq, ["gmd:scope", "gmd:DQ_Scope"]), "gmd:level") || "dataset";
  quality.reports = dq
    ? findDirectChildren(dq, "gmd:report")
        .map(parseReportProperty)
        .filter((r): r is QualityReport => r !== null)
    : [];
  const lineage = parseLineage(dq ? findDirectChild(dq, "gmd:lineage") : null);
  quality.lineageStatement = lineage.statement;
  quality.processSteps = lineage.processSteps;
  quality.sources = lineage.sources;

  /* ---------------------------- Bab 5 ---------------------------- */
  form.advanced.portrayalCatalogue = parsePortrayalProperty(findDirectChild(root, "gmd:portrayalCatalogueInfo"));

  form.advanced.applicationSchema = parseApplicationSchemaProperty(findDirectChild(root, "gmd:applicationSchemaInfo"));
  form.advanced.metadataExtension = parseMetadataExtensionProperty(findDirectChild(root, "gmd:metadataExtensionInfo"));

  return {
    formData: form,
    rawDoc: doc,
    datasetMeta: {
      uuid: info.fileIdentifier,
      baseUrl: detectedBaseUrl,
      pk: detectedPk,
      title: ident.title,
      alternateTitle: ident.alternateTitle,
      typename: ident.alternateTitle,
    },
  };
}
