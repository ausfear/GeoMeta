import {
  createXmlDocument,
  serializeXmlDocument,
  unwrapCswAndHoistNamespaces,
  insertInCanonicalOrder,
  childElements,
  findDirectChild,
  findDirectChildren,
  findPath,
  getTextContent,
  readValue,
  readProp,
  readCode,
  readNumber,
  XmlBuilder,
  detectGmlNamespace,
  setTextProperty,
  setCodeProperty,
  setDateProperty,
  syncSingle,
  syncRepeated,
  getOrCreateChild,
  prettyPrint,
} from "./dom-utils";
import {
  SCHEMA_LOCATION,
  CANONICAL_SEQUENCE_MD_METADATA as MD_SEQ,
  CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION as DI_SEQ,
  CANONICAL_SEQUENCE_CI_CITATION as CITATION_SEQ,
  CANONICAL_SEQUENCE_EX_EXTENT as EXTENT_SEQ,
  CANONICAL_SEQUENCE_MD_DISTRIBUTION as DISTRIBUTION_SEQ,
  CANONICAL_SEQUENCE_MD_DIGITAL_TRANSFER_OPTIONS as TRANSFER_SEQ,
  CANONICAL_SEQUENCE_DQ_DATA_QUALITY as DQ_SEQ,
} from "./constants";
import {
  parseContactPropertyStrict,
  parseKeywordsProperty,
  parseReferenceSystemProperty,
  parseMaintenance,
  parseMetadataMaintenance,
  parseUsage,
  parseReportProperty,
  parseLineage,
  parseFeatureCatalogueDescription,
  parseApplicationSchemaProperty,
  parseMetadataExtensionProperty,
  parsePortrayalProperty,
  parseResourceConstraints,
  parseMetadataConstraints,
  parseOnlineResource,
  isCorruptedGeoNodeConstraint,
  serializeAttributeTable,
} from "./parser";
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
  ExtendedElement,
  createEmptyCitation,
} from "../metadata-schema";
import { PROMSI_THESAURUS, TOPIC_XSD_BRIDGE } from "../iso-codelists";
import { sanitizeAndValidateXml } from "./xxe-sanitizer";
import { stableKey } from "../value-utils";

const CI_DATE_SEQ = ["gmd:date", "gmd:dateType"];

type Form = MetadataFormData;

/* ------------------------------------------------------------------ */
/* Penentu "ada isinya"                                                */
/* ------------------------------------------------------------------ */

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

export function hasContact(c: ResponsibleParty): boolean {
  return filled(c.individualName) || filled(c.organisationName) || filled(c.positionName);
}

export function hasCitationContent(ref: CitationRef): boolean {
  return filled(ref.title) || filled(ref.date) || filled(ref.edition) || filled(ref.url) || filled(ref.publisher);
}

/* ------------------------------------------------------------------ */
/* Pembangun blok                                                      */
/* ------------------------------------------------------------------ */

function buildResponsibleParty(b: XmlBuilder, contact: ResponsibleParty): Element {
  const t = (v: string) => v.trim();
  const phone =
    (t(contact.phone) || t(contact.facsimile)) &&
    b.el("gmd:phone", [b.el("gmd:CI_Telephone", [b.csOpt("gmd:voice", contact.phone), b.csOpt("gmd:facsimile", contact.facsimile)])]);

  const addressParts = [
    b.csOpt("gmd:deliveryPoint", contact.deliveryPoint),
    b.csOpt("gmd:city", contact.city),
    b.csOpt("gmd:administrativeArea", contact.administrativeArea),
    b.csOpt("gmd:postalCode", contact.postalCode),
    b.csOpt("gmd:country", contact.country),
    b.csOpt("gmd:electronicMailAddress", contact.electronicMailAddress),
  ];
  const address = addressParts.some(Boolean) && b.el("gmd:address", [b.el("gmd:CI_Address", addressParts)]);

  const online =
    t(contact.onlineUrl) &&
    b.el("gmd:onlineResource", [
      b.el("gmd:CI_OnlineResource", [b.url("gmd:linkage", t(contact.onlineUrl)), b.cs("gmd:protocol", "WWW:LINK-1.0-http--link")]),
    ]);

  const contactInfo = (phone || address || online) && b.el("gmd:contactInfo", [b.el("gmd:CI_Contact", [phone, address, online])]);

  return b.el("gmd:CI_ResponsibleParty", [
    b.csOpt("gmd:individualName", contact.individualName),
    b.csOpt("gmd:organisationName", contact.organisationName),
    b.csOpt("gmd:positionName", contact.positionName),
    contactInfo,
    b.code("gmd:role", "gmd:CI_RoleCode", "CI_RoleCode", contact.role || "pointOfContact"),
  ]);
}

function buildContactProp(b: XmlBuilder, tag: string, contact: ResponsibleParty): Element {
  return b.el(tag, [buildResponsibleParty(b, contact)]);
}

function buildCiDate(b: XmlBuilder, date: string, dateType: string, kind: "Date" | "DateTime" = "Date"): Element {
  if (!date) return b.nil("gmd:date");
  return b.el("gmd:date", [
    b.el("gmd:CI_Date", [b.date("gmd:date", date, kind), b.code("gmd:dateType", "gmd:CI_DateTypeCode", "CI_DateTypeCode", dateType || "publication")]),
  ]);
}

function buildCitation(b: XmlBuilder, ref: CitationRef, otherDetails = ""): Element {
  const url = ref.url.trim();
  const publisher = ref.publisher.trim();
  const party =
    (url || publisher) &&
    b.el("gmd:citedResponsibleParty", [
      b.el("gmd:CI_ResponsibleParty", [
        b.csOpt("gmd:organisationName", publisher),
        url &&
          b.el("gmd:contactInfo", [
            b.el("gmd:CI_Contact", [b.el("gmd:onlineResource", [b.el("gmd:CI_OnlineResource", [b.url("gmd:linkage", url)])])]),
          ]),
        b.code("gmd:role", "gmd:CI_RoleCode", "CI_RoleCode", "publisher"),
      ]),
    ]);

  return b.el("gmd:CI_Citation", [
    b.csOrNil("gmd:title", ref.title),
    buildCiDate(b, ref.date, ref.dateType),
    b.csOpt("gmd:edition", ref.edition),
    party,
    b.csOpt("gmd:otherCitationDetails", otherDetails),
  ]);
}

function simpleCitation(title: string, date: string): CitationRef {
  return { ...createEmptyCitation(), title, date };
}

