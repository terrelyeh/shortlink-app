interface GeoLocation {
  country: string | null;
  city: string | null;
}

const NULL_GEO: GeoLocation = { country: null, city: null };

export async function lookupIP(ip: string): Promise<GeoLocation> {
  // Skip private/reserved IPs
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return NULL_GEO;
  }

  try {
    // Lazy import to avoid loading .dat files at build time
    const geoip = await import("geoip-lite");
    const geo = geoip.default.lookup(ip);
    if (!geo) {
      return NULL_GEO;
    }

    return {
      country: geo.country || null,
      city: geo.city || null,
    };
  } catch {
    return NULL_GEO;
  }
}
