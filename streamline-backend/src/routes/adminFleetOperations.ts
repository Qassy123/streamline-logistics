import { readFleetAvailability } from "../lib/fleetAvailability";
import { Router, type RequestHandler } from "express";
import { Prisma, type AdminUser } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireStaff } from "../lib/adminAccess";
import { DriverPortalError, requestId, text } from "../lib/driverPortal";
import { assignDriverJob } from "./adminDrivers";
import { assertVanChange, createAllocation, dispatchRoles, fleetAudit, fleetInterval, fleetReason, fleetTransaction, staffActor, vanCategories, activeBookingStatuses, bookingWindow, operationalVan } from "../lib/fleetOperations";
import { periodRange } from "../lib/driverPayroll";
const router = Router();
type Handler = (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], admin: AdminUser) => Promise<unknown>;
function route(fn: Handler, write = false): RequestHandler { return async (req, res) => { res.setHeader("Cache-Control", "no-store"); try {
  const admin = await requireStaff(req, [...dispatchRoles, ...(write ? [] : ["READ_ONLY" as const])]); res.locals.fleetActor = staffActor(admin); await fn(req, res, admin);
} catch (e) { const conflict = e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2004", "P2010"].includes(e.code);
  res.status(e instanceof DriverPortalError ? e.status : conflict ? 409 : 500).json({ error: e instanceof DriverPortalError ? e.message : conflict ? "Fleet records conflict or changed. Refresh before retrying." : "Unable to confirm this fleet operation. Refresh before retrying." }); } }; }
