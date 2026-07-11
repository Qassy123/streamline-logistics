import { Router, type Request, type Response } from "express";
import { DiscountType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

const discountTypes = Object.values(DiscountType);

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

function normaliseNullableString(value: unknown): string | null | undefined {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normaliseDecimal(
  value: unknown,
  fieldName: string,
): Prisma.Decimal | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid non-negative number.`);
  }

  return new Prisma.Decimal(parsed);
}

function normaliseNullableDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid date.");
  }

  return parsed;
}

function isDiscountType(value: unknown): value is DiscountType {
  return (
    typeof value === "string" &&
    discountTypes.includes(value as DiscountType)
  );
}

function serialiseRule<
  T extends {
    value: Prisma.Decimal;
  },
>(rule: T) {
  return {
    ...rule,
    value: rule.value.toString(),
  };
}

router.get("/customers", async (_request, response) => {
  try {
    const customers = await prisma.user.findMany({
      orderBy: [{ companyName: "asc" }, { name: "asc" }],
      take: 500,
      select: {
        id: true,
        accountNumber: true,
        name: true,
        companyName: true,
        email: true,
      },
    });

    response.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("GET /api/admin/discounts/customers failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load customers.",
    });
  }
});

router.get("/", async (request, response) => {
  try {
    const search = normaliseString(request.query.search);
    const active = normaliseString(request.query.active);
    const type = normaliseString(request.query.type);
    const customerId = normaliseString(request.query.customerId);

    if (type && !isDiscountType(type)) {
      response.status(400).json({
        success: false,
        message: "Invalid discount type.",
      });
      return;
    }

    const where: Prisma.DiscountRuleWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    if (active === "true") {
      where.active = true;
    } else if (active === "false") {
      where.active = false;
    }

    if (type) {
      where.type = type as DiscountType;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const [rules, total, activeCount, inactiveCount] = await Promise.all([
      prisma.discountRule.findMany({
        where,
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
      prisma.discountRule.count(),
      prisma.discountRule.count({ where: { active: true } }),
      prisma.discountRule.count({ where: { active: false } }),
    ]);

    const customerIds = Array.from(
      new Set(
        rules
          .map((rule) => rule.customerId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: customerIds,
            },
          },
          select: {
            id: true,
            accountNumber: true,
            name: true,
            companyName: true,
            email: true,
          },
        })
      : [];

    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    response.json({
      success: true,
      rules: rules.map((rule) => ({
        ...serialiseRule(rule),
        customer: rule.customerId
          ? customerMap.get(rule.customerId) ?? null
          : null,
      })),
      summary: {
        total,
        active: activeCount,
        inactive: inactiveCount,
      },
      options: {
        discountTypes,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/discounts failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load discount rules.",
    });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const rule = await prisma.discountRule.findUnique({
      where: { id: request.params.id },
    });

    if (!rule) {
      response.status(404).json({
        success: false,
        message: "Discount rule not found.",
      });
      return;
    }

    const customer = rule.customerId
      ? await prisma.user.findUnique({
          where: { id: rule.customerId },
          select: {
            id: true,
            accountNumber: true,
            name: true,
            companyName: true,
            email: true,
          },
        })
      : null;

    response.json({
      success: true,
      rule: {
        ...serialiseRule(rule),
        customer,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/discounts/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load discount rule.",
    });
  }
});

router.post("/", async (request, response) => {
  try {
    const name = normaliseString(request.body.name);
    const type = request.body.type;
    const value = normaliseDecimal(request.body.value, "Discount value");
    const active =
      normaliseBoolean(request.body.active) === undefined
        ? true
        : normaliseBoolean(request.body.active);
    const customerId = normaliseNullableString(request.body.customerId);
    const startsAt = normaliseNullableDate(request.body.startsAt);
    const endsAt = normaliseNullableDate(request.body.endsAt);
    const notes = normaliseNullableString(request.body.notes);

    if (!name) {
      response.status(400).json({
        success: false,
        message: "Discount name is required.",
      });
      return;
    }

    if (!isDiscountType(type)) {
      response.status(400).json({
        success: false,
        message: "Select a valid discount type.",
      });
      return;
    }

    if (value === undefined) {
      response.status(400).json({
        success: false,
        message: "Discount value is required.",
      });
      return;
    }

    if (
      (type === DiscountType.PERCENTAGE ||
        type === DiscountType.CUSTOMER_LOYALTY ||
        type === DiscountType.MONTHLY) &&
      value.greaterThan(100)
    ) {
      response.status(400).json({
        success: false,
        message: "Percentage-based discounts cannot exceed 100.",
      });
      return;
    }

    if (startsAt && endsAt && endsAt <= startsAt) {
      response.status(400).json({
        success: false,
        message: "End date must be later than start date.",
      });
      return;
    }

    if (customerId) {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true },
      });

      if (!customer) {
        response.status(400).json({
          success: false,
          message: "Selected customer does not exist.",
        });
        return;
      }
    }

    const rule = await prisma.discountRule.create({
      data: {
        name,
        type,
        value,
        active,
        customerId,
        startsAt,
        endsAt,
        notes,
      },
    });

    response.status(201).json({
      success: true,
      rule: serialiseRule(rule),
    });
  } catch (error) {
    console.error("POST /api/admin/discounts failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create discount rule.",
    });
  }
});

router.patch("/:id", async (request, response) => {
  try {
    const existing = await prisma.discountRule.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Discount rule not found.",
      });
      return;
    }

    const name =
      request.body.name !== undefined
        ? normaliseString(request.body.name)
        : undefined;
    const type =
      request.body.type !== undefined ? request.body.type : undefined;
    const value = normaliseDecimal(request.body.value, "Discount value");
    const active = normaliseBoolean(request.body.active);
    const customerId = normaliseNullableString(request.body.customerId);
    const startsAt = normaliseNullableDate(request.body.startsAt);
    const endsAt = normaliseNullableDate(request.body.endsAt);
    const notes = normaliseNullableString(request.body.notes);

    if (request.body.name !== undefined && !name) {
      response.status(400).json({
        success: false,
        message: "Discount name cannot be empty.",
      });
      return;
    }

    if (type !== undefined && !isDiscountType(type)) {
      response.status(400).json({
        success: false,
        message: "Select a valid discount type.",
      });
      return;
    }

    const nextType = (type ?? existing.type) as DiscountType;
    const nextValue = value ?? existing.value;
    const nextStartsAt =
      startsAt === undefined ? existing.startsAt : startsAt;
    const nextEndsAt = endsAt === undefined ? existing.endsAt : endsAt;

    if (
      (nextType === DiscountType.PERCENTAGE ||
        nextType === DiscountType.CUSTOMER_LOYALTY ||
        nextType === DiscountType.MONTHLY) &&
      nextValue.greaterThan(100)
    ) {
      response.status(400).json({
        success: false,
        message: "Percentage-based discounts cannot exceed 100.",
      });
      return;
    }

    if (nextStartsAt && nextEndsAt && nextEndsAt <= nextStartsAt) {
      response.status(400).json({
        success: false,
        message: "End date must be later than start date.",
      });
      return;
    }

    if (customerId) {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true },
      });

      if (!customer) {
        response.status(400).json({
          success: false,
          message: "Selected customer does not exist.",
        });
        return;
      }
    }

    const rule = await prisma.discountRule.update({
      where: { id: existing.id },
      data: {
        name,
        type,
        value,
        active,
        customerId,
        startsAt,
        endsAt,
        notes,
      },
    });

    response.json({
      success: true,
      rule: serialiseRule(rule),
    });
  } catch (error) {
    console.error("PATCH /api/admin/discounts/:id failed", error);
    response.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update discount rule.",
    });
  }
});

router.delete("/:id", async (request, response) => {
  try {
    const existing = await prisma.discountRule.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Discount rule not found.",
      });
      return;
    }

    await prisma.discountRule.delete({
      where: { id: existing.id },
    });

    response.json({
      success: true,
      message: "Discount rule deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/discounts/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete discount rule.",
    });
  }
});

export default router;