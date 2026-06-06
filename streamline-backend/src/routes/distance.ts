import { Router } from "express";

const router = Router();

const METERS_IN_MILE = 1609.344;
const MAX_FULL_ADDRESS_DISTANCE_FROM_POSTCODE_MILES = 2;

type Coordinates = [number, number];

type GeocodeFeature = {
  geometry?: {
    coordinates?: Coordinates;
  };
  properties?: {
    label?: string;
    confidence?: number;
    country?: string;
    region?: string;
    county?: string;
    locality?: string;
    postalcode?: string;
  };
};

type GeocodeResponse = {
  features?: GeocodeFeature[];
};

type RouteResponse = {
  routes?: {
    summary?: {
      distance?: number;
      duration?: number;
    };
  }[];
  features?: {
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }[];
};

type PostcodesIoResponse = {
  status: number;
  result?: {
    longitude: number;
    latitude: number;
  };
};

type ExtraDrop = {
  order?: number;
  address?: string;
};

type RouteStop = {
  address: string;
  coordinates: Coordinates;
  coordinateSource: "ors-full-address" | "postcodes.io";
  type: "collection" | "extraDrop" | "delivery";
};

function getOpenRouteServiceApiKey() {
  return (
    process.env.ORS_API_KEY ||
    process.env.OPENROUTESERVICE_API_KEY ||
    process.env.OPEN_ROUTE_SERVICE_API_KEY ||
    ""
  );
}

function extractUkPostcode(address: string) {
  const match = address.match(
    /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i
  );

  return match ? match[1].toUpperCase().replace(/\s+/g, "") : null;
}