function buildMaintenance(
  b: XmlBuilder,
  tag: string,
  m: { frequency: string; dateOfNextUpdate?: string; updateScope: string; note: string }
): Element | null {
  if (!filled(m.frequency) && !filled(m.dateOfNextUpdate) && !filled(m.note)) return null;
  return b.el(tag, [
    b.el("gmd:MD_MaintenanceInformation", [
      b.codeOrNil("gmd:maintenanceAndUpdateFrequency", "gmd:MD_MaintenanceFrequencyCode", "MD_MaintenanceFrequencyCode", m.frequency),
      b.dateOpt("gmd:dateOfNextUpdate", m.dateOfNextUpdate ?? ""),
      b.codeOpt("gmd:updateScope", "gmd:MD_ScopeCode", "MD_ScopeCode", m.updateScope),
      b.csOpt("gmd:maintenanceNote", m.note),
    ]),
  ]);
}

function buildKeywords(b: XmlBuilder, group: KeywordGroup): Element {
  return b.el("gmd:descriptiveKeywords", [
    b.el("gmd:MD_Keywords", [
      ...group.keywords.map((k) => b.cs("gmd:keyword", k)),
      b.codeOpt("gmd:type", "gmd:MD_KeywordTypeCode", "MD_KeywordTypeCode", group.type),
      filled(group.thesaurusName) &&
        b.el("gmd:thesaurusName", [b.el("gmd:CI_Citation", [b.cs("gmd:title", group.thesaurusName.trim()), b.nil("gmd:date")])]),
    ]),
  ]);
}

function buildUsage(b: XmlBuilder, usage: Form["identification"]["usage"]): Element | null {
  const any = filled(usage.specificUsage) || filled(usage.usageDate) || filled(usage.userDeterminedLimitations) || hasContact(usage.contact);
  if (!any) return null;
  return b.el("gmd:resourceSpecificUsage", [
    b.el("gmd:MD_Usage", [
      b.csOrNil("gmd:specificUsage", usage.specificUsage),
      // XSD: usageDateTime bertipe gco:DateTime
      b.dateOpt("gmd:usageDateTime", usage.usageDate, "DateTime"),
      b.csOpt("gmd:userDeterminedLimitations", usage.userDeterminedLimitations),
      hasContact(usage.contact) ? buildContactProp(b, "gmd:userContactInfo", usage.contact) : b.nil("gmd:userContactInfo"),
    ]),
  ]);
}

function buildResourceConstraints(b: XmlBuilder, c: Form["identification"]["constraints"]): Element[] {
  const blocks: Element[] = [];
  if (filled(c.useLimitation)) {
    blocks.push(b.el("gmd:resourceConstraints", [b.el("gmd:MD_Constraints", [b.cs("gmd:useLimitation", c.useLimitation.trim())])]));
  }
  if (filled(c.accessConstraints) || filled(c.useConstraints) || filled(c.otherConstraints)) {
    blocks.push(
      b.el("gmd:resourceConstraints", [
        b.el("gmd:MD_LegalConstraints", [
          b.codeOpt("gmd:accessConstraints", "gmd:MD_RestrictionCode", "MD_RestrictionCode", c.accessConstraints),
          b.codeOpt("gmd:useConstraints", "gmd:MD_RestrictionCode", "MD_RestrictionCode", c.useConstraints),
          b.csOpt("gmd:otherConstraints", c.otherConstraints),
        ]),
      ])
    );
  }
  if (filled(c.securityClassification) || filled(c.securityUserNote)) {
    blocks.push(
      b.el("gmd:resourceConstraints", [
        b.el("gmd:MD_SecurityConstraints", [
          b.codeOrNil("gmd:classification", "gmd:MD_ClassificationCode", "MD_ClassificationCode", c.securityClassification),
          b.csOpt("gmd:userNote", c.securityUserNote),
        ]),
      ])
    );
  }
  return blocks;
}

function buildRepresentativeFraction(b: XmlBuilder, tag: string, denominator: number): Element {
  return b.el(tag, [b.el("gmd:MD_RepresentativeFraction", [b.number("gmd:denominator", "Integer", denominator)])]);
}

type ResolutionValue = { scale: number | null; distance: number | null };

function resolutionValue(s: Form["spatialAndContent"]): ResolutionValue {
  return s.resolutionMode === "distance" ? { scale: null, distance: s.groundDistance } : { scale: s.scaleDenominator, distance: null };
}

function parseResolution(prop: Element): ResolutionValue {
  const res = findDirectChild(prop, "gmd:MD_Resolution");
  return {
    scale: readNumber(findPath(res, ["gmd:equivalentScale", "gmd:MD_RepresentativeFraction"]), "gmd:denominator"),
    distance: readNumber(res, "gmd:distance"),
  };
}

function buildResolution(b: XmlBuilder, v: ResolutionValue): Element | null {
  if (v.scale) return b.el("gmd:spatialResolution", [b.el("gmd:MD_Resolution", [buildRepresentativeFraction(b, "gmd:equivalentScale", v.scale)])]);
  if (v.distance) {
    return b.el("gmd:spatialResolution", [
      b.el("gmd:MD_Resolution", [b.el("gmd:distance", [b.text("gco:Distance", String(v.distance), { uom: "m" })])]),
    ]);
  }
  return null;
}

function buildSpatialRepresentation(b: XmlBuilder, s: Form["spatialAndContent"]): Element | null {
  if (s.spatialRepresentationType === "vector") {
    const v = s.vectorDetail;
    if (!filled(v.topologyLevel) && !filled(v.geometricObjectType)) return null;
    return b.el("gmd:spatialRepresentationInfo", [
      b.el("gmd:MD_VectorSpatialRepresentation", [
        b.codeOpt("gmd:topologyLevel", "gmd:MD_TopologyLevelCode", "MD_TopologyLevelCode", v.topologyLevel),
        filled(v.geometricObjectType) &&
          b.el("gmd:geometricObjects", [
            b.el("gmd:MD_GeometricObjects", [
              b.code("gmd:geometricObjectType", "gmd:MD_GeometricObjectTypeCode", "MD_GeometricObjectTypeCode", v.geometricObjectType),
              b.number("gmd:geometricObjectCount", "Integer", v.geometricObjectCount),
            ]),
          ]),
      ]),
    ]);
  }

  if (s.spatialRepresentationType === "grid") {
    const g = s.gridDetail;
    if (g.numberOfDimensions === null && g.rowSize === null && g.columnSize === null) return null;
    const axis = (name: "row" | "column", size: number | null) =>
      size !== null &&
      b.el("gmd:axisDimensionProperties", [
        b.el("gmd:MD_Dimension", [
          b.code("gmd:dimensionName", "gmd:MD_DimensionNameTypeCode", "MD_DimensionNameTypeCode", name),
          b.number("gmd:dimensionSize", "Integer", size),
        ]),
      ]);

    const base = [
      b.number("gmd:numberOfDimensions", "Integer", g.numberOfDimensions) ?? b.nil("gmd:numberOfDimensions"),
      axis("row", g.rowSize),
      axis("column", g.columnSize),
      b.codeOrNil("gmd:cellGeometry", "gmd:MD_CellGeometryCode", "MD_CellGeometryCode", g.cellGeometry),
      b.boolOrNil("gmd:transformationParameterAvailability", g.transformationParameterAvailability),
    ];

    let node: Element;
    if (g.representationClass === "georectified") {
      node = b.el("gmd:MD_Georectified", [
        ...base,
        b.boolOrNil("gmd:checkPointAvailability", g.checkPointAvailability),
        b.csOpt("gmd:checkPointDescription", g.checkPointDescription),
        // MD_PixelOrientationCode adalah enumerasi XSD, bukan codelist
        filled(g.pointInPixel) ? b.el("gmd:pointInPixel", [b.text("gmd:MD_PixelOrientationCode", g.pointInPixel)]) : b.nil("gmd:pointInPixel"),
        b.csOpt("gmd:transformationDimensionDescription", g.transformationDescription),
      ]);
    } else if (g.representationClass === "georeferenceable") {
      node = b.el("gmd:MD_Georeferenceable", [
        ...base,
        b.boolOrNil("gmd:controlPointAvailability", g.controlPointAvailability),
        b.boolOrNil("gmd:orientationParameterAvailability", g.orientationParameterAvailability),
        b.csOpt("gmd:orientationParameterDescription", g.orientationParameterDescription),
        filled(g.georeferencedParameters)
          ? b.el("gmd:georeferencedParameters", [b.text("gco:Record", g.georeferencedParameters.trim())])
          : b.nil("gmd:georeferencedParameters"),
      ]);
    } else {
      node = b.el("gmd:MD_GridSpatialRepresentation", base);
    }
    return b.el("gmd:spatialRepresentationInfo", [node]);
  }

  return null;
}

