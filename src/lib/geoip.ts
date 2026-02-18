import geoip from "geoip-lite";

interface GeoLocation {
  country: string | null;
  city: string | null;
}

export function lookupIP(ip: string): GeoLocation {
  // Skip private/reserved IPs
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return { country: null, city: null };
  }

  try {
    const geo = geoip.lookup(ip);
    if (!geo) {
      return { country: null, city: null };
    }

    return {
      country: geo.country || null,
      city: geo.city || null,
    };
  } catch {
    return { country: null, city: null };
  }
}
