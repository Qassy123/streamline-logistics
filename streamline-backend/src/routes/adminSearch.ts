import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

function requireAdminKey(
  request: Request,
  response: Response,
  next: () => void,
) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.header("x-admin-key");

  if (!configuredKey) {
    response.status(500).json({
      success: false,
      message: "ADMIN_API_KEY is not configured.",
    });
    return;
  }

  if (!suppliedKey || suppliedKey !== configuredKey) {
    response.status(401).json({
      success: false,
      message: "Unauthorised.",
    });
    return;
  }

  next();
}

router.use(requireAdminKey);

function normaliseString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 8;
  }

  return Math.min(parsed, 25);
}

function stringifyDecimal(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}

router.get("/", async (request, response) => {
  try {
    const query = normaliseString(request.query.q);
    const entity = normaliseString(request.query.entity).toUpperCase();
    const limit = parseLimit(request.query.limit);

    if (query.length < 2) {
      response.status(400).json({
        success: false,
        message: "Enter at least two characters.",
      });
      return;
    }

    const allowedEntities = new Set([
      "",
      "CUSTOMERS",
      "TRADE_ACCOUNTS",
      "QUOTES",
      "BOOKINGS",
      "DRIVERS",
      "VEHICLES",
      "PAYMENTS",
      "INVOICES",
      "TRACKING",
      "DOCUMENTS",
    ]);

    if (!allowedEntities.has(entity)) {
      response.status(400).json({
        success: false,
        message: "Invalid entity filter.",
      });
      return;
    }

    const shouldSearch = (name: string) => entity === "" || entity === name;

    const [
      customers,
      tradeAccounts,
      quotes,
      bookings,
      drivers,
      vehicles,
      payments,
      invoices,
      tracking,
      documents,
    ] = await Promise.all([
      shouldSearch("CUSTOMERS")
        ? prisma.user.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { companyName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { username: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { accountNumber: { contains: query, mode: "insensitive" } },
                { vatNumber: { contains: query, mode: "insensitive" } },
                {
                  companyRegistrationNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              accountNumber: true,
              accountType: true,
              accountStatus: true,
              companyName: true,
              name: true,
              email: true,
              phone: true,
              updatedAt: true,
            },
          })
        : [],
      shouldSearch("TRADE_ACCOUNTS")
        ? prisma.tradeAccount.findMany({
            where: {
              OR: [
                { companyName: { contains: query, mode: "insensitive" } },
                { tradingName: { contains: query, mode: "insensitive" } },
                {
                  companyRegistrationNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { vatNumber: { contains: query, mode: "insensitive" } },
                {
                  accountsContactName: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { accountsEmail: { contains: query, mode: "insensitive" } },
                { accountsPhone: { contains: query, mode: "insensitive" } },
                { primaryEmail: { contains: query, mode: "insensitive" } },
                { primaryMobile: { contains: query, mode: "insensitive" } },
                {
                  user: {
                    is: {
                      OR: [
                        { accountNumber: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              status: true,
              companyName: true,
              tradingName: true,
              accountsEmail: true,
              accountsPhone: true,
              creditLimit: true,
              currentBalance: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  accountNumber: true,
                  email: true,
                },
              },
            },
          })
        : [],
      shouldSearch("QUOTES")
        ? prisma.quote.findMany({
            where: {
              OR: [
                { id: { contains: query, mode: "insensitive" } },
                { customerName: { contains: query, mode: "insensitive" } },
                { customerEmail: { contains: query, mode: "insensitive" } },
                { customerPhone: { contains: query, mode: "insensitive" } },
                { companyName: { contains: query, mode: "insensitive" } },
                {
                  customerReference: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  purchaseOrderNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  collectionAddress: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  deliveryAddress: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              status: true,
              customerName: true,
              customerEmail: true,
              companyName: true,
              collectionAddress: true,
              deliveryAddress: true,
              totalPrice: true,
              collectionDate: true,
              updatedAt: true,
            },
          })
        : [],
      shouldSearch("BOOKINGS")
        ? prisma.booking.findMany({
            where: {
              OR: [
                { reference: { contains: query, mode: "insensitive" } },
                {
                  customerReference: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  purchaseOrderNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  collectionAddress: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  deliveryAddress: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  user: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { companyName: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                        { phone: { contains: query, mode: "insensitive" } },
                        {
                          accountNumber: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  vehicle: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        {
                          registration: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  driver: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                        { phone: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              reference: true,
              status: true,
              collectionDate: true,
              collectionAddress: true,
              deliveryAddress: true,
              totalPrice: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                  email: true,
                },
              },
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  registration: true,
                },
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : [],
      shouldSearch("DRIVERS")
        ? prisma.driver.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { username: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                {
                  licenceNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { address: { contains: query, mode: "insensitive" } },
                {
                  vehicle: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        {
                          registration: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              phone: true,
              active: true,
              availability: true,
              status: true,
              licenceNumber: true,
              updatedAt: true,
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  registration: true,
                },
              },
            },
          })
        : [],
      shouldSearch("VEHICLES")
        ? prisma.vehicle.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { vehicleType: { contains: query, mode: "insensitive" } },
                {
                  vehicleCategory: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { registration: { contains: query, mode: "insensitive" } },
                { make: { contains: query, mode: "insensitive" } },
                { model: { contains: query, mode: "insensitive" } },
                { colour: { contains: query, mode: "insensitive" } },
                {
                  insurancePolicyNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { gpsDeviceId: { contains: query, mode: "insensitive" } },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              name: true,
              vehicleType: true,
              vehicleCategory: true,
              registration: true,
              make: true,
              model: true,
              status: true,
              active: true,
              updatedAt: true,
            },
          })
        : [],
      shouldSearch("PAYMENTS")
        ? prisma.payment.findMany({
            where: {
              OR: [
                { id: { contains: query, mode: "insensitive" } },
                { provider: { contains: query, mode: "insensitive" } },
                {
                  providerPaymentId: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { reference: { contains: query, mode: "insensitive" } },
                { notes: { contains: query, mode: "insensitive" } },
                {
                  booking: {
                    is: {
                      reference: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  invoice: {
                    is: {
                      invoiceNumber: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { companyName: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                        {
                          accountNumber: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              provider: true,
              paymentMethod: true,
              status: true,
              amount: true,
              currency: true,
              reference: true,
              paidAt: true,
              updatedAt: true,
              booking: {
                select: {
                  id: true,
                  reference: true,
                },
              },
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
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
          })
        : [],
      shouldSearch("INVOICES")
        ? prisma.invoice.findMany({
            where: {
              OR: [
                {
                  invoiceNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  customerReference: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  purchaseOrderNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { notes: { contains: query, mode: "insensitive" } },
                {
                  booking: {
                    is: {
                      reference: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { companyName: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                        {
                          accountNumber: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              subtotal: true,
              vatAmount: true,
              total: true,
              dueDate: true,
              paidAt: true,
              updatedAt: true,
              booking: {
                select: {
                  id: true,
                  reference: true,
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
          })
        : [],
      shouldSearch("TRACKING")
        ? prisma.booking.findMany({
            where: {
              OR: [
                { reference: { contains: query, mode: "insensitive" } },
                {
                  trackingEvents: {
                    some: {
                      OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        {
                          description: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  driver: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
                {
                  vehicle: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        {
                          registration: {
                            contains: query,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              reference: true,
              status: true,
              trackingStartedAt: true,
              trackingEndedAt: true,
              updatedAt: true,
              driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  registration: true,
                },
              },
              trackingEvents: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  title: true,
                  description: true,
                  createdAt: true,
                },
              },
              driverLocations: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  latitude: true,
                  longitude: true,
                  createdAt: true,
                },
              },
            },
          })
        : [],
      shouldSearch("DOCUMENTS")
        ? prisma.document.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { notes: { contains: query, mode: "insensitive" } },
                {
                  user: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { companyName: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
                {
                  driver: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
                {
                  vehicle: {
                    is: {
                      registration: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  booking: {
                    is: {
                      reference: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  invoice: {
                    is: {
                      invoiceNumber: {
                        contains: query,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
              id: true,
              type: true,
              name: true,
              fileUrl: true,
              mimeType: true,
              fileSize: true,
              updatedAt: true,
            },
          })
        : [],
    ]);

    const result = {
      customers: customers.map((item) => ({
        ...item,
        href: `/admin/customers/${item.id}`,
      })),
      tradeAccounts: tradeAccounts.map((item) => ({
        ...item,
        creditLimit: stringifyDecimal(item.creditLimit),
        currentBalance: stringifyDecimal(item.currentBalance),
        href: "/admin/trade-accounts",
      })),
      quotes: quotes.map((item) => ({
        ...item,
        totalPrice: stringifyDecimal(item.totalPrice),
        href: "/admin/quotes",
      })),
      bookings: bookings.map((item) => ({
        ...item,
        totalPrice: stringifyDecimal(item.totalPrice),
        href: "/admin/bookings",
      })),
      drivers: drivers.map((item) => ({
        ...item,
        href: "/admin/drivers",
      })),
      vehicles: vehicles.map((item) => ({
        ...item,
        href: "/admin/fleet",
      })),
      payments: payments.map((item) => ({
        ...item,
        amount: stringifyDecimal(item.amount),
        href: "/admin/payments",
      })),
      invoices: invoices.map((item) => ({
        ...item,
        subtotal: stringifyDecimal(item.subtotal),
        vatAmount: stringifyDecimal(item.vatAmount),
        total: stringifyDecimal(item.total),
        href: "/admin/invoices",
      })),
      tracking: tracking.map((item) => ({
        ...item,
        driverLocations: item.driverLocations.map((location) => ({
          ...location,
          latitude: stringifyDecimal(location.latitude),
          longitude: stringifyDecimal(location.longitude),
        })),
        href: "/admin/tracking",
      })),
      documents: documents.map((item) => ({
        ...item,
        href: "/admin/documents",
      })),
    };

    const counts = Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, value.length]),
    );

    response.json({
      success: true,
      query,
      entity: entity || "ALL",
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      results: result,
    });
  } catch (error) {
    console.error("GET /api/admin/search failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to search the admin system.",
    });
  }
});

export default router;