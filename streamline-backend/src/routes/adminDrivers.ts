import express from "express";
import bcrypt from "bcryptjs";
import { BookingStatus, DriverStatus, Prisma, ReservationStatus, VehicleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  DriverPortalError, driverJobInclude, ensureDriverStops, reconcileDriverActivity,
  requestId, reviewStopEvidence, text, ukDateKey, withBookingLock,
} from "../lib/driverPortal";

const router = express.Router();
const activeStatuses = [BookingStatus.CONFIRMED, BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS];
const actor = "Admin (API key)";

router.use((req, res, next) => {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return void res.status(500).json({ error: "Admin security is not configured." });
  if (text(req.headers["x-admin-key"]) !== key) return void res.status(401).json({ error: "Admin access denied." });
  res.setHeader("Cache-Control", "no-store");
  next();
});

type Handler = (req: express.Request, res: express.Response) => Promise<unknown>;
function route(handler: Handler): express.RequestHandler {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof DriverPortalError) return void res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return void res.status(409).json({ error: "The username, email or request is already in use. Refresh and check the saved result." });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return void res.status(409).json({ error: "The assignment changed. Refresh and retry." });
      }
      console.error("Admin driver operation failed:", error);
      res.status(500).json({ error: "Unable to confirm this driver operation. Refresh before retrying." });
    }
  };
}

type Tx = Prisma.TransactionClient;
type Driver = Prisma.DriverGetPayload<{ include: { vehicle: true } }>;
function publicDriver(driver: Driver) {
  return { id: driver.id, name: driver.name, username: driver.username, email: driver.email,
    phone: driver.phone, active: driver.active, status: driver.status, availability: driver.availability,
    onDuty: driver.portalOnDuty, vehicleId: driver.vehicleId, vehicle: driver.vehicle,
    licenceNumber: driver.licenceNumber, licenceType: driver.licenceType, licenceExpiryDate: driver.licenceExpiryDate,
    address: driver.address, emergencyContact: driver.emergencyContact, notes: driver.notes,
    lastLoginAt: driver.lastLoginAt, createdAt: driver.createdAt, updatedAt: driver.updatedAt };
}

function number(value: unknown, fallback: number, max: number) {
  if (value == null || value === "") return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max) throw new DriverPortalError(400, "Invalid pagination.");
  return result;
}

function date(value: unknown, field: string) {
  if (value == null || value === "") return null;
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new DriverPortalError(400, `Invalid ${field}.`);
  return result;
}

function password(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || Buffer.byteLength(value, "utf8") > 72) {
    throw new DriverPortalError(400, "Use a password of at least 8 characters and no more than 72 bytes.");
  }
  return value;
}

async function audit(tx: Tx, action: string, entityType: string, entityId: string,
  oldValue: Prisma.InputJsonValue, newValue: Prisma.InputJsonValue, reason: string) {
  await tx.auditLog.create({ data: { action, entityType, entityId, oldValue, newValue, reason } });
}

async function availableVan(tx: Tx, vehicleId: string, driverId?: string) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new DriverPortalError(404, "Van not found.");
  if (!vehicle.active || [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE].includes(vehicle.status as "MAINTENANCE" | "INACTIVE")) {
    throw new DriverPortalError(409, "This van is inactive or under maintenance.");
  }
  const otherDriver = await tx.driver.findFirst({ where: { active: true, vehicleId,
    ...(driverId ? { id: { not: driverId } } : {}) } });
  if (otherDriver) throw new DriverPortalError(409, `This van is assigned to ${otherDriver.name}. Unassign it from that driver first.`);
  const unsafe = await tx.driverVehicleCheck.findFirst({ where: { vehicleId, unsafeToDrive: true, resolvedAt: null } });
  if (unsafe) throw new DriverPortalError(409, "This van has an unresolved unsafe defect. Review it before assigning work.");
  return vehicle;
}

