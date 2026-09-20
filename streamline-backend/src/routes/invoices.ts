import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateAndStoreInvoicePdf, getStoredInvoicePdfBuffer } from "../lib/invoicePdf";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const ALLOWED_INVOICE_STATUSES = [
  "DRAFT",
  "FINALISED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "VOID",
  "CREDITED",
  "OVERDUE",
  "ISSUED",
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
    adjustments: { orderBy: { createdAt: "asc" } },
    lines: { orderBy: { createdAt: "asc" } },
    invoiceBookings: { orderBy: { bookingDate: "asc" } },
    allocations: { orderBy: { allocatedAt: "asc" }, include: { payment: true } },
    creditNotes: { orderBy: { createdAt: "asc" } },
    emailLogs: { orderBy: { createdAt: "asc" } },
    auditEvents: { orderBy: { createdAt: "asc" } },
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
  pdfBuffer?: Buffer | null;
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
      attachments: input.pdfBuffer
        ? [
            {
              filename: `${input.invoiceNumber}.pdf`,
              content: input.pdfBuffer.toString("base64"),
            },
          ]
        : undefined,
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


async function sendInvoiceReminderEmail(input: {
  to: string;
  invoiceNumber: string;
  accountName: string;
  dueDate: Date;
  outstanding: Prisma.Decimal;
  reminderType: "APPROACHING_DUE" | "DUE_TODAY" | "OVERDUE";
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error("Invoice reminder email is not configured.");
  }

  const heading =
    input.reminderType === "OVERDUE"
      ? "Invoice overdue"
      : input.reminderType === "DUE_TODAY"
        ? "Invoice due today"
        : "Invoice due soon";
  const dueText = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(input.dueDate);
  const outstandingText = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(input.outstanding));

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: `${heading}: ${input.invoiceNumber} - Streamline Logistics Group`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
          <h2>${escapeHtml(heading)}</h2>
          <p>Dear ${escapeHtml(input.accountName)},</p>
          <p>This is a reminder for invoice <strong>${escapeHtml(input.invoiceNumber)}</strong>.</p>
          <p><strong>Due date:</strong> ${escapeHtml(dueText)}<br />
          <strong>Outstanding:</strong> ${escapeHtml(outstandingText)}</p>
          <p>If payment has already been arranged, no further action is required.</p>
          <p>Streamline Logistics Group</p>
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
      payload.message || payload.error || "Resend rejected the reminder email.",
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
        invoiceBookings: { none: {} },
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
        invoiceBookings: {
          select: { id: true, invoice: { select: { invoiceNumber: true } } },
        },
        quote: {
          select: {
            vatAmount: true,
            totalPrice: true,
          },
        },
        user: {
          include: {
            tradeAccount: true,
            billingProfile: true,
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

    if (booking.invoiceBookings.length > 0) {
      return res.status(409).json({
        error: `Invoice ${booking.invoiceBookings[0].invoice.invoiceNumber} already includes this booking.`,
      });
    }

    // Trade accounts are billed as a 30-day cycle. When more than one
    // completed, uninvoiced booking falls inside the same cycle, the draft is
    // automatically consolidated. A single eligible booking remains a normal
    // single invoice.
    let cycleBookings = [
      {
        id: booking.id,
        totalPrice: booking.totalPrice,
        reference: booking.reference,
        collectionDate: booking.collectionDate,
        purchaseOrderNumber: booking.purchaseOrderNumber,
        collectionAddress: booking.collectionAddress,
        deliveryAddress: booking.deliveryAddress,
        vehicleType: booking.vehicleType,
        journeyType: booking.journeyType,
      },
    ];

    if (booking.user?.accountType === "TRADE" && booking.userId) {
      const cycleEnd = new Date(booking.collectionDate);
      cycleEnd.setUTCHours(23, 59, 59, 999);

      const cycleStart = new Date(cycleEnd);
      cycleStart.setUTCDate(cycleStart.getUTCDate() - 29);
      cycleStart.setUTCHours(0, 0, 0, 0);

      const tradeBookings = await prisma.booking.findMany({
        where: {
          userId: booking.userId,
          status: "COMPLETED",
          collectionDate: {
            gte: cycleStart,
            lte: cycleEnd,
          },
          invoices: { none: {} },
          invoiceBookings: { none: {} },
        },
        select: {
          id: true,
          totalPrice: true,
          reference: true,
          collectionDate: true,
          purchaseOrderNumber: true,
          collectionAddress: true,
          deliveryAddress: true,
          vehicleType: true,
          journeyType: true,
        },
        orderBy: [{ collectionDate: "asc" }, { createdAt: "asc" }],
      });

      if (tradeBookings.some((item) => item.id === booking.id)) {
        cycleBookings = tradeBookings;
      }
    }

    const shouldConsolidate =
      booking.user?.accountType === "TRADE" && cycleBookings.length > 1;

    const result = await prisma.$transaction(async (transaction) => {
      const settings = await transaction.companySettings.findFirst();

      if (!settings) {
        throw new Error(
          "Company settings must be configured before draft invoices can be created.",
        );
      }

      const vatRate = new Prisma.Decimal(settings.vatRate);
      const invoiceNumber = `${settings.invoicePrefix}-${String(
        settings.nextInvoiceNumber,
      ).padStart(6, "0")}`;

      const paymentTermsDays =
        booking.user?.accountType === "TRADE"
          ? booking.user.billingProfile?.paymentTermsDays ??
            booking.user.tradeAccount?.paymentTermsDays ??
            settings.paymentTermsDays
          : settings.paymentTermsDays;

      const dueDate = new Date();
      dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

      if (shouldConsolidate) {
        let subtotal = new Prisma.Decimal(0);
        let vatAmount = new Prisma.Decimal(0);
        let total = new Prisma.Decimal(0);

        const amounts = cycleBookings.map((item) => {
          const gross = roundMoney(new Prisma.Decimal(item.totalPrice));
          const net = vatRate.greaterThan(0)
            ? roundMoney(
                gross.div(new Prisma.Decimal(1).add(vatRate.div(100))),
              )
            : gross;
          const vat = roundMoney(gross.sub(net));

          subtotal = subtotal.add(net);
          vatAmount = vatAmount.add(vat);
          total = total.add(gross);

          return { booking: item, net, vat, gross };
        });

        const invoice = await transaction.invoice.create({
          data: {
            invoiceNumber,
            userId: booking.userId,
            status: "DRAFT",
            invoiceType: "CONSOLIDATED",
            subtotal: roundMoney(subtotal),
            vatAmount: roundMoney(vatAmount),
            total: roundMoney(total),
            dueDate,
            paymentTerms: `${paymentTermsDays} days`,
          },
        });

        for (const item of amounts) {
          await transaction.invoiceLine.create({
            data: {
              invoiceId: invoice.id,
              bookingId: item.booking.id,
              chargeType: "BASE_SERVICE",
              description: `Courier service · ${item.booking.reference}`,
              quantity: new Prisma.Decimal(1),
              unitPrice: item.net,
              netAmount: item.net,
              vatRate,
              vatAmount: item.vat,
              grossAmount: item.gross,
              bookingReference: item.booking.reference,
              sourceType: "BOOKING",
              sourceId: item.booking.id,
            },
          });

          await transaction.invoiceBooking.create({
            data: {
              invoiceId: invoice.id,
              bookingId: item.booking.id,
              bookingReference: item.booking.reference,
              bookingDate: item.booking.collectionDate,
              poReference: item.booking.purchaseOrderNumber,
              routeDescription: `${item.booking.collectionAddress} → ${item.booking.deliveryAddress}`,
              serviceDescription:
                item.booking.vehicleType ||
                item.booking.journeyType ||
                "Courier service",
              netAmount: item.net,
              vatAmount: item.vat,
              grossAmount: item.gross,
            },
          });
        }

        await transaction.invoiceAuditEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: "DRAFT_CREATED",
            description: `Automatic 30-day consolidated draft ${invoiceNumber} created for ${cycleBookings.length} bookings.`,
          },
        });

        await transaction.companySettings.update({
          where: { id: settings.id },
          data: { nextInvoiceNumber: { increment: 1 } },
        });

        return transaction.invoice.findUnique({
          where: { id: invoice.id },
          include: invoiceInclude(),
        });
      }

      const total = roundMoney(new Prisma.Decimal(booking.totalPrice));
      const subtotal = vatRate.greaterThan(0)
        ? roundMoney(
            total.div(new Prisma.Decimal(1).add(vatRate.div(100))),
          )
        : total;
      const vatAmount = roundMoney(total.sub(subtotal));

      const invoice = await transaction.invoice.create({
        data: {
          invoiceNumber,
          bookingId: booking.id,
          userId: booking.userId,
          status: "DRAFT",
          invoiceType: "SINGLE",
          subtotal,
          vatAmount,
          total,
          dueDate,
          paymentTerms: `${paymentTermsDays} days`,
          customerReference: booking.customerReference,
          purchaseOrderNumber: booking.purchaseOrderNumber,
        },
      });

      await transaction.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          bookingId: booking.id,
          chargeType: "BASE_SERVICE",
          description: `Courier service · ${booking.reference}`,
          quantity: new Prisma.Decimal(1),
          unitPrice: subtotal,
          netAmount: subtotal,
          vatRate,
          vatAmount,
          grossAmount: total,
          bookingReference: booking.reference,
          sourceType: "BOOKING",
          sourceId: booking.id,
        },
      });

      await transaction.invoiceBooking.create({
        data: {
          invoiceId: invoice.id,
          bookingId: booking.id,
          bookingReference: booking.reference,
          bookingDate: booking.collectionDate,
          poReference: booking.purchaseOrderNumber,
          routeDescription: `${booking.collectionAddress} → ${booking.deliveryAddress}`,
          serviceDescription:
            booking.vehicleType || booking.journeyType || "Courier service",
          netAmount: subtotal,
          vatAmount,
          grossAmount: total,
        },
      });

      await transaction.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "DRAFT_CREATED",
          description: `Draft invoice ${invoiceNumber} created from booking ${booking.reference}.`,
        },
      });

      await transaction.companySettings.update({
        where: { id: settings.id },
        data: { nextInvoiceNumber: { increment: 1 } },
      });

      return transaction.invoice.findUnique({
        where: { id: invoice.id },
        include: invoiceInclude(),
      });
    });

    if (!result) {
      throw new Error("Unable to load the created invoice.");
    }

    res.status(201).json({
      success: true,
      message: shouldConsolidate
        ? `Consolidated draft ${result.invoiceNumber} created automatically for ${cycleBookings.length} bookings in the customer's 30-day cycle.`
        : `Draft invoice ${result.invoiceNumber} created.`,
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

    const existingAdjustmentNetTotal = invoice.adjustments.reduce(
      (sum, adjustment) => sum.add(adjustment.netAmount),
      new Prisma.Decimal(0),
    );
    const existingAdjustmentVatTotal = invoice.adjustments.reduce(
      (sum, adjustment) => sum.add(adjustment.vatAmount),
      new Prisma.Decimal(0),
    );
    const baseSubtotal = roundMoney(
      invoice.subtotal.sub(existingAdjustmentNetTotal),
    );
    const baseVat = roundMoney(baseSubtotal.mul(vatRate).div(100));

    const nextSubtotal = roundMoney(invoice.subtotal.add(netAmount));
    const nextVat = roundMoney(
      baseVat.add(existingAdjustmentVatTotal).add(vatAmount),
    );
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
      const adjustment = await transaction.invoiceAdjustment.create({
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

      await transaction.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          chargeType: sourceType === "DISCOUNT" ? "DISCOUNT" : "OTHER",
          description: name,
          quantity,
          unitPrice: unitAmount,
          netAmount,
          vatRate: vatApplicable ? vatRate : new Prisma.Decimal(0),
          vatAmount,
          grossAmount: roundMoney(netAmount.add(vatAmount)),
          sourceType: "ADJUSTMENT",
          sourceId: adjustment.id,
        },
      });

      await transaction.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: sourceType === "DISCOUNT" ? "DISCOUNT_ADDED" : "CHARGE_ADDED",
          description: `${name} ${sourceType === "DISCOUNT" ? "applied" : "added"}.`,
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

    const remainingAdjustments = await prisma.invoiceAdjustment.findMany({
      where: {
        invoiceId: invoice.id,
        id: { not: adjustment.id },
      },
    });

    const settings = await prisma.companySettings.findFirst({
      select: { vatRate: true },
    });
    const vatRate = settings?.vatRate ?? new Prisma.Decimal(20);

    const allAdjustmentNetTotal = await prisma.invoiceAdjustment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { netAmount: true },
    });
    const baseSubtotal = roundMoney(
      invoice.subtotal.sub(
        allAdjustmentNetTotal._sum.netAmount ?? new Prisma.Decimal(0),
      ),
    );
    const baseVat = roundMoney(baseSubtotal.mul(vatRate).div(100));
    const remainingAdjustmentVatTotal = remainingAdjustments.reduce(
      (sum, item) => sum.add(item.vatAmount),
      new Prisma.Decimal(0),
    );

    const nextSubtotal = roundMoney(
      invoice.subtotal.sub(adjustment.netAmount),
    );
    const nextVat = roundMoney(baseVat.add(remainingAdjustmentVatTotal));
    const nextTotal = roundMoney(nextSubtotal.add(nextVat));

    const updatedInvoice = await prisma.$transaction(async (transaction) => {
      await transaction.invoiceLine.deleteMany({
        where: { invoiceId: invoice.id, sourceType: "ADJUSTMENT", sourceId: adjustment.id },
      });
      await transaction.invoiceAdjustment.delete({ where: { id: adjustment.id } });
      await transaction.invoiceAuditEvent.create({
        data: { invoiceId: invoice.id, eventType: "ADJUSTMENT_REMOVED", description: `${adjustment.name} removed from draft invoice.` },
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
    let invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: invoiceInclude(),
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (invoice.status === "DRAFT") {
      if (!invoice.lines.length) {
        return res.status(400).json({
          error: "Invoice must contain at least one financial charge line.",
        });
      }

      const finalisedAt = new Date();
      const issuedAt = invoice.issuedAt || finalisedAt;
      const supplyDate =
        invoice.supplyDate ||
        invoice.booking?.collectionDate ||
        invoice.invoiceBookings[0]?.bookingDate ||
        finalisedAt;

      const pdf = await generateAndStoreInvoicePdf({
        invoice: {
          ...invoice,
          status: "FINALISED",
          finalisedAt,
          issuedAt,
          supplyDate,
        },
      });

      invoice = await prisma.$transaction(async (transaction) => {
        await transaction.invoiceAuditEvent.create({
          data: {
            invoiceId: invoice!.id,
            eventType: "PDF_STORED",
            description: `Issued PDF stored as ${pdf.storageKey}.`,
          },
        });
        await transaction.invoiceAuditEvent.create({
          data: {
            invoiceId: invoice!.id,
            eventType: "FINALISED",
            description:
              "Invoice financial values locked and issued PDF stored before sending.",
          },
        });
        return transaction.invoice.update({
          where: { id: invoice!.id },
          data: {
            status: "FINALISED",
            finalisedAt,
            issuedAt,
            supplyDate,
            pdfUrl: pdf.url,
            pdfStorageKey: pdf.storageKey,
          },
          include: invoiceInclude(),
        });
      });
    }

    if (
      !["FINALISED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(
        invoice.status,
      )
    ) {
      return res.status(400).json({
        error: "This invoice cannot be sent in its current status.",
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
    let pdfBuffer: Buffer | null = null;

    try {
      pdfBuffer = await getStoredInvoicePdfBuffer(invoice);
    } catch (pdfError) {
      console.error("Invoice PDF attachment load error:", pdfError);
      return res.status(500).json({
        error:
          "The finalised invoice PDF could not be loaded. Re-finalise the invoice before sending.",
      });
    }

    try {
      providerMessageId = await sendInvoiceEmail({
        to: recipient,
        invoiceNumber: invoice.invoiceNumber,
        accountName,
        bookingReference: invoice.booking?.reference || invoice.invoiceBookings[0]?.bookingReference || "Multiple bookings",
        subtotal: invoice.subtotal,
        vatAmount: invoice.vatAmount,
        total: invoice.total,
        dueDate: invoice.dueDate,
        pdfBuffer,
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

      await transaction.invoiceAuditEvent.create({
        data: { invoiceId: invoice.id, eventType: "INVOICE_SENT", description: `Invoice sent to ${recipient}.` },
      });

      return transaction.invoice.update({
        where: { id: invoice.id },
        data: {
          status: invoice.status === "FINALISED" ? "SENT" : invoice.status,
          finalisedAt: invoice.finalisedAt || new Date(),
          issuedAt: invoice.issuedAt || new Date(),
          sentAt: invoice.sentAt || new Date(),
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

    const financialEditRequested =
      req.body.subtotal !== undefined ||
      req.body.vatAmount !== undefined ||
      req.body.total !== undefined ||
      req.body.dueDate !== undefined;

    if (existingInvoice.status !== "DRAFT" && financialEditRequested) {
      return res.status(400).json({
        error: "Financial values are locked after an invoice is finalised. Use a credit note for reductions.",
      });
    }

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


router.get("/admin/billing-profile/:userId", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { billingProfile: true, tradeAccount: true },
    });
    if (!user) return res.status(404).json({ error: "Customer not found." });
    const profile = user.billingProfile || await prisma.billingProfile.create({
      data: {
        userId: user.id,
        paymentMode: user.accountType === "TRADE" ? "PAY_LATER" : "PAY_NOW",
        paymentTermsDays: user.tradeAccount?.paymentTermsDays ?? 30,
        accountsEmail: user.tradeAccount?.accountsEmail || user.accountsEmail || user.email,
        creditLimit: user.tradeAccount?.creditLimit,
        creditFacilityOnHold: user.tradeAccount?.creditFacilityOnHold ?? false,
        holdReason: user.tradeAccount?.creditHoldReason,
      },
    });
    res.json({ profile });
  } catch (error) {
    console.error("Billing profile load error:", error);
    res.status(500).json({ error: "Unable to load billing profile." });
  }
});

router.patch("/admin/billing-profile/:userId", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const paymentTermsDays = getPositiveInteger(req.body.paymentTermsDays, 30);
    const invoiceDayOfWeek = req.body.invoiceDayOfWeek == null ? null : Number(req.body.invoiceDayOfWeek);
    const invoiceDayOfMonth = req.body.invoiceDayOfMonth == null ? null : Number(req.body.invoiceDayOfMonth);
    if (invoiceDayOfWeek != null && (invoiceDayOfWeek < 0 || invoiceDayOfWeek > 6)) return res.status(400).json({ error: "Invoice day of week must be 0 to 6." });
    if (invoiceDayOfMonth != null && (invoiceDayOfMonth < 1 || invoiceDayOfMonth > 31)) return res.status(400).json({ error: "Invoice day of month must be 1 to 31." });
    const profile = await prisma.billingProfile.upsert({
      where: { userId: req.params.userId },
      create: {
        userId: req.params.userId,
        paymentMode: req.body.paymentMode === "PAY_LATER" ? "PAY_LATER" : "PAY_NOW",
        invoiceMode: req.body.invoiceMode === "CONSOLIDATED" ? "CONSOLIDATED" : "PER_BOOKING",
        billingFrequency: ["WEEKLY", "MONTHLY"].includes(req.body.billingFrequency) ? req.body.billingFrequency : "PER_BOOKING",
        invoiceDayOfWeek, invoiceDayOfMonth, paymentTermsDays,
        accountsEmail: getOptionalString(req.body.accountsEmail), poRequired: Boolean(req.body.poRequired),
        creditLimit: getNumber(req.body.creditLimit), creditFacilityOnHold: Boolean(req.body.creditFacilityOnHold),
        holdReason: getOptionalString(req.body.holdReason),
      },
      update: {
        paymentMode: req.body.paymentMode === "PAY_LATER" ? "PAY_LATER" : "PAY_NOW",
        invoiceMode: req.body.invoiceMode === "CONSOLIDATED" ? "CONSOLIDATED" : "PER_BOOKING",
        billingFrequency: ["WEEKLY", "MONTHLY"].includes(req.body.billingFrequency) ? req.body.billingFrequency : "PER_BOOKING",
        invoiceDayOfWeek, invoiceDayOfMonth, paymentTermsDays,
        accountsEmail: getOptionalString(req.body.accountsEmail), poRequired: Boolean(req.body.poRequired),
        creditLimit: getNumber(req.body.creditLimit), creditFacilityOnHold: Boolean(req.body.creditFacilityOnHold),
        holdReason: getOptionalString(req.body.holdReason),
      },
    });
    res.json({ success: true, profile });
  } catch (error) {
    console.error("Billing profile update error:", error);
    res.status(500).json({ error: "Unable to update billing profile." });
  }
});

router.get("/admin/billing-queue", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        user: { is: { accountType: "TRADE" } },
        invoiceBookings: { none: {} },
        invoices: { none: {} },
      },
      include: { user: { include: { billingProfile: true, tradeAccount: true } }, quote: true, pod: true },
      orderBy: [{ userId: "asc" }, { collectionDate: "asc" }],
    });
    res.json({ bookings });
  } catch (error) {
    console.error("Billing queue error:", error);
    res.status(500).json({ error: "Unable to load billing queue." });
  }
});

router.post("/admin/consolidated-draft", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const bookingIds = Array.isArray(req.body.bookingIds) ? req.body.bookingIds.map(getString).filter(Boolean) : [];
    if (!bookingIds.length) return res.status(400).json({ error: "Select at least one booking." });
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: { user: { include: { billingProfile: true, tradeAccount: true } } },
    });
    if (bookings.length !== bookingIds.length) return res.status(400).json({ error: "One or more bookings could not be found." });
    const userId = bookings[0].userId;
    if (!userId || bookings.some((b) => b.userId !== userId)) return res.status(400).json({ error: "Consolidated invoices must contain bookings for one customer account." });
    const user = bookings[0].user;
    if (!user || user.accountType !== "TRADE") return res.status(400).json({ error: "Consolidated billing is only available for trade accounts." });
    if ((user.billingProfile?.poRequired) && bookings.some((b) => !b.purchaseOrderNumber)) return res.status(400).json({ error: "A PO/order reference is required for every selected booking." });
    const alreadyInvoiced = await prisma.invoiceBooking.findFirst({ where: { bookingId: { in: bookingIds } } });
    if (alreadyInvoiced) return res.status(409).json({ error: "One or more selected bookings are already invoiced." });

    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findFirst();
      if (!settings) throw new Error("Company settings must be configured before invoices can be created.");
      const vatRate = new Prisma.Decimal(settings.vatRate);
      const invoiceNumber = `${settings.invoicePrefix}-${String(settings.nextInvoiceNumber).padStart(6, "0")}`;
      let subtotal = new Prisma.Decimal(0), vatAmount = new Prisma.Decimal(0), total = new Prisma.Decimal(0);
      const amounts = bookings.map((booking) => {
        const gross = roundMoney(new Prisma.Decimal(booking.totalPrice));
        const net = vatRate.greaterThan(0) ? roundMoney(gross.div(new Prisma.Decimal(1).add(vatRate.div(100)))) : gross;
        const vat = roundMoney(gross.sub(net)); subtotal = subtotal.add(net); vatAmount = vatAmount.add(vat); total = total.add(gross);
        return { booking, net, vat, gross };
      });
      const terms = user.billingProfile?.paymentTermsDays ?? user.tradeAccount?.paymentTermsDays ?? settings.paymentTermsDays;
      const dueDate = new Date(); dueDate.setUTCDate(dueDate.getUTCDate() + terms);
      const invoice = await tx.invoice.create({ data: { invoiceNumber, userId, status: "DRAFT", invoiceType: "CONSOLIDATED", subtotal: roundMoney(subtotal), vatAmount: roundMoney(vatAmount), total: roundMoney(total), dueDate, paymentTerms: `${terms} days` } });
      for (const item of amounts) {
        await tx.invoiceBooking.create({ data: { invoiceId: invoice.id, bookingId: item.booking.id, bookingReference: item.booking.reference, bookingDate: item.booking.collectionDate, poReference: item.booking.purchaseOrderNumber, routeDescription: `${item.booking.collectionAddress} → ${item.booking.deliveryAddress}`, serviceDescription: item.booking.vehicleType || item.booking.journeyType || "Courier service", netAmount: item.net, vatAmount: item.vat, grossAmount: item.gross } });
        await tx.invoiceLine.create({ data: { invoiceId: invoice.id, bookingId: item.booking.id, chargeType: "BASE_SERVICE", description: `Courier service · ${item.booking.reference}`, quantity: 1, unitPrice: item.net, netAmount: item.net, vatRate, vatAmount: item.vat, grossAmount: item.gross, bookingReference: item.booking.reference, sourceType: "BOOKING", sourceId: item.booking.id } });
      }
      await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "DRAFT_CREATED", description: `Consolidated draft created for ${bookings.length} bookings.` } });
      await tx.companySettings.update({ where: { id: settings.id }, data: { nextInvoiceNumber: { increment: 1 } } });
      return tx.invoice.findUnique({ where: { id: invoice.id }, include: invoiceInclude() });
    });
    res.status(201).json({ success: true, invoice: result });
  } catch (error) {
    console.error("Consolidated draft error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create consolidated invoice." });
  }
});

