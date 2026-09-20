import { BookingStatus, PaymentStatus, Prisma, ReservationStatus } from "@prisma/client";
import { Router } from "express";
import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { assignRandomAvailableDriverToBooking } from "../lib/assignDriver";
import { getReservationWindow } from "../lib/reservationWindow";
import {
  sendAdminNewPaidBookingEmail,
  sendCustomerBookingConfirmedEmail,
  sendCustomerPaymentSuccessfulEmail,
} from "../lib/notifications";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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

function isPaymentStatus(value: string): value is PaymentStatus {
  return Object.values(PaymentStatus).includes(value as PaymentStatus);
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is missing from environment variables");
}

const stripe = new Stripe(stripeSecretKey);

function generateBookingReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `SL-${datePart}-${randomPart}`;
}

function getAuthToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.replace("Bearer ", "").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getAuthenticatedUser(req: { headers: { authorization?: string } }) {
  const token = getAuthToken(req);

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.userSession.delete({
        where: {
          id: session.id,
        },
      });
    }

    return null;
  }

  return session.user;
}

async function createInvoiceIfMissing(booking: {
  id: string;
  userId: string | null;
  totalPrice: Prisma.Decimal;
  reference: string;
  collectionDate: Date;
  collectionAddress: string;
  deliveryAddress: string;
  purchaseOrderNumber?: string | null;
  customerReference?: string | null;
  quote?: {
    deliveryType?: string | null;
    vatAmount: Prisma.Decimal | null;
    totalPrice: Prisma.Decimal | null;
  } | null;
}) {
  const existingInvoice = await prisma.invoice.findFirst({
    where: { bookingId: booking.id },
  });

  if (existingInvoice) return existingInvoice;

  return prisma.$transaction(async (transaction) => {
    const settings = await transaction.companySettings.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!settings) {
      throw new Error(
        "Company settings must be configured before invoices can be created.",
      );
    }

    const reservedSettings = await transaction.companySettings.update({
      where: { id: settings.id },
      data: { nextInvoiceNumber: { increment: 1 } },
    });

    const invoiceNumber = `${reservedSettings.invoicePrefix}-${String(
      reservedSettings.nextInvoiceNumber - 1,
    ).padStart(6, "0")}`;

    const total = new Prisma.Decimal(
      booking.quote?.totalPrice || booking.totalPrice,
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const vatRate = new Prisma.Decimal(reservedSettings.vatRate);
    const subtotal = vatRate.greaterThan(0)
      ? total
          .div(new Prisma.Decimal(1).add(vatRate.div(100)))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : total;
    const vatAmount = total
      .sub(subtotal)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const now = new Date();
    const routeDescription = `${booking.collectionAddress} → ${booking.deliveryAddress}`;
    const serviceDescription = booking.quote?.deliveryType || "Courier delivery";

    const invoice = await transaction.invoice.create({
      data: {
        invoiceNumber,
        bookingId: booking.id,
        userId: booking.userId,
        status: "FINALISED",
        invoiceType: "SINGLE",
        subtotal,
        vatAmount,
        total,
        dueDate: now,
        issuedAt: now,
        finalisedAt: now,
        supplyDate: booking.collectionDate,
        paymentTerms: "Pay now",
        customerReference: booking.customerReference || null,
        purchaseOrderNumber: booking.purchaseOrderNumber || null,
      },
    });

    await transaction.invoiceBooking.create({
      data: {
        invoiceId: invoice.id,
        bookingId: booking.id,
        bookingReference: booking.reference,
        bookingDate: booking.collectionDate,
        poReference: booking.purchaseOrderNumber || null,
        routeDescription,
        serviceDescription,
        netAmount: subtotal,
        vatAmount,
        grossAmount: total,
      },
    });

    await transaction.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        bookingId: booking.id,
        chargeType: "BASE_SERVICE",
        description: serviceDescription,
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

    await transaction.invoiceAuditEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "PAY_NOW_INVOICE_CREATED",
        description: `Pay-now invoice ${invoiceNumber} created and finalised for booking ${booking.reference}.`,
      },
    });

    return invoice;
  });
}

