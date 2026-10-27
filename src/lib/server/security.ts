import { NextRequest } from "next/server";

// In-memory rate limiter: IP -> Array of timestamps
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(ip: string, limit: number = 20, windowMs: number = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= limit) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return true;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export function validateSafeUrl(targetUrl: string): { valid: boolean; error?: string; urlObj?: URL } {
  try {
    const url = new URL(targetUrl);

    // Protocol check
    const isDev = process.env.NODE_ENV === "development";
    if (url.protocol !== "https:") {
      if (!(isDev && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) {
        return { valid: false, error: "Hanya protokol HTTPS aman yang diizinkan untuk menghubungkan ke GeoNode." };
      }
    }

    const host = url.hostname.toLowerCase();

    // Check private IP ranges / loopback
    if (
      host === "localhost" && !isDev ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.")
    ) {
      return { valid: false, error: "Akses ke alamat IP lokal/privat diblokir demi keamanan (SSRF Protection)." };
    }

    // 172.16.0.0 - 172.31.255.255
    if (host.startsWith("172.")) {
      const secondOctet = parseInt(host.split(".")[1], 10);
      if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
        return { valid: false, error: "Akses ke rentang IP privat 172.16.0.0/12 diblokir demi keamanan." };
      }
    }

    // Whitelist check if ALLOWED_GEONODE_HOSTS environment variable is set
    const allowedHostsEnv = process.env.ALLOWED_GEONODE_HOSTS;
    if (allowedHostsEnv && allowedHostsEnv.trim()) {
      const allowedHosts = allowedHostsEnv.split(",").map((h) => h.trim().toLowerCase());
      if (!allowedHosts.includes(host)) {
        return {
          valid: false,
          error: `Host '${host}' tidak terdaftar dalam daftar putih domain GeoNode yang diizinkan (${allowedHosts.join(", ")}).`,
        };
      }
    }

    return { valid: true, urlObj: url };
  } catch {
    return { valid: false, error: "Format URL GeoNode tidak valid." };
  }
}
