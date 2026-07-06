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

function generateInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `INV-${datePart}-${randomPart}`;
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
  quote?: {
    adminPrice: Prisma.Decimal | null;
    vatAmount: Prisma.Decimal | null;
    totalPrice: Prisma.Decimal | null;
  } | null;
}) {
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      bookingId: booking.id,
    },
  });

  if (existingInvoice) return existingInvoice;

  const subtotal = booking.quote?.adminPrice || booking.totalPrice;
  const vatAmount = booking.quote?.vatAmount || 0;
  const total = booking.quote?.totalPrice || booking.totalPrice;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  return prisma.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(),
      bookingId: booking.id,
      userId: booking.userId,
      status: "ISSUED",
      subtotal,
      vatAmount,
      total,
      dueDate,
    },
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

  const { reservedFrom, reservedUntil } = getReservationWindow(
    quote.collectionDate,
    quote.collectionWindow,
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
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
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

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

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

    const quote = await prisma.quote.update({
      where: {
        id: quoteId,
      },
      data: {
        userId: user.id,
      },
    });

    const booking = await createConfirmedBookingFromQuote(quote.id, user.id);

    const existingPayment = await prisma.payment.findFirst({
      where: {
        provider: "stripe",
        providerPaymentId: session.id,
      },
    });

    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          userId: user.id,
          provider: "stripe",
          providerPaymentId: session.id,
          status: PaymentStatus.PAID,
          amount: quote.totalPrice || booking.totalPrice,
          currency: String(session.currency || "gbp").toUpperCase(),
          paidAt: new Date(),
        },
      });

      await sendCustomerPaymentSuccessfulEmail(booking);
      await sendCustomerBookingConfirmedEmail(booking);
      await sendAdminNewPaidBookingEmail(booking);
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

export default router;