import crypto from "crypto";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { calculateQuotePrice } from "../lib/pricing";

const router = Router();

const METERS_IN_MILE = 1609.344;
const MAX_FULL_ADDRESS_DISTANCE_FROM_POSTCODE_MILES = 2;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
  type: "collection" | "delivery" | "extraDrop" | "return";
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const cleanValue = getString(value);
  return cleanValue || null;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

function getOpenRouteServiceApiKey() {
  return (
    process.env.ORS_API_KEY ||
    process.env.OPENROUTESERVICE_API_KEY ||
    process.env.OPEN_ROUTE_SERVICE_API_KEY ||
    ""
  );
}

function getAuthToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.replace("Bearer ", "").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function requireAdmin(req: { headers: { [key: string]: unknown } }) {
  const configuredAdminKey = process.env.ADMIN_API_KEY?.trim();
  const suppliedAdminKey = getString(req.headers["x-admin-key"]);

  if (!configuredAdminKey) {
    return {
      authorised: false,
      status: 503,
      error: "Admin API key is not configured.",
    };
  }

  if (!suppliedAdminKey || suppliedAdminKey !== configuredAdminKey) {
    return {
      authorised: false,
      status: 401,
      error: "Admin access denied.",
    };
  }

  return {
    authorised: true,
    status: 200,
    error: "",
  };
}

async function getAuthenticatedUser(req: {
  headers: { authorization?: string };
}) {
  const token = getAuthToken(req);

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.userSession.delete({
        where: {
          id: session.id,
        },
      });
    }

    return null;
  }

  return session.user;
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
  journeyType?: string | null,
  returnAddress?: string | null,
) {
  const stops = normaliseExtraDrops(extraDrops);

  const addresses = [
    collectionAddress,
    deliveryAddress,
    ...stops.map((stop) => String(stop.address)),
  ].filter((address) => address.trim() !== "");

  if (journeyType === "Return") {
    addresses.push(returnAddress || collectionAddress);
  }

  return addresses;
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

async function getPostcodeCoordinates(address: string): Promise<Coordinates> {
  const postcode = extractUkPostcode(address);

  if (!postcode) {
    throw new Error(`Postcode required for address: ${address}`);
  }

  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
  );

  if (!response.ok) {
    throw new Error(
      `The postcode ${postcode} could not be found. Please check and try again.`,
    );
  }

  const data = (await response.json()) as PostcodesIoResponse;

  if (
    data.status !== 200 ||
    typeof data.result?.longitude !== "number" ||
    typeof data.result?.latitude !== "number"
  ) {
    throw new Error(
      `The postcode ${postcode} could not be found. Please check and try again.`,
    );
  }

  return [data.result.longitude, data.result.latitude];
}

