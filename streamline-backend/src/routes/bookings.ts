import {
  BookingStatus,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { assignRandomAvailableDriverToBooking } from "../lib/assignDriver";
import { getReservationWindow } from "../lib/reservationWindow";

const router = Router();

const PAYMENT_RESERVATION_MINUTES = 30;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function generateBookingReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `SL-${datePart}-${randomPart}`;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const cleanValue = getString(value);
  return cleanValue || null;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
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

async function getAuthenticatedUser(req: {
  headers: { authorization?: string };
}) {
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

async function autoSaveRouteFromConfirmedBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      quote: true,
    },
  });

  if (!booking || !booking.userId || !booking.quote) return;

  const quote = booking.quote;

  const existingSavedRoute = await prisma.savedRoute.findFirst({
    where: {
      userId: booking.userId,
      collectionAddress: quote.collectionAddress,
      deliveryAddress: quote.deliveryAddress,
      deliveryType: quote.deliveryType,
      journeyType: quote.journeyType,
      vehicleSize: quote.vehicleSize,
    },
  });

  if (existingSavedRoute) return;

  await prisma.savedRoute.create({
    data: {
      userId: booking.userId,
      name: `${quote.collectionAddress} to ${quote.deliveryAddress}`,
      deliveryType: quote.deliveryType,
      journeyType: quote.journeyType,
      capacityPercent: quote.capacityPercent,
      vehicleSize: quote.vehicleSize,
      collectionAddress: quote.collectionAddress,
      collectionAddressDetails:
        quote.collectionAddressDetails === null
          ? Prisma.JsonNull
          : quote.collectionAddressDetails,
      deliveryAddress: quote.deliveryAddress,
      deliveryAddressDetails:
        quote.deliveryAddressDetails === null
          ? Prisma.JsonNull
          : quote.deliveryAddressDetails,
      returnAddress: quote.returnAddress,
      extraDrops:
        quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,
      whatAreWeCollecting: quote.whatAreWeCollecting,
      loadDescription: quote.loadDescription,
      specialInstructions: quote.specialInstructions,
      contactPreference: quote.contactPreference,
    },
  });
}

function adminBookingInclude() {
  return {
    quote: true,
    user: true,
    vehicle: true,
    driver: true,
    payments: true,
    invoices: true,
    pod: true,
    reservation: true,
    trackingEvents: {
      orderBy: {
        createdAt: "asc",
      },
    },
  } satisfies Prisma.BookingInclude;
}

async function getTradeCreditPosition(userId: string) {
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
    const amountPaid = invoice.allocations.reduce(
      (paid, allocation) => paid.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    const creditedAmount = invoice.creditNotes
      .filter((creditNote) => creditNote.status === "ISSUED")
      .reduce(
        (credited, creditNote) => credited.add(creditNote.amount),
        new Prisma.Decimal(0),
      );
    const remaining = invoice.total.sub(amountPaid).sub(creditedAmount);

    return sum.add(remaining.greaterThan(0) ? remaining : 0);
  }, new Prisma.Decimal(0));

  const [completedUninvoicedResult, committedPayLaterResult] =
    await Promise.all([
      prisma.booking.aggregate({
        where: {
          userId,
          status: BookingStatus.COMPLETED,
          invoices: { none: {} },
          invoiceBookings: { none: {} },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: {
          userId,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.ASSIGNED,
              BookingStatus.IN_PROGRESS,
            ],
          },
          invoices: { none: {} },
          invoiceBookings: { none: {} },
        },
        _sum: { totalPrice: true },
      }),
    ]);

  const completedUninvoiced = new Prisma.Decimal(
    completedUninvoicedResult._sum.totalPrice || 0,
  );
  const committedPayLater = new Prisma.Decimal(
    committedPayLaterResult._sum.totalPrice || 0,
  );
  const exposure = outstandingInvoices
    .add(completedUninvoiced)
    .add(committedPayLater)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const creditLimit = new Prisma.Decimal(
    user.billingProfile?.creditLimit ?? user.tradeAccount?.creditLimit ?? 0,
  );
  const availableCredit = creditLimit
    .sub(exposure)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    user,
    billingProfile: user.billingProfile,
    tradeAccount: user.tradeAccount,
    creditLimit,
    outstandingInvoices,
    completedUninvoiced,
    committedPayLater,
    exposure,
    availableCredit,
    creditFacilityOnHold:
      user.billingProfile?.creditFacilityOnHold ??
      user.tradeAccount?.creditFacilityOnHold ??
      false,
    holdReason:
      user.billingProfile?.holdReason ??
      user.tradeAccount?.creditHoldReason ??
      null,
    paymentTermsDays:
      user.billingProfile?.paymentTermsDays ??
      user.tradeAccount?.paymentTermsDays ??
      30,
    poRequired: user.billingProfile?.poRequired ?? false,
  };
}

