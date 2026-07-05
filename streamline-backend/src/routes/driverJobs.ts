import express from "express";
import { PrismaClient, BookingStatus } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

type DriverStopType = "COLLECTION" | "DROP" | "DELIVERY" | "RETURN";

type DriverStop = {
  sequence: number;
  type: DriverStopType;
  label: string;
  address: string;
  notes?: string | null;
  navigationUrl: string;
};

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

async function getAuthenticatedDriver(authHeader: string | undefined) {
  const token = getBearerToken(authHeader);

  if (!token) return null;

  const driver = await prisma.driver.findFirst({
    where: {
      sessionToken: token,
      active: true,
    },
    include: {
      vehicle: true,
    },
  });

  return driver;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function normaliseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNavigationUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function parseExtraDrops(value: unknown): unknown[] {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (Array.isArray(objectValue.drops)) return objectValue.drops;
    if (Array.isArray(objectValue.extraDrops)) return objectValue.extraDrops;
    if (Array.isArray(objectValue.items)) return objectValue.items;
  }

  return [];
}

function getDropAddress(drop: unknown) {
  if (typeof drop === "string") return drop.trim();

  if (!drop || typeof drop !== "object") return "";

  const dropObject = drop as Record<string, unknown>;

  return (
    normaliseText(dropObject.address) ||
    normaliseText(dropObject.fullAddress) ||
    normaliseText(dropObject.dropAddress) ||
    normaliseText(dropObject.deliveryAddress) ||
    normaliseText(dropObject.location) ||
    normaliseText(dropObject.formattedAddress) ||
    normaliseText(dropObject.label)
  );
}

function getDropNotes(drop: unknown) {
  if (!drop || typeof drop !== "object") return null;

  const dropObject = drop as Record<string, unknown>;

  return (
    normaliseText(dropObject.notes) ||
    normaliseText(dropObject.instructions) ||
    normaliseText(dropObject.specialInstructions) ||
    normaliseText(dropObject.contactName) ||
    null
  );
}

function isReturnJourney(journeyType: unknown, returnAddress: unknown) {
  const journey = normaliseText(journeyType).toLowerCase();

  return Boolean(
    normaliseText(returnAddress) ||
      journey.includes("return") ||
      journey.includes("round") ||
      journey.includes("two way") ||
      journey.includes("two-way"),
  );
}

function buildDriverStops(booking: any): DriverStop[] {
  const stops: DriverStop[] = [];

  function addStop(type: DriverStopType, label: string, address: string, notes?: string | null) {
    const cleanAddress = normaliseText(address);

    if (!cleanAddress) return;

    stops.push({
      sequence: stops.length + 1,
      type,
      label,
      address: cleanAddress,
      notes: notes || null,
      navigationUrl: getNavigationUrl(cleanAddress),
    });
  }

  addStop("COLLECTION", "Collection", booking.collectionAddress);

  const drops = parseExtraDrops(booking.extraDrops || booking.quote?.extraDrops);

  drops.forEach((drop, index) => {
    const address = getDropAddress(drop);

    if (!address) return;

    addStop("DROP", `Drop ${index + 1}`, address, getDropNotes(drop));
  });

  addStop(
    "DELIVERY",
    drops.length > 0 ? "Final delivery" : "Delivery",
    booking.deliveryAddress,
  );

  if (isReturnJourney(booking.quote?.journeyType, booking.quote?.returnAddress)) {
    addStop("RETURN", "Return", booking.quote?.returnAddress || booking.collectionAddress);
  }

  return stops;
}

function enrichJob<T extends any>(job: T): T & {
  stops: DriverStop[];
  stopSummary: {
    totalStops: number;
    extraDrops: number;
    hasReturn: boolean;
    description: string;
  };
  nextStop: DriverStop | null;
} {
  const stops = buildDriverStops(job);
  const extraDrops = stops.filter((stop) => stop.type === "DROP").length;
  const hasReturn = stops.some((stop) => stop.type === "RETURN");

  const descriptionParts = [
    `${stops.length} stop${stops.length === 1 ? "" : "s"}`,
    extraDrops > 0 ? `${extraDrops} drop${extraDrops === 1 ? "" : "s"}` : "",
    hasReturn ? "return journey" : "",
  ].filter(Boolean);

  return {
    ...job,
    stops,
    stopSummary: {
      totalStops: stops.length,
      extraDrops,
      hasReturn,
      description: descriptionParts.join(" · "),
    },
    nextStop: stops[0] || null,
  };
}