async function geocodeWithOpenRouteService(
  address: string,
  apiKey: string,
): Promise<Coordinates | null> {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(
      `${address}, United Kingdom`,
    )}&boundary.country=GB&size=1`,
    {
      headers: {
        Authorization: apiKey,
      },
    },
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
  address: string,
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
    orsCoordinates,
  );

  if (milesFromPostcode <= MAX_FULL_ADDRESS_DISTANCE_FROM_POSTCODE_MILES) {
    return {
      coordinates: orsCoordinates,
      coordinateSource: "ors-full-address",
    };
  }

  console.warn(
    `ORS coordinate rejected for ${address}. ORS: ${orsCoordinates.join(
      ",",
    )}. Postcode: ${postcodeCoordinates.join(
      ",",
    )}. Difference: ${milesFromPostcode.toFixed(2)} miles`,
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

async function buildRouteStops(
  collectionAddress: string,
  deliveryAddress: string,
  extraDrops: unknown,
  journeyType?: string | null,
  returnAddress?: string | null,
) {
  const drops = normaliseExtraDrops(extraDrops);

  const stopsToGeocode: {
    address: string;
    type: RouteStop["type"];
  }[] = [
    {
      address: collectionAddress,
      type: "collection",
    },
    {
      address: deliveryAddress,
      type: "delivery",
    },
    ...drops.map((drop) => ({
      address: String(drop.address),
      type: "extraDrop" as const,
    })),
  ];

  if (journeyType === "Return") {
    stopsToGeocode.push({
      address: returnAddress || collectionAddress,
      type: "return",
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
    }),
  );
}

async function calculateRouteDistance(stops: RouteStop[]) {
  const apiKey = getOpenRouteServiceApiKey();

  if (!apiKey) {
    throw new Error("OpenRouteService API key missing");
  }

  const coordinates = stops.map((stop) => stop.coordinates);

  if (coordinates.length < 2) {
    throw new Error("At least two route stops are required");
  }

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
    },
  );

  if (!routeResponse.ok) {
    const errorText = await routeResponse.text();

    throw new Error(
      `Failed to calculate route. Status: ${routeResponse.status}. Body: ${errorText}`,
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

function adminQuoteSelect() {
  return {
    id: true,
    status: true,
    deliveryType: true,
    journeyType: true,
    collectionDate: true,
    collectionWindow: true,
    vehicleSize: true,
    collectionAddress: true,
    deliveryAddress: true,
    returnAddress: true,
    extraDrops: true,
    customerName: true,
    customerEmail: true,
    customerPhone: true,
    companyName: true,
    customerReference: true,
    purchaseOrderNumber: true,
    distanceMiles: true,
    basePrice: true,
    fuelSurcharge: true,
    adminPrice: true,
    discountAmount: true,
    discountReason: true,
    vatAmount: true,
    totalPrice: true,
    sentAt: true,
    viewedAt: true,
    acceptedAt: true,
    cancelledAt: true,
    convertedAt: true,
    expiresAt: true,
    specialInstructions: true,
    handoverNotes: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        accountNumber: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
      },
    },
    booking: {
      select: {
        id: true,
        reference: true,
        status: true,
      },
    },
  } satisfies Prisma.QuoteSelect;
}

/* ---------------------------------
   Admin Quote Management
---------------------------------- */

router.get("/admin/list", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const page = getPositiveInteger(req.query.page, 1);
    const pageSize = Math.min(
      getPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const search = getString(req.query.search);
    const status = getString(req.query.status);
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);

    const where: Prisma.QuoteWhereInput = {};

    if (search) {
      where.OR = [
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerEmail: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerPhone: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          companyName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerReference: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          purchaseOrderNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.collectionDate = {};

      if (dateFrom) {
        where.collectionDate.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }

      if (dateTo) {
        where.collectionDate.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    const [quotes, total, statusTotals] = await Promise.all([
      prisma.quote.findMany({
        where,
        select: adminQuoteSelect(),
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quote.count({
        where,
      }),
      prisma.quote.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
    ]);

    res.json({
      quotes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus: Object.fromEntries(
          statusTotals.map((item) => [
            item.status,
            item._count._all,
          ]),
        ),
      },
    });
  } catch (error) {
    console.error("Admin quote list error:", error);

    res.status(500).json({
      error: "Unable to load quotes.",
    });
  }
});

router.get("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.id,
      },
      select: adminQuoteSelect(),
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found.",
      });
    }

    res.json({
      quote,
    });
  } catch (error) {
    console.error("Admin quote detail error:", error);

    res.status(500).json({
      error: "Unable to load quote.",
    });
  }
});

router.patch("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const status = getOptionalString(req.body.status);
    const now = new Date();

    const quote = await prisma.quote.update({
      where: {
        id: req.params.id,
      },
      data: {
        status: status || undefined,
        collectionDate:
          req.body.collectionDate !== undefined
            ? new Date(req.body.collectionDate)
            : undefined,
        collectionWindow:
          req.body.collectionWindow !== undefined
            ? getString(req.body.collectionWindow)
            : undefined,
        vehicleSize:
          req.body.vehicleSize !== undefined
            ? getString(req.body.vehicleSize)
            : undefined,
        collectionAddress:
          req.body.collectionAddress !== undefined
            ? getString(req.body.collectionAddress)
            : undefined,
        deliveryAddress:
          req.body.deliveryAddress !== undefined
            ? getString(req.body.deliveryAddress)
            : undefined,
        returnAddress:
          req.body.returnAddress !== undefined
            ? getOptionalString(req.body.returnAddress)
            : undefined,
        customerReference:
          req.body.customerReference !== undefined
            ? getOptionalString(req.body.customerReference)
            : undefined,
        purchaseOrderNumber:
          req.body.purchaseOrderNumber !== undefined
            ? getOptionalString(req.body.purchaseOrderNumber)
            : undefined,
        specialInstructions:
          req.body.specialInstructions !== undefined
            ? getOptionalString(req.body.specialInstructions)
            : undefined,
        handoverNotes:
          req.body.handoverNotes !== undefined
            ? getOptionalString(req.body.handoverNotes)
            : undefined,
        distanceMiles:
          req.body.distanceMiles !== undefined
            ? req.body.distanceMiles
            : undefined,
        basePrice:
          req.body.basePrice !== undefined
            ? req.body.basePrice
            : undefined,
        fuelSurcharge:
          req.body.fuelSurcharge !== undefined
            ? req.body.fuelSurcharge
            : undefined,
        adminPrice:
          req.body.adminPrice !== undefined
            ? req.body.adminPrice
            : undefined,
        discountAmount:
          req.body.discountAmount !== undefined
            ? req.body.discountAmount
            : undefined,
        discountReason:
          req.body.discountReason !== undefined
            ? getOptionalString(req.body.discountReason)
            : undefined,
        vatAmount:
          req.body.vatAmount !== undefined
            ? req.body.vatAmount
            : undefined,
        totalPrice:
          req.body.totalPrice !== undefined
            ? req.body.totalPrice
            : undefined,
        sentAt:
          status === "Sent"
            ? now
            : undefined,
        viewedAt:
          status === "Viewed"
            ? now
            : undefined,
        acceptedAt:
          status === "Accepted"
            ? now
            : undefined,
        cancelledAt:
          status === "Cancelled"
            ? now
            : undefined,
        convertedAt:
          status === "Converted to Booking"
            ? now
            : undefined,
      },
      select: adminQuoteSelect(),
    });

    res.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error("Admin quote update error:", error);

    res.status(500).json({
      error: "Unable to update quote.",
    });
  }
});

/* ---------------------------------
   Existing Public Quote Routes
---------------------------------- */

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
    const user = await getAuthenticatedUser(req);

    if (user && user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ error: "This customer account is not active. New quotes cannot be created." });
    }

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
        req.body.extraDrops,
        req.body.journeyType,
        req.body.returnAddress,
      );

      const routeStops = await buildRouteStops(
        req.body.collectionAddress,
        req.body.deliveryAddress,
        req.body.extraDrops,
        req.body.journeyType,
        req.body.returnAddress,
      );

      const finalRouteStops = routeStops;

      optimisedRouteAddresses = finalRouteStops.map((stop) => stop.address);

      coordinateSources = finalRouteStops.map((stop) => ({
        address: stop.address,
        source: stop.coordinateSource,
      }));

      const route = await calculateRouteDistance(finalRouteStops);

      distanceMiles = route.distanceMiles;
      durationMinutes = route.durationMinutes;

      distanceSource = coordinateSources.some(
        (stop) => stop.source === "ors-full-address",
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
        userId: user?.id || null,
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
        customerReference: req.body.customerReference || null,
        purchaseOrderNumber: req.body.purchaseOrderNumber || null,
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