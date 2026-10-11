import { prisma } from "./prisma";
import { ukDay, ukMidnight, weekKey, type ShiftInput } from "./driverPayroll";

// These are configurable company fatigue warnings. Legal applicability is never inferred
// from a category or from missing records. No statutory "compliant" result is returned.
export async function complianceReport(driverId: string, at = new Date()) {
  const policy = await prisma.driverWorkingTimePolicy.findFirst({ where: { driverId, effectiveAt: { lte: at } }, orderBy: { effectiveAt: "desc" } });
  const weeks = policy?.referenceWeeks || 17;
  const fromDay = new Date(`${ukDay(+at)}T00:00:00Z`); fromDay.setUTCDate(fromDay.getUTCDate() - weeks * 7);
  const from = ukMidnight(fromDay.toISOString().slice(0, 10));
  const shifts = await prisma.driverShift.findMany({ where: { driverId, startedAt: { lt: at }, OR: [{ endedAt: { gt: from } }, { endedAt: null }] }, include: { activities: { where: { active: true }, orderBy: { startedAt: "asc" } } }, orderBy: { startedAt: "asc" }, take: 5001 });
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId }, include: { vehicle: true } });
  return evaluateCompanyWarnings(shifts, policy, from, at, driver.vehicle?.maxGrossWeightKg || null);
}

export function evaluateCompanyWarnings(shifts: ShiftInput[], policy: {
  id: string; referenceWeeks: number; averageWeeklyMinutes: number | null; maxWeeklyMinutes: number | null; maxShiftWorkMinutes: number | null;
  maxShiftDrivingMinutes: number | null; minRestMinutes: number | null; breakAfterMinutes: number | null; minimumBreakMinutes: number | null;
  maxNightWorkMinutes: number | null; nightStartHour: number; nightEndHour: number;
} | null, from: Date, until: Date, grossWeightKg: number | null) {
  const warnings: { rule: string; message: string; shiftId?: string }[] = [], weekly: Record<string, number> = {};
  let work = 0, previousEnd: number | null = null;
  if (shifts.length > 5000) return { status: "NOT_ASSESSED", reason: "Too many records; use a reviewed report.", warnings, averageRecordedWeeklyHours: null };
  const workKinds = new Set(["WORK", "DRIVING", "OTHER_WORK"]);
  for (const shift of shifts) {
    let shiftWork = 0, driving = 0, continuous = 0, nightWork = 0;
    if (policy?.minRestMinutes && previousEnd && +new Date(shift.startedAt) - previousEnd < policy.minRestMinutes * 60000) warnings.push({ rule: "COMPANY_REST", shiftId: shift.id, message: "Rest between shifts is below the configured company minimum." });
    previousEnd = shift.endedAt ? +new Date(shift.endedAt) : null;
    for (const interval of shift.activities) {
      let start = Math.max(+from, +new Date(interval.startedAt)), end = Math.min(+until, interval.endedAt ? +new Date(interval.endedAt) : +until);
      const span = Math.max(0, end - start);
      if (interval.kind === "BREAK" || interval.kind === "REST") {
        if (!policy?.minimumBreakMinutes || span >= policy.minimumBreakMinutes * 60000) continuous = 0;
      }
      if (!workKinds.has(interval.kind)) continue;
      work += span; shiftWork += span; continuous += span;
      if (interval.kind === "DRIVING") driving += span;
      if (policy?.breakAfterMinutes && continuous > policy.breakAfterMinutes * 60000) warnings.push({ rule: "COMPANY_BREAK", shiftId: shift.id, message: "Recorded work since the last qualifying break exceeds the configured company limit." });
      // Split at UTC hour boundaries: UK offset changes on whole-hour boundaries.
      while (start < end) {
        const next = Math.min(end, Math.floor(start / 3600000 + 1) * 3600000);
        const key = weekKey(start); weekly[key] = (weekly[key] || 0) + next - start;
        const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(start)));
        if (policy) {
          const inNight = policy.nightStartHour < policy.nightEndHour ? hour >= policy.nightStartHour && hour < policy.nightEndHour : hour >= policy.nightStartHour || hour < policy.nightEndHour;
          if (inNight) nightWork += next - start;
        }
        start = next;
      }
    }
    if (policy?.maxShiftWorkMinutes && shiftWork > policy.maxShiftWorkMinutes * 60000) warnings.push({ rule: "COMPANY_SHIFT_WORK", shiftId: shift.id, message: "Recorded shift work exceeds the configured company limit." });
    if (policy?.maxShiftDrivingMinutes && driving > policy.maxShiftDrivingMinutes * 60000) warnings.push({ rule: "COMPANY_SHIFT_DRIVING", shiftId: shift.id, message: "Recorded shift driving exceeds the configured company limit." });
    if (policy?.maxNightWorkMinutes && nightWork > 0 && shiftWork > policy.maxNightWorkMinutes * 60000) warnings.push({ rule: "COMPANY_NIGHT_WORK", shiftId: shift.id, message: "A shift with recorded night work exceeds the configured company limit." });
  }
  const referenceWeeks = policy?.referenceWeeks || 17, average = work / 3600000 / referenceWeeks;
  if (policy?.averageWeeklyMinutes && average > policy.averageWeeklyMinutes / 60) warnings.push({ rule: "COMPANY_AVERAGE", message: `Recorded ${referenceWeeks}-week average exceeds the configured company limit.` });
  for (const [week, amount] of Object.entries(weekly)) if (policy?.maxWeeklyMinutes && amount > policy.maxWeeklyMinutes * 60000) warnings.push({ rule: "COMPANY_WEEKLY", message: `Recorded work in the week of ${week} exceeds the configured company limit.` });
  return { status: "NOT_ASSESSED", reason: "Statutory applicability, other employment, leave and record completeness need review. Company warnings are not a legal compliance certificate.",
    from, until, policyId: policy?.id || null, grossWeightKg, weightConfirmed: grossWeightKg !== null, referenceWeeks,
    averageRecordedWeeklyHours: Number(average.toFixed(2)), recordedHours: Number((work / 3600000).toFixed(2)), warnings,
    notes: ["Only time recorded in this system is included; missing records are not proof of zero work.", "Daily legal limits are not the same as these per-shift company limits."] };
}
