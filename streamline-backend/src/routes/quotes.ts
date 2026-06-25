import { Router } from "express";
import { prisma } from "../lib/prisma";
import { calculateQuotePrice } from "../lib/pricing";

const router = Router();

const METERS_IN_MILE = 1609.344;
const MAX_FULL_ADDRESS_DISTANCE_FROM_POSTCODE_MILES = 2;

type Coordinates = [number, number];

type GeocodeFeature = {
  geometry?: {
    coordinates?: Coordinates;
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
  const match = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
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
    throw new Error(
      `The postcode ${postcode} could not be found. Please check and try again.`
    );
  }

  const data = (await response.json()) as PostcodesIoResponse;

  if (
    data.status !== 200 ||
    typeof data.result?.longitude !== "number" ||
    typeof data.result?.latitude !== "number"
  ) {
    throw new Error(
      `The postcode ${postcode} could not be found. Please check and try again.`
    );
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

  if (!response.ok) return null;

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
  extraDrops: unknown,
  journeyType?: string | null,
  returnAddress?: string | null
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

  if (journeyType === "Return") {
    stopsToGeocode.push({
      address: returnAddress || collectionAddress,
      type: "delivery" as const,
    });
  }

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

async function calculateRouteDistance(stops: RouteStop[]) {
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

  return {
    distanceMiles: Number((distanceMeters / METERS_IN_MILE).toFixed(1)),
    durationMinutes:
      typeof durationSeconds === "number"
        ? Math.round(durationSeconds / 60)
        : null,
  };
}

router.get("/", async (_, res) => {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(quotes);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch quotes",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch quote",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    let distanceMiles: number | null = null;
    let durationMinutes: number | null = null;
    let distanceSource = "fallback";
    let originalRouteAddresses: string[] = [];
    let optimisedRouteAddresses: string[] = [];
    let coordinateSources: { address: string; source: string }[] = [];

    if (req.body.collectionAddress && req.body.deliveryAddress) {
      originalRouteAddresses = buildOriginalRouteAddresses(
        req.body.collectionAddress,
        req.body.deliveryAddress,
        req.body.extraDrops
      );

      const routeStops = await buildRouteStops(
        req.body.collectionAddress,
        req.body.deliveryAddress,
        req.body.extraDrops,
        req.body.journeyType,
        req.body.returnAddress
      );

      const optimisedRouteStops =
        req.body.journeyType === "Return"
          ? routeStops
          : optimiseExtraDropOrder(routeStops);

      optimisedRouteAddresses = optimisedRouteStops.map((stop) => stop.address);

      coordinateSources = optimisedRouteStops.map((stop) => ({
        address: stop.address,
        source: stop.coordinateSource,
      }));

      const route = await calculateRouteDistance(optimisedRouteStops);

      distanceMiles = route.distanceMiles;
      durationMinutes = route.durationMinutes;

      distanceSource = coordinateSources.some(
        (stop) => stop.source === "ors-full-address"
      )
        ? "hybrid-postcode-validated-full-address"
        : "postcodes.io";
    }

    const extraDropCount = normaliseExtraDrops(req.body.extraDrops).length;

    const price = calculateQuotePrice({
      deliveryType: req.body.deliveryType,
      journeyType: req.body.journeyType,
      vehicleSize: req.body.vehicleSize,
      distanceMiles,
      extraDropCount,
    });

    console.log("Quote pricing:", {
      originalRouteAddresses,
      optimisedRouteAddresses,
      calculatedDistanceMiles: distanceMiles,
      durationMinutes,
      distanceSource,
      coordinateSources,
      deliveryType: req.body.deliveryType,
      journeyType: req.body.journeyType,
      vehicleSize: req.body.vehicleSize,
      extraDropCount,
      totalPrice: price.totalPrice,
    });

    const quote = await prisma.quote.create({
      data: {
        status: "priced",

        deliveryType: req.body.deliveryType,
        journeyType: req.body.journeyType || null,
        capacityPercent: req.body.capacityPercent
          ? Number(req.body.capacityPercent)
          : null,

        collectionDate: req.body.collectionDate,
        collectionWindow: req.body.collectionWindow,
        vehicleSize: req.body.vehicleSize,

        collectionAddress: req.body.collectionAddress,
        collectionAddressDetails: req.body.collectionAddressDetails || null,

        deliveryAddress: req.body.deliveryAddress,
        deliveryAddressDetails: req.body.deliveryAddressDetails || null,

        returnAddress: req.body.returnAddress || null,
        extraDrops: req.body.extraDrops || null,

        whatAreWeCollecting: req.body.whatAreWeCollecting || null,
        loadDescription: req.body.loadDescription || null,
        specialInstructions: req.body.specialInstructions || null,
        handoverContactName: req.body.handoverContactName || null,
        handoverContactPhone: req.body.handoverContactPhone || null,
        handoverNotes: req.body.handoverNotes || null,
        palletCount: req.body.palletCount ? Number(req.body.palletCount) : null,
        fragileGoods: Boolean(req.body.fragileGoods),
        contactPreference: req.body.contactPreference || null,
        accuracyConfirmed: Boolean(req.body.accuracyConfirmed),

        customerName: req.body.customerName,
        customerEmail: req.body.customerEmail,
        customerPhone: req.body.customerPhone,

        companyName: req.body.companyName || req.body.legalEntity || null,
        legalEntity: req.body.legalEntity || req.body.companyName || null,
        tradingName: req.body.tradingName || null,

        distanceMiles: price.distanceMiles,
        basePrice: price.basePrice,
        fuelSurcharge: price.fuelSurcharge,
        adminPrice: price.adminPrice,
        vatAmount: price.vatAmount,
        totalPrice: price.totalPrice,
      },
    });

    res.status(201).json({
      ...quote,
      distanceSource,
      calculatedDistanceMiles: distanceMiles,
      durationMinutes,
      originalRouteAddresses,
      optimisedRouteAddresses,
      coordinateSources,
      extraDropCount,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Failed to create quote";

    res.status(400).json({
      error: message,
    });
  }
});

router.patch("/:id/price", async (req, res) => {
  try {
    const {
      distanceMiles,
      basePrice,
      fuelSurcharge,
      adminPrice,
      vatAmount,
      totalPrice,
    } = req.body;

    const quote = await prisma.quote.update({
      where: {
        id: req.params.id,
      },
      data: {
        distanceMiles,
        basePrice,
        fuelSurcharge,
        adminPrice,
        vatAmount,
        totalPrice,
      },
    });

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update quote price",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const quote = await prisma.quote.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
      },
    });

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update quote status",
    });
  }
});

export default router;