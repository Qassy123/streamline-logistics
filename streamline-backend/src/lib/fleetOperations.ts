import { readFleetAvailability } from "./fleetAvailability";
import { BookingStatus, Prisma, type AdminUser } from "@prisma/client";
import { prisma } from "./prisma";
import { DriverPortalError, text } from "./driverPortal";
import { getReservationWindow } from "./reservationWindow";
export const vanCategories = ["Small Van", "SWB Van", "LWB High Roof Van", "XLWB High Roof Van", "Luton Tail Lift Van"] as const;
export const dispatchRoles = ["SUPER_ADMIN", "OFFICE_MANAGER", "DISPATCHER"] as const;
export type FleetActor = { id?: string; label: string };
type Tx = Prisma.TransactionClient;
export const activeBookingStatuses: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"];
export function fleetDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw new DriverPortalError(400, "Enter a complete date and time.");
  const result = new Date(value); if (!Number.isFinite(+result)) throw new DriverPortalError(400, "Invalid date/time."); return result;
}
export function fleetInterval(start: unknown, end: unknown) {
  const startsAt = fleetDate(start), endsAt = fleetDate(end);
  if (endsAt <= startsAt || +endsAt - +startsAt > 31 * 86400000) throw new DriverPortalError(400, "Choose a positive allocation window of no more than 31 days.");
  return { startsAt, endsAt };
}
export function fleetReason(value: unknown) { const reason = text(value, 2000); if (reason.length < 5) throw new DriverPortalError(400, "Enter a reason of at least five characters."); return reason; }
export async function fleetMutation(tx: Tx, actor: FleetActor = { label: "Admin API key" }, reason = "Manual fleet operation") {
  // One consistent transaction lock across the existing booking, driver and vehicle mutation paths.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`;
  await tx.$queryRaw`SELECT set_config('streamline.fleet_actor', ${actor.label}, true), set_config('streamline.fleet_actor_id', ${actor.id || ""}, true), set_config('streamline.fleet_reason', ${reason}, true)`;
}
export async function fleetTransaction<T>(actor: FleetActor, reason: string, work: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(async tx => { await fleetMutation(tx, actor, reason); return work(tx); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue; throw error; }
  }
  throw new DriverPortalError(409, "Fleet changed. Refresh before retrying.");
}
export const staffActor = (admin: Pick<AdminUser, "id" | "name">): FleetActor => ({ id: admin.id, label: admin.name });
export async function fleetAudit(tx: Tx, actor: FleetActor, action: string, entityId: string, reason: string, value: unknown) {
  await tx.auditLog.create({ data: { adminId: actor.id || null, action, entityType: "Fleet", entityId, reason, newValue: JSON.parse(JSON.stringify(value)) } });
}
export async function operationalVan(tx: Tx, id: string, at: Date, until: Date) {
  const van = await tx.vehicle.findUnique({ where: { id } });
  if (!van) throw new DriverPortalError(404, "Van not found.");
  if (!vanCategories.includes(van.vehicleType as typeof vanCategories[number]) || !van.active || ["INACTIVE", "MAINTENANCE"].includes(van.status)) throw new DriverPortalError(409, "This van is inactive, outside the supported categories or under maintenance.");
  if (await tx.driverVehicleCheck.findFirst({ where: { vehicleId: id, unsafeToDrive: true, resolvedAt: null } })) throw new DriverPortalError(409, "This van has an unresolved unsafe defect.");
  if (await tx.vehicleMaintenanceRecord.findFirst({ where: { vehicleId: id, cancelledAt: null, completedAt: null, startsAt: { lt: until }, endsAt: { gt: at } } })) throw new DriverPortalError(409, "This van has maintenance in this time window.");
  return van;
}
export async function bookingWindow(tx: Tx, booking: { estimatedStartTime: Date | null; estimatedEndTime: Date | null; collectionDate: Date; collectionWindow: string }) {
  if (booking.estimatedStartTime && booking.estimatedEndTime && booking.estimatedEndTime > booking.estimatedStartTime) return { startsAt: booking.estimatedStartTime, endsAt: booking.estimatedEndTime };
  const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vehicleBlockHours: true } });
  const window = getReservationWindow(booking.collectionDate, booking.collectionWindow, settings?.vehicleBlockHours || 6);
  return { startsAt: window.reservedFrom, endsAt: window.reservedUntil };
}
export async function assertPlan(tx: Tx, input: { bookingId: string; quoteId?: string | null; driverId?: string | null; vehicleId?: string | null; startsAt: Date; endsAt: Date }) {
  const { startsAt, endsAt, driverId, vehicleId, bookingId, quoteId } = input;
  if (!Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt) throw new DriverPortalError(400, "Set valid planned start and end times.");
  if (vehicleId) {
    // Existing dispatch routes perform their own authorised compliance review.
    const rows = await readFleetAvailability(tx, { ...input, driverId: driverId || undefined, quoteId: quoteId || undefined, vehicleId, purpose: "BOOKING" });
    if (!rows[0]?.available) throw new DriverPortalError(409, rows[0]?.reasons.join("; ") || "This van is unavailable in the selected time window.");
  }
  if (vehicleId) await operationalVan(tx, vehicleId, startsAt, endsAt);
  const scope: Prisma.BookingWhereInput[] = [];
  if (driverId) scope.push({ driverId }); if (vehicleId) scope.push({ vehicleId });
  if (scope.length) {
    const bookings = await tx.booking.findMany({ where: { id: { not: bookingId }, status: { in: activeBookingStatuses }, OR: scope }, take: 1001 });
    if (bookings.length > 1000) throw new DriverPortalError(409, "Too many open bookings to safely assess conflicts; resolve older bookings first.");
    for (const other of bookings) {
      const window = await bookingWindow(tx, other);
      if (other.status === "IN_PROGRESS" && (!other.estimatedEndTime || other.estimatedEndTime <= new Date()) || window.startsAt < endsAt && window.endsAt > startsAt) throw new DriverPortalError(409, `Conflicting work: ${other.reference}.`);
    }
  }
  if (vehicleId && await tx.vehicleReservation.findFirst({ where: { vehicleId, status: { in: ["ACTIVE", "CONFIRMED"] }, reservedFrom: { lt: endsAt }, reservedUntil: { gt: startsAt },
    AND: [{ OR: [{ status: "CONFIRMED" }, { expiresAt: null }, { expiresAt: { gt: new Date() } }] }, { NOT: { OR: [{ bookingId }, ...(quoteId ? [{ quoteId }] : [])] } }] } })) throw new DriverPortalError(409, "This van has a live reservation in this time window.");
  if (driverId) {
    const driver = await tx.driver.findUnique({ where: { id: driverId } });
    if (!driver?.active || driver.status !== "ACTIVE") throw new DriverPortalError(409, "Select an active driver; unavailable or on-leave drivers cannot be assigned.");
    const slots = await tx.driverVehicleAllocation.findMany({ where: { cancelledAt: null, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, OR: [{ driverId }, ...(vehicleId ? [{ vehicleId }] : [])] } });
    if (slots.some(slot => slot.driverId !== driverId || slot.vehicleId !== vehicleId || slot.startsAt > startsAt || slot.endsAt < endsAt)) throw new DriverPortalError(409, "The job conflicts with a driver/van allocation or extends beyond its planned allocation.");
  }
}
export async function assertVanChange(tx: Tx, driverId: string, vehicleId: string | null, ignoreAllocationId?: string) {
  const driver = await tx.driver.findUnique({ where: { id: driverId } }); if (!driver) throw new DriverPortalError(404, "Driver not found.");
  if (vehicleId && (!driver.active || driver.status !== "ACTIVE")) throw new DriverPortalError(409, "Select an active, available driver before allocating a van.");
  if (driver.vehicleId === vehicleId) return;
  if (await tx.booking.findFirst({ where: { driverId, status: "IN_PROGRESS" } })) throw new DriverPortalError(409, "Resolve the active delivery before changing this driver's van.");
  const now = new Date();
  if (await tx.driverVehicleAllocation.findFirst({ where: { cancelledAt: null, startsAt: { lte: now }, endsAt: { gt: now }, ...(ignoreAllocationId ? { id: { not: ignoreAllocationId } } : {}), OR: [{ driverId, ...(vehicleId ? { vehicleId: { not: vehicleId } } : {}) }, ...(vehicleId ? [{ vehicleId, driverId: { not: driverId } }] : [])] } })) throw new DriverPortalError(409, "There is a conflicting current allocation. Cancel it with a reason before changing the van.");
  if (vehicleId) {
    await operationalVan(tx, vehicleId, now, new Date(+now + 1));
    if (await tx.driver.findFirst({ where: { id: { not: driverId }, vehicleId, active: true } })) throw new DriverPortalError(409, "This van is already assigned to another driver. Unassign it first.");
  }
}
export async function createAllocation(tx: Tx, data: { driverId: string; vehicleId: string; startsAt: Date; endsAt: Date; requestId: string; reason: string; createdBy: string }) {
  const saved = await tx.driverVehicleAllocation.findUnique({ where: { requestId: data.requestId } });
  if (saved) { if (saved.driverId !== data.driverId || saved.vehicleId !== data.vehicleId || +saved.startsAt !== +data.startsAt || +saved.endsAt !== +data.endsAt || saved.createdBy !== data.createdBy || saved.reason !== data.reason) throw new DriverPortalError(409, "Request identifier already belongs to a different allocation."); return saved; }
  const availability = await readFleetAvailability(tx, { vehicleId: data.vehicleId, startsAt: data.startsAt, endsAt: data.endsAt, purpose: "ALLOCATION" });
  if (!availability[0]?.available) throw new DriverPortalError(409, availability[0]?.reasons.join("; ") || "This van is unavailable for the selected time.");
  const driver = await tx.driver.findUnique({ where: { id: data.driverId } });
  if (!driver?.active || driver.status !== "ACTIVE") throw new DriverPortalError(409, "Select an active driver.");
  await operationalVan(tx, data.vehicleId, data.startsAt, data.endsAt);
  if (await tx.driverVehicleAllocation.findFirst({ where: { cancelledAt: null, startsAt: { lt: data.endsAt }, endsAt: { gt: data.startsAt }, OR: [{ driverId: data.driverId }, { vehicleId: data.vehicleId }] } })) throw new DriverPortalError(409, "This driver or van already has an overlapping allocation.");
  const bookings = await tx.booking.findMany({ where: { status: { in: activeBookingStatuses }, OR: [{ driverId: data.driverId }, { vehicleId: data.vehicleId }] }, take: 1001 });
  if (bookings.length > 1000) throw new DriverPortalError(409, "Resolve older bookings before allocating.");
  for (const booking of bookings) {
    const w = await bookingWindow(tx, booking);
    if (booking.status === "IN_PROGRESS" && (!booking.estimatedEndTime || booking.estimatedEndTime <= new Date()) || w.startsAt < data.endsAt && w.endsAt > data.startsAt) throw new DriverPortalError(409, `Allocation conflicts with ${booking.reference}.`);
  }
  if (data.startsAt <= new Date()) await assertVanChange(tx, data.driverId, data.vehicleId);
  return tx.driverVehicleAllocation.create({ data });
}

