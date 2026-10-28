import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { parseIso19139ToForm, patchFormToIso19139 } from "../src/lib/xml-engine";
import { compareStoredMetadata } from "../src/lib/push-verification";
import { POST } from "../src/app/api/geonode/push/route";
import { fillCompleteForm } from "./fixtures/full-form";

const SAMPLE_XML = fs.readFileSync(path.resolve(__dirname, "../jaringan_irigasi_prov_kaltim_ISO_Metadata.xml"), "utf-8");
const parsed = parseIso19139ToForm(SAMPLE_XML).formData;
const SENT_XML = patchFormToIso19139(fillCompleteForm(parsed), SAMPLE_XML);

describe("Verifikasi pasca-simpan: membandingkan XML terkirim dengan XML di GeoNode", () => {
  it("tidak melaporkan kehilangan bila GeoNode mempertahankan XML kiriman", () => {
    const report = compareStoredMetadata(SENT_XML, SENT_XML);
    expect(report.lost).toEqual([]);
    expect(report.kept.length).toBeGreaterThan(30);
  });

  it("mendeteksi isian SE 6/2021 yang dibuang saat GeoNode membuat ulang XML dari templat", () => {
    // XML Kaltim asli = keluaran templat GeoNode tanpa isian tambahan GeoMeta.
    const report = compareStoredMetadata(SENT_XML, SAMPLE_XML);
    const lost = report.lost.map((l) => l.label);
    expect(lost).toEqual(
      expect.arrayContaining([
        "Jenis sumber daya & level jangkauan",
        "Pemeliharaan metadata",
        "Hasil QA Walidata",
        "Laporan kualitas data",
        "Abstrak",
      ])
    );
    const kept = report.kept.map((l) => l.label);
    expect(kept).toEqual(expect.arrayContaining(["UUID dokumen metadata", "Tautan unduhan & layanan", "Batas koordinat"]));
  });

  it("tidak menghitung bagian yang memang tidak diisi", () => {
    const report = compareStoredMetadata(SAMPLE_XML, SAMPLE_XML);
    const all = [...report.kept, ...report.lost].map((l) => l.label);
    expect(all).not.toContain("Hasil QA Walidata");
    expect(all).not.toContain("Ekstensi metadata");
  });
});

describe("Rute /api/geonode/push", () => {
  afterEach(() => vi.unstubAllGlobals());

  function pushRequest(preserveMetadata = true) {
    return new NextRequest("http://localhost/api/geonode/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({
        baseUrl: "https://jigd.kaltimprov.go.id",
        pk: "737",
        xml: SENT_XML,
        preserveMetadata,
        auth: { username: "produsen", password: "rahasia" },
      }),
    });
  }

  function mockGeoNode({ patchStatus = 200, storedXml = SAMPLE_XML, preserveFlag = true } = {}) {
    const calls: Array<{ method: string; url: string; headers: Record<string, string> }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ method, url, headers: (init.headers ?? {}) as Record<string, string> });
      if (method === "PATCH") return new Response("{}", { status: patchStatus });
      if (method === "PUT") return new Response("{}", { status: 200 });
      if (url.includes("/catalogue/csw")) return new Response(storedXml, { status: 200 });
      return new Response(JSON.stringify({ dataset: { metadata_uploaded_preserve: preserveFlag } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return calls;
  }

  it("menyalakan preserve SEBELUM mengunggah, lalu membaca ulang dari CSW", async () => {
    const calls = mockGeoNode();
    const res = await POST(pushRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "PATCH /api/v2/datasets/737",
      "PUT /api/v2/datasets/737/metadata",
      "GET /api/v2/datasets/737",
      "GET /catalogue/csw",
    ]);
    expect(calls[3].url).toContain("Id=7ca717a3-420e-47be-97a9-894c3b3f2fdc");
    expect(json.preserve).toEqual({ requested: true, ok: true, status: 200 });
    expect(json.verification.preserveFlag).toBe(true);
    expect(json.verification.storedXml).toContain("<gmd:MD_Metadata");
    expect(json.verification.storedXml).not.toContain("GetRecordByIdResponse");
  });

  it("melaporkan PATCH yang ditolak alih-alih mengabaikannya", async () => {
    mockGeoNode({ patchStatus: 400, preserveFlag: false });
    const json = await (await POST(pushRequest())).json();
    expect(json.preserve).toEqual({ requested: true, ok: false, status: 400 });
    expect(json.verification.preserveFlag).toBe(false);
  });

  it("tidak mengirim PATCH bila preserve tidak diminta", async () => {
    const calls = mockGeoNode();
    await POST(pushRequest(false));
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("hanya mengirim kredensial lewat header, tidak pernah lewat URL", async () => {
    const calls = mockGeoNode();
    await POST(pushRequest());
    for (const call of calls) {
      expect(call.url).not.toContain("rahasia");
      expect(call.headers.Authorization).toBe(`Basic ${Buffer.from("produsen:rahasia").toString("base64")}`);
    }
  });
});
