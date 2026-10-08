import express from "express";
import crypto from "crypto";
import { BookingStatus, Prisma } from "@prisma/client";
import {
  authenticateDriver, capturedDate, DriverAction, DriverPortalError, driverJobInclude,
  performDriverAction, requestId, requireAssignmentVersion, requireOpenJob, safeDriverJob, text, withBookingLock,
} from "../lib/driverPortal";

const router = express.Router();
const trackingInclude = {
  ...driverJobInclude,
  driverLocations: { orderBy: { createdAt: "desc" as const }, take: 1 },
};
type TrackingBooking = Prisma.BookingGetPayload<{ include: typeof trackingInclude }>;
type Tx = Prisma.TransactionClient;
type Handler = (req: express.Request, res: express.Response, driverId: string) => Promise<unknown>;

function driverRoute(handler: Handler): express.RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const driver = await authenticateDriver(req.headers.authorization);
      if (!driver) return void res.status(401).json({ error: "Please sign in to the driver portal." });
      await handler(req, res, driver.id);
    } catch (error) {
      if (error instanceof DriverPortalError) return void res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        return void res.status(409).json({ error: "This job changed. Refresh and retry using the same request identifier." });
      }
      console.error("Driver tracking error:", error);
      res.status(500).json({ error: "Unable to confirm the tracking update. Please retry." });
    }
  };
}

function bookingId(req: express.Request) {
  const id = text(req.params.bookingId, 100);
  if (!id) throw new DriverPortalError(400, "Booking identifier is required.");
  return id;
}

async function assignedBooking(tx: Tx, id: string, driverId: string) {
  const booking = await tx.booking.findFirst({ where: { id, driverId }, include: trackingInclude });
  if (!booking) throw new DriverPortalError(404, "This job is no longer assigned to you.");
  return booking;
}

async function requireTrackingJourney(tx: Tx, booking: TrackingBooking, driverId: string) {
  requireOpenJob(booking);
  if (!booking.driverAcknowledgedAt || !booking.driverJourneyStartedAt || booking.status !== BookingStatus.IN_PROGRESS) {
    throw new DriverPortalError(409, "Accept the job and start its journey before enabling phone tracking.");
  }
  const driver = await tx.driver.findUnique({ where: { id: driverId } });
  if (!driver?.active || !driver.portalOnDuty) throw new DriverPortalError(409, "You must be on duty to send phone location.");
  if (!booking.vehicleId || driver.vehicleId !== booking.vehicleId) {
    throw new DriverPortalError(409, "Dispatch must check your assigned van before tracking can continue.");
  }
}

function trackingPayload(booking: TrackingBooking) {
  const point = booking.driverLocations[0];
  const latestLocation = point ? {
    id: point.id, latitude: Number(point.latitude), longitude: Number(point.longitude),
    accuracy: point.accuracy == null ? null : Number(point.accuracy),
    heading: point.heading == null ? null : Number(point.heading),
    speed: point.speed == null ? null : Number(point.speed), createdAt: point.createdAt,
  } : null;
  const active = booking.status === BookingStatus.IN_PROGRESS && Boolean(booking.trackingStartedAt) && !booking.trackingEndedAt;
  const stale = !!point && Date.now() - point.createdAt.getTime() > 120_000;
  const job = { ...safeDriverJob(booking), trackingStartedAt: booking.trackingStartedAt,
    trackingEndedAt: booking.trackingEndedAt, driverLocations: latestLocation ? [latestLocation] : [] };
  return { job, booking: job, trackingActive: active, latestLocation,
    lastLocationAt: latestLocation?.createdAt || null, locationStale: stale,
    source: "PHONE", sourceLabel: "Phone location",
    locationState: !active ? "STOPPED" : !point ? "WAITING" : stale ? "STALE" : "RECENT",
    hardwareTrackerConnected: false,
    message: "Phone location can pause when the portal is closed, the phone is locked or another app is opened. Vehicle GPS integration is not configured yet.",
    serverTime: new Date() };
}

