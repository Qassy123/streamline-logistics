import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
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

function parseDateRange(req: {
  query: Record<string, unknown>;
}) {
  const dateFromValue = getString(req.query.dateFrom);
  const dateToValue = getString(req.query.dateTo);
  const days = Math.min(
    getPositiveInteger(req.query.days, DEFAULT_RANGE_DAYS),
    MAX_RANGE_DAYS,
  );

  const now = new Date();
  const dateTo = dateToValue
    ? new Date(`${dateToValue}T23:59:59.999Z`)
    : now;

  const dateFrom = dateFromValue
    ? new Date(`${dateFromValue}T00:00:00.000Z`)
    : new Date(dateTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  if (
    Number.isNaN(dateFrom.getTime()) ||
    Number.isNaN(dateTo.getTime()) ||
    dateFrom > dateTo
  ) {
    throw new Error("Invalid report date range.");
  }

  return {
    dateFrom,
    dateTo,
  };
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return 0;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

function createDailyBuckets(dateFrom: Date, dateTo: Date) {
  const buckets: Record<
    string,
    {
      date: string;
      revenue: number;
      bookings: number;
      quotes: number;
      customers: number;
    }
  > = {};

  const cursor = new Date(dateFrom);
  cursor.setUTCHours(0, 0, 0, 0);

  const end = new Date(dateTo);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = dayKey(cursor);

    buckets[key] = {
      date: key,
      revenue: 0,
      bookings: 0,
      quotes: 0,
      customers: 0,
    };

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

function createMonthlyBuckets(dateFrom: Date, dateTo: Date) {
  const buckets: Record<
    string,
    {
      month: string;
      revenue: number;
      bookings: number;
      quotes: number;
      customers: number;
    }
  > = {};

  const cursor = new Date(
    Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), 1),
  );

  while (cursor <= end) {
    const key = monthKey(cursor);

    buckets[key] = {
      month: key,
      revenue: 0,
      bookings: 0,
      quotes: 0,
      customers: 0,
    };

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return buckets;
}

async function buildReport(dateFrom: Date, dateTo: Date) {
  const createdAtRange = {
    gte: dateFrom,
    lte: dateTo,
  };

  const [
    payments,
    invoices,
    bookings,
    quotes,
    customers,
    tradeAccounts,
    drivers,
    vehicles,
    bookingStatusTotals,
    invoiceStatusTotals,
    quoteStatusTotals,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        userId: true,
        booking: {
          select: {
            id: true,
            reference: true,
            userId: true,
            vehicle: {
              select: {
                vehicleType: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                companyName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        status: true,
        total: true,
        subtotal: true,
        vatAmount: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        collectionDate: true,
        driverId: true,
        vehicleId: true,
        userId: true,
        vehicle: {
          select: {
            vehicleType: true,
            name: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            companyName: true,
            email: true,
          },
        },
      },
    }),
    prisma.quote.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        vehicleSize: true,
        userId: true,
        companyName: true,
        customerName: true,
        customerEmail: true,
        booking: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        accountType: true,
        accountStatus: true,
        createdAt: true,
      },
    }),
    prisma.tradeAccount.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        status: true,
        creditLimit: true,
        currentBalance: true,
        createdAt: true,
      },
    }),
    prisma.driver.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        availability: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      select: {
        id: true,
        name: true,
        vehicleType: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            reservations: true,
          },
        },
      },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      where: {
        createdAt: createdAtRange,
      },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      where: {
        createdAt: createdAtRange,
      },
    }),
    prisma.quote.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      where: {
        createdAt: createdAtRange,
      },
    }),
  ]);

  const paidPayments = payments.filter(
    (payment) => String(payment.status).toUpperCase() === "PAID",
  );

  const revenue = paidPayments.reduce(
    (total, payment) => total + numberValue(payment.amount),
    0,
  );

  const paidInvoiceTotal = invoices
    .filter((invoice) => String(invoice.status).toUpperCase() === "PAID")
    .reduce((total, invoice) => total + numberValue(invoice.total), 0);

  const outstandingInvoiceTotal = invoices
    .filter((invoice) =>
      ["DRAFT", "ISSUED", "OVERDUE"].includes(
        String(invoice.status).toUpperCase(),
      ),
    )
    .reduce((total, invoice) => total + numberValue(invoice.total), 0);

  const overdueInvoiceTotal = invoices
    .filter((invoice) => {
      const status = String(invoice.status).toUpperCase();

      return (
        status === "OVERDUE" ||
        (invoice.dueDate &&
          invoice.dueDate < new Date() &&
          !["PAID", "CANCELLED"].includes(status))
      );
    })
    .reduce((total, invoice) => total + numberValue(invoice.total), 0);

  const convertedQuotes = quotes.filter(
    (quote) =>
      Boolean(quote.booking) ||
      ["ACCEPTED", "PAID", "CONVERTED TO BOOKING"].includes(
        String(quote.status).toUpperCase(),
      ),
  ).length;

  const quoteConversionRate =
    quotes.length > 0 ? (convertedQuotes / quotes.length) * 100 : 0;

  const dailyBuckets = createDailyBuckets(dateFrom, dateTo);
  const monthlyBuckets = createMonthlyBuckets(dateFrom, dateTo);

  paidPayments.forEach((payment) => {
    const effectiveDate = payment.paidAt || payment.createdAt;
    const daily = dailyBuckets[dayKey(effectiveDate)];
    const monthly = monthlyBuckets[monthKey(effectiveDate)];

    if (daily) {
      daily.revenue += numberValue(payment.amount);
    }

    if (monthly) {
      monthly.revenue += numberValue(payment.amount);
    }
  });

  bookings.forEach((booking) => {
    const daily = dailyBuckets[dayKey(booking.createdAt)];
    const monthly = monthlyBuckets[monthKey(booking.createdAt)];

    if (daily) daily.bookings += 1;
    if (monthly) monthly.bookings += 1;
  });

  quotes.forEach((quote) => {
    const daily = dailyBuckets[dayKey(quote.createdAt)];
    const monthly = monthlyBuckets[monthKey(quote.createdAt)];

    if (daily) daily.quotes += 1;
    if (monthly) monthly.quotes += 1;
  });

  customers.forEach((customer) => {
    const daily = dailyBuckets[dayKey(customer.createdAt)];
    const monthly = monthlyBuckets[monthKey(customer.createdAt)];

    if (daily) daily.customers += 1;
    if (monthly) monthly.customers += 1;
  });

  const revenueByCustomerMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      email: string;
      revenue: number;
      payments: number;
    }
  >();

  paidPayments.forEach((payment) => {
    const customer = payment.booking?.user;
    const customerId =
      customer?.id ||
      payment.userId ||
      payment.booking?.userId ||
      "guest";
    const customerName =
      customer?.companyName ||
      customer?.name ||
      "Guest customer";
    const email = customer?.email || "";

    const existing = revenueByCustomerMap.get(customerId) || {
      customerId,
      customerName,
      email,
      revenue: 0,
      payments: 0,
    };

    existing.revenue += numberValue(payment.amount);
    existing.payments += 1;

    revenueByCustomerMap.set(customerId, existing);
  });

  const revenueByVehicleTypeMap = new Map<
    string,
    {
      vehicleType: string;
      revenue: number;
      bookings: number;
    }
  >();

  paidPayments.forEach((payment) => {
    const vehicleType =
      payment.booking?.vehicle?.vehicleType || "Unassigned";

    const existing = revenueByVehicleTypeMap.get(vehicleType) || {
      vehicleType,
      revenue: 0,
      bookings: 0,
    };

    existing.revenue += numberValue(payment.amount);
    existing.bookings += 1;

    revenueByVehicleTypeMap.set(vehicleType, existing);
  });

  const driverUtilisation = drivers
    .map((driver) => ({
      driverId: driver.id,
      name: driver.name,
      active: driver.active,
      availability: driver.availability,
      bookings: driver._count.bookings,
    }))
    .sort((a, b) => b.bookings - a.bookings);

  const vehicleUtilisation = vehicles
    .map((vehicle) => ({
      vehicleId: vehicle.id,
      name: vehicle.name,
      vehicleType: vehicle.vehicleType,
      active: vehicle.active,
      bookings: vehicle._count.bookings,
      reservations: vehicle._count.reservations,
    }))
    .sort((a, b) => b.bookings - a.bookings);

  return {
    range: {
      dateFrom,
      dateTo,
    },
    overview: {
      revenue,
      paidInvoiceTotal,
      outstandingInvoiceTotal,
      overdueInvoiceTotal,
      bookings: bookings.length,
      quotes: quotes.length,
      convertedQuotes,
      quoteConversionRate,
      newCustomers: customers.length,
      newTradeAccounts: tradeAccounts.length,
      activeDrivers: drivers.filter((driver) => driver.active).length,
      activeVehicles: vehicles.filter((vehicle) => vehicle.active).length,
    },
    statusBreakdowns: {
      bookings: Object.fromEntries(
        bookingStatusTotals.map((item) => [
          item.status,
          item._count._all,
        ]),
      ),
      invoices: Object.fromEntries(
        invoiceStatusTotals.map((item) => [
          item.status,
          item._count._all,
        ]),
      ),
      quotes: Object.fromEntries(
        quoteStatusTotals.map((item) => [
          item.status,
          item._count._all,
        ]),
      ),
    },
    daily: Object.values(dailyBuckets),
    monthly: Object.values(monthlyBuckets),
    topCustomers: Array.from(revenueByCustomerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
    revenueByVehicleType: Array.from(revenueByVehicleTypeMap.values())
      .sort((a, b) => b.revenue - a.revenue),
    driverUtilisation,
    vehicleUtilisation,
    tradeAccounts: {
      total: tradeAccounts.length,
      totalCreditLimit: tradeAccounts.reduce(
        (total, account) => total + numberValue(account.creditLimit),
        0,
      ),
      totalCurrentBalance: tradeAccounts.reduce(
        (total, account) => total + numberValue(account.currentBalance),
        0,
      ),
      byStatus: tradeAccounts.reduce<Record<string, number>>(
        (totals, account) => {
          const key = String(account.status);
          totals[key] = (totals[key] || 0) + 1;
          return totals;
        },
        {},
      ),
    },
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

router.get("/", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const { dateFrom, dateTo } = parseDateRange(req);
    const report = await buildReport(dateFrom, dateTo);

    res.json(report);
  } catch (error) {
    console.error("Admin reports error:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate reports.",
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
    const { dateFrom, dateTo } = parseDateRange(req);
    const report = await buildReport(dateFrom, dateTo);

    const rows: string[][] = [
      ["Metric", "Value"],
      ["Revenue", String(report.overview.revenue)],
      ["Paid invoice total", String(report.overview.paidInvoiceTotal)],
      [
        "Outstanding invoice total",
        String(report.overview.outstandingInvoiceTotal),
      ],
      ["Overdue invoice total", String(report.overview.overdueInvoiceTotal)],
      ["Bookings", String(report.overview.bookings)],
      ["Quotes", String(report.overview.quotes)],
      ["Converted quotes", String(report.overview.convertedQuotes)],
      [
        "Quote conversion rate",
        report.overview.quoteConversionRate.toFixed(2),
      ],
      ["New customers", String(report.overview.newCustomers)],
      ["New trade accounts", String(report.overview.newTradeAccounts)],
      [],
      ["Top customer", "Email", "Revenue", "Payments"],
      ...report.topCustomers.map((customer) => [
        customer.customerName,
        customer.email,
        String(customer.revenue),
        String(customer.payments),
      ]),
      [],
      ["Vehicle type", "Revenue", "Bookings"],
      ...report.revenueByVehicleType.map((item) => [
        item.vehicleType,
        String(item.revenue),
        String(item.bookings),
      ]),
      [],
      ["Date", "Revenue", "Bookings", "Quotes", "Customers"],
      ...report.daily.map((item) => [
        item.date,
        String(item.revenue),
        String(item.bookings),
        String(item.quotes),
        String(item.customers),
      ]),
    ];

    const csv = rows
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const filename = `streamline-report-${dayKey(dateFrom)}-to-${dayKey(
      dateTo,
    )}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  } catch (error) {
    console.error("Admin reports CSV export error:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to export reports.",
    });
  }
});

export default router;