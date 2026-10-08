import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { calculateGoogleRoute, geocodeGoogleAddress, GoogleMapsError } from "../lib/googleMaps";
import { getPostcodeAddress, searchPostcodeAddresses, normaliseLookupPostcode, PostcodeLookupError } from "../lib/postcodes4u";

const router = Router();
type Coordinates = [number, number];
type ExtraDrop = { order?: number; address?: string };
type RouteStop = {
  address: string;
  coordinates: Coordinates;
  coordinateSource: "google-geocoding";
  type: "collection" | "extraDrop" | "delivery";
};

// Bound paid public requests per source address and per server process.
// Use req.ip only; do not trust a client-supplied forwarding header here.
const windows = new Map<string, { count: number; expires: number }>();
let globalWindow = { count: 0, expires: 0 };
function limitPaidRequests(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, entry] of windows) if (entry.expires <= now) windows.delete(key);
  if (globalWindow.expires <= now) globalWindow = { count: 0, expires: now + 60000 };
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const entry = windows.get(key) || { count: 0, expires: now + 60000 };
  if (entry.count >= 30 || globalWindow.count >= 300 || (!windows.has(key) && windows.size >= 10000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }
  entry.count += 1;
  globalWindow.count += 1;
  windows.set(key, entry);
  res.setHeader("Cache-Control", "no-store");
  next();
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof GoogleMapsError || error instanceof PostcodeLookupError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(502).json({ error: fallback });
}

function normaliseExtraDrops(extraDrops: unknown): ExtraDrop[] {
  if (!extraDrops) return [];

  if (Array.isArray(extraDrops)) {
    return extraDrops
      .filter((drop) => drop && typeof drop === "object")
      .map((drop) => drop as ExtraDrop)
      .filter(
        (drop) =>
          typeof drop.address === "string" && drop.address.trim() !== "",
      )
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }

  if (typeof extraDrops === "string") {
    try {
      return normaliseExtraDrops(JSON.parse(extraDrops));
    } catch {
      return [];
    }
  }

  return [];
}

function buildOriginalRouteAddresses(
  collectionAddress: string,
  deliveryAddress: string,
  extraDrops: unknown,
) {
  const stops = normaliseExtraDrops(extraDrops);

  return [
    collectionAddress,
    ...stops.map((stop) => String(stop.address)),
    deliveryAddress,
  ].filter((address) => address.trim() !== "");
}

function calculateStraightLineDistanceMiles(
  start: Coordinates,
  end: Coordinates,
) {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;
  const earthRadiusMiles = 3958.8;
  const degreesToRadians = Math.PI / 180;
  const deltaLat = (lat2 - lat1) * degreesToRadians;
  const deltaLon = (lon2 - lon1) * degreesToRadians;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1 * degreesToRadians) *
      Math.cos(lat2 * degreesToRadians) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function optimiseExtraDropOrder(stops: RouteStop[]) {
  const collection = stops.find((stop) => stop.type === "collection");
  const delivery = stops.find((stop) => stop.type === "delivery");
  const extraDrops = stops.filter((stop) => stop.type === "extraDrop");

  if (!collection || !delivery || extraDrops.length <= 1) return stops;

  const orderedDrops: RouteStop[] = [];
  const remainingDrops = [...extraDrops];
  let currentStop = collection;

  while (remainingDrops.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remainingDrops.forEach((drop, index) => {
      const distanceToDrop = calculateStraightLineDistanceMiles(
        currentStop.coordinates,
        drop.coordinates,
      );
      const dropToDelivery = calculateStraightLineDistanceMiles(
        drop.coordinates,
        delivery.coordinates,
      );
      const score = distanceToDrop + dropToDelivery * 0.15;

      if (score < nearestDistance) {
        nearestDistance = score;
        nearestIndex = index;
      }
    });

    const [nearestDrop] = remainingDrops.splice(nearestIndex, 1);
    orderedDrops.push(nearestDrop);
    currentStop = nearestDrop;
  }

  return [collection, ...orderedDrops, delivery];
}

async function buildRouteStops(
  collectionAddress: string,
  deliveryAddress: string,
  extraDrops: unknown,
) {
  const drops = normaliseExtraDrops(extraDrops);
  const stopsToGeocode = [
    { address: collectionAddress, type: "collection" as const },
    ...drops.map((drop) => ({
      address: String(drop.address),
      type: "extraDrop" as const,
    })),
    { address: deliveryAddress, type: "delivery" as const },
  ];

  return Promise.all(
    stopsToGeocode.map(async (stop) => {
      const result = await geocodeGoogleAddress(stop.address);

      return {
        ...stop,
        coordinates: result.coordinates,
        coordinateSource: result.coordinateSource,
      };
    }),
  );
}

router.get("/address-lookup", limitPaidRequests, async (req, res) => {
  try {
    if (typeof req.query.postcode !== "string") {
      return res.status(400).json({ error: "Enter a full valid UK postcode." });
    }
    return res.json(await searchPostcodeAddresses(req.query.postcode));
  } catch (error) {
    return sendError(res, error, "Unable to find addresses. Please enter the address manually.");
  }
});

router.get("/address-details", limitPaidRequests, async (req, res) => {
  try {
    if (typeof req.query.id !== "string" || typeof req.query.postcode !== "string") {
      return res.status(400).json({ error: "Select an address from the postcode search results." });
    }
    const postcode = normaliseLookupPostcode(req.query.postcode);
    const address = await getPostcodeAddress(req.query.id);
    if (address.postcode !== postcode) {
      return res.status(400).json({ error: "This address belongs to a different postcode. Search again." });
    }
    return res.json({ address });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve this address. Please enter it manually.");
  }
});

router.post("/", limitPaidRequests, async (req, res) => {
  try {
    const { collectionAddress, deliveryAddress, extraDrops } = req.body || {};
    if (typeof collectionAddress !== "string" || !collectionAddress.trim() ||
      typeof deliveryAddress !== "string" || !deliveryAddress.trim()) {
      return res.status(400).json({ error: "Collection and delivery addresses are required" });
    }
    const drops = normaliseExtraDrops(extraDrops);
    if (drops.length > 100 || collectionAddress.length > 1500 || deliveryAddress.length > 1500 ||
      drops.some(drop => String(drop.address).length > 1500)) {
      return res.status(400).json({ error: "The route contains too many stops or an invalid address." });
    }
    const originalRouteAddresses = buildOriginalRouteAddresses(collectionAddress, deliveryAddress, drops);
    const routeStops = await buildRouteStops(collectionAddress, deliveryAddress, drops);
    const optimisedRouteStops = optimiseExtraDropOrder(routeStops);
    const route = await calculateGoogleRoute(optimisedRouteStops.map(stop => stop.coordinates));
    return res.json({
      collectionAddress,
      deliveryAddress,
      extraDrops: drops,
      originalRouteAddresses,
      optimisedRouteAddresses: optimisedRouteStops.map(stop => stop.address),
      optimised: true,
      distanceSource: "google-maps",
      coordinateSources: optimisedRouteStops.map(stop => ({ address: stop.address, source: stop.coordinateSource })),
      ...route,
    });
  } catch (error) {
    return sendError(res, error, "Failed to calculate distance. Please try again or contact us.");
  }
});

export default router;
