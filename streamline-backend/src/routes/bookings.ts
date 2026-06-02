import { BookingStatus, Prisma, ReservationStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const RESERVATION_MINUTES = 30;

function generateBookingReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `SL-${datePart}-${randomPart}`;
}

function getReservationWindow(collectionDate: Date, collectionWindow: string) {
  const windowStart = collectionWindow.split("-")[0];

  const [hours, minutes] = windowStart.split(":").map(Number);

  const reservedFrom = new Date(collectionDate);
  reservedFrom.setHours(hours, minutes, 0, 0);

  const reservedUntil = new Date(reservedFrom);
  reservedUntil.setMinutes(reservedUntil.getMinutes() + RESERVATION_MINUTES);

  return {
    reservedFrom,
    reservedUntil,
  };
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
      quote.collectionWindow
    );

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
              in: [
                ReservationStatus.ACTIVE,
                ReservationStatus.CONFIRMED,
              ],
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

    const availableVehicle = vehicles.find(
      (vehicle) => vehicle.reservations.length === 0
    );

    if (!availableVehicle) {
      return res.status(409).json({
        error: "No vehicle available for this collection window",
      });
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_MINUTES);

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
        vehicleAvailableAt: reservedUntil,

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
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
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

router.patch("/:id/status", async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: {
        id: req.params.id,
      },
      data: {
        status: req.body.status,
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