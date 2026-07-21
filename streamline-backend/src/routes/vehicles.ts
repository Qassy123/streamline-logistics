import {
  BookingStatus,
  Prisma,
  ReservationStatus,
  VehicleStatus,
} from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getReservationWindow } from "../lib/reservationWindow";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
] as const;

function isVehicleType(value: string) {
  return VEHICLE_TYPES.includes(value as (typeof VEHICLE_TYPES)[number]);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const cleanValue = getString(value);
  return cleanValue || null;
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

function getOptionalNonNegativeInteger(value: unknown) {
  const cleanValue = getString(value);

  if (!cleanValue) return null;

  const parsedValue = Number.parseInt(cleanValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function getOptionalDate(value: unknown) {
  const cleanValue = getString(value);

  if (!cleanValue) return null;

  const parsedDate = new Date(cleanValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
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

function getVehicleOperationalState(vehicle: {
  active: boolean;
  status: VehicleStatus;
  motExpiry: Date | null;
  insuranceExpiry: Date | null;
  serviceDueDate: Date | null;
  bookings: {
    status: BookingStatus;
  }[];
  reservations: {
    status: ReservationStatus;
  }[];
}) {
  if (!vehicle.active || vehicle.status === VehicleStatus.INACTIVE) {
    return "INACTIVE";
  }

  if (vehicle.status === VehicleStatus.MAINTENANCE) {
    return "MAINTENANCE";
  }

  if (vehicle.status === VehicleStatus.OUT_ON_JOB) {
    return "OUT_ON_JOB";
  }

  if (vehicle.status === VehicleStatus.BOOKED) {
    return "BOOKED";
  }

  const now = new Date();

  if (
    (vehicle.motExpiry && vehicle.motExpiry < now) ||
    (vehicle.insuranceExpiry && vehicle.insuranceExpiry < now)
  ) {
    return "COMPLIANCE_EXPIRED";
  }

  if (vehicle.serviceDueDate && vehicle.serviceDueDate < now) {
    return "SERVICE_DUE";
  }

  if (
    vehicle.bookings.some(
      (booking) =>
        booking.status === BookingStatus.ASSIGNED ||
        booking.status === BookingStatus.IN_PROGRESS,
    )
  ) {
    return "IN_USE";
  }

  if (
    vehicle.reservations.some(
      (reservation) =>
        reservation.status === ReservationStatus.ACTIVE ||
        reservation.status === ReservationStatus.CONFIRMED,
    )
  ) {
    return "RESERVED";
  }

  return "AVAILABLE";
}

function adminVehicleInclude() {
  return {
    bookings: {
      where: {
        status: {
          in: [
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
            BookingStatus.ASSIGNED,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: {
        collectionDate: "asc",
      },
      take: 10,
      include: {
        user: true,
        driver: true,
      },
    },
    reservations: {
      where: {
        status: {
          in: [
            ReservationStatus.ACTIVE,
            ReservationStatus.CONFIRMED,
          ],
        },
      },
      orderBy: {
        reservedFrom: "asc",
      },
      take: 10,
    },
  } satisfies Prisma.VehicleInclude;
}

/* ---------------------------------
   Admin Fleet Management
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
    const vehicleType = getString(req.query.vehicleType);
    const active = getString(req.query.active).toUpperCase();
    const state = getString(req.query.state).toUpperCase();

    const where: Prisma.VehicleWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          registration: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          vehicleType: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          gpsDeviceId: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (vehicleType && vehicleType !== "ALL") {
      where.vehicleType = vehicleType;
    }

    if (active === "ACTIVE") {
      where.active = true;
    }

    if (active === "INACTIVE") {
      where.active = false;
    }

    const [vehicles, total, drivers] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: [
          {
            vehicleType: "asc",
          },
          {
            name: "asc",
          },
        ],
        include: adminVehicleInclude(),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vehicle.count({
        where,
      }),
      prisma.driver.findMany({
        where: {
          active: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          availability: true,
          vehicleId: true,
        },
      }),
    ]);

    const vehicleIds = vehicles.map((vehicle) => vehicle.id);

    const assignedDrivers =
      vehicleIds.length > 0
        ? await prisma.driver.findMany({
            where: {
              vehicleId: {
                in: vehicleIds,
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              availability: true,
              vehicleId: true,
            },
          })
        : [];

    const assignedDriversByVehicleId = new Map(
      assignedDrivers.map((driver) => [driver.vehicleId, driver]),
    );

    const enrichedVehicles = vehicles
      .map((vehicle) => ({
        ...vehicle,
        operationalState: getVehicleOperationalState(vehicle),
        assignedDriver:
          assignedDriversByVehicleId.get(vehicle.id) || null,
      }))
      .filter((vehicle) => {
        if (!state || state === "ALL") return true;
        return vehicle.operationalState === state;
      });

    const allVehiclesForSummary = await prisma.vehicle.findMany({
      include: adminVehicleInclude(),
    });

    const summary = allVehiclesForSummary.reduce(
      (totals, vehicle) => {
        const operationalState = getVehicleOperationalState(vehicle);

        totals.total += 1;

        if (vehicle.active) {
          totals.active += 1;
        } else {
          totals.inactive += 1;
        }

        totals.byState[operationalState] =
          (totals.byState[operationalState] || 0) + 1;

        return totals;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        byState: {} as Record<string, number>,
      },
    );

    res.json({
      vehicles: enrichedVehicles,
      drivers,
      vehicleTypes: [...VEHICLE_TYPES],
      pagination: {
        page,
        pageSize,
        total:
          state && state !== "ALL"
            ? enrichedVehicles.length
            : total,
        totalPages:
          state && state !== "ALL"
            ? 1
            : Math.max(1, Math.ceil(total / pageSize)),
      },
      summary,
    });
  } catch (error) {
    console.error("Admin fleet list error:", error);

    res.status(500).json({
      error: "Unable to load fleet.",
    });
  }
});

router.get("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        bookings: {
          orderBy: {
            collectionDate: "desc",
          },
          take: 25,
          include: {
            user: true,
            driver: true,
            payments: true,
            invoices: true,
          },
        },
        reservations: {
          orderBy: {
            reservedFrom: "desc",
          },
          take: 25,
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    const assignedDriver = await prisma.driver.findFirst({
      where: {
        vehicleId: vehicle.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        availability: true,
        vehicleId: true,
      },
    });

    res.json({
      vehicle: {
        ...vehicle,
        operationalState: getVehicleOperationalState(vehicle),
        assignedDriver,
      },
    });
  } catch (error) {
    console.error("Admin fleet detail error:", error);

    res.status(500).json({
      error: "Unable to load vehicle.",
    });
  }
});

router.post("/admin", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const name = getString(req.body.name);
    const vehicleType = getString(req.body.vehicleType);
    const registration =
      getOptionalString(req.body.registration)?.toUpperCase() || null;
    const status = getString(req.body.status).toUpperCase();

    if (!name || !vehicleType || !registration) {
      return res.status(400).json({
        error: "Vehicle name, vehicle type and registration are required.",
      });
    }

    if (!isVehicleType(vehicleType)) {
      return res.status(400).json({
        error: "Invalid vehicle type.",
      });
    }

    if (
      status &&
      !Object.values(VehicleStatus).includes(status as VehicleStatus)
    ) {
      return res.status(400).json({
        error: "Invalid vehicle status.",
      });
    }

    const existingRegistration = await prisma.vehicle.findUnique({
      where: {
        registration,
      },
    });

    if (existingRegistration) {
      return res.status(409).json({
        error: "A vehicle already exists with this registration.",
      });
    }

    const active =
      req.body.active === undefined ? true : getBoolean(req.body.active);
    const resolvedStatus = active
      ? status
        ? (status as VehicleStatus)
        : VehicleStatus.AVAILABLE
      : VehicleStatus.INACTIVE;

    const vehicle = await prisma.vehicle.create({
      data: {
        name,
        vehicleType,
        vehicleCategory: getOptionalString(req.body.vehicleCategory),
        status: resolvedStatus,
        registration,
        active,
        make: getOptionalString(req.body.make),
        model: getOptionalString(req.body.model),
        colour: getOptionalString(req.body.colour),
        fuelType: getOptionalString(req.body.fuelType),
        engineCapacity: getOptionalString(req.body.engineCapacity),
        co2Emissions: getOptionalString(req.body.co2Emissions),
        dateOfFirstRegistration: getOptionalDate(
          req.body.dateOfFirstRegistration,
        ),
        taxDueDate: getOptionalDate(req.body.taxDueDate),
        motExpiry: getOptionalDate(req.body.motExpiry),
        euroEmissionsStatus: getOptionalString(
          req.body.euroEmissionsStatus,
        ),
        mileage: getOptionalNonNegativeInteger(req.body.mileage),
        insuranceProvider: getOptionalString(req.body.insuranceProvider),
        insurancePolicyNumber: getOptionalString(
          req.body.insurancePolicyNumber,
        ),
        insuranceExpiry: getOptionalDate(req.body.insuranceExpiry),
        serviceDueDate: getOptionalDate(req.body.serviceDueDate),
        maintenanceNotes: getOptionalString(req.body.maintenanceNotes),
        gpsDeviceId: getOptionalString(req.body.gpsDeviceId),
      },
    });

    const driverId = getOptionalString(req.body.driverId);

    if (driverId) {
      await prisma.driver.update({
        where: {
          id: driverId,
        },
        data: {
          vehicleId: vehicle.id,
        },
      });
    }

    res.status(201).json({
      success: true,
      vehicle,
    });
  } catch (error) {
    console.error("Admin vehicle creation error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A vehicle already exists with this unique value.",
      });
    }

    res.status(500).json({
      error: "Unable to create vehicle.",
    });
  }
});

router.patch("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existingVehicle) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    const registration =
      req.body.registration !== undefined
        ? getOptionalString(req.body.registration)?.toUpperCase() || null
        : undefined;

    const vehicleType =
      req.body.vehicleType !== undefined
        ? getString(req.body.vehicleType)
        : undefined;

    const status =
      req.body.status !== undefined
        ? getString(req.body.status).toUpperCase()
        : undefined;

    if (vehicleType !== undefined && !isVehicleType(vehicleType)) {
      return res.status(400).json({
        error: "Invalid vehicle type.",
      });
    }

    if (
      status !== undefined &&
      !Object.values(VehicleStatus).includes(status as VehicleStatus)
    ) {
      return res.status(400).json({
        error: "Invalid vehicle status.",
      });
    }

    if (registration) {
      const duplicateRegistration = await prisma.vehicle.findFirst({
        where: {
          registration,
          id: {
            not: req.params.id,
          },
        },
      });

      if (duplicateRegistration) {
        return res.status(409).json({
          error: "Another vehicle already uses this registration.",
        });
      }
    }

    const vehicle = await prisma.$transaction(async (transaction) => {
      const updatedVehicle = await transaction.vehicle.update({
        where: {
          id: req.params.id,
        },
        data: {
          name:
            req.body.name !== undefined
              ? getString(req.body.name)
              : undefined,
          vehicleType,
          vehicleCategory:
            req.body.vehicleCategory !== undefined
              ? getOptionalString(req.body.vehicleCategory)
              : undefined,
          status:
            req.body.active !== undefined && !getBoolean(req.body.active)
              ? VehicleStatus.INACTIVE
              : status !== undefined
                ? (status as VehicleStatus)
                : req.body.active !== undefined && getBoolean(req.body.active)
                  ? VehicleStatus.AVAILABLE
                  : undefined,
          active:
            req.body.active !== undefined
              ? getBoolean(req.body.active)
              : undefined,
          registration,
          make:
            req.body.make !== undefined
              ? getOptionalString(req.body.make)
              : undefined,
          model:
            req.body.model !== undefined
              ? getOptionalString(req.body.model)
              : undefined,
          colour:
            req.body.colour !== undefined
              ? getOptionalString(req.body.colour)
              : undefined,
          fuelType:
            req.body.fuelType !== undefined
              ? getOptionalString(req.body.fuelType)
              : undefined,
          engineCapacity:
            req.body.engineCapacity !== undefined
              ? getOptionalString(req.body.engineCapacity)
              : undefined,
          co2Emissions:
            req.body.co2Emissions !== undefined
              ? getOptionalString(req.body.co2Emissions)
              : undefined,
          dateOfFirstRegistration:
            req.body.dateOfFirstRegistration !== undefined
              ? getOptionalDate(req.body.dateOfFirstRegistration)
              : undefined,
          taxDueDate:
            req.body.taxDueDate !== undefined
              ? getOptionalDate(req.body.taxDueDate)
              : undefined,
          motExpiry:
            req.body.motExpiry !== undefined
              ? getOptionalDate(req.body.motExpiry)
              : undefined,
          euroEmissionsStatus:
            req.body.euroEmissionsStatus !== undefined
              ? getOptionalString(req.body.euroEmissionsStatus)
              : undefined,
          mileage:
            req.body.mileage !== undefined
              ? getOptionalNonNegativeInteger(req.body.mileage)
              : undefined,
          insuranceProvider:
            req.body.insuranceProvider !== undefined
              ? getOptionalString(req.body.insuranceProvider)
              : undefined,
          insurancePolicyNumber:
            req.body.insurancePolicyNumber !== undefined
              ? getOptionalString(req.body.insurancePolicyNumber)
              : undefined,
          insuranceExpiry:
            req.body.insuranceExpiry !== undefined
              ? getOptionalDate(req.body.insuranceExpiry)
              : undefined,
          serviceDueDate:
            req.body.serviceDueDate !== undefined
              ? getOptionalDate(req.body.serviceDueDate)
              : undefined,
          maintenanceNotes:
            req.body.maintenanceNotes !== undefined
              ? getOptionalString(req.body.maintenanceNotes)
              : undefined,
          gpsDeviceId:
            req.body.gpsDeviceId !== undefined
              ? getOptionalString(req.body.gpsDeviceId)
              : undefined,
        },
      });

      if (req.body.driverId !== undefined) {
        await transaction.driver.updateMany({
          where: {
            vehicleId: req.params.id,
          },
          data: {
            vehicleId: null,
          },
        });

        const driverId = getOptionalString(req.body.driverId);

        if (driverId) {
          await transaction.driver.update({
            where: {
              id: driverId,
            },
            data: {
              vehicleId: req.params.id,
            },
          });
        }
      }

      return updatedVehicle;
    });

    res.json({
      success: true,
      vehicle,
    });
  } catch (error) {
    console.error("Admin vehicle update error:", error);

    res.status(500).json({
      error: "Unable to update vehicle.",
    });
  }
});

/* ---------------------------------
   Existing Public Vehicle Routes
---------------------------------- */

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

    const companySettings = await prisma.companySettings.findFirst({
      orderBy: { createdAt: "asc" },
      select: { vehicleBlockHours: true },
    });

    const { reservedFrom, reservedUntil } = getReservationWindow(
      collectionDate,
      collectionWindow,
      companySettings?.vehicleBlockHours ?? 6,
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
        blockedUntilByVehicleId.set(
          reservation.vehicleId,
          reservation.reservedUntil,
        );
      }
    });

    overlappingBookings.forEach((booking) => {
      if (!booking.vehicleId || !booking.estimatedEndTime) return;

      const existing = blockedUntilByVehicleId.get(booking.vehicleId);

      if (!existing || booking.estimatedEndTime > existing) {
        blockedUntilByVehicleId.set(
          booking.vehicleId,
          booking.estimatedEndTime,
        );
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
        motExpiry: req.body.motExpiry
          ? new Date(req.body.motExpiry)
          : undefined,
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