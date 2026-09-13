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
    return {
      authorised: false,
      status: 503,
      error: "Admin API key is not configured.",
    };
  }

  if (!suppliedAdminKey || suppliedAdminKey !== configuredAdminKey) {
    return { authorised: false, status: 401, error: "Admin access denied." };
  }

  return { authorised: true, status: 200, error: "" };
}

function invoiceInclude() {
  return {
    user: true,
    adjustments: {
      orderBy: { createdAt: "asc" },
    },
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

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendInvoiceEmail(input: {
  to: string;
  invoiceNumber: string;
  accountName: string;
  bookingReference: string;
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  dueDate: Date | null;
  adjustments: Array<{
    sourceType: string;
    name: string;
    calculation: string | null;
    quantity: Prisma.Decimal;
    unitAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
  }>;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!fromEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL or EMAIL_FROM must be configured before invoices can be sent.",
    );
  }

  const money = (value: Prisma.Decimal) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(Number(value.toString()));

  const dueText = input.dueDate
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(input.dueDate)
    : "Not specified";

  const adjustmentNetTotal = input.adjustments.reduce(
    (sum, adjustment) => sum.add(adjustment.netAmount),
    new Prisma.Decimal(0),
  );

  const baseSubtotal = roundMoney(input.subtotal.sub(adjustmentNetTotal));

  const adjustmentRows = input.adjustments
    .map((adjustment) => {
      const isDiscount = adjustment.sourceType === "DISCOUNT";
      const quantity = Number(adjustment.quantity.toString());
      const showQuantity =
        quantity !== 1 &&
        ["PER_MILE", "PER_STOP", "PER_HOUR"].includes(
          adjustment.calculation || "",
        );

      const detail = isDiscount
        ? "Discount"
        : showQuantity
          ? `Additional charge · Qty ${quantity}`
          : "Additional charge";

      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">
            <strong>${escapeHtml(adjustment.name)}</strong>
            <div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(detail)}</div>
          </td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">
            <strong>${money(adjustment.netAmount)}</strong>
          </td>
        </tr>
      `;
    })
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: `Invoice ${input.invoiceNumber} - Streamline Logistics Group`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
          <h2 style="margin:0 0 16px">Streamline Logistics Group</h2>
          <p>Dear ${escapeHtml(input.accountName)},</p>
          <p>Please find the details of invoice <strong>${escapeHtml(
            input.invoiceNumber,
          )}</strong> for booking <strong>${escapeHtml(
            input.bookingReference,
          )}</strong>.</p>

          <table style="border-collapse:collapse;width:100%;max-width:560px;margin:20px 0">
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0">
                <strong>Base service</strong>
              </td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">
                <strong>${money(baseSubtotal)}</strong>
              </td>
            </tr>
            ${adjustmentRows}
            <tr>
              <td style="padding:10px 8px;border-top:2px solid #cbd5e1;border-bottom:1px solid #e2e8f0">Subtotal</td>
              <td style="padding:10px 8px;border-top:2px solid #cbd5e1;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${money(input.subtotal)}</strong></td>
            </tr>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0">VAT</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${money(input.vatAmount)}</strong></td>
            </tr>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0">Total</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${money(input.total)}</strong></td>
            </tr>
            <tr>
              <td style="padding:8px">Due date</td>
              <td style="padding:8px;text-align:right"><strong>${escapeHtml(dueText)}</strong></td>
            </tr>
          </table>

          <p>If you have any questions about this invoice, please contact Streamline Logistics Group.</p>
        </div>
      `,
    }),
  });

  const payload = (await response.json()) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || "Resend rejected the invoice email.",
    );
  }

  return payload.id || null;
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
    const overdueOnly =
      getString(req.query.overdueOnly).toLowerCase() === "true";

    const where: Prisma.InvoiceWhereInput = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        {
          booking: {
            is: { reference: { contains: search, mode: "insensitive" } },
          },
        },
        { user: { is: { name: { contains: search, mode: "insensitive" } } } },
        {
          user: {
            is: { companyName: { contains: search, mode: "insensitive" } },
          },
        },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
        {
          user: {
            is: { accountNumber: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      if (!isInvoiceStatus(status)) {
        return res
          .status(400)
          .json({ error: "Invalid invoice status filter." });
      }
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom)
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo)
        where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
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

router.get("/admin/draft-candidates", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        invoices: { none: {} },
        status: { notIn: ["CANCELLED", "EXPIRED", "PENDING_PAYMENT"] },
      },
      orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        reference: true,
        status: true,
        totalPrice: true,
        collectionDate: true,
        collectionAddress: true,
        deliveryAddress: true,
        userId: true,
        user: {
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            name: true,
            companyName: true,
            email: true,
            tradeAccount: {
              select: {
                paymentTermsDays: true,
              },
            },
          },
        },
        quote: {
          select: {
            vatAmount: true,
            totalPrice: true,
          },
        },
      },
    });

    res.json({ bookings });
  } catch (error) {
    console.error("Admin draft invoice candidates error:", error);
    res.status(500).json({ error: "Unable to load uninvoiced bookings." });
  }
});

