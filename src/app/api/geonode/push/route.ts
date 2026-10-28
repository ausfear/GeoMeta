import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl, checkRateLimit, getClientIp } from "@/lib/server/security";
import { sanitizeAndValidateXml } from "@/lib/xml-engine/xxe-sanitizer";
import { createXmlDocument, unwrapCswAndHoistNamespaces, serializeXmlDocument, readProp } from "@/lib/xml-engine/dom-utils";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/** Hasil penyalaan metadata_uploaded_preserve. `status` null berarti permintaan gagal terkirim. */
interface PreserveResult {
  requested: boolean;
  ok: boolean;
  status: number | null;
}

/** Status tanda preserve dan XML yang benar-benar tersimpan, dibaca ulang setelah penyimpanan. */
interface Verification {
  storedXml?: string;
  preserveFlag?: boolean;
  error?: string;
}

function fileIdentifierOf(xml: string): string {
  const { rootMetadata } = unwrapCswAndHoistNamespaces(createXmlDocument(xml));
  return readProp(rootMetadata, "gmd:fileIdentifier");
}

async function readBack(baseUrl: string, pk: string, uuid: string, headers: Record<string, string>): Promise<Verification> {
  const result: Verification = {};
  try {
    const apiRes = await fetch(`${baseUrl}/api/v2/datasets/${pk}`, { headers: { ...headers, Accept: "application/json" }, cache: "no-store" });
    if (apiRes.ok) {
      const json = await apiRes.json();
      const dataset = json.dataset ?? json;
      if (typeof dataset?.metadata_uploaded_preserve === "boolean") result.preserveFlag = dataset.metadata_uploaded_preserve;
    }
  } catch {
    // Status tanda preserve bersifat informasi tambahan; verifikasi isi tetap dilanjutkan.
  }

  if (!uuid) return { ...result, error: "UUID tidak ditemukan di XML yang dikirim." };

  try {
    const cswUrl = `${baseUrl}/catalogue/csw?service=CSW&version=2.0.2&request=GetRecordById&Id=${encodeURIComponent(
      uuid
    )}&ElementSetName=full&outputSchema=http://www.isotc211.org/2005/gmd`;
    const cswRes = await fetch(cswUrl, { headers, cache: "no-store" });
    if (!cswRes.ok) return { ...result, error: `CSW GeoNode mengembalikan status HTTP ${cswRes.status}.` };
    const raw = await cswRes.text();
    sanitizeAndValidateXml(raw);
    const { doc } = unwrapCswAndHoistNamespaces(createXmlDocument(raw));
    return { ...result, storedXml: serializeXmlDocument(doc) };
  } catch (err: any) {
    return { ...result, error: err?.message || "Metadata tidak bisa dibaca ulang dari CSW GeoNode." };
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 20, 60000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan penyimpanan (Rate limit tercapai). Silakan coba lagi dalam 1 menit." },
      { status: 429, headers: NO_STORE }
    );
  }

  try {
    const body = await req.json();
    const { baseUrl, pk, xml, preserveMetadata = true, auth } = body;

    if (!baseUrl || !pk || !xml) {
      return NextResponse.json({ error: "Parameter 'baseUrl', 'pk', dan 'xml' wajib disertakan." }, { status: 400, headers: NO_STORE });
    }

    if (!auth?.username || !auth?.password) {
      return NextResponse.json(
        { error: "Kredensial GeoNode (username dan password) wajib diisi untuk menyimpan metadata ke server." },
        { status: 401, headers: NO_STORE }
      );
    }

    const urlValidation = validateSafeUrl(baseUrl);
    if (!urlValidation.valid || !urlValidation.urlObj) {
      return NextResponse.json(
        { error: urlValidation.error || "Base URL GeoNode tidak valid atau diblokir demi keamanan." },
        { status: 400, headers: NO_STORE }
      );
    }

    sanitizeAndValidateXml(xml);

    const safeBaseUrl = urlValidation.urlObj.origin;
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
    };
    auth.password = "";

    // 1. Nyalakan metadata_uploaded_preserve SEBELUM mengunggah. GeoNode memutuskan menyimpan atau membuat
    //    ulang XML saat dataset disimpan (catalogue_post_save); bila tanda ini baru dinyalakan setelahnya,
    //    XML kiriman sudah terlanjur diganti XML templat.
    const preserve: PreserveResult = { requested: Boolean(preserveMetadata), ok: false, status: null };
    if (preserve.requested) {
      try {
        const patchRes = await fetch(`${safeBaseUrl}/api/v2/datasets/${pk}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ metadata_uploaded_preserve: true }),
          cache: "no-store",
        });
        preserve.status = patchRes.status;
        preserve.ok = patchRes.ok;
      } catch {
        preserve.ok = false;
      }
    }

    // 2. Unggah XML metadata
    const metadataEndpoint = `${safeBaseUrl}/api/v2/datasets/${pk}/metadata`;
    const formData = new FormData();
    formData.append("metadata_file", new Blob([xml], { type: "application/xml" }), `metadata_${pk}.xml`);

    let uploadRes = await fetch(metadataEndpoint, { method: "PUT", headers, body: formData, cache: "no-store" });

    // Fallback: bila multipart ditolak, kirim XML mentah
    if (!uploadRes.ok && uploadRes.status === 415) {
      uploadRes = await fetch(metadataEndpoint, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/xml" },
        body: xml,
        cache: "no-store",
      });
    }

    if (!uploadRes.ok) {
      let errorMsg = `Server GeoNode mengembalikan status HTTP ${uploadRes.status}`;
      if (uploadRes.status === 401) errorMsg = "Kredensial GeoNode tidak valid atau sesi telah kedaluwarsa (401 Unauthorized).";
      else if (uploadRes.status === 403) errorMsg = "Akun GeoNode Anda tidak memiliki izin untuk mengedit metadata dataset ini (403 Forbidden).";
      else if (uploadRes.status === 404) errorMsg = `Dataset dengan ID (PK) ${pk} tidak ditemukan di server GeoNode (404 Not Found).`;
      return NextResponse.json({ error: errorMsg, preserve }, { status: uploadRes.status, headers: NO_STORE });
    }

    // 3. Baca ulang dari CSW: GeoNode bisa menerima unggahan tetapi membuang isinya saat membuat ulang XML.
    let uuid = "";
    try {
      uuid = fileIdentifierOf(xml);
    } catch {
      // ditangani readBack sebagai UUID kosong
    }
    const verification = await readBack(safeBaseUrl, String(pk), uuid, headers);

    return NextResponse.json({ success: true, preserve, verification }, { status: 200, headers: NO_STORE });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal saat menyimpan metadata ke GeoNode." },
      { status: 500, headers: NO_STORE }
    );
  }
}
