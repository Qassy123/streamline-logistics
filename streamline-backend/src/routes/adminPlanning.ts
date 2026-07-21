import {
  BookingStatus,
  Prisma,
} from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function startOfDayUtc(value: string) {
  const parsed = value ? new Date(`${value}T00:00:00.000Z`) : new Date();

  parsed.setUTCHours(0, 0, 0, 0);

  return parsed;
}

function endOfRange(startDate: Date, days: number) {
  const result = new Date(startDate);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isBookingStatus(value: string): value is BookingStatus {
  return Object.values(BookingStatus).includes(value as BookingStatus);
}

function planningBookingInclude() {
  return {
    user: true,
    quote: true,
    vehicle: true,
    driver: true,
    reservation: true,
    payments: true,
    invoices: true,
    pod: true,
  } satisfies Prisma.BookingInclude;
}

async function hasVehicleConflict(
  vehicleId: string,
  bookingId: string,
  start: Date | null,
  end: Date | null,
) {
  if (!start || !end) return false;

  const conflict = await prisma.booking.findFirst({
    where: {
      id: {
        not: bookingId,
      },
      vehicleId,
      status: {
        in: [
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.CONFIRMED,
          BookingStatus.ASSIGNED,
          BookingStatus.IN_PROGRESS,
        ],
      },
      estimatedStartTime: {
        lt: end,
      },
      estimatedEndTime: {
        gt: start,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(conflict);
}

async function hasDriverConflict(
  driverId: string,
  bookingId: string,
  start: Date | null,
  end: Date | null,
) {
  if (!start || !end) return false;

  const conflict = await prisma.booking.findFirst({
    where: {
      id: {
        not: bookingId,
      },
      driverId,
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.ASSIGNED,
          BookingStatus.IN_PROGRESS,
        ],
      },
      estimatedStartTime: {
        lt: end,
      },
      estimatedEndTime: {
        gt: start,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(conflict);
}

router.get("/", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const startDate = startOfDayUtc(getString(req.query.startDate));
    const days = Math.min(
      getPositiveInteger(req.query.days, DEFAULT_DAYS),
      MAX_DAYS,
    );
    const endDate = endOfRange(startDate, days);
    const status = getString(req.query.status).toUpperCase();
    const driverId = getString(req.query.driverId);
    const vehicleType = getString(req.query.vehicleType);
    const unassignedOnly = getBoolean(req.query.unassignedOnly);

    const where: Prisma.BookingWhereInput = {
      collectionDate: {
        gte: startDate,
        lt: endDate,
      },
    };

    if (status && status !== "ALL") {
      if (!isBookingStatus(status)) {
        return res.status(400).json({
          error: "Invalid booking status filter.",
        });
      }

      where.status = status;
    }

    if (driverId && driverId !== "ALL") {
      where.driverId = driverId;
    }

    if (vehicleType && vehicleType !== "ALL") {
      where.vehicle = {
        is: {
          vehicleType,
        },
      };
    }

    if (unassignedOnly) {
      where.OR = [
        {
          driverId: null,
        },
        {
          vehicleId: null,
        },
      ];
    }

    const [bookings, drivers, vehicles] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: planningBookingInclude(),
        orderBy: [
          {
            collectionDate: "asc",
          },
          {
            estimatedStartTime: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      }),
      prisma.driver.findMany({
        where: {
          active: true,
        },
        orderBy: {
          name: "asc",
        },
        include: {
          vehicle: true,
        },
      }),
      prisma.vehicle.findMany({
        where: {
          active: true,
        },
        orderBy: [
          {
            vehicleType: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),
    ]);

    const bookingsWithWarnings = await Promise.all(
      bookings.map(async (booking) => {
        const [vehicleConflict, driverConflict] = await Promise.all([
          booking.vehicleId
            ? hasVehicleConflict(
                booking.vehicleId,
                booking.id,
                booking.estimatedStartTime,
                booking.estimatedEndTime,
              )
            : Promise.resolve(false),
          booking.driverId
            ? hasDriverConflict(
                booking.driverId,
                booking.id,
                booking.estimatedStartTime,
                booking.estimatedEndTime,
              )
            : Promise.resolve(false),
        ]);

        return {
          ...booking,
          warnings: {
            vehicleConflict,
            driverConflict,
            missingVehicle: !booking.vehicleId,
            missingDriver: !booking.driverId,
          },
        };
      }),
    );

    const summary = bookingsWithWarnings.reduce(
      (totals, booking) => {
        totals.total += 1;

        if (!booking.vehicleId || !booking.driverId) {
          totals.unassigned += 1;
        }

        if (
          booking.warnings.vehicleConflict ||
          booking.warnings.driverConflict
        ) {
          totals.conflicts += 1;
        }

        totals.byStatus[booking.status] =
          (totals.byStatus[booking.status] || 0) + 1;

        return totals;
      },
      {
        total: 0,
        unassigned: 0,
        conflicts: 0,
        byStatus: {} as Record<string, number>,
      },
    );

    res.json({
      range: {
        startDate,
        endDate,
        days,
      },
      bookings: bookingsWithWarnings,
      drivers,
      vehicles,
      summary,
    });
  } catch (error) {
    console.error("Admin planning board error:", error);

    res.status(500).json({
      error: "Unable to load planning board.",
    });
  }
});

router.patch("/bookings/:bookingId/assignment", async (req, res) => {
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

    const driverId =
      req.body.driverId === undefined
        ? undefined
        : getString(req.body.driverId) || null;

    const vehicleType =
      req.body.vehicleType === undefined
        ? undefined
        : getString(req.body.vehicleType) || null;

    let vehicleId: string | null | undefined = undefined;

    if (vehicleType === null) {
      vehicleId = null;
    } else if (vehicleType !== undefined) {
      const candidateVehicles = await prisma.vehicle.findMany({
        where: {
          active: true,
          vehicleType,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
        },
      });

      for (const candidate of candidateVehicles) {
        const conflict = await hasVehicleConflict(
          candidate.id,
          booking.id,
          booking.estimatedStartTime,
          booking.estimatedEndTime,
        );

        if (!conflict) {
          vehicleId = candidate.id;
          break;
        }
      }

      if (!vehicleId) {
        return res.status(409).json({
          error: `No available ${vehicleType} vehicle was found for this booking time.`,
        });
      }
    }

    if (
      driverId &&
      (await hasDriverConflict(
        driverId,
        booking.id,
        booking.estimatedStartTime,
        booking.estimatedEndTime,
      ))
    ) {
      return res.status(409).json({
        error: "The selected driver has an overlapping booking.",
      });
    }

    if (
      vehicleId &&
      (await hasVehicleConflict(
        vehicleId,
        booking.id,
        booking.estimatedStartTime,
        booking.estimatedEndTime,
      ))
    ) {
      return res.status(409).json({
        error: "The selected vehicle has an overlapping booking.",
      });
    }

    const updatedBooking = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          driverId,
          vehicleId,
          driverAssignedAt:
            driverId !== undefined
              ? driverId
                ? new Date()
                : null
              : undefined,
          vehicleAssignedAt:
            vehicleId !== undefined
              ? vehicleId
                ? new Date()
                : null
              : undefined,
          status:
            (driverId || booking.driverId) &&
            (vehicleId || booking.vehicleId) &&
            (booking.status === BookingStatus.CONFIRMED ||
              booking.status === BookingStatus.PENDING_PAYMENT)
              ? BookingStatus.ASSIGNED
              : undefined,
          trackingEvents: {
            create: {
              status: BookingStatus.ASSIGNED,
              title: "Booking assigned",
              description:
                "Driver or vehicle assignment updated by the administration team.",
              userVisible: false,
            },
          },
        },
        include: planningBookingInclude(),
      });

      if (driverId) {
        await transaction.driver.update({
          where: {
            id: driverId,
          },
          data: {
            availability: "BUSY",
            vehicleId:
              vehicleId !== undefined
                ? vehicleId
                : undefined,
          },
        });
      }

      return updated;
    });

    res.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Planning assignment update error:", error);

    res.status(500).json({
      error: "Unable to update booking assignment.",
    });
  }
});

router.patch("/bookings/:bookingId/schedule", async (req, res) => {
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

    const collectionDate = getString(req.body.collectionDate);
    const estimatedStartTime = getString(req.body.estimatedStartTime);
    const estimatedEndTime = getString(req.body.estimatedEndTime);
    const status = getString(req.body.status).toUpperCase();

    if (status && !isBookingStatus(status)) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        collectionDate: collectionDate
          ? new Date(collectionDate)
          : undefined,
        estimatedStartTime: estimatedStartTime
          ? new Date(estimatedStartTime)
          : undefined,
        estimatedEndTime: estimatedEndTime
          ? new Date(estimatedEndTime)
          : undefined,
        collectionWindow:
          req.body.collectionWindow !== undefined
            ? getString(req.body.collectionWindow)
            : undefined,
        status: status
          ? (status as BookingStatus)
          : undefined,
        dispatchNotes:
          req.body.dispatchNotes !== undefined
            ? getString(req.body.dispatchNotes) || null
            : undefined,
      },
      include: planningBookingInclude(),
    });

    res.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Planning schedule update error:", error);

    res.status(500).json({
      error: "Unable to update booking schedule.",
    });
  }
});

export default router;