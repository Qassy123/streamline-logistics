import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedUser(req: { headers: { authorization?: string } }) {
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

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const savedRoutes = await prisma.savedRoute.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json({
      savedRoutes,
    });
  } catch (error) {
    console.error("Fetch saved routes error:", error);

    res.status(500).json({
      error: "Failed to fetch saved routes.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const collectionAddress = getString(req.body.collectionAddress);
    const deliveryAddress = getString(req.body.deliveryAddress);

    if (!collectionAddress || !deliveryAddress) {
      return res.status(400).json({
        error: "Collection and delivery addresses are required.",
      });
    }

    const existingSavedRoute = await prisma.savedRoute.findFirst({
      where: {
        userId: user.id,
        collectionAddress,
        deliveryAddress,
        deliveryType: getString(req.body.deliveryType) || null,
        journeyType: getString(req.body.journeyType) || null,
        vehicleSize: getString(req.body.vehicleSize) || null,
      },
    });

    if (existingSavedRoute) {
      return res.json({
        success: true,
        alreadyExists: true,
        savedRoute: existingSavedRoute,
      });
    }

    const savedRoute = await prisma.savedRoute.create({
      data: {
        userId: user.id,

        name: getString(req.body.name) || null,

        deliveryType: getString(req.body.deliveryType) || null,
        journeyType: getString(req.body.journeyType) || null,
        capacityPercent: req.body.capacityPercent
          ? Number(req.body.capacityPercent)
          : null,
        vehicleSize: getString(req.body.vehicleSize) || null,

        collectionAddress,
        collectionAddressDetails:
          req.body.collectionAddressDetails || Prisma.JsonNull,

        deliveryAddress,
        deliveryAddressDetails:
          req.body.deliveryAddressDetails || Prisma.JsonNull,

        returnAddress: getString(req.body.returnAddress) || null,
        extraDrops: req.body.extraDrops || Prisma.JsonNull,

        whatAreWeCollecting: getString(req.body.whatAreWeCollecting) || null,
        loadDescription: getString(req.body.loadDescription) || null,
        specialInstructions: getString(req.body.specialInstructions) || null,

        contactPreference: getString(req.body.contactPreference) || null,
      },
    });

    res.status(201).json({
      success: true,
      alreadyExists: false,
      savedRoute,
    });
  } catch (error) {
    console.error("Create saved route error:", error);

    res.status(500).json({
      error: "Failed to save route.",
    });
  }
});

router.post("/from-quote/:quoteId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const quote = await prisma.quote.findFirst({
      where: {
        id: req.params.quoteId,
        userId: user.id,
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found.",
      });
    }

    const existingSavedRoute = await prisma.savedRoute.findFirst({
      where: {
        userId: user.id,
        collectionAddress: quote.collectionAddress,
        deliveryAddress: quote.deliveryAddress,
        deliveryType: quote.deliveryType,
        journeyType: quote.journeyType,
        vehicleSize: quote.vehicleSize,
      },
    });

    if (existingSavedRoute) {
      return res.json({
        success: true,
        alreadyExists: true,
        savedRoute: existingSavedRoute,
      });
    }

    const savedRoute = await prisma.savedRoute.create({
      data: {
        userId: user.id,

        name:
          getString(req.body.name) ||
          `${quote.collectionAddress} to ${quote.deliveryAddress}`,

        deliveryType: quote.deliveryType,
        journeyType: quote.journeyType,
        capacityPercent: quote.capacityPercent,
        vehicleSize: quote.vehicleSize,

        collectionAddress: quote.collectionAddress,
        collectionAddressDetails:
          quote.collectionAddressDetails || Prisma.JsonNull,

        deliveryAddress: quote.deliveryAddress,
        deliveryAddressDetails: quote.deliveryAddressDetails || Prisma.JsonNull,

        returnAddress: quote.returnAddress,
        extraDrops: quote.extraDrops || Prisma.JsonNull,

        whatAreWeCollecting: quote.whatAreWeCollecting,
        loadDescription: quote.loadDescription,
        specialInstructions: quote.specialInstructions,

        contactPreference: quote.contactPreference,
      },
    });

    res.status(201).json({
      success: true,
      alreadyExists: false,
      savedRoute,
    });
  } catch (error) {
    console.error("Create saved route from quote error:", error);

    res.status(500).json({
      error: "Failed to save route from quote.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    await prisma.savedRoute.deleteMany({
      where: {
        id: req.params.id,
        userId: user.id,
      },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete saved route error:", error);

    res.status(500).json({
      error: "Failed to delete saved route.",
    });
  }
});

export default router;
