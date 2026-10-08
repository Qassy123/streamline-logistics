export type GoogleCoordinates = [number, number]; // Longitude, latitude.

export class GoogleMapsError extends Error {
  constructor(message: string, public readonly status: number = 502) {
    super(message);
    this.name = "GoogleMapsError";
  }
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new GoogleMapsError("Route calculation is unavailable. Please contact us for a quote.", 503);
  return key;
}

async function request(url: string | URL, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error("Google request failed");
    return await response.json();
  } catch {
    // Do not return upstream errors or URLs that could include the private key.
    throw new GoogleMapsError("Route calculation is unavailable. Please try again or contact us.");
  } finally {
    clearTimeout(timeout);
  }
}

function validCoordinates(value: GoogleCoordinates): boolean {
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export async function geocodeGoogleAddress(address: string): Promise<{
  coordinates: GoogleCoordinates;
  coordinateSource: "google-geocoding";
}> {
  if (!address.trim() || address.length > 1500) {
    throw new GoogleMapsError("Enter a valid collection or delivery address.", 400);
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address.trim());
  url.searchParams.set("components", "country:GB");
  url.searchParams.set("region", "gb");
  url.searchParams.set("key", apiKey());
  const data = await request(url);
  if (data?.status === "ZERO_RESULTS") {
    throw new GoogleMapsError("An address could not be located. Please check the full address and postcode.", 400);
  }
  if (data?.status !== "OK" || !Array.isArray(data.results)) {
    throw new GoogleMapsError("Address location is unavailable. Please try again or contact us.");
  }
  const compactPostcode = (value: string) => value.toUpperCase().replace(/\s+/g, "");
  const expectedPostcode = address.match(/\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i)?.[0];
  const result = data.results.find((item: any) => {
    if (!item || item.partial_match || !Array.isArray(item.address_components)) return false;
    const components = item.address_components;
    const country = components.find((part: any) => part?.types?.includes("country"));
    const postcode = components.find((part: any) => part?.types?.includes("postal_code"));
    return country?.short_name === "GB" && (!expectedPostcode ||
      (typeof postcode?.long_name === "string" && compactPostcode(postcode.long_name) === compactPostcode(expectedPostcode)));
  });
  const point = result?.geometry?.location;
  const coordinates: GoogleCoordinates = [point?.lng, point?.lat];
  if (!validCoordinates(coordinates)) {
    throw new GoogleMapsError("An address could not be matched. Please check the full address and postcode.", 400);
  }
  return { coordinates, coordinateSource: "google-geocoding" };
}

export async function calculateGoogleRoute(coordinates: GoogleCoordinates[]): Promise<{
  coordinates: GoogleCoordinates[];
  distanceMeters: number;
  distanceMiles: number;
  durationSeconds: number;
  durationMinutes: number;
}> {
  const key = apiKey();
  if (coordinates.length < 2 || coordinates.length > 102 || !coordinates.every(validCoordinates)) {
    throw new GoogleMapsError("The route contains invalid stops.", 400);
  }
  let distanceMeters = 0;
  let durationSeconds = 0;
  // Each request supports 25 intermediate stops. Share the boundary stop
  // between batches so long multi-drop routes retain every ordered leg.
  for (let start = 0; start < coordinates.length - 1; start += 26) {
    const batch = coordinates.slice(start, start + 27);
    const waypoint = ([longitude, latitude]: GoogleCoordinates) => ({ location: { latLng: { latitude, longitude } } });
    const data = await request("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: waypoint(batch[0]),
        destination: waypoint(batch[batch.length - 1]),
        intermediates: batch.slice(1, -1).map(waypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: false,
        languageCode: "en-GB",
        units: "IMPERIAL",
      }),
    });
    const route = data?.routes?.[0];
    const duration = typeof route?.duration === "string" && /^(\d+(?:\.\d+)?)s$/.test(route.duration)
      ? Number(route.duration.slice(0, -1)) : NaN;
    if (typeof route?.distanceMeters !== "number" || !Number.isFinite(route.distanceMeters) ||
      route.distanceMeters < 0 || !Number.isFinite(duration) || duration < 0) {
      throw new GoogleMapsError("No road route could be calculated. Please check the addresses or contact us.");
    }
    distanceMeters += route.distanceMeters;
    durationSeconds += duration;
  }
  return {
    coordinates,
    distanceMeters,
    distanceMiles: Number((distanceMeters / 1609.344).toFixed(1)),
    durationSeconds,
    durationMinutes: Math.round(durationSeconds / 60),
  };
}
