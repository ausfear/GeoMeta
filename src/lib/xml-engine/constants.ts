export const XMLNS = {
  GMD: "http://www.isotc211.org/2005/gmd",
  GCO: "http://www.isotc211.org/2005/gco",
  GMX: "http://www.isotc211.org/2005/gmx",
  GML: "http://www.opengis.net/gml",
  GML32: "http://www.opengis.net/gml/3.2",
  XLINK: "http://www.w3.org/1999/xlink",
  XSI: "http://www.w3.org/2001/XMLSchema-instance",
  CSW: "http://www.opengis.net/cat/csw/2.0.2",
} as const;

export const SCHEMA_LOCATION =
  "http://www.isotc211.org/2005/gmd http://www.isotc211.org/2005/gmd/gmd.xsd";

export const CODELIST_BASE_URL =
  "http://standards.iso.org/ittf/PubliclyAvailableStandards/ISO_19139_Schemas/resources/codelist/ML_gmxCodelists.xml";

export const CODELIST_GEONODE_BASE_URL =
  "http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml";

/* ------------------------------------------------------------------ */
/* Urutan kanonik xs:sequence ISO/TS 19139                              */
/* ------------------------------------------------------------------ */
// Subkelas mewarisi urutan induknya terlebih dahulu (xs:extension), jadi
// daftar subkelas di bawah selalu diawali elemen milik kelas induk.

const gmd = (...names: string[]) => names.map((n) => `gmd:${n}`);

export const CANONICAL_SEQUENCE_MD_METADATA = gmd(
  "fileIdentifier",
  "language",
  "characterSet",
  "parentIdentifier",
  "hierarchyLevel",
  "hierarchyLevelName",
  "contact",
  "dateStamp",
  "metadataStandardName",
  "metadataStandardVersion",
  "dataSetURI",
  "locale",
  "spatialRepresentationInfo",
  "referenceSystemInfo",
  "metadataExtensionInfo",
  "identificationInfo",
  "contentInfo",
  "distributionInfo",
  "dataQualityInfo",
  "portrayalCatalogueInfo",
  "metadataConstraints",
  "applicationSchemaInfo",
  "metadataMaintenance",
  "series",
  "describes",
  "propertyType",
  "featureType",
  "featureAttribute"
);

export const CANONICAL_SEQUENCE_MD_DATA_IDENTIFICATION = gmd(
  "citation",
  "abstract",
  "purpose",
  "credit",
  "status",
  "pointOfContact",
  "resourceMaintenance",
  "graphicOverview",
  "resourceFormat",
  "descriptiveKeywords",
  "resourceSpecificUsage",
  "resourceConstraints",
  "aggregationInfo",
  "spatialRepresentationType",
  "spatialResolution",
  "language",
  "characterSet",
  "topicCategory",
  "environmentDescription",
  "extent",
  "supplementalInformation"
);

export const CANONICAL_SEQUENCE_CI_RESPONSIBLE_PARTY = gmd("individualName", "organisationName", "positionName", "contactInfo", "role");

export const CANONICAL_SEQUENCE_CI_CONTACT = gmd("phone", "address", "onlineResource", "hoursOfService", "contactInstructions");

export const CANONICAL_SEQUENCE_CI_ADDRESS = gmd(
  "deliveryPoint",
  "city",
  "administrativeArea",
  "postalCode",
  "country",
  "electronicMailAddress"
);

export const CANONICAL_SEQUENCE_CI_CITATION = gmd(
  "title",
  "alternateTitle",
  "date",
  "edition",
  "editionDate",
  "identifier",
  "citedResponsibleParty",
  "presentationForm",
  "series",
  "otherCitationDetails",
  "collectiveTitle",
  "ISBN",
  "ISSN"
);

export const CANONICAL_SEQUENCE_CI_ONLINE_RESOURCE = gmd("linkage", "protocol", "applicationProfile", "name", "description", "function");

export const CANONICAL_SEQUENCE_MD_KEYWORDS = gmd("keyword", "type", "thesaurusName");

export const CANONICAL_SEQUENCE_EX_EXTENT = gmd("description", "geographicElement", "temporalElement", "verticalElement");

export const CANONICAL_SEQUENCE_MD_USAGE = gmd("specificUsage", "usageDateTime", "userDeterminedLimitations", "userContactInfo");

export const CANONICAL_SEQUENCE_MD_MAINTENANCE_INFORMATION = gmd(
  "maintenanceAndUpdateFrequency",
  "dateOfNextUpdate",
  "userDefinedMaintenanceFrequency",
  "updateScope",
  "updateScopeDescription",
  "maintenanceNote",
  "contact"
);

export const CANONICAL_SEQUENCE_MD_LEGAL_CONSTRAINTS = gmd("useLimitation", "accessConstraints", "useConstraints", "otherConstraints");