/* ---------------------------------
   Admin Booking Management
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
    const dateFrom = getString(req.query.dateFrom);
    const dateTo = getString(req.query.dateTo);
    const vehicleId = getString(req.query.vehicleId);
    const driverId = getString(req.query.driverId);

    const where: Prisma.BookingWhereInput = {};

    if (search) {
      where.OR = [
        {
          reference: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          collectionAddress: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          deliveryAddress: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerReference: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          purchaseOrderNumber: {
            contains: search,
            mode: "insensitive",
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
      if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
        return res.status(400).json({
          error: "Invalid booking status filter.",
        });
      }

      where.status = status as BookingStatus;
    }

    if (dateFrom || dateTo) {
      where.collectionDate = {};

      if (dateFrom) {
        where.collectionDate.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }

      if (dateTo) {
        where.collectionDate.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    if (vehicleId && vehicleId !== "ALL") {
      where.vehicleId = vehicleId;
    }

    if (driverId && driverId !== "ALL") {
      where.driverId = driverId;
    }

    const [bookings, total, statusTotals, vehicles, drivers] =
      await Promise.all([
        prisma.booking.findMany({
          where,
          orderBy: {
            collectionDate: "desc",
          },
          include: adminBookingInclude(),
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.booking.count({
          where,
        }),
        prisma.booking.groupBy({
          by: ["status"],
          _count: {
            _all: true,
          },
        }),
        prisma.vehicle.findMany({
          where: {
            active: true,
          },
          orderBy: {
            name: "asc",
          },
        }),
        prisma.driver.findMany({
          where: {
            active: true,
          },
          orderBy: {
            name: "asc",
          },
          include: {
            vehicle: true,
          },
        }),
      ]);

    res.json({
      bookings,
      vehicles,
      drivers,
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
      },
    });
  } catch (error) {
    console.error("Admin booking list error:", error);

    res.status(500).json({
      error: "Unable to load bookings.",
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
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
      include: adminBookingInclude(),
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    res.json({
      booking,
    });
  } catch (error) {
    console.error("Admin booking detail error:", error);

    res.status(500).json({
      error: "Unable to load booking.",
    });
  }
});

router.patch("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const current = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!current) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const statusValue = getString(req.body.status).toUpperCase();

    if (
      statusValue &&
      !Object.values(BookingStatus).includes(statusValue as BookingStatus)
    ) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    const nextStatus = statusValue
      ? (statusValue as BookingStatus)
      : undefined;

    const booking = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.booking.update({
        where: {
          id: req.params.id,
        },
        data: {
          status: nextStatus,
          vehicleId:
            req.body.vehicleId !== undefined
              ? getOptionalString(req.body.vehicleId)
              : undefined,
          driverId:
            req.body.driverId !== undefined
              ? getOptionalString(req.body.driverId)
              : undefined,
          collectionDate:
            req.body.collectionDate !== undefined
              ? new Date(req.body.collectionDate)
              : undefined,
          collectionWindow:
            req.body.collectionWindow !== undefined
              ? getString(req.body.collectionWindow)
              : undefined,
          collectionAddress:
            req.body.collectionAddress !== undefined
              ? getString(req.body.collectionAddress)
              : undefined,
          deliveryAddress:
            req.body.deliveryAddress !== undefined
              ? getString(req.body.deliveryAddress)
              : undefined,
          returnAddress:
            req.body.returnAddress !== undefined
              ? getOptionalString(req.body.returnAddress)
              : undefined,
          customerReference:
            req.body.customerReference !== undefined
              ? getOptionalString(req.body.customerReference)
              : undefined,
          purchaseOrderNumber:
            req.body.purchaseOrderNumber !== undefined
              ? getOptionalString(req.body.purchaseOrderNumber)
              : undefined,
          internalNotes:
            req.body.internalNotes !== undefined
              ? getOptionalString(req.body.internalNotes)
              : undefined,
          dispatchNotes:
            req.body.dispatchNotes !== undefined
              ? getOptionalString(req.body.dispatchNotes)
              : undefined,
          totalPrice:
            req.body.totalPrice !== undefined
              ? req.body.totalPrice
              : undefined,
          vehicleAssignedAt:
            req.body.vehicleId !== undefined
              ? new Date()
              : undefined,
          driverAssignedAt:
            req.body.driverId !== undefined
              ? new Date()
              : undefined,
          trackingEvents:
            nextStatus && nextStatus !== current.status
              ? {
                  create: {
                    status: nextStatus,
                    title: `Booking ${String(nextStatus)
                      .replace(/_/g, " ")
                      .toLowerCase()}`,
                    description:
                      "Booking status updated by the administration team.",
                  },
                }
              : undefined,
        },
        include: adminBookingInclude(),
      });

      if (
        req.body.driverId !== undefined &&
        getOptionalString(req.body.driverId)
      ) {
        await transaction.driver.update({
          where: {
            id: getString(req.body.driverId),
          },
          data: {
            availability: "BUSY",
          },
        });
      }

      if (
        req.body.vehicleId !== undefined &&
        getOptionalString(req.body.vehicleId)
      ) {
        await transaction.vehicle.update({
          where: {
            id: getString(req.body.vehicleId),
          },
          data: {
            status: "BOOKED",
          },
        });
      }

      return updated;
    });

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Admin booking update error:", error);

    res.status(500).json({
      error: "Unable to update booking.",
    });
  }
});

/*
 * Tab 4 - Planning / Create Booking
 *
 * Admin-only booking creation from an already calculated quote.
 *
 * This deliberately does NOT:
 * - choose a vehicle
 * - create a vehicle reservation
 * - assign a driver
 * - start the payment reservation flow
 *
 * The booking is created unassigned so it can be placed onto an exact
 * vehicle from the planning board.
 */