async function setVan(tx: Tx, driver: Driver, vehicleId: string | null, reason: string) {
  if (driver.vehicleId === vehicleId) return;
  const currentJob = await tx.booking.findFirst({ where: { driverId: driver.id, status: BookingStatus.IN_PROGRESS } });
  if (currentJob) throw new DriverPortalError(409, "Resolve the driver's active job before changing their van.");
  if (vehicleId) await availableVan(tx, vehicleId, driver.id);
  // Changing the driver's default van never silently changes any assigned booking.
  await tx.driver.update({ where: { id: driver.id }, data: { vehicleId } });
  await audit(tx, "DRIVER_VEHICLE_ASSIGNED", "Driver", driver.id,
    { vehicleId: driver.vehicleId }, { vehicleId }, reason || "Manual van assignment through Drivers.");
  await tx.driverPortalNotification.create({ data: { driverId: driver.id,
    dedupeKey: `van-${driver.id}-${Date.now()}`, title: vehicleId ? "Your assigned van changed" : "Van unassigned",
    body: vehicleId ? "Dispatch updated your van. Check Vehicle before starting your next job." : "Contact dispatch before starting another job." } });
}

function conflicts(start: Date, end: Date): Prisma.BookingWhereInput[] {
  const day = new Date(`${ukDateKey(start)}T00:00:00.000Z`);
  const dayEnd = new Date(day.getTime() + 86400000);
  return [
    { estimatedStartTime: { lt: end }, estimatedEndTime: { gt: start } },
    { collectionDate: { gte: day, lt: dayEnd }, estimatedStartTime: null },
    { collectionDate: { gte: day, lt: dayEnd }, estimatedEndTime: null },
    { status: BookingStatus.IN_PROGRESS, OR: [{ estimatedStartTime: null }, { estimatedEndTime: null }] },
  ];
}

async function reconcileVan(tx: Tx, vehicleId: string | null) {
  if (!vehicleId) return;
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || !vehicle.active || ["MAINTENANCE", "INACTIVE"].includes(vehicle.status)) return;
  const current = await tx.booking.count({ where: { vehicleId, status: BookingStatus.IN_PROGRESS } });
  const future = await tx.booking.count({ where: { vehicleId, status: { in: activeStatuses } } });
  await tx.vehicle.update({ where: { id: vehicleId }, data: {
    status: current ? VehicleStatus.OUT_ON_JOB : future ? VehicleStatus.BOOKED : VehicleStatus.AVAILABLE,
  } });
}

router.get("/", route(async (_req, res) => {
  const drivers = await prisma.driver.findMany({ orderBy: { createdAt: "desc" }, include: {
    vehicle: true, bookings: { where: { status: { in: activeStatuses } }, orderBy: [{ collectionDate: "asc" }, { estimatedStartTime: "asc" }],
      take: 25, select: { id: true, reference: true, status: true, collectionDate: true, collectionWindow: true,
        collectionAddress: true, deliveryAddress: true, driverAcknowledgedAt: true, vehicleId: true,
        estimatedStartTime: true, estimatedEndTime: true, driverJourneyStartedAt: true } },
    _count: { select: { bookings: { where: { status: { in: activeStatuses } } } } },
  } });
  res.json({ drivers: drivers.map(driver => ({ ...publicDriver(driver), jobs: driver.bookings, activeJobCount: driver._count.bookings })) });
}));