function optionalNumber(value: unknown, name: string, min: number, max: number) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new DriverPortalError(400, `Invalid ${name}.`);
  }
  return value;
}

function locationInput(body: Record<string, unknown>, required: boolean) {
  const latitude = optionalNumber(body.latitude, "latitude", -90, 90);
  const longitude = optionalNumber(body.longitude, "longitude", -180, 180);
  if ((latitude == null) !== (longitude == null) || (required && latitude == null)) {
    throw new DriverPortalError(400, "Provide both latitude and longitude.");
  }
  const accuracy = optionalNumber(body.accuracy, "accuracy", 0, 100_000);
  const heading = optionalNumber(body.heading, "heading", 0, 359.999999);
  const speed = optionalNumber(body.speed, "speed", 0, 200);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude, accuracy, heading, speed };
}

async function previousRequest(tx: Tx, booking: TrackingBooking, driverId: string, id: string, action: string) {
  const previous = await tx.driverJobAction.findUnique({ where: { driverId_requestId: { driverId, requestId: id } } });
  if (!previous) return false;
  if (previous.bookingId !== booking.id || previous.action !== action) {
    throw new DriverPortalError(409, "This request identifier has already been used for another action.");
  }
  return true;
}

router.get("/:bookingId", driverRoute(async (req, res, driverId) => {
  const payload = await withBookingLock(bookingId(req), async tx => trackingPayload(await assignedBooking(tx, bookingId(req), driverId)));
  res.json(payload);
}));

router.post("/:bookingId/start", driverRoute(async (req, res, driverId) => {
  const id = bookingId(req), retryId = requestId(req.body?.requestId);
  const point = locationInput(req.body || {}, false);
  const capturedAt = capturedDate(req.body?.capturedAt);
  const result = await withBookingLock(id, async tx => {
    const booking = await assignedBooking(tx, id, driverId);
    if (await previousRequest(tx, booking, driverId, retryId, "START_TRACKING")) {
      return { ...trackingPayload(booking), trackingToken: null, trackingUrl: null, replayed: true };
    }
    requireAssignmentVersion(booking, req.body?.expectedAssignedAt, req.body?.expectedVehicleId);
    await requireTrackingJourney(tx, booking, driverId);
    const alreadyActive = Boolean(booking.trackingStartedAt) && !booking.trackingEndedAt;
    // Keep existing customer links valid. Never rotate a token just because a driver refreshed.
    const shareToken = booking.trackingShareTokenHash ? null : crypto.randomBytes(32).toString("hex");
    if (!alreadyActive) {
      await tx.booking.update({ where: { id }, data: { trackingStartedAt: booking.trackingStartedAt || new Date(), trackingEndedAt: null,
        ...(shareToken ? { trackingShareTokenHash: crypto.createHash("sha256").update(shareToken).digest("hex") } : {}) } });
      await tx.bookingTrackingEvent.create({ data: { bookingId: id, status: booking.status,
        title: "Phone tracking started", description: "The driver enabled phone location sharing.", userVisible: true } });
    } else if (shareToken) {
      await tx.booking.update({ where: { id }, data: { trackingShareTokenHash: crypto.createHash("sha256").update(shareToken).digest("hex") } });
    }
    if (point && !alreadyActive) {
      if (capturedAt && Date.now() - capturedAt.getTime() > 120_000) throw new DriverPortalError(400, "Use a fresh location reading.");
      await tx.driverLocation.create({ data: { bookingId: id, driverId, ...point } });
    }
    await tx.driverJobAction.create({ data: { bookingId: id, driverId, requestId: retryId, action: "START_TRACKING", capturedAt } });
    const updated = await assignedBooking(tx, id, driverId);
    return { ...trackingPayload(updated), trackingToken: shareToken,
      trackingUrl: shareToken ? `/tracking/${encodeURIComponent(booking.reference)}?token=${shareToken}` : null,
      replayed: false };
  });
  res.json(result);
}));

