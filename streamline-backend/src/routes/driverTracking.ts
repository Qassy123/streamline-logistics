import express from "express";
import crypto from "crypto";
import { PrismaClient, BookingStatus } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

async function getAuthenticatedDriver(authHeader: string | undefined) {
  const token = getBearerToken(authHeader);

  if (!token) return null;

  return prisma.driver.findFirst({
    where: {
      sessionToken: token,
      active: true,
    },
    include: {
      vehicle: true,
    },
  });
}

function createTrackingShareToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * START DRIVER TRACKING
 */
router.post("/:bookingId/start", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;
    const { latitude, longitude, accuracy, heading, speed } = req.body;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    const shareToken = createTrackingShareToken();
    const shareTokenHash = hashToken(shareToken);

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: BookingStatus.IN_PROGRESS,
        trackingStartedAt: new Date(),
        trackingEndedAt: null,
        trackingShareTokenHash: shareTokenHash,
        trackingEvents: {
          create: {
            status: BookingStatus.IN_PROGRESS,
            title: "Tracking started",
            description: "The driver has started live tracking.",
            userVisible: true,
          },
        },
        driverLocations:
          typeof latitude === "number" && typeof longitude === "number"
            ? {
                create: {
                  driverId: driver.id,
                  latitude,
                  longitude,
                  accuracy:
                    typeof accuracy === "number" ? accuracy : undefined,
                  heading:
                    typeof heading === "number" ? heading : undefined,
                  speed:
                    typeof speed === "number" ? speed : undefined,
                },
              }
            : undefined,
      },
      include: {
        vehicle: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return res.json({
      message: "Tracking started",
      trackingToken: shareToken,
      trackingUrl: `/tracking/${booking.reference}?token=${shareToken}`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Driver start tracking error:", error);
    return res.status(500).json({
      error: "Unable to start tracking",
    });
  }
});

/**
 * SAVE DRIVER GPS LOCATION
 */
router.post("/:bookingId/location", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;
    const { latitude, longitude, accuracy, heading, speed } = req.body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        error: "Latitude and longitude are required",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    if (booking.trackingEndedAt) {
      return res.status(400).json({
        error: "Tracking has already ended",
      });
    }

    const location = await prisma.driverLocation.create({
      data: {
        bookingId: booking.id,
        driverId: driver.id,
        latitude,
        longitude,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        heading: typeof heading === "number" ? heading : undefined,
        speed: typeof speed === "number" ? speed : undefined,
      },
    });

    return res.json({
      message: "Location updated",
      location,
    });
  } catch (error) {
    console.error("Driver location update error:", error);
    return res.status(500).json({
      error: "Unable to update location",
    });
  }
});

/**
 * STOP DRIVER TRACKING
 */
router.post("/:bookingId/stop", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        trackingEndedAt: new Date(),
        trackingEvents: {
          create: {
            status: booking.status,
            title: "Tracking stopped",
            description: "The driver has stopped live tracking.",
            userVisible: true,
          },
        },
      },
      include: {
        vehicle: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return res.json({
      message: "Tracking stopped",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Driver stop tracking error:", error);
    return res.status(500).json({
      error: "Unable to stop tracking",
    });
  }
});

/**
 * DRIVER STATUS EVENT
 */
router.post("/:bookingId/event", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;
    const { status, title, description, userVisible } = req.body;

    const allowedStatuses = [
      BookingStatus.ASSIGNED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status,
        trackingEvents: {
          create: {
            status,
            title: title || "Status updated",
            description: description || null,
            userVisible:
              typeof userVisible === "boolean" ? userVisible : true,
          },
        },
      },
      include: {
        vehicle: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return res.json({
      message: "Tracking event created",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Driver tracking event error:", error);
    return res.status(500).json({
      error: "Unable to create tracking event",
    });
  }
});

/**
 * DRIVER CURRENT TRACKING STATE
 */
router.get("/:bookingId", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
      include: {
        vehicle: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    return res.json({
      booking,
      trackingActive:
        Boolean(booking.trackingStartedAt) && !booking.trackingEndedAt,
      latestLocation: booking.driverLocations[0] || null,
    });
  } catch (error) {
    console.error("Driver tracking state error:", error);
    return res.status(500).json({
      error: "Unable to load tracking state",
    });
  }
});

export default router;
