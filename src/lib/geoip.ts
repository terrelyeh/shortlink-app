interface GeoLocation {
  country: string | null;
  city: string | null;
}

const NULL_GEO: GeoLocation = { country: null, city: null };

/**
 * Check if an IP address is private/reserved (RFC 1918 + loopback).
 * 172.16.0.0 - 172.31.255.255 are private, but 172.0-15.x.x and 172.32-255.x.x are public.
 */
function isPrivateIP(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    return true;
  }
  if (ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return true;
  }
  // RFC 1918: only 172.16.0.0 - 172.31.255.255 are private
  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

export async function lookupIP(ip: string): Promise<GeoLocation> {
  if (isPrivateIP(ip)) {
    return NULL_GEO;
  }

  try {
    // Lazy import to avoid loading .dat files at build time
    const geoip = await import("geoip-lite");
    const geo = geoip.default.lookup(ip);
    if (!geo) {
      console.warn(`[geoip] No result for IP: ${ip.substring(0, 8)}...`);
      return NULL_GEO;
    }

    return {
      country: geo.country || null,
      city: geo.city || null,
    };
  } catch (error) {
    console.error("[geoip] Failed to lookup IP:", error instanceof Error ? error.message : error);
    return NULL_GEO;
  }
}
