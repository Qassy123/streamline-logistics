import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type AuditEntity =
  | "BOOKING"
  | "CUSTOMER"
  | "DRIVER"
  | "VEHICLE"
  | "PAYMENT"
  | "INVOICE"
  | "QUOTE"
  | "TRADE_ACCOUNT"
  | "TRACKING";

type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "PAYMENT_EVENT"
  | "TRACKING_EVENT";

type AuditEntry = {
  id: string;
  entity: AuditEntity;
  action: AuditAction;
  entityId: string;
  reference: string;
  title: string;
  description: string;
  createdAt: Date;
  actor: string;
  customerId?: string | null;
  bookingId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  metadata?: Record<string, unknown>;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
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

function createDateFilter(
  dateFrom: string,
  dateTo: string,
): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};

  if (dateFrom) {
    filter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  }

  if (dateTo) {
    filter.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  return filter.gte || filter.lte ? filter : undefined;
}

function matchesSearch(entry: AuditEntry, search: string) {
  if (!search) return true;

  const haystack = [
    entry.reference,
    entry.title,
    entry.description,
    entry.actor,
    entry.entity,
    entry.action,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

async function buildAuditEntries(
  dateFilter: Prisma.DateTimeFilter | undefined,
) {
  const [
    bookings,
    customers,
    drivers,
    vehicles,
    payments,
    invoices,
    quotes,
    tradeAccounts,
    trackingEvents,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        user: true,
        driver: true,
        vehicle: true,
      },
    }),
    prisma.user.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.driver.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        vehicle: true,
      },
    }),
    prisma.vehicle.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.payment.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        booking: true,
        user: true,
      },
    }),
    prisma.invoice.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        booking: true,
        user: true,
      },
    }),
    prisma.quote.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.tradeAccount.findMany({
      where: dateFilter ? { updatedAt: dateFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        user: true,
      },
    }),
    prisma.bookingTrackingEvent.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        booking: {
          include: {
            user: true,
            driver: true,
            vehicle: true,
          },
        },
      },
    }),
  ]);

  const entries: AuditEntry[] = [];

  bookings.forEach((booking) => {
    entries.push({
      id: `booking:${booking.id}:${booking.updatedAt.toISOString()}`,
      entity: "BOOKING",
      action:
        booking.driverId || booking.vehicleId
          ? "ASSIGNED"
          : booking.createdAt.getTime() === booking.updatedAt.getTime()
            ? "CREATED"
            : "UPDATED",
      entityId: booking.id,
      reference: booking.reference,
      title: `Booking ${booking.reference}`,
      description: `Booking is ${String(booking.status)
        .replace(/_/g, " ")
        .toLowerCase()}.`,
      createdAt: booking.updatedAt,
      actor: "System / Admin",
      customerId: booking.userId,
      bookingId: booking.id,
      driverId: booking.driverId,
      vehicleId: booking.vehicleId,
      metadata: {
        status: booking.status,
        customer:
          booking.user?.companyName || booking.user?.name || null,
        driver: booking.driver?.name || null,
        vehicle: booking.vehicle?.name || null,
      },
    });
  });

  customers.forEach((customer) => {
    entries.push({
      id: `customer:${customer.id}:${customer.updatedAt.toISOString()}`,
      entity: "CUSTOMER",
      action:
        customer.createdAt.getTime() === customer.updatedAt.getTime()
          ? "CREATED"
          : "UPDATED",
      entityId: customer.id,
      reference: customer.accountNumber || customer.email,
      title: customer.companyName || customer.name,
      description: `Customer account is ${String(
        customer.accountStatus,
      ).toLowerCase()}.`,
      createdAt: customer.updatedAt,
      actor: "System / Admin",
      customerId: customer.id,
      metadata: {
        accountType: customer.accountType,
        accountStatus: customer.accountStatus,
        email: customer.email,
      },
    });
  });

  drivers.forEach((driver) => {
    entries.push({
      id: `driver:${driver.id}:${driver.updatedAt.toISOString()}`,
      entity: "DRIVER",
      action:
        driver.createdAt.getTime() === driver.updatedAt.getTime()
          ? "CREATED"
          : "UPDATED",
      entityId: driver.id,
      reference: driver.email,
      title: driver.name,
      description: `Driver availability is ${String(
        driver.availability,
      ).toLowerCase()}.`,
      createdAt: driver.updatedAt,
      actor: "System / Admin",
      driverId: driver.id,
      vehicleId: driver.vehicleId,
      metadata: {
        active: driver.active,
        availability: driver.availability,
        vehicle: driver.vehicle?.name || null,
      },
    });
  });

  vehicles.forEach((vehicle) => {
    entries.push({
      id: `vehicle:${vehicle.id}:${vehicle.updatedAt.toISOString()}`,
      entity: "VEHICLE",
      action:
        vehicle.createdAt.getTime() === vehicle.updatedAt.getTime()
          ? "CREATED"
          : "UPDATED",
      entityId: vehicle.id,
      reference: vehicle.registration || vehicle.name,
      title: vehicle.name,
      description: `${vehicle.vehicleType} is ${
        vehicle.active ? "active" : "inactive"
      }.`,
      createdAt: vehicle.updatedAt,
      actor: "System / Admin",
      vehicleId: vehicle.id,
      metadata: {
        vehicleType: vehicle.vehicleType,
        registration: vehicle.registration,
        active: vehicle.active,
      },
    });
  });

  payments.forEach((payment) => {
    entries.push({
      id: `payment:${payment.id}:${payment.updatedAt.toISOString()}`,
      entity: "PAYMENT",
      action: "PAYMENT_EVENT",
      entityId: payment.id,
      reference:
        payment.providerPaymentId ||
        payment.booking?.reference ||
        payment.id,
      title: `Payment ${String(payment.status).toLowerCase()}`,
      description: payment.booking
        ? `Payment linked to ${payment.booking.reference}.`
        : "Payment record updated.",
      createdAt: payment.updatedAt,
      actor: "Payment provider / Admin",
      customerId: payment.userId,
      bookingId: payment.bookingId,
      metadata: {
        status: payment.status,
        amount: payment.amount,
        provider: payment.provider,
      },
    });
  });

  invoices.forEach((invoice) => {
    entries.push({
      id: `invoice:${invoice.id}:${invoice.updatedAt.toISOString()}`,
      entity: "INVOICE",
      action: "STATUS_CHANGED",
      entityId: invoice.id,
      reference: invoice.invoiceNumber,
      title: `Invoice ${invoice.invoiceNumber}`,
      description: `Invoice status is ${String(
        invoice.status,
      ).toLowerCase()}.`,
      createdAt: invoice.updatedAt,
      actor: "System / Admin",
      customerId: invoice.userId,
      bookingId: invoice.bookingId,
      metadata: {
        status: invoice.status,
        total: invoice.total,
        dueDate: invoice.dueDate,
      },
    });
  });

  quotes.forEach((quote) => {
    entries.push({
      id: `quote:${quote.id}:${quote.updatedAt.toISOString()}`,
      entity: "QUOTE",
      action:
        quote.createdAt.getTime() === quote.updatedAt.getTime()
          ? "CREATED"
          : "STATUS_CHANGED",
      entityId: quote.id,
      reference: quote.id,
      title: `Quote for ${quote.companyName || quote.customerName}`,
      description: `Quote status is ${String(quote.status).toLowerCase()}.`,
      createdAt: quote.updatedAt,
      actor: "System / Admin",
      customerId: quote.userId,
      metadata: {
        status: quote.status,
        totalPrice: quote.totalPrice,
        customerEmail: quote.customerEmail,
      },
    });
  });

  tradeAccounts.forEach((account) => {
    entries.push({
      id: `trade-account:${account.id}:${account.updatedAt.toISOString()}`,
      entity: "TRADE_ACCOUNT",
      action:
        account.createdAt.getTime() === account.updatedAt.getTime()
          ? "CREATED"
          : "STATUS_CHANGED",
      entityId: account.id,
      reference: account.companyName,
      title: account.companyName,
      description: `Trade account status is ${String(
        account.status,
      ).toLowerCase()}.`,
      createdAt: account.updatedAt,
      actor: "System / Admin",
      customerId: account.userId,
      metadata: {
        status: account.status,
        creditLimit: account.creditLimit,
        currentBalance: account.currentBalance,
      },
    });
  });

  trackingEvents.forEach((event) => {
    entries.push({
      id: `tracking:${event.id}`,
      entity: "TRACKING",
      action: "TRACKING_EVENT",
      entityId: event.id,
      reference: event.booking.reference,
      title: event.title,
      description:
        event.description || `Tracking event for ${event.booking.reference}.`,
      createdAt: event.createdAt,
      actor: event.userVisible ? "Driver / Admin" : "Admin",
      customerId: event.booking.userId,
      bookingId: event.bookingId,
      driverId: event.booking.driverId,
      vehicleId: event.booking.vehicleId,
      metadata: {
        status: event.status,
        userVisible: event.userVisible,
      },
    });
  });

  return entries.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

