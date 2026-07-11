import { BookingStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const STALE_LOCATION_MINUTES = 10;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
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

function adminTrackingInclude() {
  return {
    user: true,
    quote: true,
    vehicle: true,
    driver: true,
    pod: true,
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
  } satisfies Prisma.BookingInclude;
}

/* ---------------------------------
   Admin Tracking Management
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
    const status = getString(req.query.status).toUpperCase();
    const activeOnly =
      getString(req.query.activeOnly).toLowerCase() === "true";

    const where: Prisma.BookingWhereInput = {};

    if (search) {
      where.OR = [
        {
          reference: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          user: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              companyName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          driver: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          vehicle: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          vehicle: {
            is: {
              registration: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
        return res.status(400).json({
          error: "Invalid booking status filter.",
        });
      }

      where.status = status as BookingStatus;
    }

    if (activeOnly) {
      where.trackingStartedAt = {
        not: null,
      };
      where.trackingEndedAt = null;
    }

    const [bookings, total, activeCount, staleCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        include: adminTrackingInclude(),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({
        where,
      }),
      prisma.booking.count({
        where: {
          trackingStartedAt: {
            not: null,
          },
          trackingEndedAt: null,
        },
      }),
      prisma.driverLocation.count({
        where: {
          createdAt: {
            lt: new Date(
              Date.now() - STALE_LOCATION_MINUTES * 60 * 1000,
            ),
          },
          booking: {
            trackingStartedAt: {
              not: null,
            },
            trackingEndedAt: null,
          },
        },
      }),
    ]);

    const enrichedBookings = bookings.map((booking) => {
      const latestLocation = booking.driverLocations[0] || null;
      const stale =
        Boolean(latestLocation) &&
        latestLocation!.createdAt.getTime() <
          Date.now() - STALE_LOCATION_MINUTES * 60 * 1000;

      return {
        ...booking,
        latestLocation: latestLocation
          ? {
              id: latestLocation.id,
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
        locationStale: stale,
      };
    });

    res.json({
      bookings: enrichedBookings,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        activeTracking: activeCount,
        staleLocations: staleCount,
      },
    });
  } catch (error) {
    console.error("Admin tracking list error:", error);

    res.status(500).json({
      error: "Unable to load tracking data.",
    });
  }
});

router.get("/admin/:bookingId", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
      include: {
        user: true,
        quote: true,
        vehicle: true,
        driver: true,
        pod: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    res.json({
      booking: {
        ...booking,
        driverLocations: booking.driverLocations.map((location) => ({
          ...location,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          accuracy:
            location.accuracy === null
              ? null
              : Number(location.accuracy),
          heading:
            location.heading === null
              ? null
              : Number(location.heading),
          speed:
            location.speed === null
              ? null
              : Number(location.speed),
        })),
      },
    });
  } catch (error) {
    console.error("Admin tracking detail error:", error);

    res.status(500).json({
      error: "Unable to load tracking details.",
    });
  }
});

router.post("/admin/:bookingId/event", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const title = getString(req.body.title);
    const description = getString(req.body.description);
    const statusValue = getString(req.body.status).toUpperCase();

    if (!title) {
      return res.status(400).json({
        error: "Event title is required.",
      });
    }

    if (
      statusValue &&
      !Object.values(BookingStatus).includes(
        statusValue as BookingStatus,
      )
    ) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    const event = await prisma.bookingTrackingEvent.create({
      data: {
        bookingId: booking.id,
        status: statusValue
          ? (statusValue as BookingStatus)
          : booking.status,
        title,
        description: description || null,
        userVisible: getBoolean(req.body.userVisible),
      },
    });

    res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Admin tracking event creation error:", error);

    res.status(500).json({
      error: "Unable to create tracking event.",
    });
  }
});

router.patch("/admin/:bookingId/tracking", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const action = getString(req.body.action).toUpperCase();

    if (!["START", "STOP", "RESET"].includes(action)) {
      return res.status(400).json({
        error: "Action must be START, STOP or RESET.",
      });
    }

    const now = new Date();

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data:
        action === "START"
          ? {
              trackingStartedAt: booking.trackingStartedAt || now,
              trackingEndedAt: null,
            }
          : action === "STOP"
            ? {
                trackingEndedAt: now,
              }
            : {
                trackingStartedAt: null,
                trackingEndedAt: null,
                trackingShareTokenHash: null,
              },
    });

    res.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Admin tracking update error:", error);

    res.status(500).json({
      error: "Unable to update tracking state.",
    });
  }
});

/* ---------------------------------
   Existing Tracking Routes
---------------------------------- */

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

    if (booking.status === BookingStatus.COMPLETED) {
      return res.status(409).json({
        error: "Completed deliveries cannot restart tracking.",
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

    if (booking.status === BookingStatus.COMPLETED) {
      return res.status(409).json({
        error: "Delivery has already been completed.",
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
                  description:
                    "Your driver is travelling to the collection address.",
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

    if (booking.status === BookingStatus.COMPLETED) {
      return res.status(409).json({
        error: "Delivery has already been completed.",
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
        pod: true,
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
        pod: booking.pod,
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