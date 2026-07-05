import { BookingStatus, ReservationStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getReservationWindow } from "../lib/reservationWindow";

const router = Router();

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

router.get("/", async (_, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: {
        vehicleType: "asc",
      },
    });

    res.json(vehicles);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch vehicles",
    });
  }
});

router.get("/availability", async (req, res) => {
  try {
    const collectionDate = getString(req.query.collectionDate);
    const collectionWindow = getString(req.query.collectionWindow);

    if (!collectionDate || !collectionWindow) {
      return res.status(400).json({
        error: "Valid collectionDate and collectionWindow are required.",
      });
    }

    const { reservedFrom, reservedUntil } = getReservationWindow(
      collectionDate,
      collectionWindow,
    );

    const vehicles = await prisma.vehicle.findMany({
      where: {
        active: true,
      },
      orderBy: [
        {
          vehicleType: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    const overlappingReservations = await prisma.vehicleReservation.findMany({
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
      orderBy: {
        reservedUntil: "desc",
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
      orderBy: {
        estimatedEndTime: "desc",
      },
    });

    const blockedUntilByVehicleId = new Map<string, Date>();

    overlappingReservations.forEach((reservation) => {
      const existing = blockedUntilByVehicleId.get(reservation.vehicleId);

      if (!existing || reservation.reservedUntil > existing) {
        blockedUntilByVehicleId.set(reservation.vehicleId, reservation.reservedUntil);
      }
    });

    overlappingBookings.forEach((booking) => {
      if (!booking.vehicleId || !booking.estimatedEndTime) return;

      const existing = blockedUntilByVehicleId.get(booking.vehicleId);

      if (!existing || booking.estimatedEndTime > existing) {
        blockedUntilByVehicleId.set(booking.vehicleId, booking.estimatedEndTime);
      }
    });

    const vehiclesByType = new Map<string, typeof vehicles>();

    vehicles.forEach((vehicle) => {
      const current = vehiclesByType.get(vehicle.vehicleType) || [];
      current.push(vehicle);
      vehiclesByType.set(vehicle.vehicleType, current);
    });

    const availability = Array.from(vehiclesByType.entries()).map(
      ([vehicleType, typeVehicles]) => {
        const availableVehicle = typeVehicles.find(
          (vehicle) => !blockedUntilByVehicleId.has(vehicle.id),
        );

        const latestBlockedUntil = typeVehicles.reduce<Date | null>(
          (latest, vehicle) => {
            const blockedUntil = blockedUntilByVehicleId.get(vehicle.id);

            if (!blockedUntil) return latest;
            if (!latest || blockedUntil > latest) return blockedUntil;

            return latest;
          },
          null,
        );

        const representativeVehicle = availableVehicle || typeVehicles[0];

        return {
          id: representativeVehicle.id,
          name: representativeVehicle.name,
          vehicleType,
          active: representativeVehicle.active,
          available: Boolean(availableVehicle),
          unavailableUntil: availableVehicle
            ? null
            : latestBlockedUntil
              ? latestBlockedUntil.toISOString()
              : null,
          reason: availableVehicle
            ? null
            : "Vehicle is already reserved for this collection window.",
          totalVehicles: typeVehicles.length,
          availableVehicles: typeVehicles.filter(
            (vehicle) => !blockedUntilByVehicleId.has(vehicle.id),
          ).length,
        };
      },
    );

    res.json({
      vehicles: availability,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch vehicle availability",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        bookings: true,
        reservations: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        error: "Vehicle not found",
      });
    }

    res.json(vehicle);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch vehicle",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.update({
      where: {
        id: req.params.id,
      },
      data: {
        name: req.body.name,
        vehicleType: req.body.vehicleType,
        active: req.body.active,
        registration: req.body.registration,
        motExpiry: req.body.motExpiry ? new Date(req.body.motExpiry) : undefined,
        insuranceExpiry: req.body.insuranceExpiry
          ? new Date(req.body.insuranceExpiry)
          : undefined,
        serviceDueDate: req.body.serviceDueDate
          ? new Date(req.body.serviceDueDate)
          : undefined,
        gpsDeviceId: req.body.gpsDeviceId,
      },
    });

    res.json(vehicle);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update vehicle",
    });
  }
});

export default router;
