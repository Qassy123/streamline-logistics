import express from "express";
import { prisma } from "../lib/prisma";
import { authenticateDriver, DriverPortalError } from "../lib/driverPortal";
import { activityKinds, attendanceAction, shiftInclude, type ActivityKind, type AttendanceAction } from "../lib/driverAttendance";
import { applyPayAdjustments, calculatePayroll, periodRange, ukMidnight, weekKey } from "../lib/driverPayroll";
import { complianceReport } from "../lib/driverCompliance";

const router = express.Router();
type Handler = (req: express.Request, res: express.Response, driverId: string) => Promise<unknown>;
const route = (handler: Handler): express.RequestHandler => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const driver = await authenticateDriver(req.headers.authorization);
    if (!driver) throw new DriverPortalError(401, "Sign in to your driver account.");
    await handler(req, res, driver.id);
  } catch (error) { res.status(error instanceof DriverPortalError ? error.status : 500).json({ error: error instanceof DriverPortalError ? error.message : "Unable to confirm shift update. Refresh before retrying." }); }
};
router.get("/current", route(async (_req, res, driverId) => {
  const shift = await prisma.driverShift.findFirst({ where: { driverId, endedAt: null }, include: shiftInclude });
  res.json({ shift, serverTime: new Date() });
}));
router.get("/compliance", route(async (_req, res, driverId) => { res.json(await complianceReport(driverId)); }));
for (const [path, action] of Object.entries({ "clock-in": "CLOCK_IN", "clock-out": "CLOCK_OUT", "start-break": "START_BREAK", "end-break": "END_BREAK", activity: "ACTIVITY" })) {
  router.post(`/${path}`, route(async (req, res, driverId) => {
    const kind = req.body?.kind;
    if (action === "ACTIVITY" && !activityKinds.includes(kind)) throw new DriverPortalError(400, "Choose an activity.");
    res.json(await attendanceAction(driverId, action as AttendanceAction, req.body?.requestId, action === "ACTIVITY" ? kind as ActivityKind : undefined));
  }));
}
router.get("/history", route(async (req, res, driverId) => {
  const range = periodRange(req.query.from, req.query.until);
  const contextFrom = ukMidnight(weekKey(+range.from));
  const shifts = await prisma.driverShift.findMany({ where: { driverId, startedAt: { lt: range.until }, OR: [{ endedAt: { gt: contextFrom } }, { endedAt: null }] }, include: shiftInclude, orderBy: { startedAt: "asc" }, take: 1001 });
  if (shifts.length > 1000) throw new DriverPortalError(400, "Choose a shorter date range.");
  const policies = await prisma.driverPayPolicy.findMany({ where: { driverId, effectiveAt: { lt: range.until } }, orderBy: { effectiveAt: "asc" } });
  const reviews = await prisma.driverTimesheetReview.findMany({ where: { driverId, periodFrom: { lt: range.until }, periodUntil: { gt: range.from } }, orderBy: { createdAt: "desc" }, take: 100 });
  const adjustments = await prisma.driverPayrollAdjustment.findMany({ where: { driverId, status: "APPROVED", effectiveAt: { gte: range.from, lt: range.until } }, orderBy: { createdAt: "asc" } });
  res.json({ shifts, adjustments, totals: applyPayAdjustments(calculatePayroll(shifts, policies, range.from, range.until), adjustments), reviews, from: range.from, until: range.until });
}));
export default router;