function buildReferenceSystem(b: XmlBuilder, rs: ReferenceSystem): Element {
  return b.el("gmd:referenceSystemInfo", [
    b.el("gmd:MD_ReferenceSystem", [
      b.el("gmd:referenceSystemIdentifier", [
        b.el("gmd:RS_Identifier", [b.cs("gmd:code", rs.code.trim()), b.csOpt("gmd:codeSpace", rs.codeSpace), b.csOpt("gmd:version", rs.version)]),
      ]),
    ]),
  ]);
}

function buildExtendedElement(b: XmlBuilder, e: ExtendedElement): Element {
  const parents = e.parentEntity
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return b.el("gmd:extendedElementInformation", [
    b.el("gmd:MD_ExtendedElementInformation", [
      b.csOrNil("gmd:name", e.name),
      b.csOrNil("gmd:definition", e.definition),
      // MD_ObligationCode adalah enumerasi XSD
      filled(e.obligation) && b.el("gmd:obligation", [b.text("gmd:MD_ObligationCode", e.obligation)]),
      b.code("gmd:dataType", "gmd:MD_DatatypeCode", "MD_DatatypeCode", e.dataType || "characterString"),
      ...(parents.length ? parents.map((p) => b.cs("gmd:parentEntity", p)) : [b.nil("gmd:parentEntity")]),
      b.csOrNil("gmd:rule", e.rule),
      b.csOpt("gmd:rationale", e.rationale),
      b.nil("gmd:source"),
    ]),
  ]);
}

function buildMetadataExtension(b: XmlBuilder, ext: Form["advanced"]["metadataExtension"]): Element | null {
  const elements = ext.elements.filter((e) => filled(e.name));
  if (!filled(ext.url) && elements.length === 0) return null;
  return b.el("gmd:metadataExtensionInfo", [
    b.el("gmd:MD_MetadataExtensionInformation", [
      filled(ext.url) && b.el("gmd:extensionOnLineResource", [b.el("gmd:CI_OnlineResource", [b.url("gmd:linkage", ext.url.trim())])]),
      ...elements.map((e) => buildExtendedElement(b, e)),
    ]),
  ]);
}

/* ---------------------------- Kualitas data ---------------------------- */

function buildUnit(b: XmlBuilder, unit: string): Element {
  if (!filled(unit)) return b.nil("gmd:valueUnit");
  const value = unit.trim();
  const children = b.gml.is32
    ? [b.text(b.gmlTag("identifier"), value, { codeSpace: "GeoMeta" }), b.text(b.gmlTag("name"), value)]
    : [b.text(b.gmlTag("name"), value)];
  return b.el("gmd:valueUnit", [b.el(b.gmlTag("UnitDefinition"), children, { [`${b.gml.prefix}:id`]: b.nextId("geometa-unit") })]);
}

/** Satu laporan DQ_* dengan anak sesuai urutan AbstractDQ_Element_Type. */
export function buildQualityReport(b: XmlBuilder, r: QualityReport): Element {
  const c = r.conformance;
  const q = r.quantitative;
  const results: Element[] = [];

  if (filled(c.specificationTitle) || filled(c.explanation) || c.pass) {
    results.push(
      b.el("gmd:result", [
        b.el("gmd:DQ_ConformanceResult", [
          b.el("gmd:specification", [buildCitation(b, simpleCitation(c.specificationTitle, c.specificationDate))]),
          b.csOrNil("gmd:explanation", c.explanation),
          b.boolOrNil("gmd:pass", c.pass),
        ]),
      ])
    );
  }
  if (filled(q.value) || filled(q.valueUnit)) {
    results.push(
      b.el("gmd:result", [
        b.el("gmd:DQ_QuantitativeResult", [
          buildUnit(b, q.valueUnit),
          filled(q.value) ? b.el("gmd:value", [b.text("gco:Record", q.value.trim())]) : b.nil("gmd:value"),
        ]),
      ])
    );
  }

  return b.el("gmd:report", [
    b.el(`gmd:${r.elementType || "DQ_DomainConsistency"}`, [
      b.csOpt("gmd:nameOfMeasure", r.nameOfMeasure),
      b.csOpt("gmd:measureDescription", r.measureDescription),
      b.codeOpt("gmd:evaluationMethodType", "gmd:DQ_EvaluationMethodTypeCode", "DQ_EvaluationMethodTypeCode", r.evaluationMethodType),
      b.csOpt("gmd:evaluationMethodDescription", r.evaluationMethodDescription),
      (filled(r.procedureTitle) || filled(r.procedureDate)) &&
        b.el("gmd:evaluationProcedure", [buildCitation(b, simpleCitation(r.procedureTitle, r.procedureDate))]),
      b.dateOpt("gmd:dateTime", r.dateTime, "DateTime"),
      ...(results.length ? results : [b.nil("gmd:result")]),
    ]),
  ]);
}

function hasStepContent(s: ProcessStep) {
  return filled(s.description) || filled(s.rationale) || filled(s.date) || hasContact(s.processor);
}

function hasSourceContent(s: LineageSource) {
  return filled(s.description) || s.scaleDenominator !== null || filled(s.citationTitle) || filled(s.citationDate);
}