export const CANONICAL_SEQUENCE_MD_SECURITY_CONSTRAINTS = gmd(
  "useLimitation",
  "classification",
  "userNote",
  "classificationSystem",
  "handlingDescription"
);

export const CANONICAL_SEQUENCE_MD_DISTRIBUTION = gmd("distributionFormat", "distributor", "transferOptions");

export const CANONICAL_SEQUENCE_MD_DIGITAL_TRANSFER_OPTIONS = gmd("unitsOfDistribution", "transferSize", "onLine", "offLine");

export const CANONICAL_SEQUENCE_MD_FORMAT = gmd(
  "name",
  "version",
  "amendmentNumber",
  "specification",
  "fileDecompressionTechnique",
  "formatDistributor"
);

export const CANONICAL_SEQUENCE_MD_DISTRIBUTOR = gmd(
  "distributorContact",
  "distributionOrderProcess",
  "distributorFormat",
  "distributorTransferOptions"
);

export const CANONICAL_SEQUENCE_MD_STANDARD_ORDER_PROCESS = gmd("fees", "plannedAvailableDateTime", "orderingInstructions", "turnaround");

export const CANONICAL_SEQUENCE_DQ_DATA_QUALITY = gmd("scope", "report", "lineage");

/** AbstractDQ_Element_Type: berlaku untuk ke-15 subkelas DQ_*. */
export const CANONICAL_SEQUENCE_DQ_ELEMENT = gmd(
  "nameOfMeasure",
  "measureIdentification",
  "measureDescription",
  "evaluationMethodType",
  "evaluationMethodDescription",
  "evaluationProcedure",
  "dateTime",
  "result"
);

export const CANONICAL_SEQUENCE_DQ_CONFORMANCE_RESULT = gmd("specification", "explanation", "pass");

export const CANONICAL_SEQUENCE_DQ_QUANTITATIVE_RESULT = gmd("valueType", "valueUnit", "errorStatistic", "value");

export const CANONICAL_SEQUENCE_LI_LINEAGE = gmd("statement", "processStep", "source");

export const CANONICAL_SEQUENCE_LI_PROCESS_STEP = gmd("description", "rationale", "dateTime", "processor", "source");

export const CANONICAL_SEQUENCE_LI_SOURCE = gmd(
  "description",
  "scaleDenominator",
  "sourceReferenceSystem",
  "sourceCitation",
  "sourceExtent",
  "sourceStep"
);

export const CANONICAL_SEQUENCE_MD_FEATURE_CATALOGUE_DESCRIPTION = gmd(
  "complianceCode",
  "language",
  "includedWithDataset",
  "featureTypes",
  "featureCatalogueCitation"
);

export const CANONICAL_SEQUENCE_MD_COVERAGE_DESCRIPTION = gmd("attributeDescription", "contentType", "dimension");

export const CANONICAL_SEQUENCE_MD_VECTOR_SPATIAL_REPRESENTATION = gmd("topologyLevel", "geometricObjects");

const GRID_BASE = ["numberOfDimensions", "axisDimensionProperties", "cellGeometry", "transformationParameterAvailability"];

export const CANONICAL_SEQUENCE_MD_GRID_SPATIAL_REPRESENTATION = gmd(...GRID_BASE);

export const CANONICAL_SEQUENCE_MD_GEORECTIFIED = gmd(
  ...GRID_BASE,
  "checkPointAvailability",
  "checkPointDescription",
  "cornerPoints",
  "centerPoint",
  "pointInPixel",
  "transformationDimensionDescription",
  "transformationDimensionMapping"
);

export const CANONICAL_SEQUENCE_MD_GEOREFERENCEABLE = gmd(
  ...GRID_BASE,
  "controlPointAvailability",
  "orientationParameterAvailability",
  "orientationParameterDescription",
  "georeferencedParameters",
  "parameterCitation"
);

export const CANONICAL_SEQUENCE_RS_IDENTIFIER = gmd("authority", "code", "codeSpace", "version");

export const CANONICAL_SEQUENCE_MD_APPLICATION_SCHEMA_INFORMATION = gmd(
  "name",
  "schemaLanguage",
  "constraintLanguage",
  "schemaAscii",
  "graphicsFile",
  "softwareDevelopmentFile",
  "softwareDevelopmentFileFormat"
);

export const CANONICAL_SEQUENCE_MD_EXTENDED_ELEMENT_INFORMATION = gmd(
  "name",
  "shortName",
  "domainCode",
  "definition",
  "obligation",
  "condition",
  "dataType",
  "maximumOccurrence",
  "domainValue",
  "parentEntity",
  "rule",
  "rationale",
  "source"
);

/** String placeholder bawaan GeoNode yang dihitung sebagai belum terisi. */
export const SENTINEL_PLACEHOLDERS = [
  "None",
  "No abstract provided",
  "No information provided",
  "Not Specified: The original author did not specify a license.",
];
