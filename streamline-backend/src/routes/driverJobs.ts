import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  authenticateDriver, capturedDate, DriverAction, DriverPortalError, driverJobInclude,
  performDriverAction, readDriverJob, reconcileDriverActivity, reportDriverIncident,
  requestId, safeDriver, safeDriverJob, text, ukDateKey,
} from "../lib/driverPortal";

const router = express.Router();
const vehicleUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
type Handler = (req: express.Request, res: express.Response, driver: NonNullable<Awaited<ReturnType<typeof authenticateDriver>>>) => Promise<unknown>;

function driverRoute(handler: Handler): express.RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const driver = await authenticateDriver(req.headers.authorization);
      if (!driver) return void res.status(401).json({ error: "Please sign in to the driver portal." });
      await handler(req, res, driver);
    } catch (error) {
      if (error instanceof DriverPortalError) return void res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        return void res.status(409).json({ error: "This information changed. Refresh and retry using the same request identifier." });
      }
      console.error("Driver portal jobs error:", error);
      res.status(500).json({ error: "Unable to complete this request. Your work has not been confirmed; please retry." });
    }
  };
}

const activeStatuses: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS];
const jobOrder: Prisma.BookingOrderByWithRelationInput[] = [
  { collectionDate: "asc" }, { estimatedStartTime: { sort: "asc", nulls: "last" } }, { id: "asc" },
];
const listInclude = { ...driverJobInclude, trackingEvents: { orderBy: { createdAt: "desc" as const }, take: 30 } };

function dateRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DriverPortalError(400, "Choose a valid date.");
  const start = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== value) throw new DriverPortalError(400, "Choose a valid date.");
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { gte: start, lt: end };
}

function pageNumber(value: unknown, fallback: number, max: number) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new DriverPortalError(400, "Invalid page or page size.");
  return number;
}

async function hydrateJobs(rows: Prisma.BookingGetPayload<{ include: typeof driverJobInclude }>[], driverId: string) {
  const jobs: ReturnType<typeof safeDriverJob>[] = [];
  for (const row of rows) {
    if (activeStatuses.includes(row.status) && !row.driverStops.length) {
      try { jobs.push(await readDriverJob(row.id, driverId)); }
      catch (error) {
        // A reassignment between the list query and detail read removes the job from this driver's view.
        if (error instanceof DriverPortalError && error.status === 404) continue;
        // Keep a malformed legacy job visible so dispatch can correct its addresses.
        if (error instanceof DriverPortalError && error.status === 409) { jobs.push(safeDriverJob(row)); continue; }
        throw error;
      }
    } else jobs.push(safeDriverJob(row));
  }
  return jobs;
}

