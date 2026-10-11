import { DriverPortalError } from "./driverPortal";

export type Interval = { kind: string; startedAt: Date | string; endedAt: Date | string | null };
export type ShiftInput = { id: string; revision: number; startedAt: Date | string; endedAt: Date | string | null; activities: Interval[] };
export type PayPolicy = { id: string; effectiveAt: Date | string; hourlyPence: number; weeklyStandardMinutes: number;
  overtimeMultiplier: unknown; paidBreaks: boolean; paidRest: boolean; paidAvailability: boolean };
const milliseconds = (value: Date | string) => new Date(value).getTime();
const workKinds = new Set(["WORK", "DRIVING", "OTHER_WORK"]);

export function ukDay(time: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time));
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function ukMidnight(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new DriverPortalError(400, "Choose a valid date.");
  const guess = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0, 10) !== day) throw new DriverPortalError(400, "Choose a valid date.");
  // UK midnight is unambiguous even on a daylight-saving transition day.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(guess)));
  return new Date(guess - hour * 3600000);
}

export function periodRange(from: unknown, until: unknown) {
  if (typeof from !== "string" || typeof until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw new DriverPortalError(400, "Choose start and end dates (end date is excluded).");
  }
  const start = ukMidnight(from), end = ukMidnight(until);
  if (end <= start || +end - +start > 94 * 86400000) {
    throw new DriverPortalError(400, "Choose a valid range of at most 93 days.");
  }
  return { from: start, until: end };
}

export function weekKey(time: number) {
  const date = new Date(`${ukDay(time)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function calculatePayroll(shifts: ShiftInput[], policies: PayPolicy[], from: Date, until: Date, now = new Date()) {
  let attendanceMs = 0, workingMs = 0, breakMs = 0, restMs = 0, availabilityMs = 0, payableMs = 0, overtimeMs = 0, grossPence = 0;
  const warnings = new Set<string>(), weekly = new Map<string, number>();
  const rateList = [...policies].sort((a, b) => milliseconds(a.effectiveAt) - milliseconds(b.effectiveAt));
  const segments: Array<{ start: number; end: number; kind: string; shiftId: string }> = [];
  const contextFrom = +ukMidnight(weekKey(+from));
  for (const shift of shifts) {
    const start = Math.max(contextFrom, milliseconds(shift.startedAt)), end = Math.min(+until, shift.endedAt ? milliseconds(shift.endedAt) : +now);
    if (!shift.endedAt && start < +until) warnings.add("Open shift: close or correct it before approval.");
    attendanceMs += Math.max(0, end - Math.max(start, +from));
    let prior = milliseconds(shift.startedAt);
    for (const activity of shift.activities) {
      const a = milliseconds(activity.startedAt), b = activity.endedAt ? milliseconds(activity.endedAt) : +now;
      if (a !== prior || b < a || a < milliseconds(shift.startedAt) || (shift.endedAt && b > milliseconds(shift.endedAt))) {
        warnings.add("An activity timeline has a gap, overlap or invalid range.");
      }
      prior = b;
      const clippedStart = Math.max(start, a), clippedEnd = Math.min(end, b);
      if (clippedEnd > clippedStart) segments.push({ start: clippedStart, end: clippedEnd, kind: activity.kind, shiftId: shift.id });
    }
    if (shift.endedAt && prior !== milliseconds(shift.endedAt)) warnings.add("A closed shift has an incomplete activity timeline.");
  }
  segments.sort((a, b) => a.start - b.start);
  let lastEnd = -Infinity;
  for (const segment of segments) {
    if (segment.start < lastEnd) warnings.add("Shift activities overlap; office correction required.");
    lastEnd = Math.max(lastEnd, segment.end);
    const duration = Math.max(0, segment.end - Math.max(segment.start, +from));
    if (workKinds.has(segment.kind)) workingMs += duration;
    else if (segment.kind === "BREAK") breakMs += duration;
    else if (segment.kind === "REST") restMs += duration;
    else if (segment.kind === "POA") availabilityMs += duration;
    else warnings.add("Unrecognised activity type.");
    let cursor = segment.start;
    while (cursor < segment.end) {
      const applicable = rateList.filter(rate => milliseconds(rate.effectiveAt) <= cursor);
      const policy = applicable[applicable.length - 1];
      const nextRate = rateList.find(rate => milliseconds(rate.effectiveAt) > cursor);
      const monday = new Date(`${weekKey(cursor)}T00:00:00Z`); monday.setUTCDate(monday.getUTCDate() + 7);
      const nextWeek = +ukMidnight(monday.toISOString().slice(0, 10));
      const end = Math.min(segment.end, nextWeek, nextRate ? milliseconds(nextRate.effectiveAt) : Infinity, cursor < +from ? +from : Infinity);
      const delta = end - cursor;
      if (!policy) warnings.add("Pay terms are missing for part of this period.");
      else {
        const paid = workKinds.has(segment.kind) || (segment.kind === "BREAK" && policy.paidBreaks)
          || (segment.kind === "REST" && policy.paidRest) || (segment.kind === "POA" && policy.paidAvailability);
        if (paid) {
          const key = weekKey(cursor), used = weekly.get(key) || 0, threshold = policy.weeklyStandardMinutes * 60000;
          const standard = Math.min(delta, Math.max(0, threshold - used)), overtime = delta - standard;
          weekly.set(key, used + delta);
          if (cursor >= +from) {
            payableMs += delta; overtimeMs += overtime;
            grossPence += (standard + overtime * Number(policy.overtimeMultiplier)) / 3600000 * policy.hourlyPence;
          }
        }
      }
      cursor = end;
    }
  }
  return { attendanceSeconds: Math.round(attendanceMs / 1000), workingSeconds: Math.round(workingMs / 1000), breakSeconds: Math.round(breakMs / 1000),
    restSeconds: Math.round(restMs / 1000), availabilitySeconds: Math.round(availabilityMs / 1000), payableSeconds: Math.round(payableMs / 1000),
    overtimeSeconds: Math.round(overtimeMs / 1000), grossPence: Math.round(grossPence), currency: "GBP", warnings: [...warnings],
    timezone: "Europe/London", overtimeWeek: "Monday 00:00 UK time", policyIds: rateList.map(rate => rate.id),
    shiftRevisions: shifts.map(shift => ({ id: shift.id, revision: shift.revision })),
    compliance: { status: "NOT_ASSESSED", reason: "Vehicle weights and applicable rules have not been verified. These working hours are recorded activity totals, not a legal compliance certificate." } };
}

export function csvCell(value: unknown) {
  let text = String(value ?? ""); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function applyPayAdjustments(totals: ReturnType<typeof calculatePayroll>, adjustments: { id: string; payableSeconds: number; grossPence: number }[]) {
  const seconds = adjustments.reduce((sum, row) => sum + row.payableSeconds, 0), pence = adjustments.reduce((sum, row) => sum + row.grossPence, 0);
  return { ...totals, basePayableSeconds: totals.payableSeconds, baseGrossPence: totals.grossPence,
    payableSeconds: totals.payableSeconds + seconds, grossPence: totals.grossPence + pence,
    adjustmentIds: adjustments.map(row => row.id), adjustmentSeconds: seconds, adjustmentPence: pence,
    warnings: [...totals.warnings, ...(totals.payableSeconds + seconds < 0 || totals.grossPence + pence < 0 ? ["Adjustments produce a negative total; review before approval."] : [])] };
}
