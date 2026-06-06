import { Router } from "express";

const router = Router();

const METERS_IN_MILE = 1609.344;

type Coordinates = [number, number];

type GeocodeFeature = {
  geometry: {
    coordinates: Coordinates;
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

function buildRouteAddresses(
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

async function geocodePostcode(address: string): Promise<Coordinates | null> {
  const postcode = extractUkPostcode(address);

  if (!postcode) return null;

  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
  );

  if (!response.ok) return null;

  const data = (await response.json()) as PostcodesIoResponse;

  if (!data.result?.longitude || !data.result?.latitude) return null;

  return [data.result.longitude, data.result.latitude];
}

async function geocodeWithOpenRouteService(
  address: string,
  apiKey: string
): Promise<Coordinates> {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(
      `${address}, United Kingdom`
    )}&boundary.country=GB`,
    {
      headers: {
        Authorization: apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to geocode address: ${address}. Status: ${response.status}. Body: ${errorText}`
    );
  }

  const data = (await response.json()) as GeocodeResponse;
  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (!coordinates) {
    throw new Error(`Address not found: ${address}`);
  }

  return coordinates;
}

async function geocodeAddress(address: string, apiKey: string) {
  const postcodeCoordinates = await geocodePostcode(address);

  if (postcodeCoordinates) {
    return postcodeCoordinates;
  }

  return geocodeWithOpenRouteService(address, apiKey);
}

function getDistanceMeters(routeData: RouteResponse) {
  const routesDistance = routeData.routes?.[0]?.summary?.distance;

  if (typeof routesDistance === "number") return routesDistance;

  const featuresDistance =
    routeData.features?.[0]?.properties?.summary?.distance;

  if (typeof featuresDistance === "number") return featuresDistance;

  return null;
}

async function calculateRoute(addresses: string[]) {
  const apiKey = getOpenRouteServiceApiKey();

  if (!apiKey) {
    throw new Error("OpenRouteService API key missing");
  }

  if (addresses.length < 2) {
    throw new Error("At least two addresses are required");
  }

  const coordinates = await Promise.all(
    addresses.map((address) => geocodeAddress(address, apiKey))
  );

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

  if (distanceMeters === null) {
    throw new Error("No route distance returned");
  }

  const distanceMiles = Number((distanceMeters / METERS_IN_MILE).toFixed(1));

  return {
    coordinates,
    distanceMeters,
    distanceMiles,
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

    const routeAddresses = buildRouteAddresses(
      collectionAddress,
      deliveryAddress,
      extraDrops
    );

    const route = await calculateRoute(routeAddresses);

    res.json({
      collectionAddress,
      deliveryAddress,
      extraDrops: normaliseExtraDrops(extraDrops),
      routeAddresses,
      ...route,
    });
  } catch (error) {
    console.error("Distance calculation error:", error);

    res.status(500).json({
      error: "Failed to calculate distance",
    });
  }
});

export default router;