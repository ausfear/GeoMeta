const MAX_XML_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class XmlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlSecurityError";
  }
}

export function sanitizeAndValidateXml(xmlContent: string): void {
  if (!xmlContent || typeof xmlContent !== "string") {
    throw new XmlSecurityError("Konten XML kosong atau tidak valid.");
  }

  // Check payload size
  const byteLength = new TextEncoder().encode(xmlContent).length;
  if (byteLength > MAX_XML_SIZE_BYTES) {
    throw new XmlSecurityError(
      `Ukuran file XML (${(byteLength / (1024 * 1024)).toFixed(2)} MB) melebihi batas aman maksimal 5 MB.`
    );
  }

  // Check for XXE declarations (DOCTYPE or ENTITY)
  const doctypePattern = /<!DOCTYPE\b/i;
  const entityPattern = /<!ENTITY\b/i;

  if (doctypePattern.test(xmlContent)) {
    throw new XmlSecurityError(
      "Dokumen XML ditolak karena memuat deklarasi '<!DOCTYPE' yang berpotensi membahayakan keamanan (XXE)."
    );
  }

  if (entityPattern.test(xmlContent)) {
    throw new XmlSecurityError(
      "Dokumen XML ditolak karena memuat deklarasi '<!ENTITY' yang berpotensi membahayakan keamanan (XXE)."
    );
  }
}
