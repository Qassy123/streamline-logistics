import { BookingStatus, Prisma, ReservationStatus } from "@prisma/client";
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { assignRandomAvailableDriverToBooking } from "../lib/assignDriver";
import { getReservationWindow } from "../lib/reservationWindow";

const router = Router();

const PAYMENT_RESERVATION_MINUTES = 30;

function generateBookingReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `SL-${datePart}-${randomPart}`;
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

async function autoSaveRouteFromConfirmedBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      quote: true,
    },
  });

  if (!booking || !booking.userId || !booking.quote) return;

  const quote = booking.quote;

  const existingSavedRoute = await prisma.savedRoute.findFirst({
    where: {
      userId: booking.userId,
      collectionAddress: quote.collectionAddress,
      deliveryAddress: quote.deliveryAddress,
      deliveryType: quote.deliveryType,
      journeyType: quote.journeyType,
      vehicleSize: quote.vehicleSize,
    },
  });

  if (existingSavedRoute) return;

  await prisma.savedRoute.create({
    data: {
      userId: booking.userId,

      name: `${quote.collectionAddress} to ${quote.deliveryAddress}`,

      deliveryType: quote.deliveryType,
      journeyType: quote.journeyType,
      capacityPercent: quote.capacityPercent,
      vehicleSize: quote.vehicleSize,

      collectionAddress: quote.collectionAddress,
      collectionAddressDetails:
        quote.collectionAddressDetails === null
          ? Prisma.JsonNull
          : quote.collectionAddressDetails,

      deliveryAddress: quote.deliveryAddress,
      deliveryAddressDetails:
        quote.deliveryAddressDetails === null
          ? Prisma.JsonNull
          : quote.deliveryAddressDetails,

      returnAddress: quote.returnAddress,
      extraDrops: quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,

      whatAreWeCollecting: quote.whatAreWeCollecting,
      loadDescription: quote.loadDescription,
      specialInstructions: quote.specialInstructions,

      contactPreference: quote.contactPreference,
    },
  });
}

router.get("/", async (_, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        quote: true,
        user: true,
        vehicle: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
      },
    });

    res.json(bookings);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch bookings",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        quote: true,
        vehicle: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    res.json({
      bookings,
    });
  } catch (error) {
    console.error("Fetch user bookings error:", error);

    res.status(500).json({
      error: "Failed to fetch your bookings.",
    });
  }
});

router.get("/me/tracking", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
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
      },
    });

    res.json({
      bookings,
    });
  } catch (error) {
    console.error("Fetch tracking error:", error);

    res.status(500).json({
      error: "Failed to fetch tracking.",
    });
  }
});

router.get("/me/invoices", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        booking: {
          include: {
            quote: true,
          },
        },
      },
    });

    res.json({
      invoices,
    });
  } catch (error) {
    console.error("Fetch invoices error:", error);

    res.status(500).json({
      error: "Failed to fetch invoices.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        quote: true,
        user: true,
        vehicle: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch booking",
    });
  }
});

router.post("/expire-reservations", async (_, res) => {
  try {
    const now = new Date();

    const expiredReservations = await prisma.vehicleReservation.updateMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: ReservationStatus.EXPIRED,
      },
    });

    const expiredBookings = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        reservation: {
          status: ReservationStatus.EXPIRED,
        },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });

    await prisma.quote.updateMany({
      where: {
        status: "payment_pending",
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: "expired",
      },
    });

    res.json({
      success: true,
      expiredReservations: expiredReservations.count,
      expiredBookings: expiredBookings.count,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to expire reservations",
    });
  }
});