function buildLineage(b: XmlBuilder, value: ReturnType<typeof parseLineage>): Element | null {
  const steps = value.processSteps.filter(hasStepContent);
  const sources = value.sources.filter(hasSourceContent);
  if (!filled(value.statement) && steps.length === 0 && sources.length === 0) return null;

  return b.el("gmd:lineage", [
    b.el("gmd:LI_Lineage", [
      b.csOpt("gmd:statement", value.statement),
      ...steps.map((s) =>
        b.el("gmd:processStep", [
          b.el("gmd:LI_ProcessStep", [
            b.csOrNil("gmd:description", s.description),
            b.csOpt("gmd:rationale", s.rationale),
            // XSD: LI_ProcessStep/dateTime bertipe gco:DateTime
            b.dateOpt("gmd:dateTime", s.date, "DateTime"),
            hasContact(s.processor) && buildContactProp(b, "gmd:processor", s.processor),
          ]),
        ])
      ),
      ...sources.map((s) =>
        b.el("gmd:source", [
          b.el("gmd:LI_Source", [
            b.csOpt("gmd:description", s.description),
            s.scaleDenominator !== null && buildRepresentativeFraction(b, "gmd:scaleDenominator", s.scaleDenominator),
            (filled(s.citationTitle) || filled(s.citationDate)) &&
              b.el("gmd:sourceCitation", [buildCitation(b, simpleCitation(s.citationTitle, s.citationDate))]),
          ]),
        ])
      ),
    ]),
  ]);
}

/* ---------------------------- Distribusi ---------------------------- */

function buildOnlineResource(b: XmlBuilder, res: OnlineResource): Element {
  return b.el("gmd:onLine", [
    b.el("gmd:CI_OnlineResource", [
      b.url("gmd:linkage", res.linkage.trim()),
      b.csOpt("gmd:protocol", res.protocol),
      b.csOpt("gmd:name", res.name),
      b.csOpt("gmd:description", res.description),
      b.codeOpt("gmd:function", "gmd:CI_OnLineFunctionCode", "CI_OnLineFunctionCode", res.functionCode),
    ]),
  ]);
}

type FormatValue = Form["qualityAndDistribution"]["distributionFormat"];

function parseFormatProp(prop: Element): FormatValue {
  const f = findDirectChild(prop, "gmd:MD_Format");
  return {
    name: readProp(f, "gmd:name"),
    version: readProp(f, "gmd:version"),
    specification: readProp(f, "gmd:specification"),
    fileDecompressionTechnique: readProp(f, "gmd:fileDecompressionTechnique"),
  };
}

function buildFormat(b: XmlBuilder, f: FormatValue): Element | null {
  if (!filled(f.name) && !filled(f.version)) return null;
  return b.el("gmd:distributionFormat", [
    b.el("gmd:MD_Format", [
      b.csOrNil("gmd:name", f.name),
      b.csOrNil("gmd:version", f.version),
      b.csOpt("gmd:specification", f.specification),
      b.csOpt("gmd:fileDecompressionTechnique", f.fileDecompressionTechnique),
    ]),
  ]);
}

type DistributorValue = Form["qualityAndDistribution"]["distributor"];

function parseDistributorProp(prop: Element): DistributorValue | null {
  const d = findDirectChild(prop, "gmd:MD_Distributor");
  const contactProp = d ? findDirectChild(d, "gmd:distributorContact") : null;
  const contact = contactProp ? parseContactPropertyStrict(contactProp) : null;
  if (!contact) return null;
  const order = findPath(d, ["gmd:distributionOrderProcess", "gmd:MD_StandardOrderProcess"]);
  return { contact, fees: readProp(order, "gmd:fees"), orderingInstructions: readProp(order, "gmd:orderingInstructions") };
}

function buildDistributor(b: XmlBuilder, d: DistributorValue): Element | null {
  const hasOrder = filled(d.fees) || filled(d.orderingInstructions);
  if (!hasContact(d.contact) && !hasOrder) return null;
  return b.el("gmd:distributor", [
    b.el("gmd:MD_Distributor", [
      hasContact(d.contact) ? buildContactProp(b, "gmd:distributorContact", d.contact) : b.nil("gmd:distributorContact"),
      hasOrder &&
        b.el("gmd:distributionOrderProcess", [
          b.el("gmd:MD_StandardOrderProcess", [b.csOpt("gmd:fees", d.fees), b.csOpt("gmd:orderingInstructions", d.orderingInstructions)]),
        ]),
    ]),
  ]);
}

/* ---------------------------- Konten (KUGI) ---------------------------- */

type ContentValue = Form["spatialAndContent"]["contentInfo"];

function contentKey(c: ContentValue): unknown {
  if (c.type === "vector") {
    return {
      type: c.type,
      featureTypes: c.featureTypes,
      complianceCode: c.complianceCode,
      includedWithDataset: c.includedWithDataset,
      language: c.language,
      catalogueCitation: c.catalogueCitation,
      featureCitationUuid: c.featureCitationUuid,
      featureCitationHref: c.featureCitationHref,
      attributes: c.attributes,
    };
  }
  if (c.type === "raster") return { type: c.type, attributeDescription: c.attributeDescription, coverageContentType: c.coverageContentType };
  return null;
}

function isManagedContent(prop: Element) {
  return Boolean(findDirectChild(prop, "gmd:MD_FeatureCatalogueDescription") || findDirectChild(prop, "gmd:MD_CoverageDescription"));
}

/** Node asli dipakai ulang hanya bila isinya sama dan boolean-nya sudah berformat "true"/"false" standar XSD. */
function parseContentKey(prop: Element): unknown {
  const feature = findDirectChild(prop, "gmd:MD_FeatureCatalogueDescription");
  if (feature) {
    const rawBooleans = ["gmd:complianceCode", "gmd:includedWithDataset"].map((t) => readProp(feature, t));
    if (rawBooleans.some((v) => v === "0" || v === "1")) return null;
    return contentKey({ ...emptyContent(), type: "vector", ...parseFeatureCatalogueDescription(feature) });
  }
  const coverage = findDirectChild(prop, "gmd:MD_CoverageDescription");
  if (coverage) {
    return contentKey({
      ...emptyContent(),
      type: "raster",
      attributeDescription: readProp(coverage, "gmd:attributeDescription"),
      coverageContentType: readCode(coverage, "gmd:contentType"),
    });
  }
  return null;
}

function emptyContent(): ContentValue {
  return {
    type: "none",
    featureTypes: [],
    complianceCode: "",
    includedWithDataset: false,
    language: "",
    catalogueCitation: createEmptyCitation(),
    featureCitationUuid: "",
    featureCitationHref: "",
    attributes: [],
    attributeDescription: "",
    coverageContentType: "",
  };
}