router.post("/admin/from-quote/:quoteId", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.quoteId,
      },
      include: {
        booking: true,
        user: {
          include: {
            billingProfile: true,
            tradeAccount: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    if (!quote.userId || !quote.user) {
      const { reservedFrom, reservedUntil } = getReservationWindow(
        quote.collectionDate,
        quote.collectionWindow,
      );

      const guestBooking = await prisma.$transaction(async (transaction) => {
        const createdBooking = await transaction.booking.create({
          data: {
            reference: generateBookingReference(),
            status: BookingStatus.CONFIRMED,
            quoteId: quote.id,
            userId: null,
            vehicleId: null,
            driverId: null,
            collectionDate: quote.collectionDate,
            collectionWindow: quote.collectionWindow,
            collectionAddress: quote.collectionAddress,
            deliveryAddress: quote.deliveryAddress,
            extraDrops:
              quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,
            estimatedStartTime: reservedFrom,
            estimatedEndTime: reservedUntil,
            vehicleAvailableAt: reservedUntil,
            totalPrice: quote.totalPrice!,
            customerReference: getOptionalString(req.body.customerReference),
            trackingEvents: {
              create: {
                status: BookingStatus.CONFIRMED,
                title: "Guest Booking Created",
                description:
                  "Guest booking created by the administration team and awaiting planning assignment.",
                userVisible: false,
              },
            },
          },
          include: adminBookingInclude(),
        });

        await transaction.quote.update({
          where: { id: quote.id },
          data: {
            status: "Converted to Booking",
            convertedAt: new Date(),
          },
        });

        return createdBooking;
      });

      return res.status(201).json({
        success: true,
        action: "GUEST_BOOKING_CREATED",
        accountType: "GUEST",
        booking: guestBooking,
      });
    }

    if (quote.user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        error:
          "This customer account is not active. New bookings cannot be created.",
      });
    }

    if (quote.booking) {
      return res.status(409).json({
        error: "Booking already exists for this quote",
      });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({
        error: "Quote has no total price",
      });
    }

    if (!quote.collectionWindow || quote.collectionWindow === "ASAP") {
      return res.status(400).json({
        error: "A fixed collection window is required before booking",
      });
    }

    /*
     * Business accounts remain pay-now.
     * The admin Planning/Create Booking page should use this response to
     * redirect to the existing Payments page for the selected quote.
     * No booking is created here, so the existing Stripe flow remains the
     * source of truth for pay-now confirmation.
     */
    if (quote.user.accountType !== "TRADE") {
      return res.status(200).json({
        success: true,
        action: "PAYMENT_REQUIRED",
        accountType: quote.user.accountType,
        quoteId: quote.id,
        paymentUrl: `/payments?quoteId=${encodeURIComponent(quote.id)}`,
      });
    }

    if (!quote.user.tradeAccount || quote.user.tradeAccount.status !== "APPROVED") {
      return res.status(403).json({
        error: "This trade account is not approved for pay-later bookings.",
      });
    }

    const creditPosition = await getTradeCreditPosition(quote.userId);
    const paymentTermsDays = [7, 14, 30].includes(creditPosition.paymentTermsDays)
      ? creditPosition.paymentTermsDays
      : 30;
    const purchaseOrderNumber = getOptionalString(req.body.purchaseOrderNumber);
    const customerReference = getOptionalString(req.body.customerReference);
    const creditOverrideReason = getString(req.body.creditOverrideReason);
    const approvedByAdminId = "ADMIN_API_KEY";
    const bookingAmount = new Prisma.Decimal(quote.totalPrice).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    if (creditPosition.creditFacilityOnHold) {
      return res.status(409).json({
        error: creditPosition.holdReason
          ? `This customer's trade credit facility is on hold: ${creditPosition.holdReason}`
          : "This customer's trade credit facility is on hold.",
        code: "CREDIT_FACILITY_ON_HOLD",
        credit: {
          creditLimit: creditPosition.creditLimit,
          exposure: creditPosition.exposure,
          availableCredit: creditPosition.availableCredit,
        },
      });
    }

    if (creditPosition.poRequired && !purchaseOrderNumber) {
      return res.status(400).json({
        error: "A PO/order reference is required for this trade account.",
        code: "PO_REQUIRED",
      });
    }

    const exceedsCreditLimit = bookingAmount.greaterThan(
      creditPosition.availableCredit,
    );

    if (exceedsCreditLimit && (!creditOverrideReason || !approvedByAdminId)) {
      return res.status(409).json({
        error:
          "This booking would exceed the customer's available trade credit. An authorised admin override with a reason is required to continue.",
        code: "CREDIT_LIMIT_EXCEEDED",
        credit: {
          creditLimit: creditPosition.creditLimit,
          outstandingInvoices: creditPosition.outstandingInvoices,
          completedUninvoiced: creditPosition.completedUninvoiced,
          committedPayLater: creditPosition.committedPayLater,
          exposure: creditPosition.exposure,
          availableCredit: creditPosition.availableCredit,
          requestedAmount: bookingAmount,
        },
      });
    }

    const { reservedFrom, reservedUntil } = getReservationWindow(
      quote.collectionDate,
      quote.collectionWindow,
    );

    const booking = await prisma.$transaction(async (transaction) => {
      const createdBooking = await transaction.booking.create({
        data: {
          reference: generateBookingReference(),
          status: BookingStatus.CONFIRMED,
          quoteId: quote.id,
          userId: quote.userId,

          /*
           * Deliberately unassigned.
           * Tab 4 drag-and-drop chooses the exact vehicle afterwards.
           */
          vehicleId: null,
          driverId: null,

          collectionDate: quote.collectionDate,
          collectionWindow: quote.collectionWindow,
          collectionAddress: quote.collectionAddress,
          deliveryAddress: quote.deliveryAddress,
          extraDrops:
            quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,

          estimatedStartTime: reservedFrom,
          estimatedEndTime: reservedUntil,
          vehicleAvailableAt: reservedUntil,

          totalPrice: quote.totalPrice!,
          purchaseOrderNumber,
          customerReference,

          trackingEvents: {
            create: {
              status: BookingStatus.CONFIRMED,
              title: "Trade Booking Created",
              description:
                "Trade pay-later booking created by the administration team and awaiting planning assignment.",
              userVisible: false,
            },
          },
        },
        include: adminBookingInclude(),
      });

      await transaction.quote.update({
        where: {
          id: quote.id,
        },
        data: {
          status: "Converted to Booking",
          convertedAt: new Date(),
        },
      });

      if (exceedsCreditLimit) {
        await transaction.creditOverride.create({
          data: {
            userId: quote.userId!,
            bookingId: createdBooking.id,
            requestedAmount: bookingAmount,
            reason: creditOverrideReason,
            approvedByAdminId,
          },
        });
      }

      return createdBooking;
    });

    return res.status(201).json({
      success: true,
      action: "TRADE_BOOKING_CREATED",
      accountType: "TRADE",
      booking,
      billing: {
        paymentMode: "PAY_LATER",
        paymentTermsDays,
        poRequired: creditPosition.poRequired,
        billingFrequency:
          creditPosition.billingProfile?.billingFrequency || "PER_BOOKING",
        invoiceMode:
          creditPosition.billingProfile?.invoiceMode || "PER_BOOKING",
        creditLimit: creditPosition.creditLimit,
        previousExposure: creditPosition.exposure,
        bookingAmount,
        exposureAfterBooking: creditPosition.exposure.add(bookingAmount),
        availableCreditAfterBooking: creditPosition.availableCredit.sub(bookingAmount),
        creditOverrideUsed: exceedsCreditLimit,
      },
    });
  } catch (error) {
    console.error("Admin booking creation from quote error:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create planning booking from quote.",
    });
  }
});

