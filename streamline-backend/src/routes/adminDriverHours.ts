import express from "express";
import { Prisma, type AdminUser } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { attendanceRoles, payrollRoles, requireStaff } from "../lib/adminAccess";
import { DriverPortalError, reconcileDriverActivity, text } from "../lib/driverPortal";
import { activityKinds, driverTransaction, shiftInclude } from "../lib/driverAttendance";
import { applyPayAdjustments, calculatePayroll, csvCell, periodRange, ukMidnight, weekKey } from "../lib/driverPayroll";
import { complianceReport } from "../lib/driverCompliance";

const router = express.Router();
type Handler = (req: express.Request, res: express.Response, admin: AdminUser) => Promise<unknown>;
const route = (handler: Handler, payroll = false): express.RequestHandler => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await handler(req, res, await requireStaff(req, payroll ? payrollRoles : attendanceRoles)); }
  catch (error) {
    const conflict = error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2004"].includes(error.code);
    res.status(error instanceof DriverPortalError ? error.status : conflict ? 409 : 500).json({ error: error instanceof DriverPortalError ? error.message : conflict ? "These records changed or conflict. Refresh before retrying." : "Unable to confirm this operation. Refresh before retrying." });
  }
};
function driverId(req: express.Request) { const id = text(req.params.driverId, 100); if (!id) throw new DriverPortalError(400, "Choose a driver."); return id; }
function reason(req: express.Request) { const value = text(req.body?.reason, 2000); if (value.length < 5) throw new DriverPortalError(400, "Explain the reason for this change."); return value; }
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function audit(tx: Prisma.TransactionClient, adminId: string, action: string, entityId: string, explanation: string, value: unknown) {
  await tx.auditLog.create({ data: { adminId, action, entityType: "DriverHours", entityId, reason: explanation, newValue: json(value) } });
}
async function reviewLocked(tx: Prisma.TransactionClient, id: string, from: Date, until: Date) {
  const approved = await tx.driverTimesheetReview.findFirst({ where: { driverId: id, status: "APPROVED", periodFrom: { lt: until }, periodUntil: { gt: from } } });
  if (approved) throw new DriverPortalError(409, "This period has approved payroll. Use a separately reviewed adjustment; approved records cannot be silently changed.");
}
async function records(tx: Prisma.TransactionClient, id: string, from: Date, until: Date) {
  const contextFrom = ukMidnight(weekKey(+from));
  const shifts = await tx.driverShift.findMany({ where: { driverId: id, startedAt: { lt: until }, OR: [{ endedAt: { gt: contextFrom } }, { endedAt: null }] }, include: shiftInclude, orderBy: { startedAt: "asc" }, take: 1001 });
  if (shifts.length > 1000) throw new DriverPortalError(400, "Choose a shorter date range.");
  const policies = await tx.driverPayPolicy.findMany({ where: { driverId: id, effectiveAt: { lt: until } }, orderBy: { effectiveAt: "asc" } });
  const adjustments = await tx.driverPayrollAdjustment.findMany({ where: { driverId: id, effectiveAt: { gte: from, lt: until } }, orderBy: { createdAt: "asc" } });
  const totals = applyPayAdjustments(calculatePayroll(shifts, policies, from, until), adjustments.filter(row => row.status === "APPROVED"));
  if (adjustments.some(row => row.status === "PENDING")) totals.warnings.push("Pending payroll adjustments must be reviewed before approving this period.");
  return { shifts, policies, adjustments, totals };
}
router.get("/drivers", route(async (_req, res) => {
  res.json({ drivers: await prisma.driver.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }) });
}));
router.get("/overview", route(async (_req, res) => {
  const active = await prisma.driverShift.findMany({ where: { endedAt: null }, include: { ...shiftInclude, driver: { select: { name: true } } }, orderBy: { startedAt: "asc" } });
  res.json({ active, onBreak: active.filter(shift => shift.activities.some(item => !item.endedAt && item.kind === "BREAK")).length, serverTime: new Date() });
}));
router.get("/vehicle-settings", route(async (_req, res) => {
  res.json({ vehicles: await prisma.vehicle.findMany({ select: { id: true, name: true, registration: true, vehicleType: true, maxGrossWeightKg: true }, orderBy: { name: "asc" } }) });
}));
router.patch("/vehicle-settings/:vehicleId", route(async (req, res, admin) => {
  const id = text(req.params.vehicleId, 100), weight = req.body?.maxGrossWeightKg, explanation = reason(req);
  if (weight !== null && (!Number.isInteger(weight) || weight < 500 || weight > 10000)) throw new DriverPortalError(400, "Enter the plated maximum gross weight in kg, or leave it unconfirmed.");
  const vehicle = await prisma.$transaction(async tx => {
    const before = await tx.vehicle.findUniqueOrThrow({ where: { id } });
    const value = await tx.vehicle.update({ where: { id }, data: { maxGrossWeightKg: weight } });
    await tx.auditLog.create({ data: { adminId: admin.id, action: "VEHICLE_WEIGHT_UPDATED", entityType: "Vehicle", entityId: id,
      oldValue: { maxGrossWeightKg: before.maxGrossWeightKg }, newValue: { maxGrossWeightKg: weight }, reason: explanation } });
    return { id: value.id, maxGrossWeightKg: value.maxGrossWeightKg };
  }); res.json({ vehicle });
}));
router.get("/:driverId/work-settings", route(async (req, res) => {
  const id = driverId(req);
  res.json({ policies: await prisma.driverWorkingTimePolicy.findMany({ where: { driverId: id }, orderBy: { effectiveAt: "desc" } }), report: await complianceReport(id) });
}));
router.post("/:driverId/work-settings", route(async (req, res, admin) => {
  const id = driverId(req), explanation = reason(req), effectiveAt = ukMidnight(text(req.body?.effectiveDate, 10));
  const employmentType = req.body?.employmentType, operatingRegion = req.body?.operatingRegion, referenceWeeks = req.body?.referenceWeeks;
  if (!["EMPLOYEE", "CONTRACTOR"].includes(employmentType) || !["UK_ONLY", "INTERNATIONAL_REVIEW_REQUIRED"].includes(operatingRegion) || !Number.isInteger(referenceWeeks) || referenceWeeks < 1 || referenceWeeks > 52) throw new DriverPortalError(400, "Choose valid employment, operation and reference-period settings.");
  const minutes: Record<string, number | null> = {};
  for (const key of ["averageWeeklyMinutes", "maxWeeklyMinutes", "maxShiftWorkMinutes", "maxShiftDrivingMinutes", "minRestMinutes", "breakAfterMinutes", "minimumBreakMinutes", "maxNightWorkMinutes"]) {
    const value = req.body?.[key]; if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10080)) throw new DriverPortalError(400, "Use positive limits or leave a limit blank."); minutes[key] = value;
  }
  const nightStartHour = req.body?.nightStartHour, nightEndHour = req.body?.nightEndHour;
  if (![nightStartHour, nightEndHour].every(hour => Number.isInteger(hour) && hour >= 0 && hour <= 23) || nightStartHour === nightEndHour) throw new DriverPortalError(400, "Choose a valid night window with different start/end hours.");
  const policy = await driverTransaction(id, async tx => {
    const value = await tx.driverWorkingTimePolicy.create({ data: { driverId: id, effectiveAt, employmentType, operatingRegion, referenceWeeks,
      averageWeeklyMinutes: minutes.averageWeeklyMinutes, maxWeeklyMinutes: minutes.maxWeeklyMinutes, maxShiftWorkMinutes: minutes.maxShiftWorkMinutes,
      maxShiftDrivingMinutes: minutes.maxShiftDrivingMinutes, minRestMinutes: minutes.minRestMinutes, breakAfterMinutes: minutes.breakAfterMinutes,
      minimumBreakMinutes: minutes.minimumBreakMinutes, maxNightWorkMinutes: minutes.maxNightWorkMinutes, nightStartHour, nightEndHour, createdBy: admin.id, reason: explanation } });
    await audit(tx, admin.id, "DRIVER_WORK_SETTINGS_CREATED", id, explanation, value); return value;
  }); res.json({ policy });
}));
router.get("/:driverId/attendance", route(async (req, res) => {
  const id = driverId(req), range = periodRange(req.query.from, req.query.until);
  const shifts = await prisma.driverShift.findMany({ where: { driverId: id, startedAt: { lt: range.until }, OR: [{ endedAt: { gt: range.from } }, { endedAt: null }] }, include: { ...shiftInclude, amendments: { orderBy: { createdAt: "desc" } } }, orderBy: { startedAt: "asc" }, take: 1000 });
  res.json({ shifts });
}));
router.get("/:driverId/timesheet", route(async (req, res) => {
  const id = driverId(req), range = periodRange(req.query.from, req.query.until);
  const data = await prisma.$transaction(tx => records(tx, id, range.from, range.until), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const reviews = await prisma.driverTimesheetReview.findMany({ where: { driverId: id, periodFrom: { lt: range.until }, periodUntil: { gt: range.from } }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ ...data, reviews });
}, true));
router.get("/:driverId/policies", route(async (req, res) => {
  res.json({ policies: await prisma.driverPayPolicy.findMany({ where: { driverId: driverId(req) }, orderBy: { effectiveAt: "desc" } }) });
}, true));
router.post("/:driverId/policies", route(async (req, res, admin) => {
  const id = driverId(req), explanation = reason(req), effectiveAt = ukMidnight(text(req.body?.effectiveDate, 10));
  const hourlyPence = req.body?.hourlyPence, weeklyStandardMinutes = req.body?.weeklyStandardMinutes, multiplier = Number(req.body?.overtimeMultiplier);
  if (!Number.isInteger(hourlyPence) || hourlyPence < 1 || hourlyPence > 100000 || !Number.isInteger(weeklyStandardMinutes) || weeklyStandardMinutes < 0 || weeklyStandardMinutes > 10080 || !Number.isFinite(multiplier) || multiplier < 1 || multiplier > 10) throw new DriverPortalError(400, "Enter a valid hourly rate, weekly hours and overtime multiplier.");
  for (const field of ["paidBreaks", "paidRest", "paidAvailability"]) if (typeof req.body?.[field] !== "boolean") throw new DriverPortalError(400, "Choose how each type of time is paid.");
  const policy = await driverTransaction(id, async tx => {
    // A new effective rate must not change any already-approved calculation period.
    const later = await tx.driverTimesheetReview.findFirst({ where: { driverId: id, status: "APPROVED", periodUntil: { gt: effectiveAt } } });
    if (later) throw new DriverPortalError(409, "Choose an effective date after approved payroll. Historical snapshots are locked.");
    const value = await tx.driverPayPolicy.create({ data: { driverId: id, effectiveAt, hourlyPence, weeklyStandardMinutes, overtimeMultiplier: multiplier,
      paidBreaks: req.body.paidBreaks, paidRest: req.body.paidRest, paidAvailability: req.body.paidAvailability, createdBy: admin.id } });
    await audit(tx, admin.id, "PAY_POLICY_CREATED", id, explanation, value); return value;
  }); res.json({ policy });
}, true));

router.post("/:driverId/shifts", route(async (req, res, admin) => {
  const id = driverId(req), explanation = reason(req);
  const input = req.body?.activities;
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) throw new DriverPortalError(400, "Add between one and 100 activity intervals.");
  const rows = input.map(value => {
    const startedAt = new Date(value?.startedAt), endedAt = new Date(value?.endedAt), kind = value?.kind;
    if (typeof value?.startedAt !== "string" || typeof value?.endedAt !== "string" || !activityKinds.includes(kind) || !Number.isFinite(+startedAt) || !Number.isFinite(+endedAt) || endedAt <= startedAt || endedAt > new Date()) throw new DriverPortalError(400, "Enter valid completed activity times.");
    return { kind: String(kind), startedAt, endedAt };
  }).sort((a, b) => +a.startedAt - +b.startedAt);
  for (let n = 1; n < rows.length; n++) if (+rows[n].startedAt !== +rows[n - 1].endedAt) throw new DriverPortalError(400, "Activities must form one continuous shift with no gaps or overlaps.");
  const from = rows[0].startedAt, until = rows[rows.length - 1].endedAt, shiftId = text(req.body?.shiftId, 100);
  if (+until - +from > 7 * 86400000) throw new DriverPortalError(400, "A shift cannot exceed seven days. Split or correct the entries.");
  const shift = await driverTransaction(id, async tx => {
    const existing = shiftId ? await tx.driverShift.findFirst({ where: { id: shiftId, driverId: id }, include: shiftInclude }) : null;
    if (shiftId && !existing) throw new DriverPortalError(404, "Shift not found.");
    if (existing && !existing.endedAt && await tx.booking.count({ where: { driverId: id, status: "IN_PROGRESS" } })) throw new DriverPortalError(409, "Dispatch must resolve the active delivery before closing this shift.");
    await reviewLocked(tx, id, from, until);
    if (existing) await reviewLocked(tx, id, existing.startedAt, existing.endedAt || new Date());
    const overlap = await tx.driverShift.findFirst({ where: { driverId: id, ...(shiftId ? { id: { not: shiftId } } : {}), startedAt: { lt: until }, OR: [{ endedAt: { gt: from } }, { endedAt: null }] } });
    if (overlap) throw new DriverPortalError(409, "This overlaps another shift.");
    let value;
    if (existing) {
      // Original activity intervals are preserved in an immutable amendment record.
      await tx.driverShiftActivity.updateMany({ where: { shiftId, active: true }, data: { active: false } });
      value = await tx.driverShift.update({ where: { id: shiftId }, data: { startedAt: from, endedAt: until, revision: { increment: 1 }, activities: { create: rows } }, include: shiftInclude });
    } else value = await tx.driverShift.create({ data: { driverId: id, source: "ADMIN", startedAt: from, endedAt: until, activities: { create: rows } }, include: shiftInclude });
    await tx.driverShiftAmendment.create({ data: { shiftId: value.id, adminId: admin.id, reason: explanation, before: json(existing || {}), after: json(value) } });
    if (existing && !existing.endedAt) {
      await tx.driver.update({ where: { id }, data: { portalOnDuty: false } });
      await reconcileDriverActivity(tx, id);
    }
    await audit(tx, admin.id, existing ? "SHIFT_CORRECTED" : "MANUAL_SHIFT_CREATED", value.id, explanation, value);
    return value;
  }); res.json({ shift });
}));
router.post("/:driverId/adjustments", route(async (req, res, admin) => {
  const id = driverId(req), explanation = reason(req), effectiveAt = ukMidnight(text(req.body?.effectiveDate, 10));
  const payableSeconds = req.body?.payableSeconds, grossPence = req.body?.grossPence;
  if (!Number.isInteger(payableSeconds) || Math.abs(payableSeconds) > 604800 || !Number.isInteger(grossPence) || Math.abs(grossPence) > 10000000 || (!payableSeconds && !grossPence)) throw new DriverPortalError(400, "Enter a non-zero adjustment within the permitted range.");
  const adjustment = await driverTransaction(id, async tx => {
    await reviewLocked(tx, id, effectiveAt, new Date(+effectiveAt + 1));
    const value = await tx.driverPayrollAdjustment.create({ data: { driverId: id, effectiveAt, payableSeconds, grossPence, reason: explanation, createdBy: admin.id } });
    await audit(tx, admin.id, "PAYROLL_ADJUSTMENT_CREATED", value.id, explanation, value); return value;
  }); res.json({ adjustment });
}, true));
router.post("/:driverId/adjustments/:adjustmentId/review", route(async (req, res, admin) => {
  const id = driverId(req), adjustmentId = text(req.params.adjustmentId, 100), explanation = reason(req), status = req.body?.status;
  if (!["APPROVED", "REJECTED"].includes(status)) throw new DriverPortalError(400, "Choose approve or reject.");
  const adjustment = await driverTransaction(id, async tx => {
    const existing = await tx.driverPayrollAdjustment.findFirst({ where: { id: adjustmentId, driverId: id } });
    if (!existing || existing.status !== "PENDING") throw new DriverPortalError(409, "This adjustment has already been reviewed or is unavailable.");
    await reviewLocked(tx, id, existing.effectiveAt, new Date(+existing.effectiveAt + 1));
    const value = await tx.driverPayrollAdjustment.update({ where: { id: adjustmentId }, data: { status, reviewedBy: admin.id, reviewedAt: new Date(), reviewReason: explanation } });
    await audit(tx, admin.id, `PAYROLL_ADJUSTMENT_${status}`, value.id, explanation, value); return value;
  }); res.json({ adjustment });
}, true));
router.post("/:driverId/review", route(async (req, res, admin) => {
  const id = driverId(req), range = periodRange(req.body?.from, req.body?.until), explanation = reason(req), status = req.body?.status;
  if (!["APPROVED", "REJECTED"].includes(status)) throw new DriverPortalError(400, "Choose approve or reject.");
  if (status === "APPROVED" && range.until > new Date()) throw new DriverPortalError(409, "Wait until the pay period has finished before approving it.");
  const review = await driverTransaction(id, async tx => {
    await reviewLocked(tx, id, range.from, range.until);
    const data = await records(tx, id, range.from, range.until);
    if (status === "APPROVED" && ((!data.shifts.length && !data.adjustments.some(row => row.status === "APPROVED")) || data.totals.warnings.length)) throw new DriverPortalError(409, data.totals.warnings.join(" ") || "There are no shifts or approved adjustments to approve.");
    const snapshot = json({ ...data, from: range.from, until: range.until, calculatedAt: new Date() });
    const value = await tx.driverTimesheetReview.create({ data: { driverId: id, periodFrom: range.from, periodUntil: range.until, status, reason: explanation, adminId: admin.id, snapshot } });
    await audit(tx, admin.id, `TIMESHEET_${status}`, value.id, explanation, { status, driverId: id });
    await tx.driverPortalNotification.create({ data: { driverId: id, dedupeKey: `hours-${value.id}`, title: `Timesheet ${status.toLowerCase()}`, body: explanation } });
    return value;
  }); res.json({ review });
}, true));
router.get("/:driverId/export", route(async (req, res) => {
  const id = driverId(req), reviewId = text(req.query.reviewId, 100);
  const review = await prisma.driverTimesheetReview.findFirst({ where: { id: reviewId, driverId: id, status: "APPROVED" } });
  if (!review) throw new DriverPortalError(404, "Select an approved timesheet to export.");
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id } });
  const snapshot = review.snapshot as unknown as { totals: ReturnType<typeof calculatePayroll> };
  const totals = snapshot.totals;
  const headers = ["Driver", "From (UK)", "Until exclusive (UK)", "Attendance hours", "Working hours", "Break hours", "POA hours", "Payable hours", "Overtime hours", "Gross GBP", "Approval ID"];
  const hours = (seconds: number) => (seconds / 3600).toFixed(4);
  const values = [driver.name, review.periodFrom.toISOString(), review.periodUntil.toISOString(), hours(totals.attendanceSeconds), hours(totals.workingSeconds), hours(totals.breakSeconds), hours(totals.availabilitySeconds), hours(totals.payableSeconds), hours(totals.overtimeSeconds), (totals.grossPence / 100).toFixed(2), review.id];
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", `attachment; filename="payroll-${review.id}.csv"`);
  res.send("\uFEFF" + [headers, values].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n");
}, true));
export default router;
