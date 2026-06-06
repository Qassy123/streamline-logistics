import { Router } from "express";
import { prisma } from "../lib/prisma";
import { calculateQuotePrice } from "../lib/pricing";

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

async function calculateRouteDistanceMiles(
  collectionAddress: string,
  deliveryAddress: string
) {
  const apiKey = getOpenRouteServiceApiKey();

  if (!apiKey) {
    throw new Error("OpenRouteService API key missing");
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

  return Number((distanceMeters / METERS_IN_MILE).toFixed(1));
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
    let distanceSource = "fallback";

    if (req.body.collectionAddress && req.body.deliveryAddress) {
      try {
        distanceMiles = await calculateRouteDistanceMiles(
          req.body.collectionAddress,
          req.body.deliveryAddress
        );

        distanceSource = "openrouteservice";
      } catch (distanceError) {
        console.error("Route distance failed, using fallback pricing:", distanceError);
      }
    }

    const price = calculateQuotePrice({
      deliveryType: req.body.deliveryType,
      vehicleSize: req.body.vehicleSize,
      distanceMiles,
    });

    console.log("Quote pricing:", {
      collectionAddress: req.body.collectionAddress,
      deliveryAddress: req.body.deliveryAddress,
      calculatedDistanceMiles: distanceMiles,
      savedDistanceMiles: price.distanceMiles,
      distanceSource,
      deliveryType: req.body.deliveryType,
      vehicleSize: req.body.vehicleSize,
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

        loadDescription: req.body.loadDescription || null,
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
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create quote",
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