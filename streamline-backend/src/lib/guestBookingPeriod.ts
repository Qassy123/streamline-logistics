import type { Prisma } from "@prisma/client";
export function guestBookingPeriod(period: string, now = new Date()): Prisma.BookingWhereInput {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (key: string) => parts.find(item => item.type === key)!.value;
  const today = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  const terminal = ["COMPLETED", "CANCELLED", "EXPIRED"] as const;
  return period === "PREVIOUS"
    ? { OR: [{ status: { in: [...terminal] } }, { status: { notIn: [...terminal, "IN_PROGRESS"] }, collectionDate: { lt: today } }] }
    : { OR: [{ status: "IN_PROGRESS" }, { status: { notIn: [...terminal, "IN_PROGRESS"] }, collectionDate: { gte: today } }] };
}