async function findAvailableVehicle(params: {
  vehicleType: string;
  reservedFrom: Date;
  reservedUntil: Date;
  excludeBookingId?: string;
}) {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      vehicleType: params.vehicleType,
      active: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      reservations: {
        where: {
          status: {
            in: [ReservationStatus.ACTIVE, ReservationStatus.CONFIRMED],
          },
          reservedFrom: {
            lt: params.reservedUntil,
          },
          reservedUntil: {
            gt: params.reservedFrom,
          },
          ...(params.excludeBookingId
            ? {
                bookingId: {
                  not: params.excludeBookingId,
                },
              }
            : {}),
        },
      },
    },
  });

  const overlappingBookings = await prisma.booking.findMany({
    where: {
      vehicleId: {
        not: null,
      },
      ...(params.excludeBookingId
        ? {
            id: {
              not: params.excludeBookingId,
            },
          }
        : {}),
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
        lt: params.reservedUntil,
      },
      estimatedEndTime: {
        gt: params.reservedFrom,
      },
    },
    select: {
      vehicleId: true,
    },
  });

  const blockedVehicleIds = new Set(
    overlappingBookings
      .map((booking) => booking.vehicleId)
      .filter((vehicleId): vehicleId is string => Boolean(vehicleId)),
  );

  return (
    vehicles.find(
      (vehicle) =>
        vehicle.reservations.length === 0 && !blockedVehicleIds.has(vehicle.id),
    ) || null
  );
}

