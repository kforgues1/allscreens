/** Maps full region names to TMDB-compatible ISO 3166-1 alpha-2 codes. */
export const REGION_TO_ISO: Record<string, string> = {
  'Canada': 'CA',
  'United States': 'US',
  'United Kingdom': 'GB',
  'Australia': 'AU',
  'France': 'FR',
  'Germany': 'DE',
  'Japan': 'JP',
  'Mexico': 'MX',
  'Brazil': 'BR',
  'India': 'IN',
};

/**
 * Accepts either a full region name ('Canada') or an ISO code ('CA') and
 * returns the ISO code suitable for TMDB API calls. Defaults to 'US'.
 */
export function toISORegion(region: string): string {
  // Already a known ISO code (2 uppercase letters)
  if (/^[A-Z]{2}$/.test(region)) return region;
  return REGION_TO_ISO[region] ?? 'US';
}
