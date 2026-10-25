import type { Prisma } from "@prisma/client";
export function adminQuoteGrouping(group: string, now = new Date()): Prisma.QuoteWhereInput {
  const closed: Prisma.QuoteWhereInput = { OR: [
    { booking: { isNot: null } },
    { status: { in: ["paid", "converted to booking", "converted", "cancelled", "expired"], mode: "insensitive" } },
    { expiresAt: { lte: now } },
  ] };
  if (group === "COMPLETED") return closed;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (key: string) => parts.find(item => item.type === key)!.value;
  const tomorrow = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { NOT: closed, collectionDate: group === "FUTURE" ? { gte: tomorrow } : { lt: tomorrow } };
}
