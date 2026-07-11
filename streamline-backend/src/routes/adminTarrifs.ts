import { Router, type Request, type Response } from "express";
import { ChargeCalculation, ChargeType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

const chargeTypes = Object.values(ChargeType);
const chargeCalculations = Object.values(ChargeCalculation);

function requireAdminKey(
  request: Request,
  response: Response,
  next: () => void,
) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.header("x-admin-key");

  if (!configuredKey) {
    response.status(500).json({
      success: false,
      message: "ADMIN_API_KEY is not configured.",
    });
    return;
  }

  if (!suppliedKey || suppliedKey !== configuredKey) {
    response.status(401).json({
      success: false,
      message: "Unauthorised.",
    });
    return;
  }

  next();
}

router.use(requireAdminKey);

function normaliseString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normaliseDecimal(
  value: unknown,
  fieldName: string,
  options?: { allowZero?: boolean },
): Prisma.Decimal | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  const allowZero = options?.allowZero ?? true;

  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`${fieldName} must be a valid non-negative number.`);
  }

  return new Prisma.Decimal(parsed);
}

function normaliseNullableDecimal(
  value: unknown,
  fieldName: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid non-negative number.`);
  }

  return new Prisma.Decimal(parsed);
}

function isChargeType(value: unknown): value is ChargeType {
  return typeof value === "string" && chargeTypes.includes(value as ChargeType);
}

function isChargeCalculation(value: unknown): value is ChargeCalculation {
  return (
    typeof value === "string" &&
    chargeCalculations.includes(value as ChargeCalculation)
  );
}

const tariffInclude = {
  mileageBands: {
    orderBy: {
      minimumMiles: "asc",
    },
  },
  charges: {
    orderBy: [{ active: "desc" }, { name: "asc" }],
  },
} satisfies Prisma.TariffInclude;

function serialiseTariff<
  T extends {
    baseFare: Prisma.Decimal;
    mileageBands: Array<{
      minimumMiles: Prisma.Decimal;
      maximumMiles: Prisma.Decimal | null;
      ratePerMile: Prisma.Decimal;
    }>;
    charges: Array<{
      amount: Prisma.Decimal;
    }>;
  },
>(tariff: T) {
  return {
    ...tariff,
    baseFare: tariff.baseFare.toString(),
    mileageBands: tariff.mileageBands.map((band) => ({
      ...band,
      minimumMiles: band.minimumMiles.toString(),
      maximumMiles: band.maximumMiles?.toString() ?? null,
      ratePerMile: band.ratePerMile.toString(),
    })),
    charges: tariff.charges.map((charge) => ({
      ...charge,
      amount: charge.amount.toString(),
    })),
  };
}

router.get("/", async (request, response) => {
  try {
    const search = normaliseString(request.query.search);
    const active = normaliseString(request.query.active);

    const where: Prisma.TariffWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { vehicleType: { contains: search, mode: "insensitive" } },
      ];
    }

    if (active === "true") {
      where.active = true;
    } else if (active === "false") {
      where.active = false;
    }

    const [tariffs, total, activeCount, inactiveCount] = await Promise.all([
      prisma.tariff.findMany({
        where,
        include: tariffInclude,
        orderBy: [{ active: "desc" }, { vehicleType: "asc" }, { name: "asc" }],
      }),
      prisma.tariff.count(),
      prisma.tariff.count({ where: { active: true } }),
      prisma.tariff.count({ where: { active: false } }),
    ]);

    response.json({
      success: true,
      tariffs: tariffs.map(serialiseTariff),
      summary: {
        total,
        active: activeCount,
        inactive: inactiveCount,
      },
      options: {
        chargeTypes,
        chargeCalculations,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/tariffs failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load tariffs.",
    });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const tariff = await prisma.tariff.findUnique({
      where: { id: request.params.id },
      include: tariffInclude,
    });

    if (!tariff) {
      response.status(404).json({
        success: false,
        message: "Tariff not found.",
      });
      return;
    }

    response.json({
      success: true,
      tariff: serialiseTariff(tariff),
    });
  } catch (error) {
    console.error("GET /api/admin/tariffs/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load tariff.",
    });
  }
});

router.post("/", async (request, response) => {
  try {
    const name = normaliseString(request.body.name);
    const vehicleType = normaliseString(request.body.vehicleType);
    const baseFare = normaliseDecimal(request.body.baseFare, "Base fare");
    const active =
      normaliseBoolean(request.body.active) === undefined
        ? true
        : normaliseBoolean(request.body.active);
    const vatApplicable =
      normaliseBoolean(request.body.vatApplicable) === undefined
        ? true
        : normaliseBoolean(request.body.vatApplicable);

    if (!name || !vehicleType || baseFare === undefined) {
      response.status(400).json({
        success: false,
        message: "Name, vehicle type and base fare are required.",
      });
      return;
    }

    const duplicate = await prisma.tariff.findUnique({
      where: {
        name_vehicleType: {
          name,
          vehicleType,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      response.status(409).json({
        success: false,
        message: "A tariff already exists with this name and vehicle type.",
      });
      return;
    }

    const tariff = await prisma.tariff.create({
      data: {
        name,
        vehicleType,
        baseFare,
        active,
        vatApplicable,
      },
      include: tariffInclude,
    });

    response.status(201).json({
      success: true,
      tariff: serialiseTariff(tariff),
    });
  } catch (error) {
    console.error("POST /api/admin/tariffs failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to create tariff.",
    });
  }
});

router.patch("/:id", async (request, response) => {
  try {
    const existing = await prisma.tariff.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Tariff not found.",
      });
      return;
    }

    const name =
      request.body.name !== undefined
        ? normaliseString(request.body.name)
        : undefined;
    const vehicleType =
      request.body.vehicleType !== undefined
        ? normaliseString(request.body.vehicleType)
        : undefined;
    const baseFare = normaliseDecimal(request.body.baseFare, "Base fare");
    const active = normaliseBoolean(request.body.active);
    const vatApplicable = normaliseBoolean(request.body.vatApplicable);

    if (request.body.name !== undefined && !name) {
      response.status(400).json({
        success: false,
        message: "Tariff name cannot be empty.",
      });
      return;
    }

    if (request.body.vehicleType !== undefined && !vehicleType) {
      response.status(400).json({
        success: false,
        message: "Vehicle type cannot be empty.",
      });
      return;
    }

    const nextName = name ?? existing.name;
    const nextVehicleType = vehicleType ?? existing.vehicleType;

    if (
      nextName !== existing.name ||
      nextVehicleType !== existing.vehicleType
    ) {
      const duplicate = await prisma.tariff.findUnique({
        where: {
          name_vehicleType: {
            name: nextName,
            vehicleType: nextVehicleType,
          },
        },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== existing.id) {
        response.status(409).json({
          success: false,
          message: "Another tariff already uses this name and vehicle type.",
        });
        return;
      }
    }

    const tariff = await prisma.tariff.update({
      where: { id: existing.id },
      data: {
        name,
        vehicleType,
        baseFare,
        active,
        vatApplicable,
      },
      include: tariffInclude,
    });

    response.json({
      success: true,
      tariff: serialiseTariff(tariff),
    });
  } catch (error) {
    console.error("PATCH /api/admin/tariffs/:id failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to update tariff.",
    });
  }
});

router.delete("/:id", async (request, response) => {
  try {
    const existing = await prisma.tariff.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Tariff not found.",
      });
      return;
    }

    await prisma.tariff.delete({
      where: { id: existing.id },
    });

    response.json({
      success: true,
      message: "Tariff deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/tariffs/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete tariff.",
    });
  }
});

router.post("/:tariffId/mileage-bands", async (request, response) => {
  try {
    const tariff = await prisma.tariff.findUnique({
      where: { id: request.params.tariffId },
      select: { id: true },
    });

    if (!tariff) {
      response.status(404).json({
        success: false,
        message: "Tariff not found.",
      });
      return;
    }

    const minimumMiles = normaliseDecimal(
      request.body.minimumMiles,
      "Minimum miles",
    );
    const maximumMiles = normaliseNullableDecimal(
      request.body.maximumMiles,
      "Maximum miles",
    );
    const ratePerMile = normaliseDecimal(
      request.body.ratePerMile,
      "Rate per mile",
    );

    if (minimumMiles === undefined || ratePerMile === undefined) {
      response.status(400).json({
        success: false,
        message: "Minimum miles and rate per mile are required.",
      });
      return;
    }

    if (
      maximumMiles !== null &&
      maximumMiles !== undefined &&
      maximumMiles.lessThanOrEqualTo(minimumMiles)
    ) {
      response.status(400).json({
        success: false,
        message: "Maximum miles must be greater than minimum miles.",
      });
      return;
    }

    const band = await prisma.mileageBand.create({
      data: {
        tariffId: tariff.id,
        minimumMiles,
        maximumMiles,
        ratePerMile,
      },
    });

    response.status(201).json({
      success: true,
      band: {
        ...band,
        minimumMiles: band.minimumMiles.toString(),
        maximumMiles: band.maximumMiles?.toString() ?? null,
        ratePerMile: band.ratePerMile.toString(),
      },
    });
  } catch (error) {
    console.error(
      "POST /api/admin/tariffs/:tariffId/mileage-bands failed",
      error,
    );
    response.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create mileage band.",
    });
  }
});

router.patch("/mileage-bands/:id", async (request, response) => {
  try {
    const existing = await prisma.mileageBand.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Mileage band not found.",
      });
      return;
    }

    const minimumMiles = normaliseDecimal(
      request.body.minimumMiles,
      "Minimum miles",
    );
    const maximumMiles = normaliseNullableDecimal(
      request.body.maximumMiles,
      "Maximum miles",
    );
    const ratePerMile = normaliseDecimal(
      request.body.ratePerMile,
      "Rate per mile",
    );

    const nextMinimumMiles = minimumMiles ?? existing.minimumMiles;
    const nextMaximumMiles =
      maximumMiles === undefined ? existing.maximumMiles : maximumMiles;

    if (
      nextMaximumMiles !== null &&
      nextMaximumMiles.lessThanOrEqualTo(nextMinimumMiles)
    ) {
      response.status(400).json({
        success: false,
        message: "Maximum miles must be greater than minimum miles.",
      });
      return;
    }

    const band = await prisma.mileageBand.update({
      where: { id: existing.id },
      data: {
        minimumMiles,
        maximumMiles,
        ratePerMile,
      },
    });

    response.json({
      success: true,
      band: {
        ...band,
        minimumMiles: band.minimumMiles.toString(),
        maximumMiles: band.maximumMiles?.toString() ?? null,
        ratePerMile: band.ratePerMile.toString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/tariffs/mileage-bands/:id failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update mileage band.",
    });
  }
});

router.delete("/mileage-bands/:id", async (request, response) => {
  try {
    const existing = await prisma.mileageBand.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Mileage band not found.",
      });
      return;
    }

    await prisma.mileageBand.delete({
      where: { id: existing.id },
    });

    response.json({
      success: true,
      message: "Mileage band deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/tariffs/mileage-bands/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete mileage band.",
    });
  }
});

router.post("/:tariffId/charges", async (request, response) => {
  try {
    const tariff = await prisma.tariff.findUnique({
      where: { id: request.params.tariffId },
      select: { id: true },
    });

    if (!tariff) {
      response.status(404).json({
        success: false,
        message: "Tariff not found.",
      });
      return;
    }

    const type = request.body.type;
    const name = normaliseString(request.body.name);
    const calculation = request.body.calculation;
    const amount = normaliseDecimal(request.body.amount, "Charge amount");
    const active =
      normaliseBoolean(request.body.active) === undefined
        ? true
        : normaliseBoolean(request.body.active);
    const vatApplicable =
      normaliseBoolean(request.body.vatApplicable) === undefined
        ? true
        : normaliseBoolean(request.body.vatApplicable);

    if (!isChargeType(type)) {
      response.status(400).json({
        success: false,
        message: "Select a valid charge type.",
      });
      return;
    }

    if (!name) {
      response.status(400).json({
        success: false,
        message: "Charge name is required.",
      });
      return;
    }

    if (!isChargeCalculation(calculation)) {
      response.status(400).json({
        success: false,
        message: "Select a valid charge calculation.",
      });
      return;
    }

    if (amount === undefined) {
      response.status(400).json({
        success: false,
        message: "Charge amount is required.",
      });
      return;
    }

    const charge = await prisma.tariffCharge.create({
      data: {
        tariffId: tariff.id,
        type,
        name,
        calculation,
        amount,
        active,
        vatApplicable,
      },
    });

    response.status(201).json({
      success: true,
      charge: {
        ...charge,
        amount: charge.amount.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/admin/tariffs/:tariffId/charges failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to create charge.",
    });
  }
});

router.patch("/charges/:id", async (request, response) => {
  try {
    const existing = await prisma.tariffCharge.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Tariff charge not found.",
      });
      return;
    }

    const type =
      request.body.type !== undefined ? request.body.type : undefined;
    const name =
      request.body.name !== undefined
        ? normaliseString(request.body.name)
        : undefined;
    const calculation =
      request.body.calculation !== undefined
        ? request.body.calculation
        : undefined;
    const amount = normaliseDecimal(request.body.amount, "Charge amount");
    const active = normaliseBoolean(request.body.active);
    const vatApplicable = normaliseBoolean(request.body.vatApplicable);

    if (type !== undefined && !isChargeType(type)) {
      response.status(400).json({
        success: false,
        message: "Select a valid charge type.",
      });
      return;
    }

    if (request.body.name !== undefined && !name) {
      response.status(400).json({
        success: false,
        message: "Charge name cannot be empty.",
      });
      return;
    }

    if (
      calculation !== undefined &&
      !isChargeCalculation(calculation)
    ) {
      response.status(400).json({
        success: false,
        message: "Select a valid charge calculation.",
      });
      return;
    }

    const charge = await prisma.tariffCharge.update({
      where: { id: existing.id },
      data: {
        type,
        name,
        calculation,
        amount,
        active,
        vatApplicable,
      },
    });

    response.json({
      success: true,
      charge: {
        ...charge,
        amount: charge.amount.toString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/tariffs/charges/:id failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to update charge.",
    });
  }
});

router.delete("/charges/:id", async (request, response) => {
  try {
    const existing = await prisma.tariffCharge.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Tariff charge not found.",
      });
      return;
    }

    await prisma.tariffCharge.delete({
      where: { id: existing.id },
    });

    response.json({
      success: true,
      message: "Tariff charge deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/tariffs/charges/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete charge.",
    });
  }
});

export default router;