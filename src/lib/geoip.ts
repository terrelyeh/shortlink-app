interface GeoLocation {
  country: string | null;
  city: string | null;
}

const NULL_GEO: GeoLocation = { country: null, city: null };

/**
 * Extract geolocation from Vercel's automatic geo headers.
 * These headers are injected by Vercel's edge network on every request:
 *   x-vercel-ip-country  → ISO 3166-1 alpha-2 (e.g., "TW")
 *   x-vercel-ip-city     → City name (e.g., "Taipei")
 *
 * Falls back to NULL_GEO in local development or non-Vercel environments.
 */
export function getGeoFromHeaders(headers: Headers): GeoLocation {
  const country = headers.get("x-vercel-ip-country");
  const city = headers.get("x-vercel-ip-city");

  if (!country) {
    return NULL_GEO;
  }

  return {
    country,
    city: city ? decodeURIComponent(city) : null,
  };
}
