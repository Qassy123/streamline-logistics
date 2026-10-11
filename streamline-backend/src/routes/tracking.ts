import { BookingStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

import { requireStaff } from "../lib/adminAccess";
import { DriverPortalError } from "../lib/driverPortal";
import { dispatchRoles } from "../lib/fleetOperations";
import { customerTracking, driverEligible, retentionCutoff, trackingState } from "../lib/trackingState";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store, private"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });
const driverSelection = { id: true, name: true, phone: true, vehicleId: true, active: true, portalOnDuty: true } as const;
const userSelection = { id: true, name: true, companyName: true, email: true } as const;
async function workingDrivers(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const now = new Date();
  const [shifts, sessions] = await Promise.all([
    prisma.driverShift.findMany({ where: { driverId: { in: ids }, startedAt: { lte: now }, endedAt: null,
      activities: { some: { active: true, startedAt: { lte: now }, endedAt: null, kind: { in: ["WORK", "DRIVING", "OTHER_WORK"] } } } }, select: { driverId: true } }),
    prisma.driverPortalSession.findMany({ where: { driverId: { in: ids }, revokedAt: null, expiresAt: { gt: now }, NOT: { tokenHash: { startsWith: "reset:" } } }, select: { driverId: true } })]);
  const authenticated = new Set(sessions.map(s => s.driverId));
  return new Set(shifts.filter(s => authenticated.has(s.driverId)).map(s => s.driverId));
}


const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
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

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createTrackingToken() {
  return crypto.randomBytes(32).toString("hex");
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
      tokenHash: hashValue(token),
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

function adminTrackingInclude() {
  return {
    user: { select: userSelection },
    quote: true,
    vehicle: true,
    driver: { select: driverSelection },
    pod: true,
    trackingEvents: {
      orderBy: {
        createdAt: "asc",
      },
    },
    driverLocations: {
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    },
  } satisfies Prisma.BookingInclude;
}

/* ---------------------------------
   Admin Tracking Management
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
    const activeOnly =
      getString(req.query.activeOnly).toLowerCase() === "true";

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
          driver: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          vehicle: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          vehicle: {
            is: {
              registration: {
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

    if (activeOnly) {
      where.trackingStartedAt = {
        not: null,
      };
      where.trackingEndedAt = null;
      where.AND = [{ status: "IN_PROGRESS" }];
    }

    const [bookings, total, activeCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        include: adminTrackingInclude(),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({
        where,
      }),
      prisma.booking.count({
        where: {
          status: "IN_PROGRESS",
          trackingStartedAt: {
            not: null,
          },
          trackingEndedAt: null,
        },
      }),

    ]);

    const working = await workingDrivers(bookings.flatMap(b => b.driverId ? [b.driverId] : []));
    const enrichedBookings = bookings.map(booking => {
      const { trackingShareTokenHash, trackingShareExpiresAt, driverLocations, ...safe } = booking;
      return { ...safe, ...trackingState(booking, driverEligible(booking, working)) };
    });

    res.json({
      bookings: enrichedBookings,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        activeTracking: enrichedBookings.filter(b => b.trackingLive).length,
        staleLocations: enrichedBookings.filter(b => b.locationStale).length,
        sessionsEnabled: activeCount, scope: "PAGE",
      },
    });
  } catch (error) {
    console.error("Admin tracking list error:", error);

    res.status(500).json({
      error: "Unable to load tracking data.",
    });
  }
});

router.get("/admin/:bookingId", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
      include: {
        user: { select: userSelection },
        quote: true,
        vehicle: true,
        driver: { select: driverSelection },
        pod: true,
        trackingEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
          where: { createdAt: { gte: retentionCutoff() } },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const working = await workingDrivers(booking.driverId ? [booking.driverId] : []);
    const { trackingShareTokenHash, trackingShareExpiresAt, ...safeBooking } = booking;
    res.json({
      booking: {
        ...safeBooking,
        ...trackingState(booking, driverEligible(booking, working)),
        driverLocations: booking.driverLocations.map((location) => ({
          ...location,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          accuracy:
            location.accuracy === null
              ? null
              : Number(location.accuracy),
          heading:
            location.heading === null
              ? null
              : Number(location.heading),
          speed:
            location.speed === null
              ? null
              : Number(location.speed),
        })),
      },
    });
  } catch (error) {
    console.error("Admin tracking detail error:", error);

    res.status(500).json({
      error: "Unable to load tracking details.",
    });
  }
});

router.post("/admin/:bookingId/event", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const title = getString(req.body.title);
    const description = getString(req.body.description);
    const statusValue = getString(req.body.status).toUpperCase();

    if (!title) {
      return res.status(400).json({
        error: "Event title is required.",
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
    console.error("Admin tracking event creation error:", error);

    res.status(500).json({
      error: "Unable to create tracking event.",
    });
  }
});

router.patch("/admin/:bookingId/tracking", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: req.params.bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const action = getString(req.body.action).toUpperCase();

    if (!["START", "STOP", "RESET"].includes(action)) {
      return res.status(400).json({
        error: "Action must be START, STOP or RESET.",
      });
    }

    const now = new Date();

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data:
        action === "START"
          ? {
              trackingStartedAt: booking.trackingStartedAt || now,
              trackingEndedAt: null,
            }
          : action === "STOP"
            ? {
                trackingEndedAt: now,
              }
            : {
                trackingStartedAt: null,
                trackingEndedAt: null,
                trackingShareTokenHash: null,
                trackingShareExpiresAt: null,
              },
    });

    res.json({
      success: true,
      booking: { id: updatedBooking.id, reference: updatedBooking.reference, status: updatedBooking.status, trackingStartedAt: updatedBooking.trackingStartedAt, trackingEndedAt: updatedBooking.trackingEndedAt },
    });
  } catch (error) {
    console.error("Admin tracking update error:", error);

    res.status(500).json({
      error: "Unable to update tracking state.",
    });
  }
});

/* ---------------------------------
   Existing Tracking Routes
---------------------------------- */

// Retired write URLs used customer tracking links as write credentials.
// Driver mutations now require a signed-in driver and the current assigned job.
for (const path of ["/driver/start", "/driver/location", "/driver/stop"]) {
  router.post(path, (_req, res) => {
    res.status(410).json({ error: "Open the driver portal and use the authenticated job tracking controls." });
  });
}

router.get("/customer/:bookingId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.bookingId,
        userId: user.id,
      },
      include: {
        driver: { select: driverSelection },
        quote: true,
        vehicle: true,
        pod: true,
        trackingEvents: {
          where: {
            userVisible: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        driverLocations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const working = await workingDrivers(booking.driverId ? [booking.driverId] : []);
    const state = customerTracking(booking, driverEligible(booking, working));
    res.json({ ...state,
      booking: { id: booking.id, reference: booking.reference, status: booking.status,
        collectionDate: booking.collectionDate, collectionWindow: booking.collectionWindow,
        collectionAddress: booking.collectionAddress, deliveryAddress: booking.deliveryAddress,
        vehicle: booking.vehicle ? { name: booking.vehicle.name, vehicleType: booking.vehicle.vehicleType, registration: booking.vehicle.registration } : null,
        pod: booking.pod, trackingStartedAt: booking.trackingStartedAt, trackingEndedAt: booking.trackingEndedAt },
      trackingEvents: booking.trackingEvents,
    });
  } catch (error) {
    console.error("Customer tracking fetch error:", error);

    res.status(500).json({
      error: "Failed to fetch customer tracking.",
    });
  }
});


router.get("/fleet", async (req, res) => {
  try {
    await requireStaff(req, [...dispatchRoles]);
    const page = Number(req.query.page || 1), pageSize = 25;
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new DriverPortalError(400, "Invalid page.");
    const where = { active: true };
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({ where, select: { id: true, name: true, registration: true, vehicleType: true }, orderBy: { id: "asc" }, skip: (page-1)*pageSize, take: pageSize }),
      prisma.vehicle.count({ where })]);
    const bookings = vehicles.length ? await prisma.booking.findMany({ where: { vehicleId: { in: vehicles.map(v=>v.id) }, status: "IN_PROGRESS" },
      include: { driver: { select: driverSelection }, driverStops: { select: { sequence: true, address: true, status: true }, orderBy: { sequence: "asc" } }, driverLocations: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 500 }) : [];
    const working = await workingDrivers(bookings.flatMap(b=>b.driverId ? [b.driverId] : []));
    const rows = vehicles.map(vehicle => {
      const matches = bookings.filter(b=>b.vehicleId === vehicle.id);
      const states = matches.map(booking => ({ booking, state: trackingState(booking, driverEligible(booking, working)) }));
      states.sort((a,b) => Number(b.state.trackingLive)-Number(a.state.trackingLive) || (b.state.lastLocationAt?.getTime() || 0)-(a.state.lastLocationAt?.getTime() || 0));
      const selected = states[0];
      return { vehicle, booking: selected ? { id: selected.booking.id, reference: selected.booking.reference, status: selected.booking.status,
        plannedArrivalAt: selected.booking.estimatedEndTime, destination: selected.booking.driverStops.find(stop => !["COMPLETED", "SKIPPED"].includes(stop.status))?.address || selected.booking.deliveryAddress, driver: selected.booking.driver ? { name: selected.booking.driver.name } : null } : null,
        ...(selected?.state || { trackingLive: false, locationState: "WAITING", latestLocation: null, source: "PHONE", eta: null }),
        openJobs: matches.length };
    });
    res.json({ rows, page, pageSize, total, pages: Math.max(1, Math.ceil(total/pageSize)), truncatedJobs: bookings.length === 500,
      serverTime: new Date(), freshForSeconds: 120 });
  } catch(error) {
    if (error instanceof DriverPortalError) return void res.status(error.status).json({ error: error.message });
    console.error("Fleet tracking read failed"); res.status(500).json({ error: "Unable to refresh fleet tracking." });
  }
});

// A bounded in-memory abuse guard. It contains no coordinates or raw share tokens.
const publicReads = new Map<string, { started: number; count: number }>();
router.get("/public/:reference", async (req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const reference = typeof req.params.reference === "string" ? req.params.reference : "";
  if (!/^[a-f0-9]{64}$/i.test(token) || !reference || reference.length > 100) return void res.status(404).json({ error: "Tracking link is unavailable or expired." });
  const key = hashValue((req.ip || "unknown") + token), now = Date.now();
  let bucket = publicReads.get(key);
  if (!bucket || now - bucket.started >= 60_000) { bucket = { started: now, count: 0 }; publicReads.set(key, bucket); }
  if (publicReads.size > 10000) publicReads.delete(publicReads.keys().next().value!);
  if (++bucket.count > 30) { res.setHeader("Retry-After", "60"); return void res.status(429).json({ error: "Please wait before refreshing tracking again." }); }
  try {
    const booking = await prisma.booking.findFirst({ where: { reference, trackingShareTokenHash: hashValue(token), trackingShareExpiresAt: { gt: new Date() } },
      include: { driver: { select: driverSelection }, driverLocations: { orderBy: { createdAt: "desc" }, take: 1 },
        trackingEvents: { where: { userVisible: true }, select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 } } });
    if (!booking) return void res.status(404).json({ error: "Tracking link is unavailable or expired." });
    const working = await workingDrivers(booking.driverId ? [booking.driverId] : []);
    const state = customerTracking(booking, driverEligible(booking, working));
    res.json({ ...state, booking: { reference: booking.reference, status: booking.status, plannedArrivalAt: booking.estimatedEndTime },
      trackingEvents: [...booking.trackingEvents].reverse(), expiresAt: booking.trackingShareExpiresAt });
  } catch { res.status(500).json({ error: "Unable to refresh tracking. Please retry." }); }
});

export default router;