async function createConfirmedBookingFromQuote(quoteId: string, userId?: string) {
  const quote = await prisma.quote.findUnique({
    where: {
      id: quoteId,
    },
    include: {
      booking: {
        include: {
          reservation: true,
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found.");
  }

  if (!quote.totalPrice) {
    throw new Error("Quote has no total price.");
  }

  if (!quote.collectionWindow || quote.collectionWindow === "ASAP") {
    throw new Error("A fixed collection window is required before booking.");
  }

  const resolvedUserId = userId || quote.userId || undefined;

  const companySettings = await prisma.companySettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { vehicleBlockHours: true },
  });

  const { reservedFrom, reservedUntil } = getReservationWindow(
    quote.collectionDate,
    quote.collectionWindow,
    companySettings?.vehicleBlockHours ?? 6,
  );

  const vehicleAvailableAt = reservedUntil;

  await prisma.quote.update({
    where: {
      id: quote.id,
    },
    data: {
      userId: resolvedUserId || null,
      status: "paid",
    },
  });

  if (quote.booking) {
    let vehicleId = quote.booking.vehicleId;

    if (!vehicleId) {
      const availableVehicle = await findAvailableVehicle({
        vehicleType: quote.vehicleSize,
        reservedFrom,
        reservedUntil,
        excludeBookingId: quote.booking.id,
      });

      if (!availableVehicle) {
        throw new Error("No vehicle available for this collection window.");
      }

      vehicleId = availableVehicle.id;
    }

    if (!quote.booking.reservation) {
      await prisma.vehicleReservation.create({
        data: {
          bookingId: quote.booking.id,
          vehicleId,
          quoteId: quote.id,
          status: ReservationStatus.CONFIRMED,
          reservedFrom,
          reservedUntil,
          expiresAt: null,
        },
      });
    } else {
      await prisma.vehicleReservation.update({
        where: {
          bookingId: quote.booking.id,
        },
        data: {
          vehicleId,
          quoteId: quote.id,
          status: ReservationStatus.CONFIRMED,
          reservedFrom,
          reservedUntil,
          expiresAt: null,
        },
      });
    }

    const booking = await prisma.booking.update({
      where: {
        id: quote.booking.id,
      },
      data: {
        userId: resolvedUserId || quote.booking.userId || null,
        vehicleId,
        status: BookingStatus.CONFIRMED,
        estimatedStartTime: reservedFrom,
        estimatedEndTime: reservedUntil,
        vehicleAvailableAt,
        trackingEvents: {
          create: {
            status: BookingStatus.CONFIRMED,
            title: "Payment Confirmed",
            description:
              "Your payment has been received and your booking is confirmed.",
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    await createInvoiceIfMissing(booking);
    await assignRandomAvailableDriverToBooking(booking.id);

    const assignedBooking = await prisma.booking.findUnique({
      where: {
        id: booking.id,
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return assignedBooking || booking;
  }

  const availableVehicle = await findAvailableVehicle({
    vehicleType: quote.vehicleSize,
    reservedFrom,
    reservedUntil,
  });

  if (!availableVehicle) {
    throw new Error("No vehicle available for this collection window.");
  }

  const booking = await prisma.booking.create({
    data: {
      reference: generateBookingReference(),
      status: BookingStatus.CONFIRMED,

      quote: {
        connect: {
          id: quote.id,
        },
      },

      ...(resolvedUserId
        ? {
            user: {
              connect: {
                id: resolvedUserId,
              },
            },
          }
        : {}),

      vehicle: {
        connect: {
          id: availableVehicle.id,
        },
      },

      collectionDate: quote.collectionDate,
      collectionWindow: quote.collectionWindow,

      collectionAddress: quote.collectionAddress,
      deliveryAddress: quote.deliveryAddress,
      extraDrops: quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,

      estimatedStartTime: reservedFrom,
      estimatedEndTime: reservedUntil,
      vehicleAvailableAt,

      totalPrice: quote.totalPrice,

      reservation: {
        create: {
          vehicleId: availableVehicle.id,
          quoteId: quote.id,
          status: ReservationStatus.CONFIRMED,
          reservedFrom,
          reservedUntil,
          expiresAt: null,
        },
      },

      trackingEvents: {
        create: [
          {
            status: BookingStatus.PENDING_PAYMENT,
            title: "Booking Created",
            description: "Your booking has been created.",
          },
          {
            status: BookingStatus.CONFIRMED,
            title: "Payment Confirmed",
            description: "Your payment has been received and your booking is confirmed.",
          },
        ],
      },
    },
    include: {
      quote: true,
      vehicle: true,
      user: true,
      reservation: true,
      trackingEvents: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  await createInvoiceIfMissing(booking);
  await assignRandomAvailableDriverToBooking(booking.id);

  const assignedBooking = await prisma.booking.findUnique({
    where: {
      id: booking.id,
    },
    include: {
      quote: true,
      vehicle: true,
      user: true,
      reservation: true,
      trackingEvents: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  return assignedBooking || booking;
}


async function getTradeCheckoutPosition(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      billingProfile: true,
      tradeAccount: true,
    },
  });

  if (!user) {
    throw new Error("Customer account not found.");
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: {
        notIn: ["PAID", "VOID", "CREDITED", "CANCELLED"],
      },
    },
    include: {
      allocations: true,
      creditNotes: true,
    },
  });

  const outstandingInvoices = invoices.reduce((sum, invoice) => {
    const allocated = invoice.allocations.reduce(
      (paid, allocation) => paid.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    const credited = invoice.creditNotes
      .filter((note) => note.status === "ISSUED")
      .reduce(
        (total, note) => total.add(note.amount),
        new Prisma.Decimal(0),
      );
    const remaining = invoice.total.sub(allocated).sub(credited);
    return sum.add(remaining.greaterThan(0) ? remaining : 0);
  }, new Prisma.Decimal(0));

  const uninvoicedBookings = await prisma.booking.aggregate({
    where: {
      userId,
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.ASSIGNED,
          BookingStatus.IN_PROGRESS,
          BookingStatus.COMPLETED,
        ],
      },
      invoices: { none: {} },
      invoiceBookings: { none: {} },
    },
    _sum: { totalPrice: true },
  });

  const committed = new Prisma.Decimal(
    uninvoicedBookings._sum.totalPrice || 0,
  );
  const exposure = outstandingInvoices
    .add(committed)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const creditLimit = new Prisma.Decimal(
    user.billingProfile?.creditLimit ?? user.tradeAccount?.creditLimit ?? 0,
  );
  const availableCredit = creditLimit
    .sub(exposure)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    user,
    creditLimit,
    exposure,
    availableCredit,
    paymentTermsDays:
      user.billingProfile?.paymentTermsDays ??
      user.tradeAccount?.paymentTermsDays ??
      30,
    poRequired: user.billingProfile?.poRequired ?? false,
    paymentMode: user.billingProfile?.paymentMode ?? "PAY_NOW",
    creditFacilityOnHold:
      user.billingProfile?.creditFacilityOnHold ??
      user.tradeAccount?.creditFacilityOnHold ??
      false,
    holdReason:
      user.billingProfile?.holdReason ??
      user.tradeAccount?.creditHoldReason ??
      null,
  };
}

async function createTradeDraftInvoice(booking: {
  id: string;
  userId: string | null;
  totalPrice: Prisma.Decimal;
  reference: string;
  collectionDate: Date;
  collectionAddress: string;
  deliveryAddress: string;
  purchaseOrderNumber?: string | null;
  customerReference?: string | null;
  quote?: {
    deliveryType?: string | null;
    vatAmount?: Prisma.Decimal | null;
    totalPrice?: Prisma.Decimal | null;
  } | null;
}, paymentTermsDays: number) {
  const existingInvoice = await prisma.invoice.findFirst({
    where: { bookingId: booking.id },
  });

  if (existingInvoice) return existingInvoice;

  /*
   * Invoice numbering must be able to recover if CompanySettings.nextInvoiceNumber
   * is behind an invoice number that already exists. The previous implementation
   * retried the same duplicate number forever because the failed transaction also
   * rolled back the counter increment.
   *
   * We now skip numbers that already exist and retry a concurrent unique-number
   * collision safely. This keeps invoice creation idempotent and self-healing.
   */
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const invoiceAlreadyCreated = await transaction.invoice.findFirst({
          where: { bookingId: booking.id },
        });

        if (invoiceAlreadyCreated) return invoiceAlreadyCreated;

        const settings = await transaction.companySettings.findFirst({
          orderBy: { createdAt: "asc" },
        });

        if (!settings) {
          throw new Error(
            "Company settings must be configured before invoices can be created.",
          );
        }

        let candidateNumber = settings.nextInvoiceNumber;
        let invoiceNumber = `${settings.invoicePrefix}-${String(
          candidateNumber,
        ).padStart(6, "0")}`;

        while (
          await transaction.invoice.findUnique({
            where: { invoiceNumber },
            select: { id: true },
          })
        ) {
          candidateNumber += 1;
          invoiceNumber = `${settings.invoicePrefix}-${String(
            candidateNumber,
          ).padStart(6, "0")}`;
        }

        const total = new Prisma.Decimal(
          booking.quote?.totalPrice || booking.totalPrice,
        ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        const vatRate = new Prisma.Decimal(settings.vatRate);
        const subtotal = vatRate.greaterThan(0)
          ? total
              .div(new Prisma.Decimal(1).add(vatRate.div(100)))
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : total;
        const vatAmount = total
          .sub(subtotal)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

        const routeDescription = `${booking.collectionAddress} → ${booking.deliveryAddress}`;
        const serviceDescription =
          booking.quote?.deliveryType || "Courier delivery";

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
            supplyDate: booking.collectionDate,
            paymentTerms: `${paymentTermsDays} days`,
            customerReference: booking.customerReference || null,
            purchaseOrderNumber: booking.purchaseOrderNumber || null,
          },
        });

        await transaction.invoiceBooking.create({
          data: {
            invoiceId: invoice.id,
            bookingId: booking.id,
            bookingReference: booking.reference,
            bookingDate: booking.collectionDate,
            poReference: booking.purchaseOrderNumber || null,
            routeDescription,
            serviceDescription,
            netAmount: subtotal,
            vatAmount,
            grossAmount: total,
          },
        });

        await transaction.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            bookingId: booking.id,
            chargeType: "BASE_SERVICE",
            description: serviceDescription,
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

        await transaction.invoiceAuditEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: "TRADE_DRAFT_INVOICE_CREATED",
            description: `Trade draft invoice ${invoiceNumber} created for booking ${booking.reference}.`,
          },
        });

        await transaction.companySettings.update({
          where: { id: settings.id },
          data: {
            nextInvoiceNumber: candidateNumber + 1,
          },
        });

        return invoice;
      });
    } catch (error) {
      const isUniqueCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (!isUniqueCollision || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error("Unable to reserve a unique invoice number.");
}

router.get("/checkout-options/:quoteId", async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.quoteId },
      include: {
        user: {
          include: {
            billingProfile: true,
            tradeAccount: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({ error: "Quote not found." });
    }

    const user = await getAuthenticatedUser(req);

    if (!user || !quote.userId || quote.userId !== user.id) {
      return res.json({
        accountType: "GUEST",
        payNowAvailable: true,
        payLaterAvailable: false,
      });
    }

    if (user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        error: "This customer account is not active. Checkout is unavailable.",
      });
    }

    if (user.accountType !== "TRADE") {
      return res.json({
        accountType: user.accountType,
        payNowAvailable: true,
        payLaterAvailable: false,
      });
    }

    const position = await getTradeCheckoutPosition(user.id);
    const amount = new Prisma.Decimal(quote.totalPrice || 0);
    const approved =
      position.user.tradeAccount?.status === "APPROVED";
    const withinCredit = amount.lessThanOrEqualTo(position.availableCredit);
    const payLaterAvailable =
      approved && !position.creditFacilityOnHold && withinCredit;

    return res.json({
      accountType: "TRADE",
      payNowAvailable: true,
      payLaterAvailable,
      tradeStatus: position.user.tradeAccount?.status || null,
      paymentMode: position.paymentMode,
      paymentTermsDays: position.paymentTermsDays,
      poRequired: position.poRequired,
      creditFacilityOnHold: position.creditFacilityOnHold,
      holdReason: position.holdReason,
      creditLimit: Number(position.creditLimit),
      exposure: Number(position.exposure),
      availableCredit: Number(position.availableCredit),
      quoteAmount: Number(amount),
      reason: !approved
        ? "This Trade Account is not approved for Pay Later."
        : position.creditFacilityOnHold
          ? position.holdReason || "Trade credit is currently on hold."
          : !withinCredit
            ? "This booking exceeds the available Trade credit."
            : null,
    });
  } catch (error) {
    console.error("Checkout options error:", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load checkout options.",
    });
  }
});