router.get("/board", route(async (req, res) => {
  const { from, until } = periodRange(req.query.from, req.query.until);
  const [drivers, vehicles, allocations, jobs, history] = await Promise.all([
    prisma.driver.findMany({ select: { id: true, name: true, active: true, status: true, availability: true, portalOnDuty: true, vehicleId: true, shifts: { where: { endedAt: null }, select: { startedAt: true, activities: { where: { active: true, endedAt: null }, select: { kind: true } } } }, bookings: { where: { status: "IN_PROGRESS" }, select: { id: true, reference: true } } }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ where: { vehicleType: { in: [...vanCategories] } }, include: { driverChecks: { where: { unsafeToDrive: true, resolvedAt: null }, select: { id: true } }, maintenanceRecords: { where: { completedAt: null, cancelledAt: null, startsAt: { lt: until }, endsAt: { gt: from } } } }, orderBy: [{ vehicleType: "asc" }, { name: "asc" }] }),
    prisma.driverVehicleAllocation.findMany({ where: { startsAt: { lt: until }, endsAt: { gt: from } }, include: { driver: { select: { name: true } }, vehicle: { select: { name: true, registration: true } } }, orderBy: { startsAt: "asc" }, take: 501 }),
    prisma.booking.findMany({ where: { collectionDate: { gte: from, lt: until }, status: { in: activeBookingStatuses } }, select: { id: true, reference: true, status: true, driverId: true, vehicleId: true, vehicleType: true, collectionDate: true, collectionWindow: true, estimatedStartTime: true, estimatedEndTime: true, updatedAt: true, driverJourneyStartedAt: true }, orderBy: { collectionDate: "asc" }, take: 501 }),
    prisma.fleetAllocationEvent.findMany({ where: { recordedAt: { gte: from, lt: until } }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 101 }),
  ]);
  res.json({ drivers: drivers.map(driver => ({ ...driver, shiftStatus: !driver.shifts.length ? "Off shift" : driver.shifts[0].activities[0]?.kind === "BREAK" ? "On break" : "On shift", jobStatus: driver.bookings.length ? "Busy" : "Available", accountStatus: !driver.active ? "Unavailable" : driver.status.replace(/_/g, " ") })), vehicles, allocations: allocations.slice(0, 500), jobs: jobs.slice(0, 500), history: history.slice(0, 100), truncated: allocations.length > 500 || jobs.length > 500 || history.length > 100, serverTime: new Date() });
}));
router.get("/availability", route(async (req, res) => {
  const interval = fleetInterval(req.query.startsAt, req.query.endsAt), purpose = req.query.purpose === "BOOKING" ? "BOOKING" : "ALLOCATION";
  const rows = await readFleetAvailability(prisma, { ...interval, purpose, bookingId: text(req.query.bookingId, 100) || undefined, driverId: text(req.query.driverId, 100) || undefined });
  res.json({ vehicles: rows.map(row => ({ id: row.vehicle.id, available: row.available, reasons: row.reasons, unavailableUntil: row.unavailableUntil })) });
}));
router.post("/allocations", route(async (req, res, admin) => {
  const reason = fleetReason(req.body?.reason), actor = staffActor(admin), interval = fleetInterval(req.body?.startsAt, req.body?.endsAt);
  const allocation = await fleetTransaction(actor, reason, async tx => { const value = await createAllocation(tx, { ...interval, driverId: text(req.body?.driverId, 100), vehicleId: text(req.body?.vehicleId, 100), requestId: requestId(req.body?.requestId), reason, createdBy: admin.id }); await fleetAudit(tx, actor, "VAN_ALLOCATION_PLANNED", value.id, reason, value); return value; });
  res.json({ allocation, message: "Allocation planned. It does not change the current van until you apply it manually." });
}, true));
router.post("/allocations/:id/cancel", route(async (req, res, admin) => {
  const reason = fleetReason(req.body?.reason), actor = staffActor(admin), id = text(req.params.id, 100);
  const allocation = await fleetTransaction(actor, reason, async tx => { const before = await tx.driverVehicleAllocation.findUnique({ where: { id } }); if (!before) throw new DriverPortalError(404, "Allocation not found."); if (before.cancelledAt) return before;
    const value = await tx.driverVehicleAllocation.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: admin.id, cancellationReason: reason } }); await fleetAudit(tx, actor, "VAN_ALLOCATION_CANCELLED", id, reason, value); return value; }); res.json({ allocation, message: "Allocation cancelled. Current van and bookings remain for manual dispatch review." });
}, true));
router.post("/allocations/:id/apply", route(async (req, res, admin) => {
  const reason = fleetReason(req.body?.reason), actor = staffActor(admin), id = text(req.params.id, 100);
  const allocation = await fleetTransaction(actor, reason, async tx => { const value = await tx.driverVehicleAllocation.findUnique({ where: { id } }); const now = new Date();
    if (!value || value.cancelledAt || value.startsAt > now || value.endsAt <= now) throw new DriverPortalError(409, "Only a current, uncancelled allocation can be applied.");
    const driver = await tx.driver.findUnique({ where: { id: value.driverId } }); if (!driver?.active || driver.status !== "ACTIVE") throw new DriverPortalError(409, "Driver is unavailable.");
    await operationalVan(tx, value.vehicleId, now, new Date(+now + 1));
    if (value.appliedAt && driver.vehicleId === value.vehicleId) return value;
    await assertVanChange(tx, value.driverId, value.vehicleId, id); await tx.driver.update({ where: { id: value.driverId }, data: { vehicleId: value.vehicleId } });
    const updated = await tx.driverVehicleAllocation.update({ where: { id }, data: { appliedAt: value.appliedAt || now } }); await fleetAudit(tx, actor, "VAN_ALLOCATION_APPLIED", id, reason, updated);
    await tx.driverPortalNotification.create({ data: { driverId: value.driverId, dedupeKey: `allocation-${id}`, title: "Your van allocation", body: "Dispatch applied your van allocation. Check Vehicle before starting work." } }); return updated; }); res.json({ allocation });
}, true));
router.post("/drivers/:id/van", route(async (req, res, admin) => {
  const id = text(req.params.id, 100), vehicleId = req.body?.vehicleId === null ? null : text(req.body?.vehicleId, 100); if (vehicleId === "") throw new DriverPortalError(400, "Select a van or explicitly unassign it.");
  const reason = fleetReason(req.body?.reason), actor = staffActor(admin);
  const driver = await fleetTransaction(actor, reason, async tx => { await assertVanChange(tx, id, vehicleId); const updated = await tx.driver.update({ where: { id }, data: { vehicleId }, select: { id: true, name: true, vehicleId: true } }); await fleetAudit(tx, actor, "CURRENT_VAN_UPDATED", id, reason, updated); await tx.driverPortalNotification.create({ data: { driverId: id, dedupeKey: `fleet-van-${id}-${Date.now()}`, title: "Current van updated", body: "Dispatch changed your current van. Existing bookings remain unchanged." } }); return updated; }); res.json({ driver });
}, true));
router.post("/bookings/:id/assign", route(async (req, res) => {
  const bookingId = text(req.params.id, 100), driverId = text(req.body?.driverId, 100); fleetReason(req.body?.reason);
  if (!driverId) throw new DriverPortalError(400, "Select a driver."); req.params.id = driverId; req.body.bookingId = bookingId;
  await assignDriverJob(req, res, () => {});
}, true));
router.get("/vehicles", route(async (_req, res) => {
  const now = new Date(), soon = new Date(+now + 30 * 86400000);
  const vehicles = await prisma.vehicle.findMany({ where: { vehicleType: { in: [...vanCategories] } }, include: { reservations: { where: { reservedFrom: { lte: now }, reservedUntil: { gt: now }, status: { in: ["ACTIVE", "CONFIRMED"] }, OR: [{ status: "CONFIRMED" }, { expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true } }, drivers: { where: { active: true }, select: { id: true, name: true } }, bookings: { where: { status: { in: activeBookingStatuses } }, select: { id: true, reference: true, status: true, collectionDate: true, collectionWindow: true, estimatedStartTime: true, estimatedEndTime: true } }, driverChecks: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, hasDefect: true, unsafeToDrive: true } }, maintenanceRecords: { where: { cancelledAt: null, completedAt: null, startsAt: { lte: now }, endsAt: { gt: now } }, select: { id: true } } }, orderBy: [{ vehicleType: "asc" }, { name: "asc" }] });
  const availability = new Map((await readFleetAvailability(prisma, { startsAt: now, endsAt: new Date(+now + 1), purpose: "QUOTE" }, now)).map(row => [row.vehicle.id, row]));
  const rows = vehicles.map(v => ({ ...v, bookings: v.bookings.filter(b => b.status === "IN_PROGRESS"), operationalState: availability.get(v.id)?.operationalState || "INACTIVE", upcoming: [["MOT", v.motExpiry], ["Insurance", v.insuranceExpiry], ["Service", v.serviceDueDate]].filter(([, due]) => due instanceof Date && due <= soon).map(([label, due]) => ({ label, due })) }));
  res.json({ vehicles: rows, categories: vanCategories.map(category => ({ category, total: rows.filter(v => v.vehicleType === category).length })), summary: { total: rows.length, available: rows.filter(v => v.operationalState === "AVAILABLE").length, assigned: rows.filter(v => v.drivers.length).length, onDelivery: rows.filter(v => v.bookings.length).length, maintenance: rows.filter(v => v.operationalState === "MAINTENANCE").length, defects: rows.filter(v => v.operationalState === "UNSAFE_DEFECT").length } });
}));
router.get("/vehicles/:id", route(async (req, res) => {
  const id = text(req.params.id, 100); const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { drivers: { select: { id: true, name: true, active: true } }, allocations: { include: { driver: { select: { name: true } } }, orderBy: { startsAt: "desc" }, take: 100 }, maintenanceRecords: { orderBy: { startsAt: "desc" }, take: 100 }, driverChecks: { orderBy: { createdAt: "desc" }, take: 30 }, bookings: { orderBy: { collectionDate: "desc" }, take: 100, select: { id: true, reference: true, status: true, collectionDate: true, driverId: true, estimatedStartTime: true, estimatedEndTime: true } }, reservations: { where: { status: { in: ["ACTIVE", "CONFIRMED"] }, OR: [{ status: "CONFIRMED" }, { expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { reservedFrom: "desc" }, take: 100 } } });
  if (!vehicle) throw new DriverPortalError(404, "Van not found."); const history = await prisma.fleetAllocationEvent.findMany({ where: { vehicleId: id }, orderBy: { recordedAt: "desc" }, take: 100 }); const unsafeChecks = await prisma.driverVehicleCheck.findMany({ where: { vehicleId: id, unsafeToDrive: true, resolvedAt: null }, orderBy: { createdAt: "desc" } }); const now = new Date(); const current = (await readFleetAvailability(prisma, { vehicleId: id, startsAt: now, endsAt: new Date(+now + 1), purpose: "QUOTE" }, now))[0]; res.json({ vehicle: { ...vehicle, operationalState: current?.operationalState || "INACTIVE", driverChecks: [...unsafeChecks, ...vehicle.driverChecks.filter(c => !unsafeChecks.some(u => u.id === c.id))] }, history });
}));
router.patch("/vehicles/:id/details", route(async (req, res, admin) => {
  const id = text(req.params.id, 100), reason = fleetReason(req.body?.reason), actor = staffActor(admin);
  const fleetNumber = text(req.body?.fleetNumber, 100) || null, capacityKg = req.body?.capacityKg, loadVolumeM3 = req.body?.loadVolumeM3;
  if (capacityKg !== null && (!Number.isInteger(capacityKg) || capacityKg < 0 || capacityKg > 10000) || loadVolumeM3 !== null && (typeof loadVolumeM3 !== "number" || !Number.isFinite(loadVolumeM3) || loadVolumeM3 < 0 || loadVolumeM3 > 100)) throw new DriverPortalError(400, "Enter valid capacity figures or leave blank.");
  const vehicle = await fleetTransaction(actor, reason, async tx => { const value = await tx.vehicle.update({ where: { id }, data: { fleetNumber, capacityKg, loadVolumeM3 } }); await fleetAudit(tx, actor, "VAN_DETAILS_UPDATED", id, reason, { fleetNumber, capacityKg, loadVolumeM3 }); return { id: value.id }; }); res.json({ vehicle });
}, true));
router.post("/vehicles/:id/maintenance", route(async (req, res, admin) => {
  const vehicleId = text(req.params.id, 100), reason = fleetReason(req.body?.notes), actor = staffActor(admin), interval = fleetInterval(req.body?.startsAt, req.body?.endsAt), retryId = requestId(req.body?.requestId), title = text(req.body?.title, 200), mileage = req.body?.mileage;
  if (!title || mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) throw new DriverPortalError(400, "Enter a maintenance title and valid optional mileage.");
  const record = await fleetTransaction(actor, reason, async tx => { const saved = await tx.vehicleMaintenanceRecord.findUnique({ where: { requestId: retryId } }); if (saved) { if (saved.vehicleId !== vehicleId || +saved.startsAt !== +interval.startsAt || +saved.endsAt !== +interval.endsAt || saved.createdBy !== admin.id || saved.notes !== reason || saved.title !== title || saved.mileage !== mileage) throw new DriverPortalError(409, "Request identifier belongs to other maintenance."); return saved; }
    if (!await tx.vehicle.findUnique({ where: { id: vehicleId } })) throw new DriverPortalError(404, "Van not found.");
    if (await tx.vehicleMaintenanceRecord.findFirst({ where: { vehicleId, completedAt: null, cancelledAt: null, startsAt: { lt: interval.endsAt }, endsAt: { gt: interval.startsAt } } })) throw new DriverPortalError(409, "Maintenance windows overlap.");
    const bookings = await tx.booking.findMany({ where: { vehicleId, status: { in: activeBookingStatuses } }, take: 1001 }); if (bookings.length > 1000) throw new DriverPortalError(409, "Resolve older bookings first.");
    for (const booking of bookings) { const w = await bookingWindow(tx, booking); if (booking.status === "IN_PROGRESS" || w.startsAt < interval.endsAt && w.endsAt > interval.startsAt) throw new DriverPortalError(409, `Maintenance conflicts with ${booking.reference}. Reallocate work first.`); }
    if (await tx.vehicleReservation.findFirst({ where: { vehicleId, status: { in: ["ACTIVE", "CONFIRMED"] }, reservedFrom: { lt: interval.endsAt }, reservedUntil: { gt: interval.startsAt }, OR: [{ status: "CONFIRMED" }, { expiresAt: null }, { expiresAt: { gt: new Date() } }] } }) || await tx.driverVehicleAllocation.findFirst({ where: { vehicleId, cancelledAt: null, startsAt: { lt: interval.endsAt }, endsAt: { gt: interval.startsAt } } })) throw new DriverPortalError(409, "Maintenance conflicts with a reservation or allocation.");
    const value = await tx.vehicleMaintenanceRecord.create({ data: { vehicleId, ...interval, title, notes: reason, mileage, requestId: retryId, createdBy: admin.id } }); await fleetAudit(tx, actor, "MAINTENANCE_PLANNED", vehicleId, reason, value); return value; }); res.json({ record });
}, true));
router.post("/maintenance/:id/:action", route(async (req, res, admin) => {
  const id = text(req.params.id, 100), action = text(req.params.action, 20), reason = fleetReason(req.body?.reason), actor = staffActor(admin); if (!["complete", "cancel"].includes(action)) throw new DriverPortalError(400, "Choose complete or cancel.");
  const record = await fleetTransaction(actor, reason, async tx => { const before = await tx.vehicleMaintenanceRecord.findUnique({ where: { id } }); if (!before) throw new DriverPortalError(404, "Maintenance not found."); if (before.completedAt || before.cancelledAt) throw new DriverPortalError(409, "This record is already closed."); if (action === "complete" && before.startsAt > new Date()) throw new DriverPortalError(409, "Future maintenance cannot be completed yet.");
    const value = await tx.vehicleMaintenanceRecord.update({ where: { id }, data: action === "complete" ? { completedAt: new Date(), completedBy: admin.id, completionNotes: reason } : { cancelledAt: new Date(), cancelledBy: admin.id, cancellationReason: reason } }); await fleetAudit(tx, actor, `MAINTENANCE_${action.toUpperCase()}`, before.vehicleId, reason, value); return value; }); res.json({ record, message: "Record closed. Any separate manual maintenance status or unsafe defect still needs its own review." });
}, true));
export default router;

