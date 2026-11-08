import {centralAdminAccess} from "../lib/centralAdmin";
import { reserveInvoiceNumber } from "../lib/invoiceNumber";
import { TRADE_PAYMENT_TERMS, invoiceTerms, tradeMonth, ukParts, ukMidnight } from "../lib/billingPolicy";
import { processMonthlyTradeBilling } from "../lib/monthlyTradeBilling";
import { refreshContractDraft } from "../lib/commercialContracts";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { departmentEmail, departmentSender, emailLayout, sendEmail } from "../lib/email";
import { prisma } from "../lib/prisma";
import { generateAndStoreInvoicePdf, getStoredInvoicePdfBuffer, renderInvoicePdf } from "../lib/invoicePdf";

import { getManualInvoiceDetails, parseManualInvoiceInput } from "../lib/manualInvoice";

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

function requireAdmin(req: { headers: { [key: string]: unknown } }) { return centralAdminAccess(req); }

function invoiceInclude() {
  return {
    commercialContractInvoice: { select: { contractId: true, month: true } },
    user: true,
    payments: true,
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
  const fromEmail = departmentSender("accounts");

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }


  const money = (value: Prisma.Decimal) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(Number(value.toString()));

  const dueText = input.dueDate
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
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
      reply_to: departmentEmail("accounts"),
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
      html: emailLayout("Your invoice", `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
          <p>Dear ${escapeHtml(input.accountName)},</p>
          <p>Please find the details of invoice <strong>${escapeHtml(
            input.invoiceNumber,
          )}</strong> for booking <strong>${escapeHtml(
            input.bookingReference,
          )}</strong>.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-collapse:collapse;width:100%;margin:20px 0;background:#f8fafc">
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

          <p>Please retain this invoice for your records. If you have any questions, reply to this email and quote your invoice number.</p>
          <p>Kind regards,<br/><strong>Accounts Team</strong><br/>Streamline Logistics Group</p>
        </div>
      `, "accounts"),
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
  const fromEmail = departmentSender("accounts");

  if (!apiKey) {
    throw new Error("Invoice reminder email is not configured.");
  }

  const heading =
    input.reminderType === "OVERDUE"
      ? "Invoice overdue"
      : input.reminderType === "DUE_TODAY"
        ? "Invoice due today"
        : "Invoice due soon";
  const dueText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
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
      reply_to: departmentEmail("accounts"),
      to: [input.to],
      subject: `${heading}: ${input.invoiceNumber} - Streamline Logistics Group`,
      html: emailLayout(heading, `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
          <p>Dear ${escapeHtml(input.accountName)},</p>
          <p>This is a reminder for invoice <strong>${escapeHtml(input.invoiceNumber)}</strong>.</p>
          <p><strong>Due date:</strong> ${escapeHtml(dueText)}<br />
          <strong>Outstanding:</strong> ${escapeHtml(outstandingText)}</p>
          <p>If payment has already been arranged, no further action is required.</p>
          <p>For payment queries, reply to this email and quote your invoice number.</p>
          <p>Kind regards,<br/><strong>Accounts Team</strong><br/>Streamline Logistics Group</p>
        </div>
      `, "accounts"),
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

router.get("/admin/review-queue", async (req,res) => {
  const admin = requireAdmin(req); if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoices = await prisma.invoice.findMany({ where: { status: "DRAFT", invoiceType: { not: "CONSOLIDATED" }, checkedAt: null, archivedCustomerId: null, OR: [{billingAccountType:"TRADE"},{userId:null},{user:{is:{accountType:{not:"BUSINESS"}}}}] }, orderBy: { createdAt: "asc" }, select: { id: true, invoiceNumber: true, total: true, issuedAt: true, userId: true, user: { select: { companyName: true, name: true, accountNumber: true } } } });
    res.setHeader("Cache-Control", "no-store"); res.json({ invoices,count: invoices.length });
  } catch { res.status(500).json({ error: "Unable to load invoice notifications." }); }
});
router.post("/admin/:id/check", async (req,res) => {
  const admin = requireAdmin(req); if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoice = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${getString(req.params.id)} FOR UPDATE`;
      const row = await tx.invoice.findUnique({ where: { id: getString(req.params.id) } });
      if (row?.invoiceType === "CONSOLIDATED") throw new Error("Consolidated invoices can only be emailed.");
      if (!row || row.status !== "DRAFT") throw new Error("Only a pending invoice can be checked.");
      if (row.checkedAt) return row;
      const updated = await tx.invoice.update({ where: { id: row.id }, data: { checkedAt: new Date() } });
      await tx.invoiceAuditEvent.create({ data: { invoiceId: row.id, eventType: "INVOICE_CHECKED", description: "Invoice checked by the administration team; ready for finalisation." } });
      return updated;
    });
    res.json({ invoice });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Unable to check invoice." }); }
});

router.get("/admin/:id/pdf", async (req, res) => {
  const admin = requireAdmin(req); if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude() });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    const buffer = await renderInvoicePdf(invoice);
    res.setHeader("Cache-Control", "no-store"); res.type("application/pdf").send(buffer);
  } catch { res.status(500).json({ error: "Unable to render invoice PDF." }); }
});

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
        commercialContractShift: null,
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

// Manual invoices use normal invoice lines and retain a billing snapshot in the audit record.
router.get("/admin/manual-options", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const [customers, settings] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ companyName: "asc" }, { name: "asc" }],
        select: {
          id: true, accountType: true, name: true, companyName: true, email: true, accountsEmail: true,
          phone: true, alternativeContactNumber: true, accountNumber: true,
          registeredAddressLine1: true, registeredAddressLine2: true, registeredTownCity: true,
          registeredCounty: true, registeredPostcode: true, registeredCountry: true,
          billingProfile: { select: { paymentTermsDays: true, accountsEmail: true } },
          tradeAccount: { select: {
            companyName: true, paymentTermsDays: true, accountsEmail: true, invoiceDeliveryEmail: true,
            accountsPhone: true, primaryMobile: true, registeredAddressLine1: true, registeredAddressLine2: true,
            registeredTownCity: true, registeredCounty: true, registeredPostcode: true, registeredCountry: true,
          } },
        },
      }),
      prisma.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vatRate: true, paymentTermsDays: true } }),
    ]);
    res.json({ customers, vatRate: settings?.vatRate.toString() ?? "20", paymentTermsDays: settings?.paymentTermsDays ?? 30 });
  } catch (error) {
    console.error("Manual invoice options error:", error);
    res.status(500).json({ error: "Unable to load manual invoice options." });
  }
});

router.post("/admin/manual", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const selectedCustomerId = getString(req.body.userId);
    const billingCustomer = selectedCustomerId ? await prisma.user.findUnique({ where: { id: selectedCustomerId }, select: { accountType: true } }) : null;
    const input = parseManualInvoiceInput(req.body, billingCustomer?.accountType === "TRADE");
    if (billingCustomer?.accountType === "TRADE") {
      const month=tradeMonth(input.supplyDate);
      input.invoiceDate=month.issueDate; input.dueDate=month.dueDate;
      input.paymentTerms=TRADE_PAYMENT_TERMS;
      input.recipient.invoiceDate=month.issueDate.toLocaleDateString("en-CA",{timeZone:"Europe/London"});
    }
    const requestId = getString(req.body.requestId);
    if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) return res.status(400).json({ error: "Manual invoice request ID is missing. Reopen the form and try again." });
    const existingRequest = await prisma.invoiceAuditEvent.findFirst({ where: { eventType: "MANUAL_INVOICE_CREATED", metadata: { path: ["requestId"], equals: requestId } } });
    if (existingRequest) {
      const invoice = await prisma.invoice.findUnique({ where: { id: existingRequest.invoiceId }, include: invoiceInclude() });
      return res.json({ success: true, invoice, message: "Manual invoice already saved." });
    }
    if (input.userId && !(await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }))) return res.status(400).json({ error: "Customer account does not exist." });
    const invoice = await prisma.$transaction(async (tx) => {
      const previousRequest = await tx.invoiceAuditEvent.findFirst({ where: { eventType: "MANUAL_INVOICE_CREATED", metadata: { path: ["requestId"], equals: requestId } } });
      if (previousRequest) return tx.invoice.findUniqueOrThrow({ where: { id: previousRequest.invoiceId }, include: invoiceInclude() });
      const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" } });
      if (!settings) throw new Error("Configure Company Settings before creating invoices.");
      const invoiceNumber = await reserveInvoiceNumber(tx, settings.id);
      const saved = await tx.invoice.create({
        data: {
          invoiceNumber, userId: input.userId, billingAccountType:billingCustomer?.accountType, status: "DRAFT", invoiceType: "SINGLE",
          checkedAt: null, subtotal: input.subtotal, vatAmount: input.vatAmount, total: input.total,
          issuedAt: input.invoiceDate, dueDate: input.dueDate, supplyDate: input.supplyDate,
          paymentTerms: input.paymentTerms, customerReference: input.customerReference, purchaseOrderNumber: input.purchaseOrderNumber, notes: input.notes,
          lines: { create: input.lines },
          auditEvents: { create: { eventType: "MANUAL_INVOICE_CREATED", description: `Manual draft ${invoiceNumber} created without a booking.`, metadata: { ...input.recipient, requestId } } },
        }, include: invoiceInclude(),
      });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(201).json({ success: true, invoice, message: "Manual draft invoice created. Review it, then finalise and send." });
  } catch (error) {
    console.error("Manual invoice creation error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) return res.status(409).json({ error: "Another invoice was saved at the same time. Try Save again." });
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create manual invoice." });
  }
});

router.patch("/admin/:id/manual", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

    const selectedCustomerId = getString(req.body.userId);
    const billingCustomer = selectedCustomerId ? await prisma.user.findUnique({ where: { id: selectedCustomerId }, select: { accountType: true } }) : null;
    const input = parseManualInvoiceInput(req.body, billingCustomer?.accountType === "TRADE");
    if (billingCustomer?.accountType === "TRADE") {
      const month=tradeMonth(input.supplyDate);
      input.invoiceDate=month.issueDate; input.dueDate=month.dueDate;
      input.paymentTerms=TRADE_PAYMENT_TERMS;
      input.recipient.invoiceDate=month.issueDate.toLocaleDateString("en-CA",{timeZone:"Europe/London"});
    }
    if (input.userId && !(await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }))) return res.status(400).json({ error: "Customer account does not exist." });
    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude() });
      if (!existing || !getManualInvoiceDetails(existing)) throw new Error("Manual invoice not found.");
      if (existing.status !== "DRAFT") throw new Error("Only draft manual invoices can be edited. Reopen the invoice first.");
      if (existing.adjustments.length) throw new Error("Remove additional charges and discounts before editing manual lines, then reapply them afterwards.");
      await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id, sourceType: "MANUAL" } });
      return tx.invoice.update({ where: { id: existing.id }, data: {
        userId: input.userId, billingAccountType: billingCustomer?.accountType ?? null, checkedAt: null, subtotal: input.subtotal, vatAmount: input.vatAmount, total: input.total,
        issuedAt: input.invoiceDate, dueDate: input.dueDate, supplyDate: input.supplyDate,
        paymentTerms: input.paymentTerms, customerReference: input.customerReference, purchaseOrderNumber: input.purchaseOrderNumber, notes: input.notes,
        lines: { create: input.lines },
        auditEvents: { create: { eventType: "MANUAL_INVOICE_UPDATED", description: "Manual invoice recipient, dates and charge lines updated.", metadata: input.recipient } },
      }, include: invoiceInclude() });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ success: true, invoice, message: "Manual draft invoice updated." });
  } catch (error) {
    console.error("Manual invoice update error:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update manual invoice." });
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
        commercialContractShift: { select: { id: true } },
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

    if (booking?.commercialContractShift) return res.status(409).json({ error: "This shift is billed through its monthly commercial contract invoice." });
    if (booking?.user?.accountType === "BUSINESS") return res.status(409).json({ error: "Business invoices are generated as paid receipts from confirmed checkout payments." });
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

    if (booking.user?.accountType === "TRADE") {
      const month = tradeMonth(booking.createdAt);
      if (month.issueDate > new Date()) return res.status(409).json({ error: "Trade bookings are invoiced on the 1st of the following month, payable by the 15th." });
      const processed = await processMonthlyTradeBilling(new Date(), bookingId);
      const invoice = await prisma.invoice.findFirst({ where: { OR: [{ bookingId }, { invoiceBookings: { some: { bookingId } } }] }, include: invoiceInclude() });
      if (!invoice) return res.status(409).json({ error: processed.failures[0]?.error || "This booking is not eligible for monthly billing." });
      return res.json({ success: true, invoice });
    }
    const result = await prisma.$transaction(async (transaction) => {
      const settings = await transaction.companySettings.findFirst();

      if (!settings) {
        throw new Error(
          "Company settings must be configured before draft invoices can be created.",
        );
      }

      const vatRate = new Prisma.Decimal(settings.vatRate);
      const invoiceNumber = await reserveInvoiceNumber(transaction, settings.id);

      const { paymentTerms, dueDate } = invoiceTerms(booking.user?.accountType, new Date(), { paymentTerms: `${settings.paymentTermsDays} days`, dueDate: new Date(Date.now() + settings.paymentTermsDays * 86400000) });

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
          paymentTerms,
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
      message: `Draft invoice ${result.invoiceNumber} created.`,
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
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

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
      include: { adjustments: true, lines: true },
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
    const baseVat = invoice.lines.some((line) => line.sourceType === "MANUAL")
      ? roundMoney(invoice.vatAmount.sub(existingAdjustmentVatTotal))
      : roundMoney(baseSubtotal.mul(vatRate).div(100));

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
          checkedAt: null,
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
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true, adjustments: true },
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
    const baseVat = invoice.lines.some((line) => line.sourceType === "MANUAL")
      ? roundMoney(invoice.vatAmount.sub(invoice.adjustments.reduce((sum, item) => sum.add(item.vatAmount), new Prisma.Decimal(0))))
      : roundMoney(baseSubtotal.mul(vatRate).div(100));
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
          checkedAt: null,
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

    if((invoice.billingAccountType || invoice.user?.accountType) === "TRADE" && invoice.issuedAt && invoice.issuedAt > new Date()) return res.status(409).json({error:"This Trade invoice can be finalised on its scheduled issue date, the 1st of the following month."});
    if (invoice.status === "DRAFT" && invoice.commercialContractInvoice) {
      return res.status(409).json({ error: "Review and finalise this commercial contract invoice before emailing it." });
    }
    if (invoice.status === "DRAFT") {
      if (!invoice.lines.length) {
        return res.status(400).json({
          error: "Invoice must contain at least one financial charge line.",
        });
      }

      const finalisedAt = new Date();
      const issuedAt = invoice.issuedAt || finalisedAt;
      const terms = invoiceTerms((invoice.billingAccountType || invoice.user?.accountType), issuedAt, { paymentTerms: invoice.paymentTerms, dueDate: invoice.dueDate });
      const supplyDate =
        invoice.supplyDate ||
        invoice.booking?.collectionDate ||
        invoice.invoiceBookings[0]?.bookingDate ||
        finalisedAt;

      const pdf = await generateAndStoreInvoicePdf({
        invoice: {
          ...invoice,
          status: "FINALISED",
          ...terms,
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
            ...terms,
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

    const manualDetails = getManualInvoiceDetails(invoice);
    const recipient = manualDetails?.recipientEmail || invoice.user?.email;
    if (!recipient) {
      return res.status(400).json({
        error:
          "This invoice is not linked to a customer account with a primary email address.",
      });
    }

    const accountName =
      manualDetails?.recipientName || invoice.user?.companyName || invoice.user?.name || recipient;

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
        bookingReference: invoice.booking?.reference || invoice.invoiceBookings[0]?.bookingReference || (manualDetails ? "Manual invoice" : "Multiple bookings"),
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

      if (invoice.status === "FINALISED") {
        await transaction.invoice.updateMany({ where: { id: invoice.id, status: "FINALISED" }, data: { status: "SENT" } });
      }
      return transaction.invoice.update({
        where: { id: invoice.id },
        data: {
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
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

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

    if (statusValue && statusValue !== existingInvoice.status) return res.status(409).json({ error: "Use Finalise, Unfinalise or Record payment to change invoice status." });
    const nextStatus = statusValue ? existingInvoice.status : undefined;
    const account = existingInvoice.userId ? await prisma.user.findUnique({ where: { id: existingInvoice.userId }, select: { accountType: true } }) : null;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        checkedAt: financialEditRequested ? null : undefined,
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
        ...(account?.accountType === "BUSINESS" && financialEditRequested ? invoiceTerms("BUSINESS", existingInvoice.issuedAt || new Date()) : {}),
        ...(account?.accountType === "TRADE" && financialEditRequested ? invoiceTerms("TRADE", existingInvoice.issuedAt || new Date()) : {}),
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
    const receiptOwner = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } }) : null;
    if (receiptOwner?.accountType === "BUSINESS") return res.status(409).json({ error: "Business invoices are generated only after payment through checkout." });
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

    if (await prisma.commercialContractShift.findUnique({ where: { bookingId }, select: { id: true } })) {
      return res.status(409).json({ error: "This shift is billed through its monthly commercial contract invoice." });
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

    const account = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } }) : null;
    if (account?.accountType === "TRADE") return res.status(409).json({ error: "Use monthly trade billing for this account." });
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        bookingId,
        userId,
        status: "DRAFT",
        subtotal,
        vatAmount,
        total,
        ...invoiceTerms(account?.accountType, new Date(), { dueDate: dueDate ? new Date(dueDate) : null, paymentTerms: null }),
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
        paymentTermsDays: user.accountType === "TRADE" ? 14 : user.accountType === "BUSINESS" ? 0 : 30,
        invoiceMode: "PER_BOOKING",
        billingFrequency: user.accountType === "TRADE" ? "MONTHLY" : "PER_BOOKING",
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
    const account = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { accountType: true } });
    if (!account) return res.status(404).json({ error: "Customer not found." });
    const isTrade = account.accountType === "TRADE";
    const paymentTermsDays = isTrade ? 14 : 0;
    const invoiceDayOfWeek = req.body.invoiceDayOfWeek == null ? null : Number(req.body.invoiceDayOfWeek);
    const invoiceDayOfMonth = req.body.invoiceDayOfMonth == null ? null : Number(req.body.invoiceDayOfMonth);
    if (invoiceDayOfWeek != null && (invoiceDayOfWeek < 0 || invoiceDayOfWeek > 6)) return res.status(400).json({ error: "Invoice day of week must be 0 to 6." });
    if (invoiceDayOfMonth != null && (invoiceDayOfMonth < 1 || invoiceDayOfMonth > 31)) return res.status(400).json({ error: "Invoice day of month must be 1 to 31." });
    const profile = await prisma.billingProfile.upsert({
      where: { userId: req.params.userId },
      create: {
        userId: req.params.userId,
        paymentMode: isTrade ? "PAY_LATER" : "PAY_NOW",
        invoiceMode: "PER_BOOKING",
        billingFrequency: isTrade ? "MONTHLY" : "PER_BOOKING",
        invoiceDayOfWeek, invoiceDayOfMonth, paymentTermsDays,
        accountsEmail: getOptionalString(req.body.accountsEmail), poRequired: Boolean(req.body.poRequired),
        creditLimit: getNumber(req.body.creditLimit), creditFacilityOnHold: Boolean(req.body.creditFacilityOnHold),
        holdReason: getOptionalString(req.body.holdReason),
      },
      update: {
        paymentMode: isTrade ? "PAY_LATER" : "PAY_NOW",
        invoiceMode: "PER_BOOKING",
        billingFrequency: isTrade ? "MONTHLY" : "PER_BOOKING",
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


router.post("/admin/process-billing-cycles", async (req, res) => {
  const admin = requireAdmin(req); if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try { res.json(await processMonthlyTradeBilling()); }
  catch { res.status(500).json({ error: "Unable to process monthly trade billing." }); }
});

router.get("/admin/billing-queue", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        commercialContractShift: null,
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

const summaryEvent = "MONTHLY_INVOICE_SUMMARY";
const summaryPaymentTerms = "Pay the full amount in one bank transfer by the 15th of the invoice month.";
const summaryAccountFilter = {
  archivedCustomerId: null,
  user: { is: { accountType: "TRADE" as const } },
};
const summaryInvoiceFilter: Prisma.InvoiceWhereInput = {
  ...summaryAccountFilter,
  commercialContractInvoice: null,
  invoiceType: { not: "CONSOLIDATED" },
  status: { in: ["FINALISED", "SENT", "ISSUED", "OVERDUE", "PARTIALLY_PAID", "PAID", "CREDITED"] },
};
const summaryBalanceSelect = {
  id: true, issuedAt: true, finalisedAt: true, createdAt: true, total: true, status: true,
  allocations: { select: { amount: true } },
  creditNotes: { select: { amount: true, status: true } },
} satisfies Prisma.InvoiceSelect;

function invoiceMonth(value: Date) {
  const { year, month } = ukParts(value);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function summaryMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { number, month, invoiceIds, status, amountDue, issuedAt } = value;
  if (typeof number !== "string" || !/^CONS-INV-[0-9]+$/.test(number) ||
      typeof month !== "string" || !/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(month) ||
      !Array.isArray(invoiceIds) || !invoiceIds.length ||
      !invoiceIds.every((id): id is string => typeof id === "string")) return null;
  return {
    number, month, invoiceIds,
    status: status === "FINALISED" || status === "PAID" ? status : "DRAFT" as const,
    amountDue: typeof amountDue === "string" ? amountDue : null,
    issuedAt: typeof issuedAt === "string" ? issuedAt : null,
  };
}

type SummaryDetails = NonNullable<ReturnType<typeof summaryMetadata>>;
type SummaryBalance = Prisma.InvoiceGetPayload<{ select: typeof summaryBalanceSelect }>;

function outstandingForSummary(invoice: SummaryBalance) {
  const credits = invoice.creditNotes.reduce((total, note) =>
    note.status === "ISSUED" ? total.add(note.amount) : total, new Prisma.Decimal(0));
  const payments = invoice.allocations.reduce((total, allocation) => total.add(allocation.amount), new Prisma.Decimal(0));
  return Prisma.Decimal.max(0, roundMoney(invoice.total.sub(credits).sub(payments)));
}

function canConsolidate(invoice: SummaryBalance) {
  return !["PAID", "CREDITED"].includes(invoice.status) && outstandingForSummary(invoice).gt(0);
}

function combinedBalance(invoices: SummaryBalance[]) {
  return invoices.reduce((total, invoice) => total.add(outstandingForSummary(invoice)), new Prisma.Decimal(0));
}

function summaryDueDate(month: string) {
  const [year, number] = month.split("-").map(Number);
  return ukMidnight(year, number, 15);
}

function summaryView(record: { id: string; createdAt: Date }, details: SummaryDetails, invoices: SummaryBalance[]) {
  const balance = combinedBalance(invoices);
  return {
    id: record.id, number: details.number, month: details.month, status: details.status,
    total: details.amountDue ?? balance.toFixed(2),
    dueDate: summaryDueDate(details.month).toISOString(),
    createdAt: record.createdAt.toISOString(), issuedAt: details.issuedAt,
  };
}

function findMonthlySummary(db: Prisma.TransactionClient, userId: string, summaryId: string) {
  return db.invoiceAuditEvent.findFirst({
    where: { id: summaryId, eventType: summaryEvent, invoice: { ...summaryAccountFilter, userId } },
  });
}

router.get("/admin/monthly-summary/:userId", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const [invoices, summaries] = await Promise.all([
      prisma.invoice.findMany({
        where: { ...summaryInvoiceFilter, userId: req.params.userId },
        select: summaryBalanceSelect,
      }),
      prisma.invoiceAuditEvent.findMany({
        where: { eventType: summaryEvent, invoice: { ...summaryAccountFilter, userId: req.params.userId } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, metadata: true },
      }),
    ]);
    const months = [...new Set(invoices.filter(canConsolidate)
      .map(invoice => invoiceMonth(invoice.issuedAt || invoice.finalisedAt || invoice.createdAt)))].sort().reverse();
    const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
    return res.json({
      months,
      summaries: summaries.flatMap(row => {
        const details = summaryMetadata(row.metadata);
        if (!details) return [];
        const sources = details.invoiceIds.flatMap(id => {
          const source = byId.get(id);
          return source ? [source] : [];
        });
        return [summaryView(row, details, sources)];
      }),
    });
  } catch (error) {
    console.error("Monthly summary options error:", error);
    return res.status(500).json({ error: "Unable to load consolidated invoices." });
  }
});

router.post("/admin/monthly-summary/:userId", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  const month = getString(req.body?.month);
  if (!/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: "Select an invoice month." });
  const [year, monthNumber] = month.split("-").map(Number);
  const range = { gte: ukMidnight(year, monthNumber, 1), lt: ukMidnight(year, monthNumber + 1, 1) };
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121107)`;
      const invoices = (await tx.invoice.findMany({
        where: {
          ...summaryInvoiceFilter,
          userId: req.params.userId,
          OR: [
            { issuedAt: range },
            { issuedAt: null, finalisedAt: range },
            { issuedAt: null, finalisedAt: null, createdAt: range },
          ],
        },
        orderBy: { id: "asc" },
        select: summaryBalanceSelect,
      })).filter(canConsolidate);
      if (!invoices.length) return null;
      const records = await tx.invoiceAuditEvent.findMany({
        where: { eventType: summaryEvent },
        select: { id: true, createdAt: true, metadata: true, invoice: { select: { userId: true } } },
      });
      const reserved = new Set<string>();
      let next = 1;
      for (const row of records) {
        const details = summaryMetadata(row.metadata);
        if (!details) continue;
        next = Math.max(next, Number(details.number.slice("CONS-INV-".length)) + 1);
        if (row.invoice.userId === req.params.userId && details.status === "FINALISED") {
          details.invoiceIds.forEach(id => reserved.add(id));
        }
      }
      const sources = invoices.filter(invoice => !reserved.has(invoice.id));
      if (!sources.length) {
        for (const row of records) {
          const details = summaryMetadata(row.metadata);
          if (row.invoice.userId === req.params.userId && details?.month === month &&
              details.status === "FINALISED" && invoices.every(invoice => details.invoiceIds.includes(invoice.id))) {
            return summaryView(row, details, invoices);
          }
        }
        return null;
      }
      const invoiceIds = sources.map(invoice => invoice.id);
      for (const row of records) {
        const details = summaryMetadata(row.metadata);
        if (row.invoice.userId === req.params.userId && details?.month === month &&
            details.status === "DRAFT" && details.invoiceIds.join(",") === invoiceIds.join(",")) {
          return summaryView(row, details, sources);
        }
      }
      const details: SummaryDetails = {
        number: `CONS-INV-${String(next).padStart(2, "0")}`, month, invoiceIds,
        status: "DRAFT", amountDue: null, issuedAt: null,
      };
      const record = await tx.invoiceAuditEvent.create({
        data: {
          invoiceId: invoiceIds[0], eventType: summaryEvent,
          description: `Created pending consolidated invoice ${details.number} for ${month}.`,
          metadata: details, adminId: admin.admin?.id,
        },
      });
      return summaryView(record, details, sources);
    });
    if (!result) return res.status(404).json({ error: "No available finalised invoices with a balance due were found for that month." });
    return res.status(201).json({ summary: result });
  } catch (error) {
    console.error("Monthly summary generation error:", error);
    return res.status(500).json({ error: "Unable to generate the consolidated invoice." });
  }
});

