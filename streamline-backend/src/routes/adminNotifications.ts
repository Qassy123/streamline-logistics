import {
  BookingStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type NotificationCategory =
  | "BOOKING"
  | "PAYMENT"
  | "INVOICE"
  | "TRACKING"
  | "COMPLIANCE"
  | "SYSTEM";

type AdminNotification = {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  createdAt: Date;
  bookingId?: string | null;
  bookingReference?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  sourceType: string;
  sourceId: string;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
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

function bookingPriority(status: BookingStatus): NotificationPriority {
  if (
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.EXPIRED
  ) {
    return "HIGH";
  }

  if (
    status === BookingStatus.PENDING_PAYMENT ||
    status === BookingStatus.IN_PROGRESS
  ) {
    return "NORMAL";
  }

  return "LOW";
}

function invoicePriority(
  status: InvoiceStatus,
  dueDate: Date | null,
): NotificationPriority {
  if (status === InvoiceStatus.OVERDUE) return "URGENT";

  if (
    dueDate &&
    dueDate < new Date() &&
    status !== InvoiceStatus.PAID &&
    status !== InvoiceStatus.CANCELLED
  ) {
    return "URGENT";
  }

  if (status === InvoiceStatus.ISSUED) return "NORMAL";

  return "LOW";
}

function paymentPriority(status: PaymentStatus): NotificationPriority {
  if (status === PaymentStatus.FAILED) return "URGENT";
  if (status === PaymentStatus.REFUNDED) return "HIGH";
  if (status === PaymentStatus.PENDING) return "NORMAL";
  return "LOW";
}

function matchesSearch(notification: AdminNotification, search: string) {
  if (!search) return true;

  const haystack = [
    notification.title,
    notification.message,
    notification.bookingReference,
    notification.customerName,
    notification.driverName,
    notification.vehicleName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
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
    const category = getString(req.query.category).toUpperCase();
    const priority = getString(req.query.priority).toUpperCase();
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);

    const createdAt: Prisma.DateTimeFilter = {};

    if (dateFrom) {
      createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const createdAtFilter =
      createdAt.gte || createdAt.lte ? createdAt : undefined;

    const [
      bookings,
      payments,
      invoices,
      trackingEvents,
      vehicles,
    ] = await Promise.all([
      prisma.booking.findMany({
        where: createdAtFilter
          ? {
              updatedAt: createdAtFilter,
            }
          : undefined,
        orderBy: {
          updatedAt: "desc",
        },
        take: 250,
        include: {
          user: true,
          driver: true,
          vehicle: true,
        },
      }),
      prisma.payment.findMany({
        where: createdAtFilter
          ? {
              updatedAt: createdAtFilter,
            }
          : undefined,
        orderBy: {
          updatedAt: "desc",
        },
        take: 250,
        include: {
          user: true,
          booking: {
            include: {
              driver: true,
              vehicle: true,
              user: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: createdAtFilter
          ? {
              updatedAt: createdAtFilter,
            }
          : undefined,
        orderBy: {
          updatedAt: "desc",
        },
        take: 250,
        include: {
          user: true,
          booking: {
            include: {
              driver: true,
              vehicle: true,
              user: true,
            },
          },
        },
      }),
      prisma.bookingTrackingEvent.findMany({
        where: createdAtFilter
          ? {
              createdAt: createdAtFilter,
            }
          : undefined,
        orderBy: {
          createdAt: "desc",
        },
        take: 250,
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
      prisma.vehicle.findMany({
        where: {
          active: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
    ]);

    const notifications: AdminNotification[] = [];

    bookings.forEach((booking) => {
      notifications.push({
        id: `booking:${booking.id}:${booking.updatedAt.toISOString()}`,
        category: "BOOKING",
        priority: bookingPriority(booking.status),
        title: `Booking ${String(booking.status).replace(/_/g, " ").toLowerCase()}`,
        message: `${booking.reference} is currently ${String(
          booking.status,
        )
          .replace(/_/g, " ")
          .toLowerCase()}.`,
        createdAt: booking.updatedAt,
        bookingId: booking.id,
        bookingReference: booking.reference,
        customerId: booking.user?.id || null,
        customerName:
          booking.user?.companyName || booking.user?.name || null,
        driverId: booking.driver?.id || null,
        driverName: booking.driver?.name || null,
        vehicleId: booking.vehicle?.id || null,
        vehicleName: booking.vehicle?.name || null,
        sourceType: "BOOKING",
        sourceId: booking.id,
      });
    });

    payments.forEach((payment) => {
      const booking = payment.booking;
      const customer = payment.user || booking?.user || null;

      notifications.push({
        id: `payment:${payment.id}:${payment.updatedAt.toISOString()}`,
        category: "PAYMENT",
        priority: paymentPriority(payment.status),
        title: `Payment ${String(payment.status).toLowerCase()}`,
        message: booking
          ? `Payment for ${booking.reference} is ${String(
              payment.status,
            ).toLowerCase()}.`
          : `Payment ${payment.id} is ${String(
              payment.status,
            ).toLowerCase()}.`,
        createdAt: payment.updatedAt,
        bookingId: booking?.id || null,
        bookingReference: booking?.reference || null,
        customerId: customer?.id || null,
        customerName:
          customer?.companyName || customer?.name || null,
        driverId: booking?.driver?.id || null,
        driverName: booking?.driver?.name || null,
        vehicleId: booking?.vehicle?.id || null,
        vehicleName: booking?.vehicle?.name || null,
        sourceType: "PAYMENT",
        sourceId: payment.id,
      });
    });

    invoices.forEach((invoice) => {
      const booking = invoice.booking;
      const customer = invoice.user || booking.user || null;

      notifications.push({
        id: `invoice:${invoice.id}:${invoice.updatedAt.toISOString()}`,
        category: "INVOICE",
        priority: invoicePriority(invoice.status, invoice.dueDate),
        title: `Invoice ${String(invoice.status).toLowerCase()}`,
        message: `${invoice.invoiceNumber} for ${booking.reference} is ${String(
          invoice.status,
        ).toLowerCase()}.`,
        createdAt: invoice.updatedAt,
        bookingId: booking.id,
        bookingReference: booking.reference,
        customerId: customer?.id || null,
        customerName:
          customer?.companyName || customer?.name || null,
        driverId: booking.driver?.id || null,
        driverName: booking.driver?.name || null,
        vehicleId: booking.vehicle?.id || null,
        vehicleName: booking.vehicle?.name || null,
        sourceType: "INVOICE",
        sourceId: invoice.id,
      });
    });

    trackingEvents.forEach((event) => {
      const booking = event.booking;

      notifications.push({
        id: `tracking:${event.id}`,
        category: "TRACKING",
        priority:
          event.status === BookingStatus.CANCELLED ||
          event.status === BookingStatus.EXPIRED
            ? "HIGH"
            : "NORMAL",
        title: event.title,
        message:
          event.description ||
          `Tracking event recorded for ${booking.reference}.`,
        createdAt: event.createdAt,
        bookingId: booking.id,
        bookingReference: booking.reference,
        customerId: booking.user?.id || null,
        customerName:
          booking.user?.companyName || booking.user?.name || null,
        driverId: booking.driver?.id || null,
        driverName: booking.driver?.name || null,
        vehicleId: booking.vehicle?.id || null,
        vehicleName: booking.vehicle?.name || null,
        sourceType: "TRACKING_EVENT",
        sourceId: event.id,
      });
    });

    const now = new Date();

    vehicles.forEach((vehicle) => {
      const complianceItems = [
        {
          label: "MOT",
          value: vehicle.motExpiry,
        },
        {
          label: "insurance",
          value: vehicle.insuranceExpiry,
        },
        {
          label: "service",
          value: vehicle.serviceDueDate,
        },
      ];

      complianceItems.forEach((item) => {
        if (!item.value) return;

        const daysRemaining = Math.ceil(
          (item.value.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if (daysRemaining > 30) return;

        const expired = daysRemaining < 0;

        notifications.push({
          id: `compliance:${vehicle.id}:${item.label}:${item.value.toISOString()}`,
          category: "COMPLIANCE",
          priority: expired ? "URGENT" : daysRemaining <= 7 ? "HIGH" : "NORMAL",
          title: `${vehicle.name} ${item.label} ${
            expired ? "expired" : "due soon"
          }`,
          message: expired
            ? `${vehicle.name} ${item.label} expired ${Math.abs(
                daysRemaining,
              )} day(s) ago.`
            : `${vehicle.name} ${item.label} is due in ${daysRemaining} day(s).`,
          createdAt: vehicle.updatedAt,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          sourceType: "VEHICLE_COMPLIANCE",
          sourceId: vehicle.id,
        });
      });
    });

    const filtered = notifications
      .filter((notification) => matchesSearch(notification, search))
      .filter(
        (notification) =>
          !category ||
          category === "ALL" ||
          notification.category === category,
      )
      .filter(
        (notification) =>
          !priority ||
          priority === "ALL" ||
          notification.priority === priority,
      )
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

    const total = filtered.length;
    const paginated = filtered.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    const byCategory = filtered.reduce<Record<string, number>>(
      (totals, notification) => {
        totals[notification.category] =
          (totals[notification.category] || 0) + 1;
        return totals;
      },
      {},
    );

    const byPriority = filtered.reduce<Record<string, number>>(
      (totals, notification) => {
        totals[notification.priority] =
          (totals[notification.priority] || 0) + 1;
        return totals;
      },
      {},
    );

    res.json({
      notifications: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byCategory,
        byPriority,
      },
    });
  } catch (error) {
    console.error("Admin notifications list error:", error);

    res.status(500).json({
      error: "Unable to load notifications.",
    });
  }
});

router.post("/booking-event", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const bookingId = getString(req.body.bookingId);
    const title = getString(req.body.title);
    const description = getString(req.body.description);
    const statusValue = getString(req.body.status).toUpperCase();

    if (!bookingId || !title) {
      return res.status(400).json({
        error: "Booking and notification title are required.",
      });
    }

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    if (
      statusValue &&
      !Object.values(BookingStatus).includes(
        statusValue as BookingStatus,
      )
    ) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    const event = await prisma.bookingTrackingEvent.create({
      data: {
        bookingId: booking.id,
        status: statusValue
          ? (statusValue as BookingStatus)
          : booking.status,
        title,
        description: description || null,
        userVisible: getBoolean(req.body.userVisible),
      },
    });

    res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Admin notification creation error:", error);

    res.status(500).json({
      error: "Unable to create notification.",
    });
  }
});

export default router;