function normaliseExtraDrops(extraDrops: unknown): ExtraDrop[] {
  if (!extraDrops) return [];

  if (Array.isArray(extraDrops)) {
    return extraDrops
      .filter((drop) => drop && typeof drop === "object")
      .map((drop) => drop as ExtraDrop)
      .filter(
        (drop) =>
          typeof drop.address === "string" && drop.address.trim() !== ""
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
  extraDrops: unknown
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
  end: Coordinates
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

async function getPostcodeCoordinates(address: string): Promise<Coordinates> {
  const postcode = extractUkPostcode(address);

  if (!postcode) {
    throw new Error(`Postcode required for address: ${address}`);
  }

  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
  );

  if (!response.ok) {
    throw new Error(`Invalid or unresolved UK postcode for address: ${address}`);
  }

  const data = (await response.json()) as PostcodesIoResponse;

  if (
    data.status !== 200 ||
    typeof data.result?.longitude !== "number" ||
    typeof data.result?.latitude !== "number"
  ) {
    throw new Error(`Invalid or unresolved UK postcode for address: ${address}`);
  }

  return [data.result.longitude, data.result.latitude];
}

async function geocodeWithOpenRouteService(
  address: string,
  apiKey: string
): Promise<Coordinates | null> {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(
      `${address}, United Kingdom`
    )}&boundary.country=GB&size=1`,
    {
      headers: {
        Authorization: apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.warn(
      `ORS geocode failed for ${address}. Status: ${response.status}. Body: ${errorText}`
    );

    return null;
  }

  const data = (await response.json()) as GeocodeResponse;
  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null;
  }

  return coordinates;
}

async function geocodeAddress(
  address: string
): Promise<{
  coordinates: Coordinates;
  coordinateSource: "ors-full-address" | "postcodes.io";
}> {
  const apiKey = getOpenRouteServiceApiKey();

  if (!apiKey) {
    throw new Error("OpenRouteService API key missing");
  }

  const postcodeCoordinates = await getPostcodeCoordinates(address);
  const orsCoordinates = await geocodeWithOpenRouteService(address, apiKey);

  if (!orsCoordinates) {
    return {
      coordinates: postcodeCoordinates,
      coordinateSource: "postcodes.io",
    };
  }

  const milesFromPostcode = calculateStraightLineDistanceMiles(
    postcodeCoordinates,
    orsCoordinates
  );

  if (milesFromPostcode <= MAX_FULL_ADDRESS_DISTANCE_FROM_POSTCODE_MILES) {
    return {
      coordinates: orsCoordinates,
      coordinateSource: "ors-full-address",
    };
  }

  console.warn(
    `ORS coordinate rejected for ${address}. ORS: ${orsCoordinates.join(
      ","
    )}. Postcode: ${postcodeCoordinates.join(
      ","
    )}. Difference: ${milesFromPostcode.toFixed(2)} miles`
  );

  return {
    coordinates: postcodeCoordinates,
    coordinateSource: "postcodes.io",
  };
}

function getDistanceMeters(routeData: RouteResponse) {
  const routesDistance = routeData.routes?.[0]?.summary?.distance;

  if (typeof routesDistance === "number") return routesDistance;

  const featuresDistance =
    routeData.features?.[0]?.properties?.summary?.distance;

  if (typeof featuresDistance === "number") return featuresDistance;

  return null;
}

function getDurationSeconds(routeData: RouteResponse) {
  const routesDuration = routeData.routes?.[0]?.summary?.duration;

  if (typeof routesDuration === "number") return routesDuration;

  const featuresDuration =
    routeData.features?.[0]?.properties?.summary?.duration;

  if (typeof featuresDuration === "number") return featuresDuration;

  return null;
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
        drop.coordinates
      );

      const dropToDelivery = calculateStraightLineDistanceMiles(
        drop.coordinates,
        delivery.coordinates
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
  extraDrops: unknown
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
      const result = await geocodeAddress(stop.address);

      return {
        ...stop,
        coordinates: result.coordinates,
        coordinateSource: result.coordinateSource,
      };
    })
  );
}

async function calculateRoute(stops: RouteStop[]) {
  const apiKey = getOpenRouteServiceApiKey();

  if (!apiKey) {
    throw new Error("OpenRouteService API key missing");
  }

  const coordinates = stops.map((stop) => stop.coordinates);

  const routeResponse = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates,
      }),
    }
  );

  if (!routeResponse.ok) {
    const errorText = await routeResponse.text();

    throw new Error(
      `Failed to calculate route. Status: ${routeResponse.status}. Body: ${errorText}`
    );
  }

  const routeData = (await routeResponse.json()) as RouteResponse;
  const distanceMeters = getDistanceMeters(routeData);
  const durationSeconds = getDurationSeconds(routeData);

  if (distanceMeters === null) {
    throw new Error("No route distance returned");
  }

  const distanceMiles = Number((distanceMeters / METERS_IN_MILE).toFixed(1));
  const durationMinutes =
    durationSeconds === null ? null : Math.round(durationSeconds / 60);

  return {
    coordinates,
    distanceMeters,
    distanceMiles,
    durationSeconds,
    durationMinutes,
  };
}

router.post("/", async (req, res) => {
  try {
    const { collectionAddress, deliveryAddress, extraDrops } = req.body;

    if (!collectionAddress || !deliveryAddress) {
      return res.status(400).json({
        error: "Collection and delivery addresses are required",
      });
    }

    const originalRouteAddresses = buildOriginalRouteAddresses(
      collectionAddress,
      deliveryAddress,
      extraDrops
    );

    const routeStops = await buildRouteStops(
      collectionAddress,
      deliveryAddress,
      extraDrops
    );

    const optimisedRouteStops = optimiseExtraDropOrder(routeStops);
    const route = await calculateRoute(optimisedRouteStops);

    const coordinateSources = optimisedRouteStops.map((stop) => ({
      address: stop.address,
      source: stop.coordinateSource,
    }));

    const usedFullAddressGeocoding = coordinateSources.some(
      (stop) => stop.source === "ors-full-address"
    );

    res.json({
      collectionAddress,
      deliveryAddress,
      extraDrops: normaliseExtraDrops(extraDrops),
      originalRouteAddresses,
      optimisedRouteAddresses: optimisedRouteStops.map((stop) => stop.address),
      optimised: true,
      distanceSource: usedFullAddressGeocoding
        ? "hybrid-postcode-validated-full-address"
        : "postcodes.io",
      coordinateSources,
      ...route,
    });
  } catch (error) {
    console.error("Distance calculation error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to calculate distance";

    res.status(400).json({
      error: message,
    });
  }
});

export default router;