async function loadMonthlySummaryPdf(userId: string, summaryId: string) {
  const record = await findMonthlySummary(prisma, userId, summaryId);
  const details = record && summaryMetadata(record.metadata);
  if (!record || !details) return { ok: false, status: 404, error: "Consolidated invoice not found." } as const;
  const invoices = await prisma.invoice.findMany({
    where: { ...summaryInvoiceFilter, userId, id: { in: details.invoiceIds } },
    include: invoiceInclude(),
    orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
  });
  if (invoices.length !== details.invoiceIds.length) {
    return { ok: false, status: 409, error: "An included invoice is no longer finalised. Check the individual invoices before continuing." } as const;
  }
  const first = invoices[0];
  const recipient = first.user?.accountsEmail || first.user?.email;
  const sum = (key: "subtotal" | "vatAmount" | "total") => invoices.reduce((total, invoice) => total.add(invoice[key]), new Prisma.Decimal(0));
  const pdf = await renderInvoicePdf({
    ...first,
    invoiceNumber: details.number, invoiceType: "CONSOLIDATED", billingAccountType: "TRADE",
    status: details.status, issuedAt: details.issuedAt ? new Date(details.issuedAt) : null, finalisedAt: null,
    createdAt: record.createdAt, supplyDate: null, dueDate: summaryDueDate(details.month), paymentTerms: summaryPaymentTerms,
    subtotal: sum("subtotal"), vatAmount: sum("vatAmount"), total: sum("total"),
    booking: null, invoiceBookings: [], auditEvents: [], notes: null, customerReference: null, purchaseOrderNumber: null,
    allocations: invoices.flatMap(invoice => invoice.allocations),
    creditNotes: invoices.flatMap(invoice => invoice.creditNotes),
    lines: invoices.flatMap(invoice => invoice.lines),
  }, { month: details.month, invoices });
  return { ok: true, record, details, invoices, recipient, pdf } as const;
}

