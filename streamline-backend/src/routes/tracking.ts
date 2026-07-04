import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getAuthToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.replace("Bearer ", "").trim();
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createTrackingToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function getAuthenticatedUser(req: { headers: { authorization?: string } }) {
  const token = getAuthToken(req);

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashValue(token),
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

router.post("/driver/start", async (req, res) => {
  try {
    const bookingId = getString(req.body.bookingId);
    const driverId = getString(req.body.driverId);
    const driverName = getString(req.body.driverName);

    if (!bookingId) {
      return res.status(400).json({
        error: "bookingId is required.",
      });
    }

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const token = createTrackingToken();
    const tokenHash = hashValue(token);

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        driverId: driverId || booking.driverId || null,
        trackingShareTokenHash: tokenHash,
        trackingStartedAt: new Date(),
        trackingEndedAt: null,
        status:
          booking.status === BookingStatus.CONFIRMED ||
          booking.status === BookingStatus.ASSIGNED
            ? BookingStatus.IN_PROGRESS
            : booking.status,
        trackingEvents: {
          create: {
            status: BookingStatus.IN_PROGRESS,
            title: "Live Tracking Started",
            description: driverName
              ? `${driverName} has started sharing live location.`
              : "The driver has started sharing live location.",
            userVisible: true,
          },
        },
      },
    });

    res.json({
      success: true,
      bookingId: updatedBooking.id,
      token,
      driverUrl: `/driver-tracking/${token}`,
    });
  } catch (error) {
    console.error("Start driver tracking error:", error);

    res.status(500).json({
      error: "Failed to start driver tracking.",
    });
  }
});

router.post("/driver/location", async (req, res) => {
  try {
    const token = getString(req.body.token);
    const latitude = getNumber(req.body.latitude);
    const longitude = getNumber(req.body.longitude);
    const accuracy = getNumber(req.body.accuracy);
    const heading = getNumber(req.body.heading);
    const speed = getNumber(req.body.speed);

    if (!token || latitude === null || longitude === null) {
      return res.status(400).json({
        error: "token, latitude and longitude are required.",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        trackingShareTokenHash: hashValue(token),
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Tracking link is invalid.",
      });
    }

    if (booking.trackingEndedAt) {
      return res.status(409).json({
        error: "Tracking has already ended.",
      });
    }

    const location = await prisma.driverLocation.create({
      data: {
        bookingId: booking.id,
        driverId: booking.driverId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
      },
    });

    await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        trackingStartedAt: booking.trackingStartedAt || new Date(),
        status:
          booking.status === BookingStatus.CONFIRMED ||
          booking.status === BookingStatus.ASSIGNED
            ? BookingStatus.IN_PROGRESS
            : booking.status,
        trackingEvents:
          booking.status === BookingStatus.CONFIRMED ||
          booking.status === BookingStatus.ASSIGNED
            ? {
                create: {
                  status: BookingStatus.IN_PROGRESS,
                  title: "Driver En Route",
                  description: "Your driver is travelling to the collection address.",
                  userVisible: true,
                },
              }
            : undefined,
      },
    });

    res.json({
      success: true,
      location,
    });
  } catch (error) {
    console.error("Driver location update error:", error);

    res.status(500).json({
      error: "Failed to update driver location.",
    });
  }
});

router.post("/driver/stop", async (req, res) => {
  try {
    const token = getString(req.body.token);

    if (!token) {
      return res.status(400).json({
        error: "token is required.",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        trackingShareTokenHash: hashValue(token),
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Tracking link is invalid.",
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
            title: "Live Tracking Stopped",
            description: "The driver has stopped sharing live location.",
            userVisible: true,
          },
        },
      },
    });

    res.json({
      success: true,
      bookingId: updatedBooking.id,
    });
  } catch (error) {
    console.error("Stop driver tracking error:", error);

    res.status(500).json({
      error: "Failed to stop driver tracking.",
    });
  }
});

router.get("/customer/:bookingId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.bookingId,
        userId: user.id,
      },
      include: {
        quote: true,
        vehicle: true,
        trackingEvents: {
          where: {
            userVisible: true,
          },
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
        error: "Booking not found.",
      });
    }

    const latestLocation = booking.driverLocations[0] || null;

    res.json({
      booking: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        collectionDate: booking.collectionDate,
        collectionWindow: booking.collectionWindow,
        collectionAddress: booking.collectionAddress,
        deliveryAddress: booking.deliveryAddress,
        vehicle: booking.vehicle,
        trackingStartedAt: booking.trackingStartedAt,
        trackingEndedAt: booking.trackingEndedAt,
      },
      latestLocation: latestLocation
        ? {
            latitude: Number(latestLocation.latitude),
            longitude: Number(latestLocation.longitude),
            accuracy:
              latestLocation.accuracy === null
                ? null
                : Number(latestLocation.accuracy),
            heading:
              latestLocation.heading === null
                ? null
                : Number(latestLocation.heading),
            speed:
              latestLocation.speed === null
                ? null
                : Number(latestLocation.speed),
            createdAt: latestLocation.createdAt,
          }
        : null,
      trackingEvents: booking.trackingEvents,
    });
  } catch (error) {
    console.error("Customer tracking fetch error:", error);

    res.status(500).json({
      error: "Failed to fetch customer tracking.",
    });
  }
});

export default router;