router.post("/admin/:id/reopen", async (req, res) => {
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

    if (!["FINALISED", "SENT", "OVERDUE", "ISSUED"].includes(invoice.status)) {
      return res.status(400).json({
        error: "Only an issued unpaid invoice can be reopened for editing.",
      });
    }

    const allocatedTotal = invoice.allocations.reduce(
      (sum, allocation) => sum.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    const issuedCreditTotal = invoice.creditNotes
      .filter((creditNote) => creditNote.status === "ISSUED")
      .reduce(
        (sum, creditNote) => sum.add(creditNote.amount),
        new Prisma.Decimal(0),
      );

    if (allocatedTotal.greaterThan(0) || issuedCreditTotal.greaterThan(0)) {
      return res.status(400).json({
        error:
          "This invoice already has a payment or issued credit note. Use the payment/credit-note correction workflow instead of editing its financial values.",
      });
    }

    const previousStatus = invoice.status;
    const previousPdfStorageKey = invoice.pdfStorageKey;
    const wasPreviouslySent = Boolean(invoice.sentAt);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "REOPENED_FOR_EDIT",
          description: wasPreviouslySent
            ? `Previously sent invoice reopened for correction from ${previousStatus}. It must be finalised and resent after editing.`
            : `Invoice reopened for correction from ${previousStatus}. It must be finalised again after editing.`,
          metadata: {
            previousStatus,
            previousPdfStorageKey,
            wasPreviouslySent,
          },
        },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "DRAFT",
          finalisedAt: null,
          issuedAt: null,
          pdfUrl: null,
          pdfStorageKey: null,
        },
        include: invoiceInclude(),
      });
    });

    res.json({
      success: true,
      message: wasPreviouslySent
        ? `${updated.invoiceNumber} reopened for editing. Finalise and resend the corrected invoice when ready.`
        : `${updated.invoiceNumber} reopened for editing. Finalise it again when ready.`,
      invoice: updated,
    });
  } catch (error) {
    console.error("Invoice reopen error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to reopen invoice for editing.",
    });
  }
});