async function updateMonthlySummary(
  userId: string, summaryId: string, adminId: string | undefined,
  payment?: { amount: Prisma.Decimal; paidAt: Date },
) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121107)`;
    const record = await findMonthlySummary(tx, userId, summaryId);
    const details = record && summaryMetadata(record.metadata);
    if (!record || !details) return { error: "Consolidated invoice not found.", status: 404 } as const;
    if (details.status === "PAID" || (!payment && details.status === "FINALISED")) {
      return { error: "This consolidated invoice has already been " + (details.status === "PAID" ? "paid." : "finalised."), status: 409 } as const;
    }
    if (payment && details.status !== "FINALISED") {
      return { error: "Finalise this consolidated invoice before recording payment.", status: 409 } as const;
    }
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id IN (${Prisma.join(details.invoiceIds)}) ORDER BY id FOR UPDATE`;
    const invoices = await tx.invoice.findMany({
      where: { ...summaryInvoiceFilter, userId, id: { in: details.invoiceIds } },
      select: summaryBalanceSelect,
    });
    if (invoices.length !== details.invoiceIds.length || invoices.some(invoice => !canConsolidate(invoice))) {
      return { error: "An included invoice is no longer finalised with a balance due. Check the individual invoices before continuing.", status: 409 } as const;
    }
    const amountDue = combinedBalance(invoices);
    if (payment) {
      if (!amountDue.eq(details.amountDue ?? 0)) {
        return { error: "The balance has changed since finalisation. Review the individual invoices before recording this transfer.", status: 409 } as const;
      }
      if (!payment.amount.eq(amountDue)) {
        return { error: `Record one full bank transfer of £${amountDue.toFixed(2)}.`, status: 400 } as const;
      }
      const receipt = await tx.payment.create({
        data: {
          userId, provider: "MANUAL", paymentMethod: "BANK_TRANSFER", status: "PAID", amount: payment.amount,
          currency: "GBP", reference: details.number, notes: `Cleared by consolidated invoice ${details.number}.`,
          paidAt: payment.paidAt,
        },
      });
      await tx.paymentAllocation.createMany({
        data: invoices.map(invoice => ({ paymentId: receipt.id, invoiceId: invoice.id, amount: outstandingForSummary(invoice), allocatedByAdminId: adminId })),
      });
      await tx.invoice.updateMany({
        where: { id: { in: details.invoiceIds } },
        data: { status: "PAID", paidAt: payment.paidAt },
      });
      await tx.invoiceAuditEvent.createMany({
        data: invoices.map(invoice => ({
          invoiceId: invoice.id, eventType: "PAYMENT_RECORDED", adminId,
          description: `Cleared by full bank transfer for consolidated invoice ${details.number}.`,
          metadata: { paymentId: receipt.id, summaryId, reference: details.number, amount: outstandingForSummary(invoice).toFixed(2) },
        })),
      });
    } else {
      const others = await tx.invoiceAuditEvent.findMany({
        where: { eventType: summaryEvent, invoice: { userId } },
        select: { id: true, metadata: true },
      });
      if (others.some(row => {
        const other = summaryMetadata(row.metadata);
        return row.id !== summaryId && other?.status === "FINALISED" && other.invoiceIds.some(id => details.invoiceIds.includes(id));
      })) return { error: "An included invoice is already on an unpaid consolidated invoice.", status: 409 } as const;
    }
    const updated: SummaryDetails = {
      ...details, status: payment ? "PAID" : "FINALISED",
      amountDue: amountDue.toFixed(2), issuedAt: details.issuedAt ?? new Date().toISOString(),
    };
    await tx.invoiceAuditEvent.update({ where: { id: record.id }, data: { metadata: updated } });
    return { summary: summaryView(record, updated, invoices) };
  }, { timeout: 15000 });
}