router.get("/dispatch", route(async (req, res) => {
  const page = number(req.query.page, 1, 10000), pageSize = number(req.query.pageSize, 25, 100);
  const where: Prisma.BookingWhereInput = { status: { in: activeStatuses } };
  if (req.query.unassigned === "true") where.driverId = null;
  if (text(req.query.driverId, 100)) where.driverId = text(req.query.driverId, 100);
  const query = text(req.query.q, 100);
  if (query) where.OR = ["reference", "collectionAddress", "deliveryAddress"].map(key => ({ [key]: { contains: query, mode: "insensitive" } }));
  const [jobs, total, vehicles, incidents, evidenceReviews, defects] = await Promise.all([
    prisma.booking.findMany({ where, orderBy: [{ collectionDate: "asc" }, { estimatedStartTime: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize, take: pageSize, include: { vehicle: true, driver: { select: { id: true, name: true } },
        quote: { select: { vehicleSize: true, customerName: true, companyName: true } }, driverStops: { orderBy: { sequence: "asc" } } } }),
    prisma.booking.count({ where }),
    prisma.vehicle.findMany({ orderBy: [{ vehicleType: "asc" }, { name: "asc" }], include: {
      drivers: { where: { active: true }, select: { id: true, name: true } } } }),
    prisma.driverIncident.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 100,
      include: { driver: { select: { id: true, name: true } }, booking: { select: { id: true, reference: true, status: true } } } }),
    prisma.driverStopEvidence.findMany({ where: { reviewStatus: "PENDING" }, orderBy: { receivedAt: "asc" }, take: 100,
      include: { stop: { include: { booking: { select: { id: true, reference: true, status: true, driverId: true } } } } } }),
    prisma.driverVehicleCheck.findMany({ where: { hasDefect: true, resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 100,
      include: { driver: { select: { id: true, name: true } }, vehicle: { select: { id: true, name: true, registration: true } } } }),
  ]);
  res.json({ jobs, vehicles, incidents, evidenceReviews, defects, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}));

router.patch("/incidents/:incidentId", route(async (req, res) => {
  const id = text(req.params.incidentId, 100), response = text(req.body?.response);
  const action = text(req.body?.action, 20);
  if (!["ACKNOWLEDGE", "RESOLVE"].includes(action) || !response) throw new DriverPortalError(400, "Choose acknowledge or resolve and enter a dispatch response.");
  const incident = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "DriverIncident" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.driverIncident.findUnique({ where: { id } });
    if (!existing) throw new DriverPortalError(404, "Problem report not found.");
    if (existing.resolvedAt) return existing;
    const updated = await tx.driverIncident.update({ where: { id }, data: { dispatchResponse: response,
      acknowledgedAt: existing.acknowledgedAt || new Date(), acknowledgedBy: existing.acknowledgedBy || actor,
      ...(action === "RESOLVE" ? { resolvedAt: new Date(), resolvedBy: actor } : {}) } });
    await audit(tx, `DRIVER_INCIDENT_${action}`, "DriverIncident", id, { resolved: false }, { response }, response);
    await tx.driverPortalNotification.create({ data: { driverId: existing.driverId, bookingId: existing.bookingId,
      dedupeKey: `incident-${id}-${Date.now()}`, title: "Dispatch responded to your report", body: response } });
    return updated;
  });
  res.json({ incident });
}));

router.patch("/evidence/:stopId/review", route(async (req, res) => {
  const decision = text(req.body?.decision, 20);
  if (!["APPROVE", "REJECT"].includes(decision)) throw new DriverPortalError(400, "Choose approve or reject.");
  const job = await reviewStopEvidence({ stopId: text(req.params.stopId, 100), decision: decision as "APPROVE" | "REJECT",
    reviewedBy: actor, notes: req.body?.notes });
  res.json({ job, message: "Delivery exception reviewed." });
}));

router.patch("/defects/:checkId", route(async (req, res) => {
  const id = text(req.params.checkId, 100), response = text(req.body?.response);
  const action = text(req.body?.action, 20);
  if (!["ACKNOWLEDGE", "RESOLVE"].includes(action) || !response) throw new DriverPortalError(400, "Choose acknowledge or resolve and enter a dispatch response.");
  const check = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "DriverVehicleCheck" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.driverVehicleCheck.findUnique({ where: { id } });
    if (!existing?.hasDefect) throw new DriverPortalError(404, "Vehicle defect not found.");
    if (existing.resolvedAt) return existing;
    const updated = await tx.driverVehicleCheck.update({ where: { id }, data: { dispatchResponse: response,
      acknowledgedAt: existing.acknowledgedAt || new Date(), acknowledgedBy: existing.acknowledgedBy || actor,
      ...(action === "RESOLVE" ? { resolvedAt: new Date(), resolvedBy: actor } : {}) } });
    await audit(tx, `VEHICLE_DEFECT_${action}`, "DriverVehicleCheck", id, { resolved: false }, { response }, response);
    await tx.driverPortalNotification.create({ data: { driverId: existing.driverId,
      dedupeKey: `defect-${id}-${Date.now()}`, title: action === "RESOLVE" ? "Vehicle defect resolved" : "Dispatch acknowledged the vehicle defect", body: response } });
    return updated;
  });
  res.json({ check });
}));