router.post("/admin/:id/finalise", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude() });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (invoice.status !== "DRAFT") return res.status(400).json({ error: "Only draft invoices can be finalised." });
    if (!invoice.lines.length) return res.status(400).json({ error: "Invoice must contain at least one financial charge line." });
    const finalisedAt = new Date();
    const issuedAt = invoice.issuedAt || finalisedAt;
    const supplyDate = invoice.supplyDate || invoice.booking?.collectionDate || invoice.invoiceBookings[0]?.bookingDate || finalisedAt;

    const pdf = await generateAndStoreInvoicePdf({
      invoice: {
        ...invoice,
        status: "FINALISED",
        finalisedAt,
        issuedAt,
        supplyDate,
      },
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "PDF_STORED",
          description: `Issued PDF stored as ${pdf.storageKey}.`,
        },
      });
      await tx.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "FINALISED",
          description: "Invoice financial values locked and issued PDF stored.",
        },
      });
      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "FINALISED",
          finalisedAt,
          issuedAt,
          supplyDate,
          pdfUrl: pdf.url,
          pdfStorageKey: pdf.storageKey,
        },
        include: invoiceInclude(),
      });
    });
    res.json({ success: true, invoice: updated });
  } catch (error) {
    console.error("Invoice finalise error:", error);
    res.status(500).json({ error: "Unable to finalise invoice." });
  }
});