function buildContentInfo(b: XmlBuilder, c: ContentValue): Element | null {
  if (c.type === "raster") {
    if (!filled(c.attributeDescription) && !filled(c.coverageContentType)) return null;
    return b.el("gmd:contentInfo", [
      b.el("gmd:MD_CoverageDescription", [
        filled(c.attributeDescription)
          ? b.el("gmd:attributeDescription", [b.text("gco:RecordType", c.attributeDescription.trim())])
          : b.nil("gmd:attributeDescription"),
        b.codeOrNil("gmd:contentType", "gmd:MD_CoverageContentTypeCode", "MD_CoverageContentTypeCode", c.coverageContentType),
      ]),
    ]);
  }

  if (c.type !== "vector") return null;
  const featureTypes = c.featureTypes.map((f) => f.trim()).filter(Boolean);
  const attributeText = serializeAttributeTable(c.attributes);
  const hasCitation = hasCitationContent(c.catalogueCitation) || Boolean(attributeText);
  const hasLink = filled(c.featureCitationUuid) || filled(c.featureCitationHref);
  if (!featureTypes.length && !hasCitation && !hasLink && !c.complianceCode) return null;

  // Atribut uuidref & xlink:href bawaan GeoNode tetap dipasang walau sitasi diisi (SPEC 5.E.4).
  const linkAttrs: Record<string, string> = {};
  if (filled(c.featureCitationUuid)) linkAttrs.uuidref = c.featureCitationUuid.trim();
  if (filled(c.featureCitationHref)) linkAttrs["xlink:href"] = c.featureCitationHref.trim();

  const citationProp =
    hasCitation || hasLink
      ? b.el("gmd:featureCatalogueCitation", [hasCitation && buildCitation(b, c.catalogueCitation, attributeText)], linkAttrs)
      : b.nil("gmd:featureCatalogueCitation");

  return b.el("gmd:contentInfo", [
    b.el("gmd:MD_FeatureCatalogueDescription", [
      b.boolOpt("gmd:complianceCode", c.complianceCode),
      b.csOpt("gmd:language", c.language),
      b.bool("gmd:includedWithDataset", c.includedWithDataset ? "true" : "false"),
      ...featureTypes.map((f) => b.el("gmd:featureTypes", [b.text("gco:LocalName", f)])),
      citationProp,
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Penambalan per bagian                                               */
/* ------------------------------------------------------------------ */

function patchMetadataRoot(b: XmlBuilder, root: Element, form: Form) {
  const m = form.metadataInfo;
  setTextProperty(b, root, "gmd:fileIdentifier", m.fileIdentifier, MD_SEQ, "nil");
  setTextProperty(b, root, "gmd:language", m.language || "ind", MD_SEQ, "nil");
  setCodeProperty(b, root, "gmd:characterSet", "gmd:MD_CharacterSetCode", "MD_CharacterSetCode", m.characterSet, MD_SEQ);
  setTextProperty(b, root, "gmd:parentIdentifier", m.parentIdentifier, MD_SEQ);
  setCodeProperty(b, root, "gmd:hierarchyLevel", "gmd:MD_ScopeCode", "MD_ScopeCode", m.hierarchyLevel, MD_SEQ);
  setTextProperty(b, root, "gmd:hierarchyLevelName", m.hierarchyLevelName, MD_SEQ);

  const contacts = m.contacts.filter(hasContact);
  syncRepeated(root, "gmd:contact", MD_SEQ, contacts, parseContactPropertyStrict, (c) => buildContactProp(b, "gmd:contact", c));
  if (contacts.length === 0) insertInCanonicalOrder(root, b.nil("gmd:contact"), MD_SEQ);

  setDateProperty(b, root, "gmd:dateStamp", m.dateStamp, MD_SEQ, { emptyMode: "nil" });
  setTextProperty(b, root, "gmd:metadataStandardName", m.metadataStandardName, MD_SEQ);
  setTextProperty(b, root, "gmd:metadataStandardVersion", m.metadataStandardVersion, MD_SEQ);
  setTextProperty(b, root, "gmd:dataSetURI", m.dataSetURI, MD_SEQ);
}

function patchCitationDates(b: XmlBuilder, ciCitation: Element, dates: CitationDate[]) {
  const existing = findDirectChildren(ciCitation, "gmd:date");
  const items = dates.filter((d) => filled(d.date));

  items.forEach((d, i) => {
    const prop = existing[i];
    const ciDate = prop ? findDirectChild(prop, "gmd:CI_Date") : null;
    if (ciDate) {
      // Diperbarui di tempat agar gco:DateTime asli GeoNode (beserta jamnya) tetap dipakai.
      setDateProperty(b, ciDate, "gmd:date", d.date, CI_DATE_SEQ, { emptyMode: "nil" });
      setCodeProperty(b, ciDate, "gmd:dateType", "gmd:CI_DateTypeCode", "CI_DateTypeCode", d.dateType || "publication", CI_DATE_SEQ, "nil");
    } else if (prop) {
      ciCitation.replaceChild(buildCiDate(b, d.date, d.dateType), prop);
    } else {
      insertInCanonicalOrder(ciCitation, buildCiDate(b, d.date, d.dateType), CITATION_SEQ);
    }
  });

  for (const extra of existing.slice(items.length)) ciCitation.removeChild(extra);
  if (items.length === 0) insertInCanonicalOrder(ciCitation, b.nil("gmd:date"), CITATION_SEQ);
}

function isoTopicCodes(topics: string[]): string[] {
  const codes: string[] = [];
  for (const topic of topics) {
    const code = TOPIC_XSD_BRIDGE[topic]?.isoCode ?? topic;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function keywordItems(id: Form["identification"]): KeywordGroup[] {
  const groups = id.keywordGroups
    .map((g) => ({ type: g.type, thesaurusName: g.thesaurusName.trim(), keywords: g.keywords.map((k) => k.trim()).filter(Boolean) }))
    .filter((g) => g.keywords.length > 0);

  // Jembatan XSD untuk topik ProMSI 20 & 21 (lihat TOPIC_XSD_BRIDGE).
  const bridged = id.topicCategories.filter((t) => TOPIC_XSD_BRIDGE[t]).map((t) => TOPIC_XSD_BRIDGE[t].keyword);
  if (bridged.length) groups.push({ type: "theme", thesaurusName: PROMSI_THESAURUS, keywords: bridged });
  return groups;
}

type BboxValue = { w: number | null; e: number | null; s: number | null; n: number | null };

function parseBbox(prop: Element): BboxValue {
  const bbox = findDirectChild(prop, "gmd:EX_GeographicBoundingBox");
  return {
    w: readNumber(bbox, "gmd:westBoundLongitude"),
    e: readNumber(bbox, "gmd:eastBoundLongitude"),
    s: readNumber(bbox, "gmd:southBoundLatitude"),
    n: readNumber(bbox, "gmd:northBoundLatitude"),
  };
}

function patchExtent(b: XmlBuilder, dataIdent: Element, extent: Form["identification"]["extent"]) {
  const bbox: BboxValue = {
    w: extent.westBoundLongitude,
    e: extent.eastBoundLongitude,
    s: extent.southBoundLatitude,
    n: extent.northBoundLatitude,
  };
  const hasBbox = Object.values(bbox).some((v) => v !== null);
  const hasTemporal = filled(extent.temporalBegin) || filled(extent.temporalEnd);
  const hasVertical = extent.verticalMin !== null || extent.verticalMax !== null;
  const existingProp = findDirectChild(dataIdent, "gmd:extent");
  if (!existingProp && !hasBbox && !filled(extent.geographicDescription) && !hasTemporal && !hasVertical) return;

  const prop = existingProp ?? getOrCreateChild(b, dataIdent, "gmd:extent", DI_SEQ);
  prop.removeAttribute("gco:nilReason");
  const ex = findDirectChild(prop, "gmd:EX_Extent") ?? prop.appendChild(b.el("gmd:EX_Extent"));

  const dec = (tag: string, v: number | null) => b.number(tag, "Decimal", v) ?? b.nil(tag);
  syncSingle(
    ex,
    "gmd:geographicElement",
    EXTENT_SEQ,
    bbox,
    parseBbox,
    (v) =>
      hasBbox
        ? b.el("gmd:geographicElement", [
            b.el("gmd:EX_GeographicBoundingBox", [
              dec("gmd:westBoundLongitude", v.w),
              dec("gmd:eastBoundLongitude", v.e),
              dec("gmd:southBoundLatitude", v.s),
              dec("gmd:northBoundLatitude", v.n),
            ]),
          ])
        : null,
    (el) => Boolean(findDirectChild(el, "gmd:EX_GeographicBoundingBox"))
  );

  syncSingle(
    ex,
    "gmd:geographicElement",
    EXTENT_SEQ,
    extent.geographicDescription.trim(),
    (el) => {
      const identifier = findPath(el, ["gmd:EX_GeographicDescription", "gmd:geographicIdentifier"]);
      return readProp(identifier ? childElements(identifier)[0] ?? null : null, "gmd:code");
    },
    (v) =>
      v
        ? b.el("gmd:geographicElement", [
            b.el("gmd:EX_GeographicDescription", [b.el("gmd:geographicIdentifier", [b.el("gmd:MD_Identifier", [b.cs("gmd:code", v)])])]),
          ])
        : null,
    (el) => Boolean(findDirectChild(el, "gmd:EX_GeographicDescription"))
  );

  syncSingle(
    ex,
    "gmd:temporalElement",
    EXTENT_SEQ,
    { begin: extent.temporalBegin, end: extent.temporalEnd },
    (el) => {
      const period = findPath(el, ["gmd:EX_TemporalExtent", "gmd:extent"]);
      const read = (local: string) => {
        const node = period ? Array.from(period.getElementsByTagName("*")).find((n) => (n.localName || n.nodeName.split(":").pop()) === local) : null;
        return node ? getTextContent(node).slice(0, 10) : "";
      };
      return { begin: read("beginPosition"), end: read("endPosition") };
    },
    (v) => {
      if (!v.begin && !v.end) return null;
      const position = (local: string, value: string) =>
        value ? b.text(b.gmlTag(local), value) : b.el(b.gmlTag(local), [], { indeterminatePosition: "unknown" });
      return b.el("gmd:temporalElement", [
        b.el("gmd:EX_TemporalExtent", [
          b.el("gmd:extent", [
            b.el(b.gmlTag("TimePeriod"), [position("beginPosition", v.begin), position("endPosition", v.end)], {
              [`${b.gml.prefix}:id`]: b.nextId("geometa-periode"),
            }),
          ]),
        ]),
      ]);
    },
    (el) => Boolean(findDirectChild(el, "gmd:EX_TemporalExtent"))
  );

  syncSingle(
    ex,
    "gmd:verticalElement",
    EXTENT_SEQ,
    { min: extent.verticalMin, max: extent.verticalMax },
    (el) => {
      const v = findDirectChild(el, "gmd:EX_VerticalExtent");
      return { min: readNumber(v, "gmd:minimumValue"), max: readNumber(v, "gmd:maximumValue") };
    },
    (v) =>
      v.min === null && v.max === null
        ? null
        : b.el("gmd:verticalElement", [
            b.el("gmd:EX_VerticalExtent", [
              b.number("gmd:minimumValue", "Real", v.min) ?? b.nil("gmd:minimumValue"),
              b.number("gmd:maximumValue", "Real", v.max) ?? b.nil("gmd:maximumValue"),
              b.nil("gmd:verticalCRS"),
            ]),
          ])
  );
}

function patchIdentification(b: XmlBuilder, root: Element, form: Form) {
  const id = form.identification;
  const identInfo = getOrCreateChild(b, root, "gmd:identificationInfo", MD_SEQ);
  const dataIdent = findDirectChild(identInfo, "gmd:MD_DataIdentification") ?? identInfo.appendChild(b.el("gmd:MD_DataIdentification"));

  // Sitasi
  const citationProp = getOrCreateChild(b, dataIdent, "gmd:citation", DI_SEQ);
  citationProp.removeAttribute("gco:nilReason");
  const ci = findDirectChild(citationProp, "gmd:CI_Citation") ?? citationProp.appendChild(b.el("gmd:CI_Citation"));
  setTextProperty(b, ci, "gmd:title", id.title, CITATION_SEQ, "nil");
  setTextProperty(b, ci, "gmd:alternateTitle", id.alternateTitle, CITATION_SEQ);
  patchCitationDates(b, ci, id.dates);
  setTextProperty(b, ci, "gmd:edition", id.edition, CITATION_SEQ);
  syncSingle(
    ci,
    "gmd:identifier",
    CITATION_SEQ,
    id.identifierCode.trim(),
    (el) => readProp(childElements(el)[0] ?? null, "gmd:code"),
    (v) => (v ? b.el("gmd:identifier", [b.el("gmd:MD_Identifier", [b.cs("gmd:code", v)])]) : null)
  );
  setCodeProperty(b, ci, "gmd:presentationForm", "gmd:CI_PresentationFormCode", "CI_PresentationFormCode", id.presentationForm, CITATION_SEQ);

  // Deskripsi
  setTextProperty(b, dataIdent, "gmd:abstract", id.abstract, DI_SEQ, "nil");
  setTextProperty(b, dataIdent, "gmd:purpose", id.purpose, DI_SEQ);
  setTextProperty(b, dataIdent, "gmd:credit", id.credit, DI_SEQ);
  setCodeProperty(b, dataIdent, "gmd:status", "gmd:MD_ProgressCode", "MD_ProgressCode", id.status, DI_SEQ);

  syncRepeated(dataIdent, "gmd:pointOfContact", DI_SEQ, id.pointOfContacts.filter(hasContact), parseContactPropertyStrict, (c) =>
    buildContactProp(b, "gmd:pointOfContact", c)
  );

  syncSingle(dataIdent, "gmd:resourceMaintenance", DI_SEQ, id.maintenance, parseMaintenance, (v) =>
    buildMaintenance(b, "gmd:resourceMaintenance", v)
  );

  // Thumbnail GeoNode tidak pernah disentuh; hanya dibuat bila belum ada dan memang terisi.
  const thumb = id.graphicOverview;
  if (!findDirectChild(dataIdent, "gmd:graphicOverview") && filled(thumb.fileName) && thumb.fileName.trim() !== "None") {
    insertInCanonicalOrder(
      dataIdent,
      b.el("gmd:graphicOverview", [
        b.el("gmd:MD_BrowseGraphic", [
          b.cs("gmd:fileName", thumb.fileName.trim()),
          b.csOpt("gmd:fileDescription", thumb.fileDescription),
          b.csOpt("gmd:fileType", thumb.fileType),
        ]),
      ]),
      DI_SEQ
    );
  }

  syncRepeated(dataIdent, "gmd:descriptiveKeywords", DI_SEQ, keywordItems(id), parseKeywordsProperty, (g) => buildKeywords(b, g));

  syncSingle(dataIdent, "gmd:resourceSpecificUsage", DI_SEQ, id.usage, parseUsage, (v) => buildUsage(b, v));

  // Batasan: dibangun ulang hanya bila isinya berubah; duplikat cacat GeoNode selalu dibersihkan.
  const constraintProps = findDirectChildren(dataIdent, "gmd:resourceConstraints");
  if (stableKey(parseResourceConstraints(constraintProps)) === stableKey(id.constraints)) {
    for (const prop of constraintProps) if (isCorruptedGeoNodeConstraint(prop)) dataIdent.removeChild(prop);
  } else {
    for (const prop of constraintProps) dataIdent.removeChild(prop);
    for (const block of buildResourceConstraints(b, id.constraints)) insertInCanonicalOrder(dataIdent, block, DI_SEQ);
  }

  const spatial = form.spatialAndContent;
  setCodeProperty(
    b,
    dataIdent,
    "gmd:spatialRepresentationType",
    "gmd:MD_SpatialRepresentationTypeCode",
    "MD_SpatialRepresentationTypeCode",
    spatial.spatialRepresentationType,
    DI_SEQ
  );
  syncSingle(dataIdent, "gmd:spatialResolution", DI_SEQ, resolutionValue(spatial), parseResolution, (v) => buildResolution(b, v));

  if (!findDirectChild(dataIdent, "gmd:language")) {
    insertInCanonicalOrder(dataIdent, b.cs("gmd:language", form.metadataInfo.language || "ind"), DI_SEQ);
  }

  // Kategori topik: enumerasi XSD biasa tanpa atribut codeList (SPEC 5.E.3)
  for (const t of findDirectChildren(dataIdent, "gmd:topicCategory")) dataIdent.removeChild(t);
  for (const code of isoTopicCodes(id.topicCategories)) {
    insertInCanonicalOrder(dataIdent, b.el("gmd:topicCategory", [b.text("gmd:MD_TopicCategoryCode", code)]), DI_SEQ);
  }

  patchExtent(b, dataIdent, id.extent);
  setTextProperty(b, dataIdent, "gmd:supplementalInformation", id.supplementalInformation, DI_SEQ);
}

function patchDistribution(b: XmlBuilder, root: Element, q: Form["qualityAndDistribution"]) {
  const customLinks = q.onlineResources.filter((r) => !r.isLockedGeoNode && filled(r.linkage));
  const lockedLinks = q.onlineResources.filter((r) => r.isLockedGeoNode);
  const needsDistribution =
    filled(q.distributionFormat.name) ||
    hasContact(q.distributor.contact) ||
    filled(q.distributor.fees) ||
    filled(q.distributor.orderingInstructions) ||
    customLinks.length > 0 ||
    q.transferSize !== null;

  let distInfo = findDirectChild(root, "gmd:distributionInfo");
  if (!distInfo && !needsDistribution) return;
  distInfo = distInfo ?? getOrCreateChild(b, root, "gmd:distributionInfo", MD_SEQ);
  const mdDist = findDirectChild(distInfo, "gmd:MD_Distribution") ?? distInfo.appendChild(b.el("gmd:MD_Distribution"));

  syncSingle(mdDist, "gmd:distributionFormat", DISTRIBUTION_SEQ, q.distributionFormat, parseFormatProp, (v) => buildFormat(b, v));
  syncSingle(mdDist, "gmd:distributor", DISTRIBUTION_SEQ, q.distributor, parseDistributorProp, (v) => buildDistributor(b, v));

  const transferProp = findDirectChild(mdDist, "gmd:transferOptions");
  if (!transferProp && customLinks.length === 0 && q.transferSize === null) return;
  const transfer = transferProp ?? getOrCreateChild(b, mdDist, "gmd:transferOptions", DISTRIBUTION_SEQ);
  const dto = findDirectChild(transfer, "gmd:MD_DigitalTransferOptions") ?? transfer.appendChild(b.el("gmd:MD_DigitalTransferOptions"));

  syncSingle(
    dto,
    "gmd:transferSize",
    TRANSFER_SEQ,
    q.transferSize,
    (el) => {
      const n = Number(readValue(el));
      return readValue(el) && Number.isFinite(n) ? n : null;
    },
    (v) => b.number("gmd:transferSize", "Real", v)
  );

  // Tautan bawaan GeoNode dipertahankan node aslinya; hanya yang dihapus pengguna (setelah buka kunci) yang dibuang.
  const remaining = lockedLinks.map((r) => stableKey({ linkage: r.linkage, protocol: r.protocol, name: r.name }));
  for (const onLine of findDirectChildren(dto, "gmd:onLine")) {
    const ciOnline = findDirectChild(onLine, "gmd:CI_OnlineResource");
    if (!ciOnline) continue;
    const parsed = parseOnlineResource(ciOnline, true);
    const idx = remaining.indexOf(stableKey({ linkage: parsed.linkage, protocol: parsed.protocol, name: parsed.name }));
    if (idx === -1) dto.removeChild(onLine);
    else remaining.splice(idx, 1);
  }
  for (const res of customLinks) insertInCanonicalOrder(dto, buildOnlineResource(b, res), TRANSFER_SEQ);
}

function patchDataQuality(b: XmlBuilder, root: Element, q: Form["qualityAndDistribution"]) {
  const lineageValue = { statement: q.lineageStatement, processSteps: q.processSteps, sources: q.sources };
  const hasContent =
    filled(q.lineageStatement) || q.processSteps.some(hasStepContent) || q.sources.some(hasSourceContent) || q.reports.length > 0;

  let dqInfo = findDirectChild(root, "gmd:dataQualityInfo");
  if (!dqInfo && !hasContent) return;
  dqInfo = dqInfo ?? getOrCreateChild(b, root, "gmd:dataQualityInfo", MD_SEQ);
  const dq = findDirectChild(dqInfo, "gmd:DQ_DataQuality") ?? dqInfo.appendChild(b.el("gmd:DQ_DataQuality"));

  syncSingle(
    dq,
    "gmd:scope",
    DQ_SEQ,
    q.scope || "dataset",
    (el) => readCode(findDirectChild(el, "gmd:DQ_Scope"), "gmd:level"),
    (v) => b.el("gmd:scope", [b.el("gmd:DQ_Scope", [b.code("gmd:level", "gmd:MD_ScopeCode", "MD_ScopeCode", v)])])
  );
  syncRepeated(dq, "gmd:report", DQ_SEQ, q.reports, parseReportProperty, (r) => buildQualityReport(b, r));
  syncSingle(dq, "gmd:lineage", DQ_SEQ, lineageValue, parseLineage, (v) => buildLineage(b, v));
}

function patchMetadataConstraints(b: XmlBuilder, root: Element, c: Form["metadataInfo"]["constraints"]) {
  const existing = findDirectChildren(root, "gmd:metadataConstraints");
  if (stableKey(parseMetadataConstraints(existing)) === stableKey(c)) return;
  for (const prop of existing) root.removeChild(prop);

  let block: Element | null = null;
  if (filled(c.classification)) {
    block = b.el("gmd:MD_SecurityConstraints", [
      b.csOpt("gmd:useLimitation", c.useLimitation),
      b.code("gmd:classification", "gmd:MD_ClassificationCode", "MD_ClassificationCode", c.classification),
    ]);
  } else if (filled(c.useLimitation)) {
    block = b.el("gmd:MD_Constraints", [b.cs("gmd:useLimitation", c.useLimitation.trim())]);
  }
  if (block) insertInCanonicalOrder(root, b.el("gmd:metadataConstraints", [block]), MD_SEQ);
}

/* ------------------------------------------------------------------ */
/* Titik masuk                                                         */
/* ------------------------------------------------------------------ */

function openDocument(baseDocOrXml?: Document | string): { doc: Document; root: Element } {
  if (typeof baseDocOrXml === "string") {
    sanitizeAndValidateXml(baseDocOrXml);
    const { doc, rootMetadata } = unwrapCswAndHoistNamespaces(createXmlDocument(baseDocOrXml));
    return { doc, root: rootMetadata };
  }
  if (baseDocOrXml) {
    const { doc, rootMetadata } = unwrapCswAndHoistNamespaces(baseDocOrXml);
    return { doc, root: rootMetadata };
  }
  const doc = createXmlDocument();
  return { doc, root: doc.documentElement };
}

/**
 * Menambal nilai form ke DOM XML asli tanpa menulis ulang dokumen (SPEC 1.3).
 * Setiap blok disisipkan sesuai urutan xs:sequence ISO/TS 19139; node asli yang isinya
 * tidak berubah dibiarkan apa adanya, termasuk seluruh <gmd:onLine> dan thumbnail GeoNode.
 */
export function patchFormToIso19139(formData: MetadataFormData, baseDocOrXml?: Document | string): string {
  const { doc, root } = openDocument(baseDocOrXml);
  const b = new XmlBuilder(doc, detectGmlNamespace(root));

  if (!root.hasAttribute("xsi:schemaLocation")) {
    root.setAttribute("xsi:schemaLocation", SCHEMA_LOCATION);
  }

  const spatial = formData.spatialAndContent;

  patchMetadataRoot(b, root, formData);

  // spatialRepresentationInfo dibangun ulang dari form; tag kosong GeoNode ikut terbuang (SPEC 5.E.3).
  for (const prop of findDirectChildren(root, "gmd:spatialRepresentationInfo")) root.removeChild(prop);
  const spatialRep = buildSpatialRepresentation(b, spatial);
  if (spatialRep) insertInCanonicalOrder(root, spatialRep, MD_SEQ);

  syncRepeated(
    root,
    "gmd:referenceSystemInfo",
    MD_SEQ,
    spatial.referenceSystems
      .filter((r) => filled(r.code))
      .map((r) => ({ code: r.code.trim(), codeSpace: r.codeSpace.trim(), version: r.version.trim() })),
    parseReferenceSystemProperty,
    (r) => buildReferenceSystem(b, r)
  );

  syncSingle(root, "gmd:metadataExtensionInfo", MD_SEQ, formData.advanced.metadataExtension, parseMetadataExtensionProperty, (v) =>
    buildMetadataExtension(b, v)
  );

  patchIdentification(b, root, formData);

  syncSingle(root, "gmd:contentInfo", MD_SEQ, contentKey(spatial.contentInfo), parseContentKey, () => buildContentInfo(b, spatial.contentInfo), isManagedContent);

  patchDistribution(b, root, formData.qualityAndDistribution);
  patchDataQuality(b, root, formData.qualityAndDistribution);

  syncSingle(root, "gmd:portrayalCatalogueInfo", MD_SEQ, formData.advanced.portrayalCatalogue, parsePortrayalProperty, (ref) =>
    hasCitationContent(ref)
      ? b.el("gmd:portrayalCatalogueInfo", [
          b.el("gmd:MD_PortrayalCatalogueReference", [b.el("gmd:portrayalCatalogueCitation", [buildCitation(b, ref)])]),
        ])
      : null
  );

  patchMetadataConstraints(b, root, formData.metadataInfo.constraints);

  syncSingle(root, "gmd:applicationSchemaInfo", MD_SEQ, formData.advanced.applicationSchema, parseApplicationSchemaProperty, (v) =>
    hasCitationContent(v.citation) || filled(v.schemaLanguage) || filled(v.constraintLanguage)
      ? b.el("gmd:applicationSchemaInfo", [
          b.el("gmd:MD_ApplicationSchemaInformation", [
            b.el("gmd:name", [buildCitation(b, v.citation)]),
            b.csOrNil("gmd:schemaLanguage", v.schemaLanguage),
            b.csOrNil("gmd:constraintLanguage", v.constraintLanguage),
          ]),
        ])
      : null
  );

  syncSingle(root, "gmd:metadataMaintenance", MD_SEQ, formData.metadataInfo.maintenance, parseMetadataMaintenance, (v) =>
    buildMaintenance(b, "gmd:metadataMaintenance", v)
  );

  prettyPrint(doc, root);
  return serializeXmlDocument(doc);
}
