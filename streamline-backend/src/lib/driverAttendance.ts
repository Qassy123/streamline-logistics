import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DriverPortalError, reconcileDriverActivity, requestId } from "./driverPortal";

export const activityKinds = ["WORK", "DRIVING", "OTHER_WORK", "BREAK", "REST", "POA"] as const;
export type ActivityKind = typeof activityKinds[number];
export type AttendanceAction = "CLOCK_IN" | "CLOCK_OUT" | "START_BREAK" | "END_BREAK" | "ACTIVITY";
export const shiftInclude = { activities: { where: { active: true }, orderBy: { startedAt: "asc" as const } } };
type Tx = Prisma.TransactionClient;

export async function lockDriver(tx: Tx, driverId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
}

export async function driverTransaction<T>(driverId: string, work: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => { await lockDriver(tx, driverId); return work(tx); },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new DriverPortalError(409, "Your shift changed. Refresh and try again.");
}

// Called inside the driver lock, also used by the legacy duty APIs.
export async function changeAttendance(tx: Tx, driverId: string, action: AttendanceAction, kind?: ActivityKind) {
  const driver = await tx.driver.findUniqueOrThrow({ where: { id: driverId } });
  if (!driver.active || driver.status !== "ACTIVE") throw new DriverPortalError(401, "Driver account is inactive.");
  const shift = await tx.driverShift.findFirst({ where: { driverId, endedAt: null }, include: shiftInclude });
  const now = new Date();
  const activeJob = await tx.booking.findFirst({ where: { driverId, status: BookingStatus.IN_PROGRESS }, select: { reference: true } });
  if (action === "CLOCK_IN") {
    if (shift) throw new DriverPortalError(409, "You are already clocked in. Refresh to view your shift.");
    await tx.driverShift.create({ data: { driverId, vehicleAtStartId: driver.vehicleId, startedAt: now,
      activities: { create: { kind: "WORK", startedAt: now } } } });
  } else {
    if (!shift) throw new DriverPortalError(409, "Clock in before recording an activity.");
    const open = shift.activities.find(activity => !activity.endedAt);
    if (!open) throw new DriverPortalError(409, "This shift needs an office correction. Contact dispatch.");
    if (now <= open.startedAt) throw new DriverPortalError(409, "Please wait a moment before changing activity.");
    if (action === "CLOCK_OUT" && activeJob) {
      throw new DriverPortalError(409, `Resolve active job ${activeJob.reference} with dispatch before ending your shift.`);
    }
    if (action === "START_BREAK" && open.kind === "BREAK") throw new DriverPortalError(409, "Your break is already running.");
    if (action === "END_BREAK" && open.kind !== "BREAK") throw new DriverPortalError(409, "There is no active break to end.");
    const next = action === "START_BREAK" ? "BREAK" : action === "END_BREAK" ? "WORK" : kind;
    if (action !== "CLOCK_OUT" && (!next || !activityKinds.includes(next))) throw new DriverPortalError(400, "Choose a valid activity.");
    if (next === open.kind) throw new DriverPortalError(409, "This activity is already running.");
    await tx.driverShiftActivity.update({ where: { id: open.id }, data: { endedAt: now } });
    if (action === "CLOCK_OUT") await tx.driverShift.update({ where: { id: shift.id }, data: { endedAt: now } });
    else await tx.driverShiftActivity.create({ data: { shiftId: shift.id, startedAt: now, kind: next! } });
  }
  const current = await tx.driverShift.findFirst({ where: { driverId, endedAt: null }, include: shiftInclude });
  await tx.driver.update({ where: { id: driverId }, data: { portalOnDuty: Boolean(current) } });
  await reconcileDriverActivity(tx, driverId);
  return { shift: current, serverTime: now };
}

export async function attendanceAction(driverId: string, action: AttendanceAction, suppliedId: unknown, kind?: ActivityKind) {
  const id = requestId(suppliedId), payload = JSON.stringify({ action, kind: kind || null });
  return driverTransaction(driverId, async tx => {
    const previous = await tx.driverAttendanceRequest.findUnique({ where: { driverId_requestId: { driverId, requestId: id } } });
    if (previous) {
      if (previous.payload !== payload) throw new DriverPortalError(409, "This request belongs to a different action.");
      return previous.result;
    }
    const result = await changeAttendance(tx, driverId, action, kind);
    const json = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    await tx.driverAttendanceRequest.create({ data: { driverId, requestId: id, action, payload, result: json } });
    await tx.auditLog.create({ data: { action: `ATTENDANCE_${action}`, entityType: "Driver", entityId: driverId,
      newValue: json, reason: `Driver ${driverId}; server-recorded attendance` } });
    return json;
  });
}

export async function legacyDuty(driverId: string, onDuty: boolean) {
  return driverTransaction(driverId, async tx => {
    const shift = await tx.driverShift.findFirst({ where: { driverId, endedAt: null } });
    if (Boolean(shift) !== onDuty) {
      await changeAttendance(tx, driverId, onDuty ? "CLOCK_IN" : "CLOCK_OUT");
      await tx.auditLog.create({ data: { action: "ATTENDANCE_LEGACY_DUTY", entityType: "Driver", entityId: driverId,
        newValue: { onDuty }, reason: `Driver ${driverId}; legacy duty API` } });
    } else await tx.driver.update({ where: { id: driverId }, data: { portalOnDuty: onDuty } });
    return tx.driver.findUniqueOrThrow({ where: { id: driverId }, include: { vehicle: true } });
  });
}