router.get("/", async (req, res) => {
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
    const entity = getString(req.query.entity).toUpperCase();
    const action = getString(req.query.action).toUpperCase();
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);

    const dateFilter = createDateFilter(dateFrom, dateTo);
    const entries = await buildAuditEntries(dateFilter);

    const filtered = entries
      .filter((entry) => matchesSearch(entry, search))
      .filter(
        (entry) =>
          !entity || entity === "ALL" || entry.entity === entity,
      )
      .filter(
        (entry) =>
          !action || action === "ALL" || entry.action === action,
      );

    const total = filtered.length;
    const paginated = filtered.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    const byEntity = filtered.reduce<Record<string, number>>(
      (totals, entry) => {
        totals[entry.entity] = (totals[entry.entity] || 0) + 1;
        return totals;
      },
      {},
    );

    const byAction = filtered.reduce<Record<string, number>>(
      (totals, entry) => {
        totals[entry.action] = (totals[entry.action] || 0) + 1;
        return totals;
      },
      {},
    );

    res.json({
      entries: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byEntity,
        byAction,
      },
    });
  } catch (error) {
    console.error("Admin audit log error:", error);

    res.status(500).json({
      error: "Unable to load audit log.",
    });
  }
});

router.get("/export.csv", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const search = getString(req.query.search);
    const entity = getString(req.query.entity).toUpperCase();
    const action = getString(req.query.action).toUpperCase();
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);

    const dateFilter = createDateFilter(dateFrom, dateTo);
    const entries = await buildAuditEntries(dateFilter);

    const filtered = entries
      .filter((entry) => matchesSearch(entry, search))
      .filter(
        (entry) =>
          !entity || entity === "ALL" || entry.entity === entity,
      )
      .filter(
        (entry) =>
          !action || action === "ALL" || entry.action === action,
      );

    const rows = [
      [
        "Timestamp",
        "Entity",
        "Action",
        "Reference",
        "Title",
        "Description",
        "Actor",
      ],
      ...filtered.map((entry) => [
        entry.createdAt.toISOString(),
        entry.entity,
        entry.action,
        entry.reference,
        entry.title,
        entry.description,
        entry.actor,
      ]),
    ];

    const csv = rows
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="streamline-audit-log.csv"',
    );
    res.send(csv);
  } catch (error) {
    console.error("Admin audit export error:", error);

    res.status(500).json({
      error: "Unable to export audit log.",
    });
  }
});

export default router;