router.post("/admin/draft", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const bookingId = getString(req.body.bookingId);

    if (!bookingId) {
      return res.status(400).json({ error: "Select a booking." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        invoices: {
          select: { id: true, invoiceNumber: true },
        },
        quote: {
          select: {
            vatAmount: true,
            totalPrice: true,
          },
        },
        user: {
          select: {
            id: true,
            accountType: true,
            tradeAccount: {
              select: {
                paymentTermsDays: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (
      ["CANCELLED", "EXPIRED", "PENDING_PAYMENT"].includes(booking.status)
    ) {
      return res.status(400).json({
        error: "This booking is not currently eligible for a draft invoice.",
      });
    }

    if (booking.invoices.length > 0) {
      return res.status(409).json({
        error: `Invoice ${booking.invoices[0].invoiceNumber} already exists for this booking.`,
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const settings = await transaction.companySettings.findFirst();

      if (!settings) {
        throw new Error(
          "Company settings must be configured before draft invoices can be created.",
        );
      }

      const total = roundMoney(new Prisma.Decimal(booking.totalPrice));
      const vatRate = new Prisma.Decimal(settings.vatRate);

      const subtotal = vatRate.greaterThan(0)
        ? roundMoney(
            total.div(new Prisma.Decimal(1).add(vatRate.div(100))),
          )
        : total;

      const vatAmount = roundMoney(total.sub(subtotal));

      const invoiceNumber = `${settings.invoicePrefix}-${String(
        settings.nextInvoiceNumber,
      ).padStart(6, "0")}`;

      const paymentTermsDays =
        booking.user?.accountType === "TRADE"
          ? booking.user.tradeAccount?.paymentTermsDays ??
            settings.paymentTermsDays
          : settings.paymentTermsDays;

      const dueDate = new Date();
      dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

      const invoice = await transaction.invoice.create({
        data: {
          invoiceNumber,
          bookingId: booking.id,
          userId: booking.userId,
          status: "DRAFT",
          subtotal,
          vatAmount,
          total,
          dueDate,
          paymentTerms: `${paymentTermsDays} days`,
          customerReference: booking.customerReference,
          purchaseOrderNumber: booking.purchaseOrderNumber,
        },
        include: invoiceInclude(),
      });

      await transaction.companySettings.update({
        where: { id: settings.id },
        data: {
          nextInvoiceNumber: {
            increment: 1,
          },
        },
      });

      return invoice;
    });

    res.status(201).json({
      success: true,
      message: `Draft invoice ${result.invoiceNumber} created.`,
      invoice: result,
    });
  } catch (error) {
    console.error("Admin draft invoice creation error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error:
          "The invoice number is already in use. Refresh and try again.",
      });
    }

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create draft invoice.",
    });
  }
});

router.get("/admin/:id/options", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        error:
          "Additional charges and discounts can only be changed while an invoice is pending.",
      });
    }

    const now = new Date();

    const [charges, discounts] = await Promise.all([
      prisma.tariffCharge.findMany({
        where: {
          active: true,
          tariffId: null,
        },
        orderBy: [{ name: "asc" }],
      }),
      prisma.discountRule.findMany({
        where: {
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            {
              OR: [
                { customerId: null },
                ...(invoice.userId ? [{ customerId: invoice.userId }] : []),
              ],
            },
          ],
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    res.json({
      charges: charges.map((charge) => ({
        id: charge.id,
        label: charge.name,
        name: charge.name,
        calculation: charge.calculation,
        amount: charge.amount.toString(),
        vatApplicable: charge.vatApplicable,
      })),
      discounts: discounts.map((discount) => ({
        id: discount.id,
        label:
          discount.type === "FIXED_AMOUNT"
            ? `${discount.name} · £${Number(discount.value).toFixed(2)}`
            : `${discount.name} · ${Number(discount.value)}%`,
        name: discount.name,
        type: discount.type,
        value: discount.value.toString(),
        customerId: discount.customerId,
      })),
    });
  } catch (error) {
    console.error("Admin invoice options error:", error);
    res
      .status(500)
      .json({ error: "Unable to load invoice adjustment options." });
  }
});

router.post("/admin/:id/adjustments", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const sourceType = getString(req.body.sourceType).toUpperCase();
    const sourceId = getString(req.body.sourceId);
    const requestedQuantity = getNumber(req.body.quantity) ?? 1;

    if (!["CHARGE", "DISCOUNT"].includes(sourceType)) {
      return res.status(400).json({
        error: "Adjustment type must be CHARGE or DISCOUNT.",
      });
    }

    if (!sourceId) {
      return res.status(400).json({
        error: "Select an additional charge or discount.",
      });
    }

    if (requestedQuantity <= 0) {
      return res.status(400).json({
        error: "Quantity must be greater than zero.",
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { adjustments: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        error: "Only pending invoices can be changed.",
      });
    }

    let name = "";
    let calculation = "";
    let quantity = new Prisma.Decimal(1);
    let unitAmount = new Prisma.Decimal(0);
    let netAmount = new Prisma.Decimal(0);
    let vatApplicable = false;

    if (sourceType === "CHARGE") {
      const charge = await prisma.tariffCharge.findFirst({
        where: {
          id: sourceId,
          active: true,
          tariffId: null,
        },
      });

      if (!charge) {
        return res.status(404).json({
          error: "The selected additional charge is unavailable.",
        });
      }

      name = charge.name;
      calculation = charge.calculation;
      unitAmount = charge.amount;
      vatApplicable = charge.vatApplicable;

      if (
        ["PER_MILE", "PER_STOP", "PER_HOUR"].includes(charge.calculation)
      ) {
        quantity = new Prisma.Decimal(requestedQuantity);
        netAmount = roundMoney(charge.amount.mul(quantity));
      } else if (charge.calculation === "PERCENTAGE") {
        netAmount = roundMoney(invoice.subtotal.mul(charge.amount).div(100));
      } else {
        netAmount = roundMoney(charge.amount);
      }
    } else {
      const now = new Date();
      const discount = await prisma.discountRule.findFirst({
        where: {
          id: sourceId,
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            {
              OR: [
                { customerId: null },
                ...(invoice.userId ? [{ customerId: invoice.userId }] : []),
              ],
            },
          ],
        },
      });

      if (!discount) {
        return res.status(404).json({
          error: "The selected discount is unavailable for this invoice.",
        });
      }

      name = discount.name;
      calculation = discount.type;
      unitAmount = discount.value;
      vatApplicable = invoice.vatAmount.greaterThan(0);

      if (discount.type === "FIXED_AMOUNT") {
        const cappedValue = discount.value.greaterThan(invoice.subtotal)
          ? invoice.subtotal
          : discount.value;
        netAmount = roundMoney(cappedValue.negated());
      } else {
        netAmount = roundMoney(
          invoice.subtotal.mul(discount.value).div(100).negated(),
        );
      }
    }

    const settings = await prisma.companySettings.findFirst({
      select: { vatRate: true },
    });

    const vatRate = settings?.vatRate ?? new Prisma.Decimal(20);
    const vatAmount = vatApplicable
      ? roundMoney(netAmount.mul(vatRate).div(100))
      : new Prisma.Decimal(0);

    const nextSubtotal = roundMoney(invoice.subtotal.add(netAmount));
    const nextVat = roundMoney(invoice.vatAmount.add(vatAmount));
    const nextTotal = roundMoney(nextSubtotal.add(nextVat));

    if (
      nextSubtotal.lessThan(0) ||
      nextVat.lessThan(0) ||
      nextTotal.lessThan(0)
    ) {
      return res.status(400).json({
        error: "This adjustment would reduce the invoice below zero.",
      });
    }

    const updatedInvoice = await prisma.$transaction(async (transaction) => {
      await transaction.invoiceAdjustment.create({
        data: {
          invoiceId: invoice.id,
          sourceType,
          sourceId,
          name,
          calculation,
          quantity,
          unitAmount,
          netAmount,
          vatApplicable,
          vatAmount,
        },
      });

      return transaction.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: nextSubtotal,
          vatAmount: nextVat,
          total: nextTotal,
        },
        include: invoiceInclude(),
      });
    });

    res.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error("Admin invoice adjustment error:", error);
    res.status(500).json({ error: "Unable to update invoice charges." });
  }
});