router.post("/admin/monthly-summary/:userId/:summaryId/finalise", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const result = await updateMonthlySummary(getString(req.params.userId), getString(req.params.summaryId), admin.admin?.id);
    if ("error" in result && result.status) return res.status(result.status).json({ error: result.error });
    return res.json({ summary: result.summary });
  } catch (error) {
    console.error("Monthly summary finalisation error:", error);
    return res.status(500).json({ error: "Unable to finalise the consolidated invoice." });
  }
});

router.post("/admin/monthly-summary/:userId/:summaryId/record-payment", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  const value = String(req.body?.amount ?? "");
  const paidAtValue = getString(req.body?.paidAt);
  const paidAt = paidAtValue ? new Date(paidAtValue) : new Date();
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number.isNaN(paidAt.getTime())) {
    return res.status(400).json({ error: "Enter the full transfer amount and a valid payment date." });
  }
  try {
    const result = await updateMonthlySummary(getString(req.params.userId), getString(req.params.summaryId), admin.admin?.id, {
      amount: new Prisma.Decimal(value), paidAt,
    });
    if ("error" in result && result.status) return res.status(result.status).json({ error: result.error });
    return res.status(201).json({ summary: result.summary });
  } catch (error) {
    console.error("Monthly summary payment error:", error);
    return res.status(500).json({ error: "Unable to record the consolidated payment." });
  }
});

