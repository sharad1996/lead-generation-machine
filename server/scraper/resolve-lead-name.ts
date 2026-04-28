/**
 * Google Maps place URLs often encode the listing name in the path:
 * https://www.google.com/maps/place/Acme+Medical/@lat,lng,...
 */
export function parseNameFromGoogleMapsPlaceUrl(url: string | null | undefined): string | null {
  if (!url?.trim() || !url.includes("/place/")) return null;
  const m = url.match(/\/place\/([^/?]+)/);
  if (!m?.[1]) return null;
  let segment = m[1];
  const at = segment.indexOf("@");
  if (at !== -1) segment = segment.slice(0, at);
  if (segment.startsWith("data=")) return null;
  try {
    const decoded = decodeURIComponent(segment.replace(/\+/g, " ")).trim();
    if (decoded.length < 2) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Prefer a real DOM title; otherwise derive from the /maps/place/ URL; last resort a label so rows aren’t blank.
 */
export function resolveLeadNameFromMaps(
  domTitle: string | null | undefined,
  mapsPlaceUrl: string | null | undefined,
): string {
  const t = (domTitle ?? "").replace(/\s+/g, " ").trim();
  if (t.length >= 2 && !/^google maps$/i.test(t) && !/^maps$/i.test(t)) {
    return t;
  }
  const fromUrl = parseNameFromGoogleMapsPlaceUrl(mapsPlaceUrl);
  if (fromUrl && fromUrl.length >= 2) {
    return fromUrl;
  }
  return "Unknown business";
}
