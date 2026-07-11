import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const ALLOWED_INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

type InvoiceStatusValue = (typeof ALLOWED_INVOICE_STATUSES)[number];

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const cleanValue = getString(value);
  return cleanValue || null;
}

function getNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function isInvoiceStatus(value: string): value is InvoiceStatusValue {
  return ALLOWED_INVOICE_STATUSES.includes(value as InvoiceStatusValue);
}

function requireAdmin(req: { headers: { [key: string]: unknown } }) {
  const configuredAdminKey = process.env.ADMIN_API_KEY?.trim();
  const suppliedAdminKey = getString(req.headers["x-admin-key"]);

  if (!configuredAdminKey) {
    return { authorised: false, status: 503, error: "Admin API key is not configured." };
  }

  if (!suppliedAdminKey || suppliedAdminKey !== configuredAdminKey) {
    return { authorised: false, status: 401, error: "Admin access denied." };
  }

  return { authorised: true, status: 200, error: "" };
}

function invoiceInclude() {
  return {
    user: true,
    booking: {
      include: {
        quote: true,
        payments: true,
        vehicle: true,
        driver: true,
        pod: true,
      },
    },
  } satisfies Prisma.InvoiceInclude;
}

router.get("/admin/list", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const page = getPositiveInteger(req.query.page, 1);
    const pageSize = Math.min(
      getPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const search = getString(req.query.search);
    const status = getString(req.query.status).toUpperCase();
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);
    const overdueOnly = getString(req.query.overdueOnly).toLowerCase() === "true";

    const where: Prisma.InvoiceWhereInput = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        {
          booking: {
            is: {
              reference: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          user: {
            is: {
              name: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          user: {
            is: {
              companyName: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          user: {
            is: {
              email: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          user: {
            is: {
              accountNumber: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      if (!isInvoiceStatus(status)) {
        return res.status(400).json({ error: "Invalid invoice status filter." });
      }

      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    if (overdueOnly) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ["PAID", "CANCELLED"] };
    }

    const [invoices, total, statusTotals, aggregateTotals] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: invoiceInclude(),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: { subtotal: true, vatAmount: true, total: true },
      }),
    ]);

    res.json({
      invoices,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus: Object.fromEntries(
          statusTotals.map((item) => [item.status, item._count._all]),
        ),
        totals: {
          subtotal: aggregateTotals._sum.subtotal || 0,
          vatAmount: aggregateTotals._sum.vatAmount || 0,
          total: aggregateTotals._sum.total || 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin invoice list error:", error);
    res.status(500).json({ error: "Unable to load invoices." });
  }
});

router.get("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: invoiceInclude(),
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    res.json({ invoice });
  } catch (error) {
    console.error("Admin invoice detail error:", error);
    res.status(500).json({ error: "Unable to load invoice." });
  }
});

router.patch("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    const statusValue = getString(req.body.status).toUpperCase();
    const subtotal = getNumber(req.body.subtotal);
    const vatAmount = getNumber(req.body.vatAmount);
    const total = getNumber(req.body.total);
    const dueDateValue = getOptionalString(req.body.dueDate);

    if (statusValue && !isInvoiceStatus(statusValue)) {
      return res.status(400).json({ error: "Invalid invoice status." });
    }

    if (req.body.subtotal !== undefined && (subtotal === null || subtotal < 0)) {
      return res.status(400).json({ error: "Subtotal must be zero or greater." });
    }

    if (req.body.vatAmount !== undefined && (vatAmount === null || vatAmount < 0)) {
      return res.status(400).json({ error: "VAT amount must be zero or greater." });
    }

    if (req.body.total !== undefined && (total === null || total < 0)) {
      return res.status(400).json({ error: "Invoice total must be zero or greater." });
    }

    const nextStatus = statusValue
      ? (statusValue as InvoiceStatusValue)
      : undefined;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: nextStatus,
        subtotal:
          req.body.subtotal !== undefined ? (subtotal as number) : undefined,
        vatAmount:
          req.body.vatAmount !== undefined ? (vatAmount as number) : undefined,
        total:
          req.body.total !== undefined ? (total as number) : undefined,
        dueDate:
          req.body.dueDate !== undefined
            ? dueDateValue
              ? new Date(dueDateValue)
              : null
            : undefined,
        paidAt:
          nextStatus === "PAID"
            ? existingInvoice.paidAt || new Date()
            : nextStatus
              ? null
              : undefined,
      },
      include: invoiceInclude(),
    });

    res.json({ success: true, invoice });
  } catch (error) {
    console.error("Admin invoice update error:", error);
    res.status(500).json({ error: "Unable to update invoice." });
  }
});

router.post("/admin", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const bookingId = getString(req.body.bookingId);
    const userId = getOptionalString(req.body.userId);
    const invoiceNumber = getString(req.body.invoiceNumber);
    const subtotal = getNumber(req.body.subtotal);
    const vatAmount = getNumber(req.body.vatAmount);
    const total = getNumber(req.body.total);
    const dueDate = getOptionalString(req.body.dueDate);

    if (!bookingId || !invoiceNumber) {
      return res.status(400).json({
        error: "Booking and invoice number are required.",
      });
    }

    if (
      subtotal === null ||
      vatAmount === null ||
      total === null ||
      subtotal < 0 ||
      vatAmount < 0 ||
      total < 0
    ) {
      return res.status(400).json({
        error: "Invoice amounts must be valid non-negative numbers.",
      });
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ invoiceNumber }, { bookingId }],
      },
    });

    if (existingInvoice) {
      return res.status(409).json({
        error: "An invoice already exists with this number or for this booking.",
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        bookingId,
        userId,
        status: "DRAFT",
        subtotal,
        vatAmount,
        total,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: invoiceInclude(),
    });

    res.status(201).json({ success: true, invoice });
  } catch (error) {
    console.error("Admin invoice creation error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "An invoice already exists with this unique value.",
      });
    }

    res.status(500).json({ error: "Unable to create invoice." });
  }
});

export default router;