import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl, checkRateLimit, getClientIp } from "@/lib/server/security";
import { sanitizeAndValidateXml } from "@/lib/xml-engine/xxe-sanitizer";

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 20, 60000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan penyimpanan (Rate limit tercapai). Silakan coba lagi dalam 1 menit." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await req.json();
    const { baseUrl, pk, xml, preserveMetadata = true, auth } = body;

    // Validate parameters
    if (!baseUrl || !pk || !xml) {
      return NextResponse.json(
        { error: "Parameter 'baseUrl', 'pk', dan 'xml' wajib disertakan." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!auth?.username || !auth?.password) {
      return NextResponse.json(
        { error: "Kredensial GeoNode (username dan password) wajib diisi untuk menyimpan metadata ke server." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // SSRF Check
    const urlValidation = validateSafeUrl(baseUrl);
    if (!urlValidation.valid || !urlValidation.urlObj) {
      return NextResponse.json(
        { error: urlValidation.error || "Base URL GeoNode tidak valid atau diblokir demi keamanan." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // XXE Check & Payload Size Limit
    sanitizeAndValidateXml(xml);

    const safeBaseUrl = urlValidation.urlObj.origin;
    const basicToken = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");

    // Clear password reference from local object scope
    auth.password = "";

    const headers: Record<string, string> = {
      Authorization: `Basic ${basicToken}`,
    };

    // 1. Upload metadata XML to GeoNode REST API v2
    const metadataEndpoint = `${safeBaseUrl}/api/v2/datasets/${pk}/metadata`;

    // Try multipart form-data payload (compatible with GeoNode metadata file upload)
    const formData = new FormData();
    const blob = new Blob([xml], { type: "application/xml" });
    formData.append("metadata_file", blob, `metadata_${pk}.xml`);

    let uploadRes = await fetch(metadataEndpoint, {
      method: "PUT",
      headers,
      body: formData,
      cache: "no-store",
    });

    // Fallback: If multipart is rejected, try raw XML payload
    if (!uploadRes.ok && uploadRes.status === 415) {
      uploadRes = await fetch(metadataEndpoint, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/xml",
        },
        body: xml,
        cache: "no-store",
      });
    }

    if (!uploadRes.ok) {
      let errorMsg = `Server GeoNode mengembalikan status HTTP ${uploadRes.status}`;
      if (uploadRes.status === 401) {
        errorMsg = "Kredensial GeoNode tidak valid atau sesi telah kedaluwarsa (401 Unauthorized).";
      } else if (uploadRes.status === 403) {
        errorMsg = "Akun GeoNode Anda tidak memiliki izin untuk mengedit metadata dataset ini (403 Forbidden).";
      } else if (uploadRes.status === 404) {
        errorMsg = `Dataset dengan ID (PK) ${pk} tidak ditemukan di server GeoNode (404 Not Found).`;
      }
      return NextResponse.json(
        { error: errorMsg },
        { status: uploadRes.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. If preserveMetadata is true, set metadata_uploaded_preserve = true on the dataset
    if (preserveMetadata) {
      const patchEndpoint = `${safeBaseUrl}/api/v2/datasets/${pk}`;
      try {
        await fetch(patchEndpoint, {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ metadata_uploaded_preserve: true }),
          cache: "no-store",
        });
      } catch (err) {
        console.warn("Gagal memperbarui metadata_uploaded_preserve flag:", err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Metadata berhasil disimpan dan diperbarui di GeoNode.",
        preserved: preserveMetadata,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal saat menyimpan metadata ke GeoNode." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