router.post("/admin/:id/credit-notes", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const amountValue = getNumber(req.body.amount); const reason = getString(req.body.reason);
    if (amountValue == null || amountValue <= 0 || !reason) return res.status(400).json({ error: "Credit amount and reason are required." });
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { creditNotes: true, allocations: true } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (["DRAFT", "VOID", "CANCELLED"].includes(invoice.status)) return res.status(400).json({ error: "Credit notes can only be raised against an issued invoice." });
    const existingCredits = invoice.creditNotes.filter((c) => c.status === "ISSUED").reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
    const remaining = invoice.total.sub(existingCredits);
    const amount = roundMoney(new Prisma.Decimal(amountValue));
    if (amount.greaterThan(remaining)) return res.status(400).json({ error: "Credit amount exceeds the remaining invoice value." });
    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findFirst(); if (!settings) throw new Error("Company settings are required.");
      const creditNoteNumber = `${settings.creditNotePrefix}-${String(settings.nextCreditNoteNumber).padStart(6, "0")}`;
      const creditNote = await tx.creditNote.create({ data: { creditNoteNumber, invoiceId: invoice.id, status: "ISSUED", amount, reason } });
      await tx.companySettings.update({ where: { id: settings.id }, data: { nextCreditNoteNumber: { increment: 1 } } });
      await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "CREDIT_NOTE_CREATED", description: `${creditNoteNumber} created for £${amount.toFixed(2)}.`, metadata: { reason } } });
      const fullyCredited = amount.equals(remaining);
      const updatedInvoice = await tx.invoice.update({ where: { id: invoice.id }, data: fullyCredited ? { status: "CREDITED" } : {}, include: invoiceInclude() });
      return { creditNote, invoice: updatedInvoice };
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("Credit note error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create credit note." });
  }
});


