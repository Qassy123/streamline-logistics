import { vehicleComplianceBlocks } from "./vehicleCompliance";
import { Prisma } from "@prisma/client";
import { DriverPortalError } from "./driverPortal";
import { getReservationWindow } from "./reservationWindow";

type Reader = Pick<Prisma.TransactionClient, "vehicle" | "driver" | "booking" | "vehicleReservation" | "driverVehicleAllocation" | "vehicleMaintenanceRecord" | "driverVehicleCheck" | "companySettings">;
export type AvailabilityPurpose = "QUOTE" | "ALLOCATION" | "BOOKING" | "CURRENT";
export type AvailabilityOptions = {
  startsAt: Date; endsAt: Date; vehicleType?: string; vehicleId?: string;
  bookingId?: string; quoteId?: string; driverId?: string; purpose?: AvailabilityPurpose;
};
export const SIX_HOURS = 6 * 60 * 60 * 1000;
export const capacityEnd = (start: Date, end: Date) => new Date(Math.max(+end, +start + SIX_HOURS));
type Hold = { reason: string; until: Date | null; state: string };
const activeStatuses = ["PENDING_PAYMENT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const categories = ["Small Van", "SWB Van", "LWB High Roof Van", "XLWB High Roof Van", "Luton Tail Lift Van"];

// Shared by the quote badges, booking/payment capacity checks, Fleet and dispatch.
// The same half-open interval is checked; cancellation removes only its own hold.
export async function readFleetAvailability(db: Reader, options: AvailabilityOptions, now = new Date()) {
  const startsAt = options.startsAt, endsAt = options.purpose === "CURRENT" ? options.endsAt : capacityEnd(startsAt, options.endsAt);
  const lookback = new Date(+startsAt - SIX_HOURS);
  if (!Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt) throw new DriverPortalError(400, "Choose a valid start and end time.");
  const vehicles = await db.vehicle.findMany({ where: { vehicleType: options.vehicleType ? options.vehicleType : { in: categories }, ...(options.vehicleId ? { id: options.vehicleId } : {}) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const ids = vehicles.map(v => v.id), scope = { vehicleId: { in: ids } };
  const [bookings, reservations, allocations, maintenance, defects, settings] = await Promise.all([
    db.booking.findMany({ where: { ...(options.driverId ? { OR: [scope, { driverId: options.driverId }] } : scope), AND: [{ OR: [{ status: { in: [...activeStatuses] } }, { status: "COMPLETED", estimatedStartTime: { lt: endsAt }, estimatedEndTime: { gt: lookback } }] }], ...(options.bookingId ? { id: { not: options.bookingId } } : {}) }, take: 2001 }),
    db.vehicleReservation.findMany({ where: { ...scope, status: { in: ["ACTIVE", "CONFIRMED"] }, reservedFrom: { lt: endsAt }, reservedUntil: { gt: lookback }, OR: [{ status: "CONFIRMED" }, { expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.driverVehicleAllocation.findMany({ where: { ...(options.driverId ? { OR: [scope, { driverId: options.driverId }] } : scope), cancelledAt: null, startsAt: { lt: endsAt }, endsAt: { gt: lookback } } }),
    db.vehicleMaintenanceRecord.findMany({ where: { ...scope, completedAt: null, cancelledAt: null, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
    db.driverVehicleCheck.findMany({ where: { ...scope, unsafeToDrive: true, resolvedAt: null }, select: { vehicleId: true } }),
    db.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vehicleBlockHours: true } }),
  ]);
  if (bookings.length > 2000) throw new DriverPortalError(409, "Resolve older fleet bookings before assessing availability.");
  const holds = new Map<string, Hold[]>();
  const add = (id: string | null, reason: string, until: Date | null, state: string) => { if (id) holds.set(id, [...(holds.get(id) || []), { reason, until, state }]); };
  if (options.driverId) {
    const driver = await db.driver.findUnique({ where: { id: options.driverId }, select: { active: true, status: true } });
    if (!driver?.active || driver.status !== "ACTIVE") for (const van of vehicles) add(van.id, "Driver unavailable", null, "INACTIVE");
  }
  for (const van of vehicles) {
    if (!van.active || van.status === "INACTIVE") add(van.id, "Inactive", null, "INACTIVE");
    if (van.status === "MAINTENANCE") add(van.id, "Maintenance", null, "MAINTENANCE");
    for (const reason of vehicleComplianceBlocks(van, endsAt, now)) add(van.id, reason, null, "COMPLIANCE_EXPIRED");
    // BOOKED/OUT_ON_JOB are cached legacy statuses. Existing timed bookings and
    // live delivery records determine capacity; compliance review stays separate.
  }
  for (const defect of defects) add(defect.vehicleId, "Unresolved unsafe defect", null, "UNSAFE_DEFECT");
  for (const record of maintenance) add(record.vehicleId, "Maintenance", record.endsAt, "MAINTENANCE");
  for (const allocation of allocations) {
    const release = capacityEnd(allocation.startsAt, allocation.endsAt);
    if (release <= startsAt) continue;
    // Dispatch can attach work to the driver whose allocation fully covers it.
    const ownBooking = options.purpose === "BOOKING" && options.driverId === allocation.driverId && allocation.startsAt <= startsAt && release >= endsAt;
    if (!ownBooking) add(allocation.vehicleId, "Allocated", release, "ALLOCATED");
    if (allocation.driverId === options.driverId) for (const van of vehicles) {
      if (options.purpose !== "BOOKING" || van.id !== allocation.vehicleId || !ownBooking) add(van.id, "Driver already allocated", release, "ALLOCATED");
    }
  }
  for (const reservation of reservations) {
    const release = capacityEnd(reservation.reservedFrom, reservation.reservedUntil);
    if (release <= startsAt) continue;
    if (options.bookingId && reservation.bookingId === options.bookingId || options.quoteId && reservation.quoteId === options.quoteId) continue;
    add(reservation.vehicleId, "Reserved", release, "RESERVED");
  }
  for (const booking of bookings) {
    if (options.quoteId && booking.quoteId === options.quoteId) continue;
    
    let start = booking.estimatedStartTime, end = booking.estimatedEndTime;
    if (!start || !end || end <= start) {
      if (booking.status === "COMPLETED") continue;
      try { const w = getReservationWindow(booking.collectionDate, booking.collectionWindow, 6); start = w.reservedFrom; end = w.reservedUntil; }
      catch { add(booking.vehicleId, "Booking times need review", null, "RESERVED"); continue; }
    }
    end = capacityEnd(start, end);
    const overdue = booking.status === "IN_PROGRESS" && (!booking.estimatedEndTime || booking.estimatedEndTime <= now);
    if (overdue || start < endsAt && end > startsAt) {
      add(booking.vehicleId, booking.status === "IN_PROGRESS" ? "On delivery" : "Booked", overdue ? null : end, booking.status === "IN_PROGRESS" ? "OUT_ON_JOB" : "RESERVED");
      if (booking.driverId === options.driverId) for (const van of vehicles) add(van.id, "Driver has booked work", overdue ? null : end, "RESERVED");
    }
  }
  const priority = ["INACTIVE", "UNSAFE_DEFECT", "MAINTENANCE", "OUT_ON_JOB", "COMPLIANCE_EXPIRED", "SERVICE_DUE", "ALLOCATED", "RESERVED"];
  return vehicles.map(vehicle => {
    const blocked = holds.get(vehicle.id) || [];
    const finiteEnds = blocked.flatMap(h => h.until ? [h.until] : []);
    const until = blocked.some(h => !h.until) ? null : finiteEnds.length ? new Date(Math.max(...finiteEnds.map(Number))) : null;
    const driverReasons = [...new Set(blocked.filter(h => h.reason.startsWith("Driver ")).map(h=>h.reason))];
    const vanHolds = blocked.filter(h => !h.reason.startsWith("Driver "));
    return { vehicle, vanAvailable: vanHolds.length === 0, driverReasons, available: blocked.length === 0, operationalState: priority.find(state => blocked.some(h => h.state === state)) || "AVAILABLE", reasons: [...new Set(blocked.map(h => h.reason))], unavailableUntil: until };
  });
}

export async function findFleetVehicle(db: Reader, params: { vehicleType: string; reservedFrom: Date; reservedUntil: Date; excludeBookingId?: string }) {
  let ownQuote: string | undefined, ownDriver: string | undefined;
  if (params.excludeBookingId) {
    const booking = await db.booking.findUnique({ where: { id: params.excludeBookingId }, select: { quoteId: true, driverId: true } });
    ownQuote = booking?.quoteId || undefined; ownDriver = booking?.driverId || undefined;
  }
  const rows = await readFleetAvailability(db, { startsAt: params.reservedFrom, endsAt: params.reservedUntil, vehicleType: params.vehicleType, bookingId: params.excludeBookingId, quoteId: ownQuote, driverId: ownDriver, purpose: ownDriver ? "BOOKING" : "QUOTE" });
  const found = rows.find(row => row.available && row.vehicle.active)?.vehicle;
  if (found) return found;
  const compliance = rows.flatMap(row => row.reasons.filter(reason => /tax|MOT/.test(reason)).map(reason => `${row.vehicle.registration || row.vehicle.name}: ${reason}`));
  if (compliance.length) throw new DriverPortalError(409, compliance.join(" "));
  return null;
}