router.delete("/admin/:id/adjustments/:adjustmentId", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        error: "Only pending invoices can be changed.",
      });
    }

    const adjustment = await prisma.invoiceAdjustment.findFirst({
      where: {
        id: req.params.adjustmentId,
        invoiceId: invoice.id,
      },
    });

    if (!adjustment) {
      return res.status(404).json({
        error: "Invoice adjustment not found.",
      });
    }

    const nextSubtotal = roundMoney(
      invoice.subtotal.sub(adjustment.netAmount),
    );
    const nextVat = roundMoney(invoice.vatAmount.sub(adjustment.vatAmount));
    const nextTotal = roundMoney(nextSubtotal.add(nextVat));

    const updatedInvoice = await prisma.$transaction(async (transaction) => {
      await transaction.invoiceAdjustment.delete({
        where: { id: adjustment.id },
      });

      return transaction.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: nextSubtotal,
          vatAmount: nextVat,
          total: nextTotal,
        },
        include: invoiceInclude(),
      });
    });

    res.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error("Admin invoice adjustment removal error:", error);
    res.status(500).json({ error: "Unable to remove invoice adjustment." });
  }
});

router.post("/admin/:id/send", async (req, res) => {
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

    if (invoice.status !== "DRAFT") {
      return res.status(400).json({
        error: "Only a pending invoice can be sent.",
      });
    }

    if (!invoice.user?.email) {
      return res.status(400).json({
        error:
          "This invoice is not linked to a customer account with a primary email address.",
      });
    }

    const recipient = invoice.user.email;
    const accountName =
      invoice.user.companyName || invoice.user.name || recipient;

    let providerMessageId: string | null = null;

    try {
      providerMessageId = await sendInvoiceEmail({
        to: recipient,
        invoiceNumber: invoice.invoiceNumber,
        accountName,
        bookingReference: invoice.booking.reference,
        subtotal: invoice.subtotal,
        vatAmount: invoice.vatAmount,
        total: invoice.total,
        dueDate: invoice.dueDate,
        adjustments: invoice.adjustments.map((adjustment) => ({
          sourceType: adjustment.sourceType,
          name: adjustment.name,
          calculation: adjustment.calculation,
          quantity: adjustment.quantity,
          unitAmount: adjustment.unitAmount,
          netAmount: adjustment.netAmount,
          vatAmount: adjustment.vatAmount,
        })),
      });
    } catch (emailError) {
      await prisma.emailLog.create({
        data: {
          type: "INVOICE",
          status: "FAILED",
          recipient,
          subject: `Invoice ${invoice.invoiceNumber} - Streamline Logistics Group`,
          errorMessage:
            emailError instanceof Error
              ? emailError.message
              : "Invoice email failed.",
          userId: invoice.userId,
          bookingId: invoice.bookingId,
          invoiceId: invoice.id,
        },
      });

      throw emailError;
    }

    const updatedInvoice = await prisma.$transaction(async (transaction) => {
      await transaction.emailLog.create({
        data: {
          type: "INVOICE",
          status: "SENT",
          recipient,
          subject: `Invoice ${invoice.invoiceNumber} - Streamline Logistics Group`,
          providerMessageId,
          sentAt: new Date(),
          userId: invoice.userId,
          bookingId: invoice.bookingId,
          invoiceId: invoice.id,
        },
      });

      return transaction.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          issuedAt: invoice.issuedAt || new Date(),
        },
        include: invoiceInclude(),
      });
    });

    res.json({
      success: true,
      message: `Invoice sent to ${recipient}.`,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error("Admin invoice send error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to send invoice.",
    });
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

    if (
      req.body.subtotal !== undefined &&
      (subtotal === null || subtotal < 0)
    ) {
      return res
        .status(400)
        .json({ error: "Subtotal must be zero or greater." });
    }

    if (
      req.body.vatAmount !== undefined &&
      (vatAmount === null || vatAmount < 0)
    ) {
      return res
        .status(400)
        .json({ error: "VAT amount must be zero or greater." });
    }

    if (req.body.total !== undefined && (total === null || total < 0)) {
      return res
        .status(400)
        .json({ error: "Invoice total must be zero or greater." });
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
          req.body.vatAmount !== undefined
            ? (vatAmount as number)
            : undefined,
        total: req.body.total !== undefined ? (total as number) : undefined,
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