/**
 * DRIVER DASHBOARD SUMMARY
 */
router.get("/dashboard", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { start, end } = getTodayRange();

    const [todayJobs, assignedJobs, activeJobs, completedJobs] =
      await Promise.all([
        prisma.booking.findMany({
          where: {
            driverId: driver.id,
            collectionDate: {
              gte: start,
              lt: end,
            },
          },
          orderBy: {
            collectionDate: "asc",
          },
          include: {
            quote: true,
            vehicle: true,
            pod: true,
          },
        }),

        prisma.booking.findMany({
          where: {
            driverId: driver.id,
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.ASSIGNED,
                BookingStatus.IN_PROGRESS,
              ],
            },
          },
          orderBy: {
            collectionDate: "asc",
          },
          include: {
            quote: true,
            vehicle: true,
            pod: true,
          },
        }),

        prisma.booking.findMany({
          where: {
            driverId: driver.id,
            status: BookingStatus.IN_PROGRESS,
          },
          orderBy: {
            collectionDate: "asc",
          },
          include: {
            quote: true,
            vehicle: true,
            pod: true,
          },
        }),

        prisma.booking.findMany({
          where: {
            driverId: driver.id,
            status: BookingStatus.COMPLETED,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 10,
          include: {
            quote: true,
            vehicle: true,
            pod: true,
          },
        }),
      ]);

    return res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        username: driver.username,
        email: driver.email,
        phone: driver.phone,
        availability: driver.availability,
        vehicle: driver.vehicle,
      },
      stats: {
        todayJobs: todayJobs.length,
        assignedJobs: assignedJobs.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
      },
      todayJobs: todayJobs.map(enrichJob),
      assignedJobs: assignedJobs.map(enrichJob),
      activeJobs: activeJobs.map(enrichJob),
      completedJobs: completedJobs.map(enrichJob),
    });
  } catch (error) {
    console.error("Driver dashboard error:", error);
    return res.status(500).json({
      error: "Unable to load driver dashboard",
    });
  }
});

/**
 * ALL DRIVER JOBS
 */
router.get("/", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const status = typeof req.query.status === "string" ? req.query.status : "";

    const jobs = await prisma.booking.findMany({
      where: {
        driverId: driver.id,
        ...(status
          ? {
              status: status as BookingStatus,
            }
          : {}),
      },
      orderBy: {
        collectionDate: "asc",
      },
      include: {
        quote: true,
        vehicle: true,
        pod: true,
        trackingEvents: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    return res.json({
      jobs: jobs.map(enrichJob),
    });
  } catch (error) {
    console.error("Driver jobs error:", error);
    return res.status(500).json({
      error: "Unable to load driver jobs",
    });
  }
});

/**
 * SINGLE DRIVER JOB
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

    const job = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
      include: {
        quote: true,
        vehicle: true,
        pod: true,
        payments: true,
        invoices: true,
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

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.json({
      job: enrichJob(job),
    });
  } catch (error) {
    console.error("Driver job detail error:", error);
    return res.status(500).json({
      error: "Unable to load job",
    });
  }
});

/**
 * ACCEPT ASSIGNED JOB
 */
router.patch("/:bookingId/accept", async (req, res) => {
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
        error: "Job not found",
      });
    }

    if ([BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) {
      return res.status(409).json({
        error: "This job can no longer be accepted",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: BookingStatus.ASSIGNED,
        trackingEvents: {
          create: {
            status: BookingStatus.ASSIGNED,
            title: "Job accepted",
            description: "The driver has accepted this job.",
            userVisible: true,
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        pod: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return res.json({
      message: "Job accepted",
      job: enrichJob(updatedBooking),
    });
  } catch (error) {
    console.error("Driver accept job error:", error);
    return res.status(500).json({
      error: "Unable to accept job",
    });
  }
});

/**
 * UPDATE JOB STATUS
 */
router.patch("/:bookingId/status", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { bookingId } = req.params;
    const { status, title, description } = req.body;

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
        error: "Job not found",
      });
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return res.status(409).json({
        error: "Completed jobs cannot be changed",
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
            userVisible: true,
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        pod: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return res.json({
      message: "Job status updated",
      job: enrichJob(updatedBooking),
    });
  } catch (error) {
    console.error("Driver update job status error:", error);
    return res.status(500).json({
      error: "Unable to update job status",
    });
  }
});

export default router;
