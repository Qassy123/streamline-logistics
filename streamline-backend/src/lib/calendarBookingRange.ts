import { Prisma } from "@prisma/client";
const SIX_HOURS = 6 * 3600000;
// Candidate query shared by the two calendars. Include minimum six-hour holds
// even for legacy short end times, plus longer explicit/reservation holds.
export function calendarBookingRange(startsAt: Date, endsAt: Date, firstDay: Date, dayAfterLast: Date): Prisma.BookingWhereInput {
  const lookback = new Date(+startsAt - SIX_HOURS);
  const previousDay = new Date(+firstDay - 86400000);
  return { OR: [
    { collectionDate: { gte: firstDay, lt: dayAfterLast } },
    { estimatedStartTime: { gt: lookback, lt: endsAt } },
    { estimatedStartTime: { lt: endsAt }, estimatedEndTime: { gt: startsAt } },
    { estimatedStartTime: { lt: endsAt }, vehicleAvailableAt: { gt: startsAt } },
    { reservation: { is: { status: { in: ["ACTIVE", "CONFIRMED"] }, reservedFrom: { lt: endsAt }, reservedUntil: { gt: lookback } } } },
    { estimatedStartTime: null, collectionDate: { gte: previousDay, lt: dayAfterLast } },
  ] };
}
