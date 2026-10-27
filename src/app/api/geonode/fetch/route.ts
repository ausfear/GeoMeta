import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl, checkRateLimit, getClientIp } from "@/lib/server/security";
import { sanitizeAndValidateXml } from "@/lib/xml-engine/xxe-sanitizer";
import { createXmlDocument, unwrapCswAndHoistNamespaces, serializeXmlDocument } from "@/lib/xml-engine/dom-utils";

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 30, 60000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba kembali." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await req.json();
    const { targetUrlOrUuid, auth } = body;

    if (!targetUrlOrUuid || typeof targetUrlOrUuid !== "string") {
      return NextResponse.json(
        { error: "Parameter 'targetUrlOrUuid' wajib diisi." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const trimmedInput = targetUrlOrUuid.trim();
    let baseUrl: string = "";
    let datasetUuid: string = "";
    let datasetPk: string = "";
    let alternate: string = "";

    const isUrl = trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://");

    if (isUrl) {
      const validation = validateSafeUrl(trimmedInput);
      if (!validation.valid || !validation.urlObj) {
        return NextResponse.json(
          { error: validation.error || "URL GeoNode tidak aman atau tidak valid." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      baseUrl = validation.urlObj.origin;
      const pathname = validation.urlObj.pathname;
      const hash = validation.urlObj.hash;

      // Check pattern: /datasets/{alternate} or /layers/{alternate}
      const datasetMatch = pathname.match(/\/(?:datasets|layers)\/([^/?#]+)/);
      if (datasetMatch) {
        alternate = datasetMatch[1];
      }

      // Check pattern: /catalogue/#/dataset/{pk}
      const pkMatch = (pathname + hash).match(/\/dataset\/(\d+)/);
      if (pkMatch) {
        datasetPk = pkMatch[1];
      }
    } else {
      // Input is UUID
      datasetUuid = trimmedInput;
      if (auth?.baseUrl) {
        const validation = validateSafeUrl(auth.baseUrl);
        if (!validation.valid || !validation.urlObj) {
          return NextResponse.json(
            { error: "Base URL GeoNode yang disertakan tidak aman atau tidak valid." },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }
        baseUrl = validation.urlObj.origin;
      } else {
        return NextResponse.json(
          { error: "Untuk pencarian berbasis UUID, Base URL GeoNode wajib disertakan." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      Accept: "application/json, application/xml, text/xml",
    };

    if (auth?.username && auth?.password) {
      const token = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      requestHeaders["Authorization"] = `Basic ${token}`;
    }

    let datasetMeta: {
      baseUrl: string;
      pk?: string;
      uuid?: string;
      title?: string;
      alternate?: string;
      preserveFlag?: boolean;
    } = { baseUrl };

    // If we have alternate or pk, fetch metadata from GeoNode REST API v2
    if (alternate || datasetPk) {
      const apiUrl = datasetPk
        ? `${baseUrl}/api/v2/datasets/${datasetPk}`
        : `${baseUrl}/api/v2/datasets/?filter{alternate}=${encodeURIComponent(alternate)}`;

      try {
        const apiRes = await fetch(apiUrl, {
          headers: requestHeaders,
          cache: "no-store",
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          const datasetData = json.dataset || json.datasets?.[0] || json;
          if (datasetData) {
            datasetMeta = {
              baseUrl,
              pk: datasetData.pk ? String(datasetData.pk) : datasetPk,
              uuid: datasetData.uuid,
              title: datasetData.title,
              alternate: datasetData.alternate || alternate,
              preserveFlag: Boolean(datasetData.metadata_uploaded_preserve),
            };
            if (datasetData.uuid) {
              datasetUuid = datasetData.uuid;
            }
          }
        }
      } catch (err) {
        console.warn("Gagal menghubungi REST API v2 GeoNode, melanjutkan langsung ke CSW...");
      }
    }

    if (!datasetUuid) {
      return NextResponse.json(
        { error: `Tidak dapat menemukan UUID dataset untuk '${trimmedInput}'. Pastikan layer/dataset ada di server GeoNode.` },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fetch full XML via GeoNode CSW
    const cswUrl = `${baseUrl}/catalogue/csw?service=CSW&version=2.0.2&request=GetRecordById&Id=${encodeURIComponent(
      datasetUuid
    )}&ElementSetName=full&outputSchema=http://www.isotc211.org/2005/gmd`;

    const cswRes = await fetch(cswUrl, {
      headers: requestHeaders,
      cache: "no-store",
    });

    if (!cswRes.ok) {
      return NextResponse.json(
        { error: `Gagal mengambil XML metadata dari CSW GeoNode (Status HTTP ${cswRes.status}).` },
        { status: cswRes.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const xmlRaw = await cswRes.text();

    // Security sanitization (XXE check)
    sanitizeAndValidateXml(xmlRaw);

    // Unwrap CSW and hoist namespaces
    const doc = createXmlDocument(xmlRaw);
    const { doc: cleanDoc } = unwrapCswAndHoistNamespaces(doc);
    const finalXml = serializeXmlDocument(cleanDoc);

    return NextResponse.json(
      {
        xml: finalXml,
        datasetMeta: {
          baseUrl,
          pk: datasetMeta.pk || datasetPk,
          uuid: datasetUuid,
          title: datasetMeta.title,
          alternate: datasetMeta.alternate || alternate,
          preserveFlag: datasetMeta.preserveFlag ?? true,
        },
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
      { error: error.message || "Terjadi kesalahan internal server saat memproses pengambilan metadata." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