router.get("/dashboard", driverRoute(async (_req, res, driver) => {
  const today = ukDateKey();
  const range = dateRange(today);
  const activeWhere: Prisma.BookingWhereInput = { driverId: driver.id, status: { in: activeStatuses } };
  const [activeRows, todayCount, assignedCount, activeCount, completedCount, recentRows, notificationCount, notifications] = await Promise.all([
    prisma.booking.findMany({ where: activeWhere, include: listInclude, orderBy: jobOrder, take: 50 }),
    prisma.booking.count({ where: { driverId: driver.id, collectionDate: range, status: { in: [...activeStatuses, BookingStatus.COMPLETED] } } }),
    prisma.booking.count({ where: { driverId: driver.id, status: { in: [BookingStatus.CONFIRMED, BookingStatus.ASSIGNED] } } }),
    prisma.booking.count({ where: { driverId: driver.id, status: BookingStatus.IN_PROGRESS } }),
    prisma.booking.count({ where: { driverId: driver.id, status: BookingStatus.COMPLETED } }),
    prisma.booking.findMany({ where: { driverId: driver.id, status: BookingStatus.COMPLETED }, include: listInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
    prisma.driverPortalNotification.count({ where: { driverId: driver.id, readAt: null } }),
    prisma.driverPortalNotification.findMany({ where: { driverId: driver.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  // Current work always wins over the next scheduled job, even when there are many future jobs.
  const currentRow = activeRows.find(job => job.status === BookingStatus.IN_PROGRESS)
    || await prisma.booking.findFirst({ where: { driverId: driver.id, status: BookingStatus.IN_PROGRESS }, include: listInclude, orderBy: jobOrder });
  const combined = currentRow && !activeRows.some(job => job.id === currentRow.id) ? [currentRow, ...activeRows] : activeRows;
  const jobs = await hydrateJobs(combined, driver.id);
  const currentJob = jobs.find(job => job.status === BookingStatus.IN_PROGRESS) || null;
  const assignedJobs = jobs.filter(job => job.status !== BookingStatus.IN_PROGRESS);
  const todayJobs = jobs.filter(job => ukDateKey(new Date(job.collectionDate)) === today);
  res.json({
    driver: safeDriver(driver), today, serverTime: new Date(),
    currentJob, nextJob: assignedJobs[0] || null, upcomingJobs: assignedJobs,
    todayJobs, assignedJobs, activeJobs: jobs.filter(job => job.status === BookingStatus.IN_PROGRESS),
    completedJobs: recentRows.map(safeDriverJob),
    stats: { todayJobs: todayCount, assignedJobs: assignedCount, activeJobs: activeCount, completedJobs: completedCount },
    unreadNotifications: notificationCount, notifications,
    hasMoreAssignedJobs: assignedCount + activeCount > jobs.length,
    // Hardware tracking is deliberately unconnected until a provider is selected.
    tracker: { source: "VEHICLE_TRACKER", connected: false, message: "Vehicle GPS integration is not configured yet." },
  });
}));

router.get("/notifications", driverRoute(async (req, res, driver) => {
  const page = pageNumber(req.query.page, 1, 10000), pageSize = pageNumber(req.query.pageSize, 25, 50);
  const where: Prisma.DriverPortalNotificationWhereInput = { driverId: driver.id };
  if (req.query.unread === "true") where.readAt = null;
  const [notifications, total] = await Promise.all([
    prisma.driverPortalNotification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.driverPortalNotification.count({ where }),
  ]);
  res.json({ notifications, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}));

router.patch("/notifications/:id/read", driverRoute(async (req, res, driver) => {
  const notification = await prisma.driverPortalNotification.findFirst({ where: { id: text(req.params.id, 100), driverId: driver.id } });
  if (!notification) throw new DriverPortalError(404, "Notification not found.");
  await prisma.driverPortalNotification.updateMany({ where: { id: notification.id, driverId: driver.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ success: true });
}));

router.patch("/duty", driverRoute(async (req, res, driver) => {
  if (typeof req.body?.onDuty !== "boolean") throw new DriverPortalError(400, "Choose on duty or off duty.");
  const onDuty = req.body.onDuty as boolean;
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driver.id } });
    if (!current?.active) throw new DriverPortalError(401, "Driver account is inactive.");
    if (!onDuty && await tx.booking.count({ where: { driverId: driver.id, status: BookingStatus.IN_PROGRESS } })) {
      throw new DriverPortalError(409, "Finish the active job or contact dispatch before going off duty.");
    }
    await tx.driver.update({ where: { id: driver.id }, data: { portalOnDuty: onDuty } });
    await reconcileDriverActivity(tx, driver.id);
    return tx.driver.findUniqueOrThrow({ where: { id: driver.id }, include: { vehicle: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ driver: safeDriver(updated) });
}));

const checkItems = ["TYRES", "LIGHTS", "BRAKES", "MIRRORS", "FLUIDS", "LOAD_SECURITY", "BODYWORK"] as const;

function vehiclePhoto(value: unknown, driverId: string, vehicleId: string) {
  const raw = text(value, 2000), cloud = process.env.CLOUDINARY_CLOUD_NAME;
  let url: URL;
  try { url = new URL(raw); } catch { throw new DriverPortalError(400, "Invalid vehicle photo."); }
  const prefix = `/${cloud}/image/upload/`;
  if (!cloud || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(prefix)
    || !url.pathname.slice(prefix.length).includes(`/streamline-logistics/vehicle-checks/${driverId}/${vehicleId}/`)) {
    throw new DriverPortalError(400, "Use photos uploaded for your assigned van.");
  }
  return raw;
}

router.post("/vehicle/photo", driverRoute(async (req, res, driver) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new DriverPortalError(503, "Photo storage is not configured. Contact dispatch.");
  }
  await new Promise<void>((resolve, reject) => vehicleUpload.single("file")(req, res, error => {
    if (error) reject(new DriverPortalError(400, "Upload one photo smaller than 8 MB.")); else resolve();
  }));
  const vehicleId = text(req.body?.vehicleId, 100);
  const uploadId = requestId(req.body?.requestId);
  const current = await prisma.driver.findUnique({ where: { id: driver.id }, include: { vehicle: true } });
  if (!current?.active || current.vehicleId !== vehicleId || !current.vehicle?.active) {
    throw new DriverPortalError(409, "This van is no longer assigned to you. Refresh before uploading.");
  }
  if (!req.file || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(req.file.mimetype)) {
    throw new DriverPortalError(400, "Choose a JPEG, PNG, WebP or HEIC vehicle photo.");
  }
  const uploaded = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`, {
    folder: `streamline-logistics/vehicle-checks/${driver.id}/${vehicleId}`, public_id: `photo-${uploadId}`, resource_type: "image", overwrite: false,
  });
  res.json({ url: uploaded.secure_url, vehicleId });
}));

router.get("/vehicle", driverRoute(async (_req, res, driver) => {
  const vehicle = driver.vehicle;
  const [checks, unresolvedDefects] = vehicle ? await Promise.all([
    prisma.driverVehicleCheck.findMany({ where: { driverId: driver.id, vehicleId: vehicle.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.driverVehicleCheck.findMany({ where: { vehicleId: vehicle.id, hasDefect: true, resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]) : [[], []];
  res.json({ driver: safeDriver(driver), vehicle: vehicle ? {
    id: vehicle.id, name: vehicle.name, registration: vehicle.registration, vehicleType: vehicle.vehicleType,
    active: vehicle.active, mileage: vehicle.mileage, make: vehicle.make, model: vehicle.model,
  } : null, checkItems, checks,
  unresolvedDefects: unresolvedDefects.map(check => ({ id: check.id, items: check.items, notes: check.notes,
    unsafeToDrive: check.unsafeToDrive, createdAt: check.createdAt, acknowledgedAt: check.acknowledgedAt,
    dispatchResponse: check.dispatchResponse })), today: ukDateKey() });
}));

router.post("/vehicle/checks", driverRoute(async (req, res, driver) => {
  const id = requestId(req.body?.requestId);
  const vehicleId = text(req.body?.vehicleId, 100);
  const capturedAt = capturedDate(req.body?.capturedAt);
  const items = req.body?.items;
  if (!items || typeof items !== "object" || Array.isArray(items)) throw new DriverPortalError(400, "Complete each vehicle check.");
  const validatedItems: Record<string, "PASS" | "DEFECT"> = {};
  for (const key of checkItems) {
    if (!["PASS", "DEFECT"].includes(items[key])) throw new DriverPortalError(400, "Complete every vehicle check item.");
    validatedItems[key] = items[key];
  }
  const hasDefect = Object.values(validatedItems).includes("DEFECT");
  if (typeof req.body?.unsafeToDrive !== "boolean") throw new DriverPortalError(400, "Confirm whether the van is safe to drive.");
  const unsafeToDrive = req.body.unsafeToDrive as boolean;
  const notes = text(req.body?.notes);
  if ((hasDefect || unsafeToDrive) && !notes) throw new DriverPortalError(400, "Describe the vehicle defect.");
  const odometer = req.body?.odometer == null || req.body.odometer === "" ? null : Number(req.body.odometer);
  if (odometer != null && (!Number.isInteger(odometer) || odometer < 0 || odometer > 10_000_000)) throw new DriverPortalError(400, "Enter a valid mileage.");
  if (req.body?.photoUrls != null && (!Array.isArray(req.body.photoUrls) || req.body.photoUrls.length > 8)) {
    throw new DriverPortalError(400, "Provide up to eight vehicle photos.");
  }
  const photoUrls = (req.body?.photoUrls || []).map((value: unknown) => vehiclePhoto(value, driver.id, vehicleId)) as string[];
  const check = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driver.id }, include: { vehicle: true } });
    if (!current?.active || current.vehicleId !== vehicleId || !current.vehicle?.active) {
      throw new DriverPortalError(409, "This van is no longer assigned to you. Refresh before submitting the check.");
    }
    const previous = await tx.driverVehicleCheck.findUnique({ where: { driverId_requestId: { driverId: driver.id, requestId: id } } });
    if (previous) {
      if (previous.vehicleId !== vehicleId) throw new DriverPortalError(409, "This request identifier belongs to another vehicle check.");
      return previous;
    }
    return tx.driverVehicleCheck.create({ data: { driverId: driver.id, vehicleId, requestId: id,
      checkDate: ukDateKey(capturedAt || new Date()), capturedAt, items: validatedItems, odometer,
      notes: notes || null, hasDefect: hasDefect || unsafeToDrive, unsafeToDrive, photoUrls } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ check, message: unsafeToDrive ? "Unsafe defect reported. Do not start a journey in this van; contact dispatch." : "Vehicle check saved." });
}));

router.get("/", driverRoute(async (req, res, driver) => {
  const page = pageNumber(req.query.page, 1, 10000), pageSize = pageNumber(req.query.pageSize, 25, 50);
  const where: Prisma.BookingWhereInput = { driverId: driver.id };
  const scope = text(req.query.scope, 20).toUpperCase() || "ALL";
  const status = text(req.query.status, 40).toUpperCase();
  const today = ukDateKey();
  if (!["ALL", "TODAY", "UPCOMING", "COMPLETED", "ACTIVE"].includes(scope)) throw new DriverPortalError(400, "Invalid jobs filter.");
  if (scope === "TODAY") { where.collectionDate = dateRange(today); where.status = { in: [...activeStatuses, BookingStatus.COMPLETED] }; }
  if (scope === "UPCOMING") { where.collectionDate = { gte: dateRange(today).gte }; where.status = { in: [BookingStatus.CONFIRMED, BookingStatus.ASSIGNED] }; }
  if (scope === "COMPLETED") where.status = BookingStatus.COMPLETED;
  if (scope === "ACTIVE") where.status = { in: activeStatuses };
  if (status && status !== "ALL") {
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) throw new DriverPortalError(400, "Invalid job status.");
    // Both filters must match; a status parameter must not broaden the chosen tab.
    where.AND = [{ status: status as BookingStatus }];
  }
  if (req.query.date) where.collectionDate = dateRange(text(req.query.date));
  const query = text(req.query.q, 100);
  if (query) where.OR = [...["reference", "collectionAddress", "deliveryAddress", "customerReference"].map(key => ({ [key]: { contains: query, mode: "insensitive" as const } })), { driverStops: { some: { OR: [{ address: { contains: query, mode: "insensitive" } }, { label: { contains: query, mode: "insensitive" } }] } } }];
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({ where, include: listInclude,
      orderBy: scope === "COMPLETED" ? [{ updatedAt: "desc" }, { id: "asc" }] : jobOrder,
      skip: (page - 1) * pageSize, take: pageSize }),
    prisma.booking.count({ where }),
  ]);
  res.json({ jobs: await hydrateJobs(rows, driver.id), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, serverTime: new Date() });
}));

router.get("/:bookingId", driverRoute(async (req, res, driver) => {
  res.json({ job: await readDriverJob(text(req.params.bookingId, 100), driver.id), serverTime: new Date() });
}));

router.post("/:bookingId/actions", driverRoute(async (req, res, driver) => {
  const action = text(req.body?.action, 30) as DriverAction;
  const job = await performDriverAction({ bookingId: text(req.params.bookingId, 100), driverId: driver.id,
    expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId, action, stopId: text(req.body?.stopId, 100) || undefined, capturedAt: req.body?.capturedAt });
  res.json({ job, message: "Job progress saved." });
}));

router.patch("/:bookingId/accept", driverRoute(async (req, res, driver) => {
  const job = await performDriverAction({ bookingId: text(req.params.bookingId, 100), driverId: driver.id,
    expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId, action: "ACCEPT", capturedAt: req.body?.capturedAt });
  res.json({ job, message: "Job accepted." });
}));

router.post("/:bookingId/incidents", driverRoute(async (req, res, driver) => {
  const incident = await reportDriverIncident({ bookingId: text(req.params.bookingId, 100), driverId: driver.id,
    expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId, stopId: text(req.body?.stopId, 100) || undefined,
    reason: req.body?.reason, notes: req.body?.notes, photoUrls: req.body?.photoUrls,
    revisedArrivalAt: req.body?.revisedArrivalAt, capturedAt: req.body?.capturedAt });
  res.json({ incident, job: await readDriverJob(text(req.params.bookingId, 100), driver.id), message: "Problem recorded for dispatch." });
}));

// Preserve the old URL while closing its completion/cancellation bypass.
router.patch("/:bookingId/status", driverRoute(async (req, res, driver) => {
  const status = text(req.body?.status);
  await readDriverJob(text(req.params.bookingId, 100), driver.id);
  if (status === BookingStatus.COMPLETED) throw new DriverPortalError(409, "Complete each delivery stop with its required evidence.");
  if (status === BookingStatus.CANCELLED) throw new DriverPortalError(409, "Report the problem to dispatch. Only admin can cancel a booking.");
  const action = status === BookingStatus.ASSIGNED ? "ACCEPT" : status === BookingStatus.IN_PROGRESS ? "START" : null;
  if (!action) throw new DriverPortalError(400, "Use the current stop's available action.");
  const job = await performDriverAction({ bookingId: text(req.params.bookingId, 100), driverId: driver.id,
    expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId, action, capturedAt: req.body?.capturedAt });
  res.json({ job, message: "Job progress saved." });
}));

export default router;

