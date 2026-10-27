/**
 * Pembacaan URL GeoNode di sisi klien untuk pratinjau sebelum metadata dimuat.
 * Pola pencocokan sengaja disamakan dengan /api/geonode/fetch agar yang ditampilkan
 * ke pengguna adalah yang benar-benar akan dicari oleh server.
 */
export type GeoNodeUrlReading =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "uuid-only"; uuid: string }
  | {
      kind: "url";
      host: string;
      alternate?: string;
      pk?: string;
      warning?: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readGeoNodeInput(raw: string): GeoNodeUrlReading {
  const input = raw.trim();
  if (!input) return { kind: "empty" };

  if (UUID_PATTERN.test(input)) return { kind: "uuid-only", uuid: input };

  if (!/^https?:\/\//i.test(input)) {
    return {
      kind: "invalid",
      message: "Alamat harus diawali https:// atau berupa UUID dataset.",
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: "invalid", message: "Alamat ini bukan URL yang valid." };
  }

  const alternate = url.pathname.match(/\/(?:datasets|layers)\/([^/?#]+)/)?.[1];
  const pk = (url.pathname + url.hash).match(/\/dataset\/(\d+)/)?.[1];

  let warning: string | undefined;
  if (url.protocol === "http:" && url.hostname !== "localhost") {
    warning = "Server hanya menerima alamat https://.";
  } else if (!alternate && !pk) {
    warning = "Nama layer atau ID dataset tidak ditemukan di alamat ini. Buka halaman dataset di GeoNode, lalu salin alamatnya.";
  }

  return {
    kind: "url",
    host: url.host,
    alternate: alternate ? decodeURIComponent(alternate) : undefined,
    pk,
    warning,
  };
}