router.post("/from-quote/:quoteId", async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.quoteId,
      },
      include: {
        booking: true,
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    if (quote.booking) {
      return res.status(409).json({
        error: "Booking already exists for this quote",
      });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({
        error: "Quote has no total price",
      });
    }

    if (!quote.collectionWindow || quote.collectionWindow === "ASAP") {
      return res.status(400).json({
        error: "A fixed collection window is required before booking",
      });
    }

    const { reservedFrom, reservedUntil } = getReservationWindow(
      quote.collectionDate,
      quote.collectionWindow,
    );

    const vehicleAvailableAt = reservedUntil;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        vehicleType: quote.vehicleSize,
        active: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        reservations: {
          where: {
            status: {
              in: [ReservationStatus.ACTIVE, ReservationStatus.CONFIRMED],
            },
            reservedFrom: {
              lt: reservedUntil,
            },
            reservedUntil: {
              gt: reservedFrom,
            },
          },
        },
      },
    });

    const overlappingBookings = await prisma.booking.findMany({
      where: {
        vehicleId: {
          not: null,
        },
        status: {
          in: [
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
            BookingStatus.ASSIGNED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.COMPLETED,
          ],
        },
        estimatedStartTime: {
          lt: reservedUntil,
        },
        estimatedEndTime: {
          gt: reservedFrom,
        },
      },
      select: {
        vehicleId: true,
      },
    });

    const blockedVehicleIds = new Set(
      overlappingBookings
        .map((booking) => booking.vehicleId)
        .filter((vehicleId): vehicleId is string => Boolean(vehicleId)),
    );

    const availableVehicle = vehicles.find(
      (vehicle) =>
        vehicle.reservations.length === 0 && !blockedVehicleIds.has(vehicle.id),
    );

    if (!availableVehicle) {
      return res.status(409).json({
        error: "No vehicle available for this collection window",
      });
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PAYMENT_RESERVATION_MINUTES);

    const booking = await prisma.booking.create({
      data: {
        reference: generateBookingReference(),
        status: BookingStatus.PENDING_PAYMENT,

        quoteId: quote.id,
        userId: quote.userId,

        vehicleId: availableVehicle.id,

        collectionDate: quote.collectionDate,
        collectionWindow: quote.collectionWindow,

        collectionAddress: quote.collectionAddress,
        deliveryAddress: quote.deliveryAddress,
        extraDrops:
          quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,

        estimatedStartTime: reservedFrom,
        estimatedEndTime: reservedUntil,
        vehicleAvailableAt,

        totalPrice: quote.totalPrice,

        reservation: {
          create: {
            vehicleId: availableVehicle.id,
            quoteId: quote.id,
            status: ReservationStatus.ACTIVE,
            reservedFrom,
            reservedUntil,
            expiresAt,
          },
        },

        trackingEvents: {
          create: {
            status: BookingStatus.PENDING_PAYMENT,
            title: "Booking Created",
            description: "Your booking has been created and is pending payment.",
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
        trackingEvents: true,
      },
    });

    await prisma.quote.update({
      where: {
        id: quote.id,
      },
      data: {
        status: "payment_pending",
        expiresAt,
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create booking from quote",
    });
  }
});

router.post("/:id/confirm-payment", async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        quote: true,
        reservation: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    if (!booking.reservation) {
      return res.status(400).json({
        error: "Booking has no reservation",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: BookingStatus.CONFIRMED,
        reservation: {
          update: {
            status: ReservationStatus.CONFIRMED,
            expiresAt: null,
          },
        },
        quote: booking.quote
          ? {
              update: {
                status: "paid",
              },
            }
          : undefined,
        trackingEvents: {
          create: {
            status: BookingStatus.CONFIRMED,
            title: "Payment Confirmed",
            description: "Your payment has been received and your booking is confirmed.",
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    await autoSaveRouteFromConfirmedBooking(updatedBooking.id);
    await assignRandomAvailableDriverToBooking(updatedBooking.id);

    const finalBooking = await prisma.booking.findUnique({
      where: {
        id: updatedBooking.id,
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        driver: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    res.json(finalBooking || updatedBooking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to confirm booking payment",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const status = req.body.status as BookingStatus;

    const booking = await prisma.booking.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
        trackingEvents: {
          create: {
            status,
            title: `Booking ${String(status).replace(/_/g, " ").toLowerCase()}`,
            description: "Your booking status has been updated.",
          },
        },
      },
      include: {
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    res.json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update booking status",
    });
  }
});

export default router;