router.get("/admin/monthly-summary/:userId/:summaryId/pdf", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const summary = await loadMonthlySummaryPdf(getString(req.params.userId), getString(req.params.summaryId));
    if (!summary.ok) return res.status(summary.status).json({ error: summary.error });
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `inline; filename="${summary.details.number}.pdf"`);
    return res.type("application/pdf").send(summary.pdf);
  } catch (error) {
    console.error("Monthly summary PDF error:", error);
    return res.status(500).json({ error: "Unable to open the consolidated invoice PDF." });
  }
});

router.post("/admin/monthly-summary/:userId/:summaryId/send", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const summary = await loadMonthlySummaryPdf(getString(req.params.userId), getString(req.params.summaryId));
    if (!summary.ok) return res.status(summary.status).json({ error: summary.error });
    const { record, details, invoices, recipient, pdf } = summary;
    if (details.status === "DRAFT") return res.status(409).json({ error: "Finalise the consolidated invoice before emailing it." });
    if (details.status === "FINALISED" && !combinedBalance(invoices).eq(details.amountDue ?? 0)) {
      return res.status(409).json({ error: "The balance has changed since finalisation. Review the individual invoices before sending." });
    }
    if (!recipient) return res.status(400).json({ error: "This customer account has no invoice email address." });
    const result = await sendEmail({
      to: recipient,
      subject: `Consolidated invoice ${details.number}`,
      html: emailLayout("Consolidated invoice", details.status === "PAID"
        ? "<p>Your paid consolidated invoice is attached.</p>"
        : `<p>Your consolidated invoice is attached. Please pay the full amount in one transfer using BACS reference <strong>${details.number}</strong> by the 15th of the invoice month.</p>`, "accounts"),
      department: "accounts",
      attachments: [{ filename: `${details.number}.pdf`, content: pdf }],
    });
    if ("skipped" in result || result.error) return res.status(502).json({ error: "The consolidated invoice email could not be sent." });
    await prisma.invoiceAuditEvent.create({
      data: {
        invoiceId: record.invoiceId, eventType: "MONTHLY_INVOICE_SUMMARY_SENT",
        description: `Emailed ${details.number} to ${recipient}.`,
        adminId: admin.admin?.id, metadata: { summaryId: record.id, providerMessageId: result.data?.id || null },
      },
    });
    return res.json({ message: `${details.number} sent to ${recipient}.` });
  } catch (error) {
    console.error("Monthly summary email error:", error);
    return res.status(500).json({ error: "Unable to email the consolidated invoice." });
  }
});