router.post("/:id/assign-job", route(async (req, res) => {
  const driverId = text(req.params.id, 100), bookingId = text(req.body?.bookingId, 100), vehicleId = text(req.body?.vehicleId, 100);
  const retryId = requestId(req.body?.requestId), reason = text(req.body?.reason);
  if (!bookingId || !vehicleId) throw new DriverPortalError(400, "Select the booking and van explicitly.");
  const job = await withBookingLock(bookingId, async tx => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: driverJobInclude });
    if (!booking) throw new DriverPortalError(404, "Booking not found.");
    const earlier = await tx.auditLog.findFirst({ where: { action: "DRIVER_JOB_ASSIGNED", entityType: "Booking", entityId: bookingId,
      newValue: { path: ["requestId"], equals: retryId } } });
    if (earlier) {
      const saved = earlier.newValue as Record<string, unknown> | null;
      if (saved?.driverId !== driverId || saved?.vehicleId !== vehicleId) throw new DriverPortalError(409, "This request identifier belongs to another assignment.");
      return booking;
    }
    if (![BookingStatus.CONFIRMED, BookingStatus.ASSIGNED].includes(booking.status as "CONFIRMED" | "ASSIGNED") || booking.driverJourneyStartedAt) {
      throw new DriverPortalError(409, "Only released, unstarted jobs can be assigned. Resolve active or closed jobs first.");
    }
    const expected = text(req.body?.expectedUpdatedAt, 100);
    if (expected && new Date(expected).getTime() !== booking.updatedAt.getTime()) throw new DriverPortalError(409, "This booking changed. Refresh before assigning it.");
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
    const driver = await tx.driver.findUnique({ where: { id: driverId }, include: { vehicle: true } });
    if (!driver?.active || driver.status !== DriverStatus.ACTIVE) throw new DriverPortalError(409, "Select an active driver.");
    if (driver.vehicleId !== vehicleId) throw new DriverPortalError(409, "Assign this van to the driver before assigning the job.");
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
    const vehicle = await availableVan(tx, vehicleId, driverId);
    const requiredType = booking.vehicleType || booking.quote?.vehicleSize || booking.vehicle?.vehicleType;
    if (requiredType && vehicle.vehicleType !== requiredType) throw new DriverPortalError(409, `This booking requires ${requiredType}. Select a matching van.`);
    const start = req.body?.estimatedStartTime == null ? booking.estimatedStartTime : date(req.body.estimatedStartTime, "start time");
    const end = req.body?.estimatedEndTime == null ? booking.estimatedEndTime : date(req.body.estimatedEndTime, "end time");
    if (!start || !end || end <= start) throw new DriverPortalError(400, "Set a valid planned start and end time before assigning the job.");
    if (ukDateKey(start) !== ukDateKey(booking.collectionDate)) throw new DriverPortalError(409, "The start time must match the booking's collection date. Edit the booking date first if needed.");
    if (driver.licenceExpiryDate && ukDateKey(driver.licenceExpiryDate) < ukDateKey(start)) throw new DriverPortalError(409, "The driver's recorded licence has expired for this job date.");
    const warnings = [
      ["Tax", vehicle.taxDueDate], ["MOT", vehicle.motExpiry], ["Insurance", vehicle.insuranceExpiry],
    ].filter(([, due]) => due instanceof Date && due.getTime() <= start.getTime() + 30 * 86400000).map(([label]) => label);
    if (warnings.length && (req.body?.complianceOverride !== true || !text(req.body?.complianceOverrideReason))) {
      throw new DriverPortalError(409, `${warnings.join(", ")} compliance warning. Check the fleet records and record an explicit override reason if authorised.`);
    }
    const overlaps = conflicts(start, end);
    const [driverConflict, vehicleConflict, reservationConflict] = await Promise.all([
      tx.booking.findFirst({ where: { id: { not: booking.id }, driverId, status: { in: activeStatuses }, OR: overlaps } }),
      tx.booking.findFirst({ where: { id: { not: booking.id }, vehicleId, status: { in: activeStatuses }, OR: overlaps } }),
      tx.vehicleReservation.findFirst({ where: { vehicleId, status: { in: [ReservationStatus.ACTIVE, ReservationStatus.CONFIRMED] },
        reservedFrom: { lt: end }, reservedUntil: { gt: start },
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { NOT: { OR: [{ bookingId: booking.id }, ...(booking.quoteId ? [{ quoteId: booking.quoteId }] : [])] } }] } }),
    ]);
    if (driverConflict || vehicleConflict || reservationConflict) throw new DriverPortalError(409, "The driver or van has overlapping work or a reservation. Choose another time or resolve the conflict.");
    if (booking.driverId && booking.driverId !== driverId && !reason) throw new DriverPortalError(400, "Record a reason for reassigning this job.");
    if (booking.driverStops.some(stop => stop.status !== "PENDING" || stop.evidence)) {
      throw new DriverPortalError(409, "This stop plan already has progress or evidence. Resolve it before changing the assignment.");
    }
    const assigned = await tx.booking.update({ where: { id: booking.id }, data: { driverId, vehicleId,
      vehicleType: vehicle.vehicleType, status: BookingStatus.ASSIGNED, estimatedStartTime: start, estimatedEndTime: end,
      vehicleAvailableAt: end, driverAssignedAt: new Date(), vehicleAssignedAt: new Date(),
      driverAcknowledgedAt: null,
      driverJourneyStartedAt: null }, include: driverJobInclude });
    await tx.vehicleReservation.upsert({ where: { bookingId: booking.id },
      create: { bookingId: booking.id, quoteId: booking.quoteId, vehicleId, status: ReservationStatus.CONFIRMED, reservedFrom: start, reservedUntil: end },
      update: { vehicleId, status: ReservationStatus.CONFIRMED, reservedFrom: start, reservedUntil: end, expiresAt: null } });
    // A fresh manual assignment snapshots the latest unstarted route. Never delete progressed stops or evidence.
    if (booking.driverStops.length) await tx.driverStop.deleteMany({ where: { bookingId: booking.id } });
    await ensureDriverStops(tx, { ...assigned, driverStops: [] });
    await audit(tx, "DRIVER_JOB_ASSIGNED", "Booking", booking.id,
      { driverId: booking.driverId, vehicleId: booking.vehicleId },
      { driverId, vehicleId, requestId: retryId, start: start.toISOString(), end: end.toISOString(), complianceOverrideReason: text(req.body?.complianceOverrideReason) },
      reason || "Manual job assignment through Drivers.");
    await tx.bookingTrackingEvent.create({ data: { bookingId: booking.id, status: BookingStatus.ASSIGNED,
      title: "Driver assigned", description: "Dispatch manually assigned a driver and van.", userVisible: true } });
    await tx.driverPortalNotification.create({ data: { driverId, bookingId: booking.id, dedupeKey: `assignment-${retryId}`,
      title: "Job assigned", body: `${booking.reference}: ${booking.collectionAddress} → ${booking.deliveryAddress}` } });
    if (booking.driverId && booking.driverId !== driverId) {
      await tx.driverPortalNotification.create({ data: { driverId: booking.driverId, bookingId: booking.id,
        dedupeKey: `reassigned-${retryId}`, title: "Job reassigned", body: `${booking.reference} is no longer assigned to you.` } });
      await reconcileDriverActivity(tx, booking.driverId);
    }
    await reconcileDriverActivity(tx, driverId);
    await reconcileVan(tx, booking.vehicleId);
    await reconcileVan(tx, vehicleId);
    return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: driverJobInclude });
  });
  res.json({ job, message: "Job and van manually assigned. The driver can now acknowledge the job." });
}));