router.post("/:bookingId/location", driverRoute(async (req, res, driverId) => {
  const id = bookingId(req), retryId = requestId(req.body?.requestId);
  const point = locationInput(req.body || {}, true)!;
  const capturedAt = capturedDate(req.body?.capturedAt);
  const result = await withBookingLock(id, async tx => {
    const booking = await assignedBooking(tx, id, driverId);
    if (await previousRequest(tx, booking, driverId, retryId, "PHONE_LOCATION")) {
      return { ...trackingPayload(booking), replayed: true };
    }
    requireAssignmentVersion(booking, req.body?.expectedAssignedAt, req.body?.expectedVehicleId);
    await requireTrackingJourney(tx, booking, driverId);
    if (!booking.trackingStartedAt || booking.trackingEndedAt) throw new DriverPortalError(409, "Enable phone tracking before sending location.");
    // Delayed queued GPS must not be presented to dispatch as a current position.
    if (capturedAt && Date.now() - capturedAt.getTime() > 120_000) throw new DriverPortalError(400, "Use a fresh location reading. Old GPS points cannot be replayed as live location.");
    const location = await tx.driverLocation.create({ data: { bookingId: id, driverId, ...point } });
    await tx.driverJobAction.create({ data: { bookingId: id, driverId, requestId: retryId, action: "PHONE_LOCATION", capturedAt } });
    return { ...trackingPayload(await assignedBooking(tx, id, driverId)), location: {
      id: location.id, latitude: Number(location.latitude), longitude: Number(location.longitude), createdAt: location.createdAt,
    }, replayed: false };
  });
  res.json(result);
}));

router.post("/:bookingId/stop", driverRoute(async (req, res, driverId) => {
  const id = bookingId(req), retryId = requestId(req.body?.requestId);
  const capturedAt = capturedDate(req.body?.capturedAt);
  const result = await withBookingLock(id, async tx => {
    const booking = await assignedBooking(tx, id, driverId);
    if (await previousRequest(tx, booking, driverId, retryId, "STOP_TRACKING")) return trackingPayload(booking);
    if (!booking.trackingStartedAt) throw new DriverPortalError(409, "Phone tracking has not started for this job.");
    if (!booking.trackingEndedAt) {
      await tx.booking.update({ where: { id }, data: { trackingEndedAt: new Date() } });
      await tx.bookingTrackingEvent.create({ data: { bookingId: id, status: booking.status,
        title: "Phone tracking stopped", description: "The driver stopped phone location sharing.", userVisible: true } });
    }
    await tx.driverJobAction.create({ data: { bookingId: id, driverId, requestId: retryId, action: "STOP_TRACKING", capturedAt } });
    return trackingPayload(await assignedBooking(tx, id, driverId));
  });
  res.json(result);
}));

// Legacy URL now delegates to the ordered workflow; free-text events cannot set arbitrary job state.
router.post("/:bookingId/event", driverRoute(async (req, res, driverId) => {
  const status = text(req.body?.status, 40);
  if (status === BookingStatus.COMPLETED) throw new DriverPortalError(409, "Complete each delivery stop with its required evidence.");
  if (status === BookingStatus.CANCELLED) throw new DriverPortalError(409, "Report the problem to dispatch. Only admin can cancel a booking.");
  const knownTitles: Record<string, DriverAction> = {
    "Job accepted": "ACCEPT", "Driver en route": "START", "Arrived at collection": "ARRIVE",
    "Goods collected": "COMPLETE_COLLECTION", "En route to delivery": "EN_ROUTE", "Arrived at delivery": "ARRIVE",
  };
  const action = text(req.body?.action, 30) as DriverAction || knownTitles[text(req.body?.title, 100)];
  if (!action) throw new DriverPortalError(400, "Use the current stop's available action.");
  const job = await performDriverAction({ bookingId: bookingId(req), driverId,
    expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId, action, stopId: text(req.body?.stopId, 100) || undefined, capturedAt: req.body?.capturedAt });
  res.json({ job, booking: job, message: "Job progress saved." });
}));

export default router;