router.post("/pay-later", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const quoteId = getString(req.body.quoteId);
    const purchaseOrderNumber = getString(req.body.purchaseOrderNumber) || null;

    if (!quoteId) {
      return res.status(400).json({ error: "quoteId is required." });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        booking: {
          include: {
            quote: true,
            vehicle: true,
            user: true,
            reservation: true,
            trackingEvents: {
              orderBy: { createdAt: "asc" },
            },
            invoices: true,
            payments: true,
          },
        },
        reservations: true,
        user: {
          include: {
            billingProfile: true,
            tradeAccount: true,
          },
        },
      },
    });

    if (!quote || !quote.userId || quote.userId !== user.id) {
      return res.status(404).json({ error: "Quote not found for this account." });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({ error: "Quote has no total price." });
    }

    if (!quote.collectionWindow || quote.collectionWindow === "ASAP") {
      return res.status(400).json({
        error: "A fixed collection window is required before booking.",
      });
    }

    if (
      user.accountStatus !== "ACTIVE" ||
      user.accountType !== "TRADE" ||
      !quote.user?.tradeAccount ||
      quote.user.tradeAccount.status !== "APPROVED"
    ) {
      return res.status(403).json({
        error: "This account is not approved for Trade Pay Later.",
      });
    }

    const position = await getTradeCheckoutPosition(user.id);

    if (position.creditFacilityOnHold) {
      return res.status(409).json({
        error: position.holdReason
          ? `Trade credit is on hold: ${position.holdReason}`
          : "Trade credit is currently on hold.",
        code: "CREDIT_FACILITY_ON_HOLD",
      });
    }

    if (position.poRequired && !purchaseOrderNumber) {
      return res.status(400).json({
        error: "A PO/order reference is required for this Trade Account.",
        code: "PO_REQUIRED",
      });
    }

    const bookingAmount = new Prisma.Decimal(quote.totalPrice);

    /*
     * If this quote already has a non-pending booking, never create another
     * booking or invoice. A confirmed/in-progress/completed booking with an
     * invoice is treated idempotently; cancelled/expired bookings are rejected.
     */
    if (quote.booking && quote.booking.status !== BookingStatus.PENDING_PAYMENT) {
      const activeBooking =
        quote.booking.status === BookingStatus.CONFIRMED ||
        quote.booking.status === BookingStatus.ASSIGNED ||
        quote.booking.status === BookingStatus.IN_PROGRESS ||
        quote.booking.status === BookingStatus.COMPLETED;

      if (activeBooking && quote.booking.invoices.length > 0) {
        const existingInvoice = quote.booking.invoices[0];

        return res.json({
          success: true,
          alreadyProcessed: true,
          booking: quote.booking,
          invoice: {
            id: existingInvoice.id,
            invoiceNumber: existingInvoice.invoiceNumber,
            status: existingInvoice.status,
            dueDate: existingInvoice.dueDate,
          },
          billing: {
            paymentMode: "PAY_LATER",
            paymentTermsDays: position.paymentTermsDays,
          },
        });
      }

      /*
       * A previous Trade Pay Later request may have confirmed the booking but
       * failed while creating its invoice. That is a recoverable partial state,
       * not a reason to strand the customer on checkout forever.
       *
       * Never recover a booking as Trade credit if a successful card payment
       * already exists for it.
       */
      if (activeBooking && quote.booking.invoices.length === 0) {
        const hasSuccessfulPayment = quote.booking.payments.some(
          (payment) => payment.status === PaymentStatus.PAID,
        );

        if (hasSuccessfulPayment) {
          return res.status(409).json({
            error:
              "This booking has already been paid. It cannot be converted to Trade Pay Later.",
            code: "BOOKING_ALREADY_PAID",
          });
        }

        return res.json({
          success: true,
          alreadyProcessed: true,
          booking: quote.booking,
          invoice: null,
          billing: {
            paymentMode: "PAY_LATER",
            paymentTermsDays: position.paymentTermsDays,
            bookingAmount: Number(bookingAmount),
            availableCreditAfterBooking: Number(position.availableCredit),
            invoicePendingBillingCycle: true,
          },
        });
      }

      return res.status(409).json({
        error: `This quote already has a booking with status ${quote.booking.status}.`,
        code: "BOOKING_ALREADY_PROCESSED",
      });
    }

    /*
     * A PENDING_PAYMENT booking is not new credit exposure yet. The exposure
     * helper only counts confirmed/assigned/in-progress/completed uninvoiced
     * bookings, so the quote amount can safely be checked against available
     * credit before converting the pending booking.
     */
    if (bookingAmount.greaterThan(position.availableCredit)) {
      return res.status(409).json({
        error: "This booking exceeds the available Trade credit.",
        code: "CREDIT_LIMIT_EXCEEDED",
        creditLimit: Number(position.creditLimit),
        exposure: Number(position.exposure),
        availableCredit: Number(position.availableCredit),
        requestedAmount: Number(bookingAmount),
      });
    }

    const { reservedFrom, reservedUntil } = getReservationWindow(
      quote.collectionDate,
      quote.collectionWindow,
      6,
    );

    let booking;

    if (quote.booking) {
      /*
       * Preserve the existing booking/reference and convert the normal
       * PENDING_PAYMENT booking into a Trade booking.
       */
      booking = await prisma.$transaction(async (transaction) => {
        const currentBooking = await transaction.booking.findUnique({
          where: { id: quote.booking!.id },
          include: {
            reservation: true,
            invoices: true,
          },
        });

        if (!currentBooking) {
          throw new Error("Existing booking could not be found.");
        }

        /*
         * Protect against two Pay Later requests racing each other. If another
         * request has already moved it out of PENDING_PAYMENT, stop this
         * transaction instead of creating duplicate financial records.
         */
        if (currentBooking.status !== BookingStatus.PENDING_PAYMENT) {
          throw new Error("TRADE_BOOKING_ALREADY_PROCESSED");
        }

        const updated = await transaction.booking.update({
          where: { id: currentBooking.id },
          data: {
            status: BookingStatus.CONFIRMED,
            userId: user.id,
            purchaseOrderNumber:
              purchaseOrderNumber ?? currentBooking.purchaseOrderNumber,
            estimatedStartTime:
              currentBooking.estimatedStartTime ?? reservedFrom,
            estimatedEndTime:
              currentBooking.estimatedEndTime ?? reservedUntil,
            vehicleAvailableAt:
              currentBooking.vehicleAvailableAt ?? reservedUntil,
            trackingEvents: {
              create: {
                status: BookingStatus.CONFIRMED,
                title: "Trade Booking Confirmed",
                description:
                  "Your booking has been confirmed on your Trade Account and will be invoiced under your agreed payment terms.",
              },
            },
          },
          include: {
            quote: true,
            vehicle: true,
            user: true,
            reservation: true,
            trackingEvents: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (currentBooking.reservation) {
          await transaction.vehicleReservation.update({
            where: { id: currentBooking.reservation.id },
            data: {
              status: ReservationStatus.CONFIRMED,
              reservedFrom,
              reservedUntil,
              expiresAt: null,
            },
          });
        }

        await transaction.quote.update({
          where: { id: quote.id },
          data: {
            status: "Converted to Booking",
            convertedAt: new Date(),
          },
        });

        return updated;
      });
    } else {
      /*
       * Some quote paths do not pre-create a booking. Keep supporting those
       * without changing the existing public checkout behaviour.
       */
      booking = await prisma.$transaction(async (transaction) => {
        const created = await transaction.booking.create({
          data: {
            reference: generateBookingReference(),
            status: BookingStatus.CONFIRMED,
            quoteId: quote.id,
            userId: user.id,
            vehicleId: null,
            driverId: null,
            collectionDate: quote.collectionDate,
            collectionWindow: quote.collectionWindow,
            collectionAddress: quote.collectionAddress,
            deliveryAddress: quote.deliveryAddress,
            returnAddress: quote.returnAddress,
            extraDrops:
              quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,
            journeyType: quote.journeyType,
            vehicleType: quote.vehicleSize,
            estimatedStartTime: reservedFrom,
            estimatedEndTime: reservedUntil,
            vehicleAvailableAt: reservedUntil,
            totalPrice: quote.totalPrice!,
            purchaseOrderNumber,
            customerReference: quote.customerReference,
            trackingEvents: {
              create: {
                status: BookingStatus.CONFIRMED,
                title: "Trade Booking Confirmed",
                description:
                  "Your booking has been confirmed on your Trade Account and will be invoiced under your agreed payment terms.",
              },
            },
          },
          include: {
            quote: true,
            vehicle: true,
            user: true,
            reservation: true,
            trackingEvents: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        await transaction.quote.update({
          where: { id: quote.id },
          data: {
            status: "Converted to Booking",
            convertedAt: new Date(),
          },
        });

        return created;
      });
    }

    try {
      await sendCustomerBookingConfirmedEmail(booking);
    } catch (emailError) {
      console.error("Trade booking confirmation email error:", emailError);
    }

    return res.status(201).json({
      success: true,
      booking,
      invoice: null,
      billing: {
        paymentMode: "PAY_LATER",
        paymentTermsDays: position.paymentTermsDays,
        invoicePendingBillingCycle: true,
        previousExposure: Number(position.exposure),
        bookingAmount: Number(bookingAmount),
        availableCreditAfterBooking: Number(
          position.availableCredit.sub(bookingAmount),
        ),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TRADE_BOOKING_ALREADY_PROCESSED"
    ) {
      /*
       * A concurrent/double-click request won the race. Re-read the completed
       * result and return it instead of creating anything twice.
       */
      const quoteId = getString(req.body.quoteId);
      const existing = quoteId
        ? await prisma.quote.findUnique({
            where: { id: quoteId },
            include: {
              booking: {
                include: {
                  quote: true,
                  vehicle: true,
                  user: true,
                  reservation: true,
                  trackingEvents: {
                    orderBy: { createdAt: "asc" },
                  },
                  invoices: true,
                },
              },
            },
          })
        : null;

      if (existing?.booking && existing.booking.invoices.length > 0) {
        const existingInvoice = existing.booking.invoices[0];

        return res.json({
          success: true,
          alreadyProcessed: true,
          booking: existing.booking,
          invoice: {
            id: existingInvoice.id,
            invoiceNumber: existingInvoice.invoiceNumber,
            status: existingInvoice.status,
            dueDate: existingInvoice.dueDate,
          },
        });
      }

      return res.status(409).json({
        error:
          "This Trade booking is already being processed. Refresh the page before trying again.",
        code: "TRADE_BOOKING_PROCESSING",
      });
    }

    console.error("Trade Pay Later error:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create Trade Pay Later booking.",
    });
  }
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { quoteId } = req.body;

    if (!quoteId) {
      return res.status(400).json({
        error: "quoteId is required",
      });
    }

    const quote = await prisma.quote.findUnique({
      where: {
        id: quoteId,
      },
      include: {
        user: { select: { accountStatus: true } },
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    if (quote.user && quote.user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ error: "This customer account is not active. Checkout is unavailable." });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({
        error: "Quote has no total price",
      });
    }

    const totalAmountPence = Math.round(Number(quote.totalPrice) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: quote.customerEmail,
      success_url: `${frontendUrl}/payment-success?quoteId=${quote.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payments?quoteId=${quote.id}&cancelled=true`,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: totalAmountPence,
            product_data: {
              name: "Streamline Logistics Delivery Booking",
              description: `Quote reference: ${quote.id}`,
              metadata: {
                quoteId: quote.id,
              },
            },
          },
        },
      ],
      metadata: {
        quoteId: quote.id,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
      },
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe checkout session error:", error);

    res.status(500).json({
      error: "Failed to create checkout session",
    });
  }
});

router.post("/confirm-checkout-session", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const quoteId = typeof req.body.quoteId === "string" ? req.body.quoteId : "";
    const sessionId =
      typeof req.body.sessionId === "string" ? req.body.sessionId : "";

    if (!quoteId || !sessionId) {
      return res.status(400).json({
        error: "quoteId and sessionId are required.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        error: "Payment has not been completed yet.",
      });
    }

    if (session.metadata?.quoteId && session.metadata.quoteId !== quoteId) {
      return res.status(400).json({
        error: "Payment session does not match this quote.",
      });
    }

    const quote = user
      ? await prisma.quote.update({
          where: {
            id: quoteId,
          },
          data: {
            userId: user.id,
          },
        })
      : await prisma.quote.findUnique({
          where: {
            id: quoteId,
          },
        });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found.",
      });
    }

    const booking = await createConfirmedBookingFromQuote(quote.id, user?.id);

    const invoice = await prisma.invoice.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });

    const existingPayment = await prisma.payment.findFirst({
      where: {
        provider: "stripe",
        providerPaymentId: session.id,
      },
    });

    const payment =
      existingPayment ||
      (await prisma.payment.create({
        data: {
          bookingId: booking.id,
          invoiceId: invoice?.id || null,
          userId: user?.id || booking.userId || null,
          provider: "stripe",
          providerPaymentId: session.id,
          status: PaymentStatus.PAID,
          amount: quote.totalPrice || booking.totalPrice,
          currency: String(session.currency || "gbp").toUpperCase(),
          paidAt: new Date(),
        },
      }));

    if (invoice) {
      const existingAllocation = await prisma.paymentAllocation.findUnique({
        where: {
          paymentId_invoiceId: {
            paymentId: payment.id,
            invoiceId: invoice.id,
          },
        },
      });

      if (!existingAllocation) {
        await prisma.$transaction(async (transaction) => {
          await transaction.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: invoice.id,
              amount: payment.amount,
              notes: "Automatically allocated from Stripe Checkout payment.",
            },
          });

          if (!payment.invoiceId) {
            await transaction.payment.update({
              where: { id: payment.id },
              data: { invoiceId: invoice.id },
            });
          }

          await transaction.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "PAID",
              paidAt: payment.paidAt || new Date(),
              issuedAt: invoice.issuedAt || new Date(),
              finalisedAt: invoice.finalisedAt || new Date(),
            },
          });

          await transaction.invoiceAuditEvent.create({
            data: {
              invoiceId: invoice.id,
              eventType: "PAYMENT_ALLOCATED",
              description: `Stripe payment ${payment.id} allocated to invoice ${invoice.invoiceNumber}.`,
              metadata: {
                paymentId: payment.id,
                providerPaymentId: session.id,
                amount: Number(payment.amount),
              },
            },
          });
        });
      }
    }

    try {
      await sendCustomerPaymentSuccessfulEmail(booking);
      await sendCustomerBookingConfirmedEmail(booking);
      await sendAdminNewPaidBookingEmail(booking);
    } catch (emailError) {
      console.error("Payment confirmation email error:", emailError);
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Confirm checkout session error:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to confirm checkout session.",
    });
  }
});