router.post(["/admin/:id/reopen", "/admin/:id/unfinalise"], async (req, res) => {
  const admin = requireAdmin(req); if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoice = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${getString(req.params.id)} FOR UPDATE`;
      const row = await tx.invoice.findUnique({ where: { id: getString(req.params.id) }, include: invoiceInclude() });
      if (row?.invoiceType === "CONSOLIDATED") throw new Error("Consolidated invoices can only be emailed.");
      if (!row) throw new Error("Invoice not found.");
      if (row.status === "DRAFT") return row;
      if (!["FINALISED", "SENT", "OVERDUE", "ISSUED"].includes(row.status) || row.paidAt || row.allocations.some(a => a.amount.greaterThan(0)) || row.payments.some(p => p.status === "PAID") || row.creditNotes.some(n => n.status === "ISSUED")) throw new Error("Only an unpaid invoice without payments or issued credit notes can be unfinalised.");
      await tx.invoiceAuditEvent.create({ data: { invoiceId: row.id, eventType: "UNFINALISED", description: "Invoice returned to Pending for correction. Finalise and resend after editing.", metadata: { previousStatus: row.status, previousPdfStorageKey: row.pdfStorageKey, previouslySentAt: row.sentAt?.toISOString() || null } } });
      return tx.invoice.update({ where: { id: row.id }, data: { status: "DRAFT", checkedAt: null, finalisedAt: null, sentAt: null, pdfUrl: null, pdfStorageKey: null }, include: invoiceInclude() });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ success: true, invoice, message: "Invoice unfinalised and returned to Pending." });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Unable to unfinalise invoice." }); }
});

router.post("/admin/:id/finalise", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121012)`;
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${req.params.id} FOR UPDATE`;
    let invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude() });
      if (invoice?.invoiceType === "CONSOLIDATED") throw new Error("Consolidated invoices can only be emailed.");
    if (!invoice) throw new Error("Invoice not found.");
    if((invoice.billingAccountType || invoice.user?.accountType) === "TRADE" && invoice.issuedAt && invoice.issuedAt > new Date()) throw new Error("This Trade invoice can be finalised on its scheduled issue date, the 1st of the following month.");
    if (invoice.status !== "DRAFT") { if(invoice.pdfStorageKey && ["FINALISED","SENT","ISSUED","OVERDUE","PAID","PARTIALLY_PAID"].includes(invoice.status))return invoice; throw new Error("Only draft invoices can be finalised."); }
    if (invoice.commercialContractInvoice) {
      const { contractId, month } = invoice.commercialContractInvoice;
      const contract = await tx.commercialContract.findUniqueOrThrow({ where: { id: contractId } });
      await refreshContractDraft(tx, contract, month, invoice.id, true);
      invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: invoiceInclude() });
    }
    if (!invoice.lines.length) throw new Error("Invoice must contain at least one financial charge line.");
    const finalisedAt = new Date();
    const issuedAt = invoice.issuedAt || finalisedAt;
    const terms = invoiceTerms((invoice.billingAccountType || invoice.user?.accountType), issuedAt, { paymentTerms: invoice.paymentTerms, dueDate: invoice.dueDate });
    const supplyDate = invoice.supplyDate || invoice.booking?.collectionDate || invoice.invoiceBookings[0]?.bookingDate || finalisedAt;

    const pdf = await generateAndStoreInvoicePdf({
      invoice: {
        ...invoice,
        status: "FINALISED",
        ...terms,
        finalisedAt,
        issuedAt,
        supplyDate,
      },
    });

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
          ...terms,
          finalisedAt,
          issuedAt,
          supplyDate,
          pdfUrl: pdf.url,
          pdfStorageKey: pdf.storageKey,
        },
        include: invoiceInclude(),
      });
    }, {timeout:60000});
    res.json({ success: true, invoice: updated });
  } catch (error) {
    console.error("Invoice finalise error:", error);
    res.status(409).json({ error: error instanceof Error && /Cloudinary|scheduled issue date|financial charge line|draft invoice|not found|Commercial Contracts/.test(error.message) ? error.message : "Unable to store the finalised invoice PDF. Check invoice storage configuration and try again; the draft has been retained." });
  }
});

router.post("/admin/:id/credit-notes", async (req, res) => {
  const admin = requireAdmin(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  try {
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

    const amountValue = getNumber(req.body.amount); const reason = getString(req.body.reason);
    if (amountValue == null || amountValue <= 0 || !reason) return res.status(400).json({ error: "Credit amount and reason are required." });
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${req.params.id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { creditNotes: true, allocations: true } });
      if (!invoice) return { error: "Invoice not found.", status: 404 } as const;
      if (["DRAFT", "VOID", "CANCELLED"].includes(invoice.status)) return { error: "Credit notes can only be raised against an issued invoice.", status: 400 } as const;
      const existingCredits = invoice.creditNotes.filter((c) => c.status === "ISSUED").reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
      const remaining = invoice.total.sub(existingCredits);
      const amount = roundMoney(new Prisma.Decimal(amountValue));
      if (amount.greaterThan(remaining)) return { error: "Credit amount exceeds the remaining invoice value.", status: 400 } as const;
      const settings = await tx.companySettings.findFirst(); if (!settings) throw new Error("Company settings are required.");
      const creditNoteNumber = `${settings.creditNotePrefix}-${String(settings.nextCreditNoteNumber).padStart(6, "0")}`;
      const creditNote = await tx.creditNote.create({ data: { creditNoteNumber, invoiceId: invoice.id, status: "ISSUED", amount, reason } });
      await tx.companySettings.update({ where: { id: settings.id }, data: { nextCreditNoteNumber: { increment: 1 } } });
      await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "CREDIT_NOTE_CREATED", description: `${creditNoteNumber} created for £${amount.toFixed(2)}.`, metadata: { reason } } });
      const fullyCredited = amount.equals(remaining);
      const updatedInvoice = await tx.invoice.update({ where: { id: invoice.id }, data: fullyCredited ? { status: "CREDITED" } : {}, include: invoiceInclude() });
      return { creditNote, invoice: updatedInvoice };
    });
    if ("error" in result && result.status) return res.status(result.status).json({ error: result.error });
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
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

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

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${req.params.id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { id: req.params.id },
        include: {
          allocations: true,
          creditNotes: true,
        },
      });

      if (!invoice) {
        return { error: "Invoice not found.", status: 404 } as const;
      }

      if (["DRAFT", "VOID", "CREDITED", "CANCELLED", "PAID"].includes(invoice.status)) {
        return { error: "A payment cannot be recorded against this invoice.", status: 400 } as const;
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
        return { error: "This invoice has no outstanding balance.", status: 400 } as const;
      }

      const amount = roundMoney(new Prisma.Decimal(amountValue));

      if (amount.greaterThan(invoiceOutstanding)) {
        return { error: `Payment exceeds the invoice outstanding balance of £${invoiceOutstanding.toFixed(2)}.`, status: 400 } as const;
      }

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

    if ("error" in result && result.status) return res.status(result.status).json({ error: result.error });

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
    const invoiceType = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { invoiceType: true } });
    if (invoiceType?.invoiceType === "CONSOLIDATED") {
      return res.status(409).json({ error: "Consolidated invoices can only be emailed." });
    }

    const amountValue = getNumber(req.body.amount); const paymentId = getString(req.body.paymentId);
    if (!paymentId || amountValue == null || amountValue <= 0) return res.status(400).json({ error: "Payment and allocation amount are required." });
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${req.params.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { allocations: true, creditNotes: true } });
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
      if (!invoice || !payment) return { error: "Invoice or payment not found.", status: 404 } as const;
      if (payment.status !== "PAID") return { error: "Only paid payments can be allocated.", status: 400 } as const;
      const allocatedToPayment = payment.allocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
      const paymentRemaining = payment.amount.sub(allocatedToPayment); const amount = roundMoney(new Prisma.Decimal(amountValue));
      if (amount.greaterThan(paymentRemaining)) return { error: "Allocation exceeds the unallocated payment amount.", status: 400 } as const;
      const credits = invoice.creditNotes.filter((c) => c.status === "ISSUED").reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
      const alreadyPaid = invoice.allocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
      const outstanding = invoice.total.sub(credits).sub(alreadyPaid);
      if (amount.greaterThan(outstanding)) return { error: "Allocation exceeds the invoice outstanding balance.", status: 400 } as const;
      await tx.paymentAllocation.create({ data: { paymentId, invoiceId: invoice.id, amount, allocatedByAdminId: getOptionalString(req.body.adminId), notes: getOptionalString(req.body.notes) } });
      const newPaid = alreadyPaid.add(amount); const newOutstanding = invoice.total.sub(credits).sub(newPaid);
      const status = newOutstanding.lessThanOrEqualTo(0) ? "PAID" : "PARTIALLY_PAID";
      await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "PAYMENT_ALLOCATED", description: `Payment of £${amount.toFixed(2)} allocated.` } });
      return tx.invoice.update({ where: { id: invoice.id }, data: { status, paidAt: status === "PAID" ? new Date() : null }, include: invoiceInclude() });
    });
    if ("error" in result && result.status) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, invoice: result });
  } catch (error) {
    console.error("Payment allocation error:", error);
    res.status(500).json({ error: "Unable to allocate payment." });
  }
});


export async function runInvoiceReminders(){
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const approachingEnd = new Date(todayStart);
    approachingEnd.setUTCDate(approachingEnd.getUTCDate() + 4);

    const invoices = await prisma.invoice.findMany({
      where: {
        commercialContractInvoice: null,
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

    return {success:true,sent,skipped,failures};
}
router.post("/admin/process-reminders",async(req,res)=>{const access=requireAdmin(req);if(!access.authorised)return res.status(access.status).json({error:access.error});try{res.json(await runInvoiceReminders());}catch{res.status(500).json({error:"Unable to process invoice reminders."});}});

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