/* ---------------------------------
   Existing Booking Routes
---------------------------------- */

router.get("/", async (_, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        quote: true,
        user: true,
        vehicle: true,
        driver: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
      },
    });

    res.json(bookings);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch bookings",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        quote: true,
        vehicle: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    res.json({
      bookings,
    });
  } catch (error) {
    console.error("Fetch user bookings error:", error);

    res.status(500).json({
      error: "Failed to fetch your bookings.",
    });
  }
});

router.get("/me/tracking", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        quote: true,
        vehicle: true,
        trackingEvents: {
          where: {
            userVisible: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    res.json({
      bookings,
    });
  } catch (error) {
    console.error("Fetch tracking error:", error);

    res.status(500).json({
      error: "Failed to fetch tracking.",
    });
  }
});

router.get("/me/invoices", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        booking: {
          include: {
            quote: true,
            pod: true,
            documents: true,
          },
        },
        invoiceBookings: {
          orderBy: {
            bookingDate: "asc",
          },
          include: {
            booking: {
              include: {
                quote: true,
                pod: true,
                documents: true,
              },
            },
          },
        },
        lines: {
          orderBy: {
            createdAt: "asc",
          },
        },
        allocations: {
          orderBy: {
            allocatedAt: "asc",
          },
          include: {
            payment: true,
          },
        },
        creditNotes: {
          orderBy: {
            issuedAt: "asc",
          },
        },
        documents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    const now = new Date();

    const customerInvoices = invoices.map((invoice) => {
      const amountPaid = invoice.allocations.reduce(
        (sum, allocation) => sum.add(allocation.amount),
        new Prisma.Decimal(0),
      );
      const creditedAmount = invoice.creditNotes
        .filter((creditNote) => creditNote.status !== "CANCELLED")
        .reduce(
          (sum, creditNote) => sum.add(creditNote.amount),
          new Prisma.Decimal(0),
        );
      const outstanding = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        invoice.total.sub(amountPaid).sub(creditedAmount),
      );

      let effectiveStatus = invoice.status;

      if (outstanding.equals(0) && amountPaid.greaterThan(0)) {
        effectiveStatus = "PAID";
      } else if (amountPaid.greaterThan(0) && outstanding.greaterThan(0)) {
        effectiveStatus = "PARTIALLY_PAID";
      } else if (
        invoice.dueDate &&
        invoice.dueDate < now &&
        outstanding.greaterThan(0) &&
        !["DRAFT", "VOID", "CREDITED", "CANCELLED"].includes(invoice.status)
      ) {
        effectiveStatus = "OVERDUE";
      }

      return {
        ...invoice,
        status: effectiveStatus,
        amountPaid,
        creditedAmount,
        outstanding,
      };
    });

    res.json({
      invoices: customerInvoices,
    });
  } catch (error) {
    console.error("Fetch invoices error:", error);

    res.status(500).json({
      error: "Failed to fetch invoices.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        quote: true,
        user: true,
        vehicle: true,
        driver: true,
        payments: true,
        invoices: true,
        pod: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch booking",
    });
  }
});