router.patch("/:id/vehicle", route(async (req, res) => {
  const driverId = text(req.params.id, 100);
  if (!(req.body?.vehicleId === null || typeof req.body?.vehicleId === "string" && text(req.body.vehicleId))) {
    throw new DriverPortalError(400, "Select a van or explicitly unassign it.");
  }
  const vehicleId = req.body.vehicleId === null ? null : text(req.body.vehicleId, 100);
  const driver = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driverId }, include: { vehicle: true } });
    if (!current) throw new DriverPortalError(404, "Driver not found.");
    if (vehicleId) await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
    await setVan(tx, current, vehicleId, text(req.body?.reason));
    return tx.driver.findUniqueOrThrow({ where: { id: driverId }, include: { vehicle: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ driver: publicDriver(driver), message: "Van assignment saved. Existing bookings were not reassigned." });
}));

router.post("/:id/unassign-job", route(async (req, res) => {
  const driverId = text(req.params.id, 100), bookingId = text(req.body?.bookingId, 100);
  const retryId = requestId(req.body?.requestId), reason = text(req.body?.reason);
  if (!bookingId || !reason) throw new DriverPortalError(400, "Select the job and record why it is being unassigned.");
  const job = await withBookingLock(bookingId, async tx => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: driverJobInclude });
    if (!booking) throw new DriverPortalError(404, "Booking not found.");
    const earlier = await tx.auditLog.findFirst({ where: { action: "DRIVER_JOB_UNASSIGNED", entityType: "Booking", entityId: bookingId,
      newValue: { path: ["requestId"], equals: retryId } } });
    if (earlier) return booking;
    if (booking.driverId !== driverId) throw new DriverPortalError(409, "This job is no longer assigned to this driver.");
    if (![BookingStatus.CONFIRMED, BookingStatus.ASSIGNED].includes(booking.status as "CONFIRMED" | "ASSIGNED") || booking.driverJourneyStartedAt) {
      throw new DriverPortalError(409, "Resolve the active or closed job before unassigning its driver.");
    }
    const updated = await tx.booking.update({ where: { id: bookingId }, data: { driverId: null,
      status: BookingStatus.CONFIRMED, driverAssignedAt: null, driverAcknowledgedAt: null }, include: driverJobInclude });
    await audit(tx, "DRIVER_JOB_UNASSIGNED", "Booking", bookingId,
      { driverId }, { driverId: null, requestId: retryId }, reason);
    await tx.bookingTrackingEvent.create({ data: { bookingId, status: BookingStatus.CONFIRMED,
      title: "Driver assignment updated", description: "Dispatch is arranging a driver for this booking.", userVisible: true } });
    await tx.driverPortalNotification.create({ data: { driverId, bookingId, dedupeKey: `unassigned-${retryId}`,
      title: "Job unassigned", body: `${booking.reference} has been removed from your assigned work.` } });
    await reconcileDriverActivity(tx, driverId);
    return updated;
  });
  res.json({ job, message: "Driver manually unassigned. The booking's planned van and reservation remain in place." });
}));

