/**
 * SSRF Guard — validates that a caller-supplied URL is safe to fetch server-side.
 *
 * Blocks:
 *   - Non-HTTPS protocols (http, ftp, file, …)
 *   - Loopback addresses (127.x.x.x, ::1, localhost)
 *   - RFC-1918 private ranges (10.x, 172.16-31.x, 192.168.x)
 *   - Link-local / metadata service (169.254.x.x)
 *   - IPv6 loopback / ULA / link-local
 *   - Common internal hostnames
 *
 * Note: hostname-to-IP resolution is NOT performed here, which means
 * a DNS rebinding attack is theoretically possible.  For a stronger
 * guarantee the caller can resolve the hostname first and pass the
 * resulting IP through this function again.
 */

// Private IPv4 ranges as [start, end] inclusive (32-bit unsigned ints)
const PRIVATE_IPV4_RANGES: [number, number][] = [
  [0x00000000, 0x00000000], // 0.0.0.0
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8   loopback
  [0x0a000000, 0x0affffff], // 10.0.0.0/8    RFC-1918
  [0xac100000, 0xac1fffff], // 172.16.0.0/12 RFC-1918
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 RFC-1918
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 link-local / AWS metadata
  [0xe0000000, 0xffffffff], // 224.0.0.0/4+  multicast & reserved
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "localtest.me",
  "ip6-localhost",
  "ip6-loopback",
]);

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const byte = parseInt(p, 10);
    if (isNaN(byte) || byte < 0 || byte > 255 || p !== String(byte)) return null;
    n = (n * 256 + byte) >>> 0;
  }
  return n;
}

function isPrivateIpv4(hostname: string): boolean {
  const n = ipv4ToUint32(hostname);
  if (n === null) return false;
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIpv6(hostname: string): boolean {
  // Strip surrounding brackets: [::1] → ::1
  const h = hostname.startsWith("[") ? hostname.slice(1, -1).toLowerCase() : hostname.toLowerCase();
  return (
    h === "::1" ||                    // loopback
    h === "::" ||                     // unspecified
    h.startsWith("fc") ||             // ULA fc00::/7
    h.startsWith("fd") ||             // ULA fc00::/7
    h.startsWith("fe80") ||           // link-local
    h.startsWith("::ffff:127.") ||    // IPv4-mapped loopback
    h.startsWith("::ffff:10.") ||     // IPv4-mapped private
    h.startsWith("::ffff:172.1") ||   // IPv4-mapped private (rough)
    h.startsWith("::ffff:192.168.")   // IPv4-mapped private
  );
}

export type SsrfGuardResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

/**
 * Validate a caller-supplied URL before using it in a server-side fetch.
 *
 * @param rawUrl  The URL string supplied by the client
 * @returns       { ok: true, url } on success or { ok: false, error } on failure
 */
export function validateExternalUrl(rawUrl: string): SsrfGuardResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL format." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTPS URLs are permitted." };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: "The target hostname is not permitted." };
  }

  if (isPrivateIpv4(hostname)) {
    return { ok: false, error: "The target URL resolves to a private or reserved IP address." };
  }

  if (isPrivateIpv6(hostname)) {
    return { ok: false, error: "The target URL resolves to a private or reserved IP address." };
  }

  return { ok: true, url: parsed };
}