router.post("/expire-reservations", async (_, res) => {
  try {
    const now = new Date();

    const expiredReservations = await prisma.vehicleReservation.updateMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: ReservationStatus.EXPIRED,
      },
    });

    const expiredBookings = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        reservation: {
          status: ReservationStatus.EXPIRED,
        },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });

    await prisma.quote.updateMany({
      where: {
        status: "payment_pending",
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: "expired",
      },
    });

    res.json({
      success: true,
      expiredReservations: expiredReservations.count,
      expiredBookings: expiredBookings.count,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to expire reservations",
    });
  }
});

router.post("/from-quote/:quoteId", async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.quoteId,
      },
      include: {
        booking: true,
        user: {
          select: {
            accountStatus: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    if (quote.user && quote.user.accountStatus !== "ACTIVE") {
      return res.status(403).json({
        error:
          "This customer account is not active. New bookings cannot be created.",
      });
    }

    if (quote.booking) {
      return res.status(409).json({
        error: "Booking already exists for this quote",
      });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({
        error: "Quote has no total price",
      });
    }

    if (!quote.collectionWindow || quote.collectionWindow === "ASAP") {
      return res.status(400).json({
        error: "A fixed collection window is required before booking",
      });
    }

    const { reservedFrom, reservedUntil } = getReservationWindow(
      quote.collectionDate,
      quote.collectionWindow,
    );

    const vehicleAvailableAt = reservedUntil;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        vehicleType: quote.vehicleSize,
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
              lt: reservedUntil,
            },
            reservedUntil: {
              gt: reservedFrom,
            },
          },
        },
      },
    });

    const overlappingBookings = await prisma.booking.findMany({
      where: {
        vehicleId: {
          not: null,
        },
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
          lt: reservedUntil,
        },
        estimatedEndTime: {
          gt: reservedFrom,
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

    const availableVehicle = vehicles.find(
      (vehicle) =>
        vehicle.reservations.length === 0 &&
        !blockedVehicleIds.has(vehicle.id),
    );

    if (!availableVehicle) {
      return res.status(409).json({
        error: "No vehicle available for this collection window",
      });
    }

    const expiresAt = new Date();

    expiresAt.setMinutes(
      expiresAt.getMinutes() + PAYMENT_RESERVATION_MINUTES,
    );

    const booking = await prisma.booking.create({
      data: {
        reference: generateBookingReference(),
        status: BookingStatus.PENDING_PAYMENT,
        quoteId: quote.id,
        userId: quote.userId,
        vehicleId: availableVehicle.id,
        collectionDate: quote.collectionDate,
        collectionWindow: quote.collectionWindow,
        collectionAddress: quote.collectionAddress,
        deliveryAddress: quote.deliveryAddress,
        extraDrops:
          quote.extraDrops === null ? Prisma.JsonNull : quote.extraDrops,
        estimatedStartTime: reservedFrom,
        estimatedEndTime: reservedUntil,
        vehicleAvailableAt,
        totalPrice: quote.totalPrice,
        reservation: {
          create: {
            vehicleId: availableVehicle.id,
            quoteId: quote.id,
            status: ReservationStatus.ACTIVE,
            reservedFrom,
            reservedUntil,
            expiresAt,
          },
        },
        trackingEvents: {
          create: {
            status: BookingStatus.PENDING_PAYMENT,
            title: "Booking Created",
            description:
              "Your booking has been created and is pending payment.",
          },
        },
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        reservation: true,
        trackingEvents: true,
      },
    });

    await prisma.quote.update({
      where: {
        id: quote.id,
      },
      data: {
        status: "payment_pending",
        expiresAt,
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create booking from quote",
    });
  }
});

router.post("/:id/confirm-payment", async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        quote: true,
        reservation: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    if (!booking.reservation) {
      return res.status(400).json({
        error: "Booking has no reservation",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: BookingStatus.CONFIRMED,
        reservation: {
          update: {
            status: ReservationStatus.CONFIRMED,
            expiresAt: null,
          },
        },
        quote: booking.quote
          ? {
              update: {
                status: "paid",
              },
            }
          : undefined,
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

    await autoSaveRouteFromConfirmedBooking(updatedBooking.id);
    await assignRandomAvailableDriverToBooking(updatedBooking.id);

    const finalBooking = await prisma.booking.findUnique({
      where: {
        id: updatedBooking.id,
      },
      include: {
        quote: true,
        vehicle: true,
        user: true,
        driver: true,
        reservation: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    res.json(finalBooking || updatedBooking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to confirm booking payment",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const status = req.body.status as BookingStatus;

    const booking = await prisma.booking.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
        trackingEvents: {
          create: {
            status,
            title: `Booking ${String(status)
              .replace(/_/g, " ")
              .toLowerCase()}`,
            description: "Your booking status has been updated.",
          },
        },
      },
      include: {
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    res.json(booking);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update booking status",
    });
  }
});

export default router;