router.post("/", route(async (req, res) => {
  const name = text(req.body?.name, 200), username = text(req.body?.username, 100), email = text(req.body?.email, 254).toLowerCase();
  if (!name || !username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DriverPortalError(400, "Enter name, username and a valid email.");
  const hash = await bcrypt.hash(password(req.body?.password), 12);
  const vehicleId = text(req.body?.vehicleId, 100) || null;
  const availability = text(req.body?.availability, 20) || "AVAILABLE";
  if (!["AVAILABLE", "BUSY", "OFFLINE"].includes(availability)) throw new DriverPortalError(400, "Invalid availability.");
  const active = typeof req.body?.active === "boolean" ? req.body.active : true;
  const driver = await prisma.$transaction(async tx => {
    if (vehicleId) { await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`; await availableVan(tx, vehicleId); }
    const created = await tx.driver.create({ data: { name, username, email, password: hash, phone: text(req.body?.phone, 100) || null,
      active, status: active ? DriverStatus.ACTIVE : DriverStatus.INACTIVE, availability: active ? availability : "OFFLINE",
      portalOnDuty: active && availability !== "OFFLINE", vehicleId,
      licenceNumber: text(req.body?.licenceNumber, 100) || null, licenceType: text(req.body?.licenceType, 100) || null,
      licenceExpiryDate: date(req.body?.licenceExpiryDate, "licence expiry"), address: text(req.body?.address) || null,
      emergencyContact: text(req.body?.emergencyContact) || null, notes: text(req.body?.notes) || null }, include: { vehicle: true } });
    await audit(tx, "DRIVER_CREATED", "Driver", created.id, {}, { name, username, email, vehicleId }, "Driver created manually through Drivers.");
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ driver: publicDriver(driver), message: "Driver created." });
}));

router.get("/:id", route(async (req, res) => {
  const driver = await prisma.driver.findUnique({ where: { id: text(req.params.id, 100) }, include: { vehicle: true,
    bookings: { orderBy: { collectionDate: "desc" }, take: 50, include: { vehicle: true, pod: true, driverStops: { orderBy: { sequence: "asc" }, include: { evidence: true } } } },
    locations: { orderBy: { createdAt: "desc" }, take: 10 }, vehicleChecks: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!driver) throw new DriverPortalError(404, "Driver not found.");
  res.json({ driver: { ...publicDriver(driver), bookings: driver.bookings, locations: driver.locations, vehicleChecks: driver.vehicleChecks } });
}));

router.patch("/:id", route(async (req, res) => {
  const driverId = text(req.params.id, 100), body = req.body || {};
  const data: Prisma.DriverUncheckedUpdateInput = {};
  for (const field of ["name", "username", "email"] as const) {
    if (body[field] !== undefined) {
      const value = text(body[field], field === "email" ? 254 : 200);
      if (!value) throw new DriverPortalError(400, `${field} cannot be empty.`);
      data[field] = field === "email" ? value.toLowerCase() : value;
    }
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) throw new DriverPortalError(400, "Enter a valid email.");
  for (const field of ["phone", "licenceNumber", "licenceType", "address", "emergencyContact", "notes"] as const) {
    if (body[field] !== undefined) data[field] = text(body[field]) || null;
  }
  if (body.licenceExpiryDate !== undefined) data.licenceExpiryDate = date(body.licenceExpiryDate, "licence expiry");
  if (body.active !== undefined && typeof body.active !== "boolean") throw new DriverPortalError(400, "Invalid driver account state.");
  if (body.status !== undefined && !Object.values(DriverStatus).includes(body.status)) throw new DriverPortalError(400, "Invalid driver status.");
  if (body.password) { data.password = await bcrypt.hash(password(body.password), 12); data.sessionToken = null; }
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driverId }, include: { vehicle: true } });
    if (!current) throw new DriverPortalError(404, "Driver not found.");
    const status: DriverStatus = body.status || (body.active === false ? DriverStatus.INACTIVE : body.active === true ? DriverStatus.ACTIVE : current.status);
    const active = body.active !== undefined ? body.active : status === DriverStatus.ACTIVE && current.active;
    if (active && status !== DriverStatus.ACTIVE) throw new DriverPortalError(400, "An active account must have Active status.");
    if (active && !current.active && current.vehicleId) {
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${current.vehicleId} FOR UPDATE`;
      await availableVan(tx, current.vehicleId, driverId);
    }
    data.status = status; data.active = active;
    if ((!active || body.availability === "OFFLINE") && await tx.booking.count({ where: { driverId, status: BookingStatus.IN_PROGRESS } })) {
      throw new DriverPortalError(409, "Resolve the driver's active job before taking this account off duty or deactivating it.");
    }
    if (body.vehicleId !== undefined) {
      if (!(body.vehicleId === null || typeof body.vehicleId === "string" && text(body.vehicleId))) throw new DriverPortalError(400, "Select a van or explicitly unassign it.");
      const vehicleId = body.vehicleId === null ? null : text(body.vehicleId, 100);
      if (vehicleId) await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
      await setVan(tx, current, vehicleId, text(body.reason));
    }
    if (body.availability !== undefined) {
      if (!["AVAILABLE", "BUSY", "OFFLINE"].includes(body.availability)) throw new DriverPortalError(400, "Invalid availability.");
      data.portalOnDuty = active && body.availability !== "OFFLINE";
    }
    if (!active) { data.portalOnDuty = false; data.sessionToken = null; }
    await tx.driver.update({ where: { id: driverId }, data });
    if (data.password || !active) await tx.driverPortalSession.updateMany({ where: { driverId, revokedAt: null }, data: { revokedAt: new Date() } });
    await reconcileDriverActivity(tx, driverId);
    const result = await tx.driver.findUniqueOrThrow({ where: { id: driverId }, include: { vehicle: true } });
    await audit(tx, "DRIVER_UPDATED", "Driver", driverId,
      { active: current.active, status: current.status, vehicleId: current.vehicleId },
      { active: result.active, status: result.status, vehicleId: result.vehicleId, passwordReset: Boolean(data.password) }, text(body.reason) || "Driver details updated through Drivers.");
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ driver: publicDriver(updated), message: "Driver updated." });
}));

router.delete("/:id", route(async (req, res) => {
  const driverId = text(req.params.id, 100);
  const driver = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driverId } });
    if (!current) throw new DriverPortalError(404, "Driver not found.");
    if (await tx.booking.count({ where: { driverId, status: BookingStatus.IN_PROGRESS } })) throw new DriverPortalError(409, "Resolve this driver's active job before deactivating the account.");
    const updated = await tx.driver.update({ where: { id: driverId }, data: {
      active: false, status: DriverStatus.INACTIVE, portalOnDuty: false, availability: "OFFLINE", sessionToken: null }, include: { vehicle: true } });
    await tx.driverPortalSession.updateMany({ where: { driverId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, "DRIVER_DEACTIVATED", "Driver", driverId, { active: current.active }, { active: false }, "Driver account deactivated through Drivers.");
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ driver: publicDriver(driver), message: "Driver deactivated. Assigned bookings remain available for manual dispatch review." });
}));

export default router;