/* ---------------------------------
   Admin Payment Management
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
    const status = getString(req.query.status).toUpperCase();
    const provider = getString(req.query.provider);
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);

    const where: Prisma.PaymentWhereInput = {};

    if (search) {
      where.OR = [
        {
          providerPaymentId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          booking: {
            is: {
              reference: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              companyName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      if (!isPaymentStatus(status)) {
        return res.status(400).json({
          error: "Invalid payment status filter.",
        });
      }

      where.status = status;
    }

    if (provider && provider !== "ALL") {
      where.provider = provider;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};

      if (dateFrom) {
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }

      if (dateTo) {
        where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    const [payments, total, statusTotals, providerTotals] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: true,
          booking: {
            include: {
              quote: true,
              invoices: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({
        where,
      }),
      prisma.payment.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.payment.groupBy({
        by: ["provider"],
        _count: {
          _all: true,
        },
      }),
    ]);

    res.json({
      payments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus: Object.fromEntries(
          statusTotals.map((item) => [
            item.status,
            item._count._all,
          ]),
        ),
        byProvider: Object.fromEntries(
          providerTotals.map((item) => [
            item.provider,
            item._count._all,
          ]),
        ),
      },
    });
  } catch (error) {
    console.error("Admin payment list error:", error);

    res.status(500).json({
      error: "Unable to load payments.",
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
    const payment = await prisma.payment.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        user: true,
        booking: {
          include: {
            quote: true,
            invoices: true,
            vehicle: true,
            driver: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found.",
      });
    }

    res.json({
      payment,
    });
  } catch (error) {
    console.error("Admin payment detail error:", error);

    res.status(500).json({
      error: "Unable to load payment.",
    });
  }
});

router.patch("/admin/:id/status", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const statusValue = getString(req.body.status).toUpperCase();

    if (!statusValue || !isPaymentStatus(statusValue)) {
      return res.status(400).json({
        error: "A valid payment status is required.",
      });
    }

    const payment = await prisma.payment.update({
      where: {
        id: req.params.id,
      },
      data: {
        status: statusValue,
        paidAt:
          statusValue === PaymentStatus.PAID
            ? new Date()
            : undefined,
      },
      include: {
        user: true,
        booking: {
          include: {
            quote: true,
            invoices: true,
            vehicle: true,
            driver: true,
          },
        },
      },
    });

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Admin payment status update error:", error);

    res.status(500).json({
      error: "Unable to update payment status.",
    });
  }
});


export default router;