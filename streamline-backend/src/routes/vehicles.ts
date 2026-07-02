import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const VEHICLE_BLOCK_HOURS = 6;
const UK_TIME_ZONE = "Europe/London";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const zonedDate = new Date(
    date.toLocaleString("en-US", {
      timeZone,
    }),
  );

  const utcDate = new Date(
    date.toLocaleString("en-US", {
      timeZone: "UTC",
    }),
  );

  return zonedDate.getTime() - utcDate.getTime();
}

function createUtcDateFromUkLocalTime(
  collectionDate: string,
  hours: number,
  minutes: number,
) {
  const [year, month, day] = collectionDate.split("-").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(UK_TIME_ZONE, utcGuess);

  return new Date(utcGuess.getTime() - offsetMs);
}

function parseCollectionWindow(collectionDate: string, collectionWindow: string) {
  const [start] = collectionWindow.split("-");
  const [hours, minutes] = start.split(":").map(Number);

  if (!collectionDate || !collectionWindow) {
    return null;
  }

  const reservedFrom = createUtcDateFromUkLocalTime(
    collectionDate,
    hours,
    minutes,
  );

  if (!reservedFrom || Number.isNaN(reservedFrom.getTime())) {
    return null;
  }

  const reservedUntil = new Date(reservedFrom);
  reservedUntil.setHours(reservedUntil.getHours() + VEHICLE_BLOCK_HOURS);

  return {
    reservedFrom,
    reservedUntil,
  };
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

    const reservationWindow = parseCollectionWindow(
      collectionDate,
      collectionWindow,
    );

    if (!reservationWindow) {
      return res.status(400).json({
        error: "Valid collectionDate and collectionWindow are required.",
      });
    }

    const { reservedFrom, reservedUntil } = reservationWindow;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        active: true,
      },
      orderBy: {
        vehicleType: "asc",
      },
    });

    const overlappingReservations = await prisma.vehicleReservation.findMany({
      where: {
        status: {
          in: ["ACTIVE", "CONFIRMED"],
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

    const reservationByVehicleId = new Map<
      string,
      (typeof overlappingReservations)[number]
    >();

    overlappingReservations.forEach((reservation) => {
      const existing = reservationByVehicleId.get(reservation.vehicleId);

      if (!existing || reservation.reservedUntil > existing.reservedUntil) {
        reservationByVehicleId.set(reservation.vehicleId, reservation);
      }
    });

    const availability = vehicles.map((vehicle) => {
      const reservation = reservationByVehicleId.get(vehicle.id);

      return {
        id: vehicle.id,
        name: vehicle.name,
        vehicleType: vehicle.vehicleType,
        active: vehicle.active,
        available: !reservation,
        unavailableUntil: reservation
          ? reservation.reservedUntil.toISOString()
          : null,
        reason: reservation
          ? "Vehicle is already reserved for this collection window."
          : null,
      };
    });

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
