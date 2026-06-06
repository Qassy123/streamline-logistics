import { Router } from "express";

const router = Router();

const METERS_IN_MILE = 1609.344;

type GeocodeFeature = {
  geometry: {
    coordinates: [number, number];
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

function getOpenRouteServiceApiKey() {
  return (
    process.env.ORS_API_KEY ||
    process.env.OPENROUTESERVICE_API_KEY ||
    process.env.OPEN_ROUTE_SERVICE_API_KEY ||
    ""
  );
}

async function geocodeAddress(address: string, apiKey: string) {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(
      address
    )}`,
    {
      headers: {
        Authorization: apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to geocode address: ${address}`);
  }

  const data = (await response.json()) as GeocodeResponse;
  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (!coordinates) {
    throw new Error(`Address not found: ${address}`);
  }

  return coordinates;
}

function getDistanceMeters(routeData: RouteResponse) {
  const routesDistance = routeData.routes?.[0]?.summary?.distance;

  if (typeof routesDistance === "number") {
    return routesDistance;
  }

  const featuresDistance =
    routeData.features?.[0]?.properties?.summary?.distance;

  if (typeof featuresDistance === "number") {
    return featuresDistance;
  }

  return null;
}

router.post("/", async (req, res) => {
  try {
    const { collectionAddress, deliveryAddress } = req.body;

    if (!collectionAddress || !deliveryAddress) {
      return res.status(400).json({
        error: "Collection and delivery addresses are required",
      });
    }

    const apiKey = getOpenRouteServiceApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error: "OpenRouteService API key missing",
      });
    }

    const collectionCoordinates = await geocodeAddress(collectionAddress, apiKey);
    const deliveryCoordinates = await geocodeAddress(deliveryAddress, apiKey);

    const routeResponse = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [collectionCoordinates, deliveryCoordinates],
        }),
      }
    );

    if (!routeResponse.ok) {
      throw new Error("Failed to calculate route");
    }

    const routeData = (await routeResponse.json()) as RouteResponse;
    const distanceMeters = getDistanceMeters(routeData);

    if (distanceMeters === null) {
      throw new Error("No route distance returned");
    }

    const distanceMiles = Number((distanceMeters / METERS_IN_MILE).toFixed(1));

    res.json({
      collectionAddress,
      deliveryAddress,
      distanceMeters,
      distanceMiles,
    });
  } catch (error) {
    console.error("Distance calculation error:", error);

    res.status(500).json({
      error: "Failed to calculate distance",
    });
  }
});

export default router;