import express from "express";
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
      todayJobs,
      assignedJobs,
      activeJobs,
      completedJobs,
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
      jobs,
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
      job,
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
      job: updatedBooking,
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
      job: updatedBooking,
    });
  } catch (error) {
    console.error("Driver update job status error:", error);
    return res.status(500).json({
      error: "Unable to update job status",
    });
  }
});

export default router;