router.post("/admin/:id/record-payment", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const amountValue = getNumber(req.body.amount);
    const paymentMethod = getString(req.body.paymentMethod);
    const reference = getOptionalString(req.body.reference);
    const notes = getOptionalString(req.body.notes);
    const paidAtValue = getOptionalString(req.body.paidAt);

    const allowedPaymentMethods = [
      "BANK_TRANSFER",
      "CASH",
      "CARD",
      "OTHER",
    ];

    if (amountValue == null || amountValue <= 0) {
      return res.status(400).json({ error: "Payment amount must be greater than zero." });
    }

    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: "Select a valid payment method.",
      });
    }

    let paidAt = new Date();

    if (paidAtValue) {
      const parsedPaidAt = new Date(paidAtValue);

      if (Number.isNaN(parsedPaidAt.getTime())) {
        return res.status(400).json({ error: "Payment date is invalid." });
      }

      paidAt = parsedPaidAt;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        allocations: true,
        creditNotes: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (["DRAFT", "VOID", "CREDITED", "CANCELLED", "PAID"].includes(invoice.status)) {
      return res.status(400).json({
        error: "A payment cannot be recorded against this invoice.",
      });
    }

    const credits = invoice.creditNotes
      .filter((creditNote) => creditNote.status === "ISSUED")
      .reduce(
        (sum, creditNote) => sum.add(creditNote.amount),
        new Prisma.Decimal(0),
      );

    const alreadyPaid = invoice.allocations.reduce(
      (sum, allocation) => sum.add(allocation.amount),
      new Prisma.Decimal(0),
    );

    const invoiceOutstanding = roundMoney(
      invoice.total.sub(credits).sub(alreadyPaid),
    );

    if (invoiceOutstanding.lessThanOrEqualTo(0)) {
      return res.status(400).json({
        error: "This invoice has no outstanding balance.",
      });
    }

    const amount = roundMoney(new Prisma.Decimal(amountValue));

    if (amount.greaterThan(invoiceOutstanding)) {
      return res.status(400).json({
        error: `Payment exceeds the invoice outstanding balance of £${invoiceOutstanding.toFixed(2)}.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId: invoice.bookingId,
          invoiceId: invoice.id,
          userId: invoice.userId,
          provider: "MANUAL",
          paymentMethod: paymentMethod as
            | "BANK_TRANSFER"
            | "CASH"
            | "CARD"
            | "OTHER",
          status: "PAID",
          amount,
          currency: "GBP",
          reference,
          notes,
          paidAt,
        },
      });

      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount,
          notes,
        },
      });

      const newOutstanding = roundMoney(invoiceOutstanding.sub(amount));
      const status =
        newOutstanding.lessThanOrEqualTo(0) ? "PAID" : "PARTIALLY_PAID";

      await tx.invoiceAuditEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "PAYMENT_RECORDED",
          description: `Manual ${paymentMethod.replace(/_/g, " ").toLowerCase()} payment of £${amount.toFixed(2)} recorded${reference ? ` (${reference})` : ""}.`,
          metadata: {
            paymentId: payment.id,
            paymentMethod,
            amount: amount.toFixed(2),
            reference,
            paidAt: paidAt.toISOString(),
          },
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status,
          paidAt: status === "PAID" ? paidAt : null,
        },
        include: invoiceInclude(),
      });

      return { payment, invoice: updatedInvoice };
    });

    res.status(201).json({
      success: true,
      payment: result.payment,
      invoice: result.invoice,
      message:
        result.invoice.status === "PAID"
          ? `${result.invoice.invoiceNumber} marked as paid.`
          : `Payment recorded against ${result.invoice.invoiceNumber}.`,
    });
  } catch (error) {
    console.error("Record invoice payment error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to record invoice payment.",
    });
  }
});


router.post("/admin/:id/payment-allocations", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const amountValue = getNumber(req.body.amount); const paymentId = getString(req.body.paymentId);
    if (!paymentId || amountValue == null || amountValue <= 0) return res.status(400).json({ error: "Payment and allocation amount are required." });
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { allocations: true, creditNotes: true } });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
    if (!invoice || !payment) return res.status(404).json({ error: "Invoice or payment not found." });
    if (payment.status !== "PAID") return res.status(400).json({ error: "Only paid payments can be allocated." });
    const allocatedToPayment = payment.allocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
    const paymentRemaining = payment.amount.sub(allocatedToPayment); const amount = roundMoney(new Prisma.Decimal(amountValue));
    if (amount.greaterThan(paymentRemaining)) return res.status(400).json({ error: "Allocation exceeds the unallocated payment amount." });
    const credits = invoice.creditNotes.filter((c) => c.status === "ISSUED").reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
    const alreadyPaid = invoice.allocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
    const outstanding = invoice.total.sub(credits).sub(alreadyPaid);
    if (amount.greaterThan(outstanding)) return res.status(400).json({ error: "Allocation exceeds the invoice outstanding balance." });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.create({ data: { paymentId, invoiceId: invoice.id, amount, allocatedByAdminId: getOptionalString(req.body.adminId), notes: getOptionalString(req.body.notes) } });
      const newPaid = alreadyPaid.add(amount); const newOutstanding = invoice.total.sub(credits).sub(newPaid);
      const status = newOutstanding.lessThanOrEqualTo(0) ? "PAID" : "PARTIALLY_PAID";
      await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "PAYMENT_ALLOCATED", description: `Payment of £${amount.toFixed(2)} allocated.` } });
      return tx.invoice.update({ where: { id: invoice.id }, data: { status, paidAt: status === "PAID" ? new Date() : null }, include: invoiceInclude() });
    });
    res.json({ success: true, invoice: updated });
  } catch (error) {
    console.error("Payment allocation error:", error);
    res.status(500).json({ error: "Unable to allocate payment." });
  }
});


router.post("/admin/process-reminders", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const approachingEnd = new Date(todayStart);
    approachingEnd.setUTCDate(approachingEnd.getUTCDate() + 4);

    const invoices = await prisma.invoice.findMany({
      where: {
        dueDate: { not: null },
        status: {
          in: ["SENT", "PARTIALLY_PAID", "OVERDUE", "ISSUED"],
        },
        userId: { not: null },
      },
      include: {
        user: { include: { billingProfile: true } },
        allocations: true,
        creditNotes: true,
        auditEvents: {
          where: { createdAt: { gte: todayStart } },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    const failures: Array<{ invoiceNumber: string; error: string }> = [];

    for (const invoice of invoices) {
      if (!invoice.user || !invoice.dueDate) {
        skipped += 1;
        continue;
      }

      const paid = invoice.allocations.reduce(
        (sum, allocation) => sum.add(allocation.amount),
        new Prisma.Decimal(0),
      );
      const credits = invoice.creditNotes
        .filter((creditNote) => creditNote.status === "ISSUED")
        .reduce(
          (sum, creditNote) => sum.add(creditNote.amount),
          new Prisma.Decimal(0),
        );
      const outstanding = invoice.total.sub(paid).sub(credits);

      if (outstanding.lessThanOrEqualTo(0)) {
        skipped += 1;
        continue;
      }

      let reminderType:
        | "APPROACHING_DUE"
        | "DUE_TODAY"
        | "OVERDUE"
        | null = null;

      if (invoice.dueDate < todayStart) {
        if (invoice.user.billingProfile?.reminderOverdue !== false) {
          reminderType = "OVERDUE";
        }
      } else if (invoice.dueDate < todayEnd) {
        if (invoice.user.billingProfile?.reminderDueToday !== false) {
          reminderType = "DUE_TODAY";
        }
      } else if (invoice.dueDate < approachingEnd) {
        if (invoice.user.billingProfile?.reminderApproachingDue !== false) {
          reminderType = "APPROACHING_DUE";
        }
      }

      if (!reminderType) {
        skipped += 1;
        continue;
      }

      // Only send one reminder per invoice per calendar day.
      // The timestamp is persisted on the invoice so repeated scheduler runs
      // cannot send the same reminder again during the same day.
      const reminderAlreadySentToday =
        invoice.lastReminderSentAt &&
        invoice.lastReminderSentAt >= todayStart &&
        invoice.lastReminderSentAt < todayEnd;

      if (reminderAlreadySentToday) {
        skipped += 1;
        continue;
      }

      const eventType = `REMINDER_${reminderType}`;

      const recipient =
        invoice.user.billingProfile?.accountsEmail ||
        invoice.user.accountsEmail ||
        invoice.user.email;
      const accountName =
        invoice.user.companyName || invoice.user.name || recipient;

      try {
        const providerMessageId = await sendInvoiceReminderEmail({
          to: recipient,
          invoiceNumber: invoice.invoiceNumber,
          accountName,
          dueDate: invoice.dueDate,
          outstanding,
          reminderType,
        });

        await prisma.$transaction(async (transaction) => {
          await transaction.emailLog.create({
            data: {
              type: "INVOICE",
              status: "SENT",
              recipient,
              subject: `${reminderType.replace(/_/g, " ")} - ${invoice.invoiceNumber}`,
              providerMessageId,
              sentAt: new Date(),
              userId: invoice.userId,
              bookingId: invoice.bookingId,
              invoiceId: invoice.id,
            },
          });
          await transaction.invoiceAuditEvent.create({
            data: {
              invoiceId: invoice.id,
              eventType,
              description: `${reminderType.replace(/_/g, " ").toLowerCase()} reminder sent to ${recipient}.`,
            },
          });

          await transaction.invoice.update({
            where: { id: invoice.id },
            data: {
              lastReminderSentAt: new Date(),
              ...(reminderType === "OVERDUE" && invoice.status !== "OVERDUE"
                ? { status: "OVERDUE" }
                : {}),
            },
          });
        });
        sent += 1;
      } catch (error) {
        failures.push({
          invoiceNumber: invoice.invoiceNumber,
          error: error instanceof Error ? error.message : "Reminder failed.",
        });
      }
    }

    res.json({ success: true, sent, skipped, failures });
  } catch (error) {
    console.error("Invoice reminder processing error:", error);
    res.status(500).json({ error: "Unable to process invoice reminders." });
  }
});

router.get("/admin/credit-exposure/:userId", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId }, include: { tradeAccount: true, billingProfile: true } });
    if (!user) return res.status(404).json({ error: "Customer not found." });
    const invoices = await prisma.invoice.findMany({ where: { userId: user.id, status: { notIn: ["PAID", "VOID", "CREDITED", "CANCELLED"] } }, include: { allocations: true, creditNotes: true } });
    const outstandingInvoices = invoices.reduce((sum, invoice) => { const paid = invoice.allocations.reduce((a, x) => a.add(x.amount), new Prisma.Decimal(0)); const credits = invoice.creditNotes.filter((c) => c.status === "ISSUED").reduce((a, x) => a.add(x.amount), new Prisma.Decimal(0)); const remaining = invoice.total.sub(paid).sub(credits); return sum.add(remaining.greaterThan(0) ? remaining : 0); }, new Prisma.Decimal(0));
    const uninvoiced = await prisma.booking.aggregate({ where: { userId: user.id, status: "COMPLETED", invoices: { none: {} }, invoiceBookings: { none: {} } }, _sum: { totalPrice: true } });
    const committed = await prisma.booking.aggregate({ where: { userId: user.id, status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"] }, invoices: { none: {} }, invoiceBookings: { none: {} } }, _sum: { totalPrice: true } });
    const completedUninvoiced = new Prisma.Decimal(uninvoiced._sum.totalPrice || 0); const committedPayLater = new Prisma.Decimal(committed._sum.totalPrice || 0);
    const exposure = roundMoney(outstandingInvoices.add(completedUninvoiced).add(committedPayLater));
    const creditLimit = new Prisma.Decimal(user.billingProfile?.creditLimit ?? user.tradeAccount?.creditLimit ?? 0); const availableCredit = roundMoney(creditLimit.sub(exposure));
    res.json({ creditLimit, outstandingInvoices, completedUninvoiced, committedPayLater, exposure, availableCredit, creditFacilityOnHold: user.billingProfile?.creditFacilityOnHold ?? user.tradeAccount?.creditFacilityOnHold ?? false, holdReason: user.billingProfile?.holdReason ?? user.tradeAccount?.creditHoldReason ?? null });
  } catch (error) {
    console.error("Credit exposure error:", error);
    res.status(500).json({ error: "Unable to calculate credit exposure." });
  }
});

router.post("/admin/credit-overrides", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const userId = getString(req.body.userId), bookingId = getOptionalString(req.body.bookingId), reason = getString(req.body.reason), approvedByAdminId = getString(req.body.approvedByAdminId), requestedAmount = getNumber(req.body.requestedAmount);
    if (!userId || !reason || !approvedByAdminId || requestedAmount == null || requestedAmount <= 0) return res.status(400).json({ error: "Customer, amount, approving admin and reason are required." });
    const override = await prisma.creditOverride.create({ data: { userId, bookingId, reason, approvedByAdminId, requestedAmount } });
    res.status(201).json({ success: true, override });
  } catch (error) {
    console.error("Credit override error:", error);
    res.status(500).json({ error: "Unable to record credit override." });
  }
});

export default router;
