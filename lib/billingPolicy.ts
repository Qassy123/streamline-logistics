export const TRADE_PAYMENT_TERMS = "Monthly invoicing on the 1st; payment due by the 15th of the same month";
export const TRADE_PAYMENT_NOTICE = "Invoices for all bookings made during the previous month will be issued on the 1st of each month, with payment due by the 15th of the same month.";
export const TRADE_PAYMENT_EXAMPLE = "For example, invoices for all May bookings will be issued on 1 June and will be payable by 15 June.";
export function ukParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}
export function ukMidnight(year: number, month: number, day: number) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  return new Date(guess.getTime() - Number(parts.find(p => p.type === "hour")?.value || 0) * 3600000);
}
export function tradeMonth(bookingCreatedAt: Date) {
  const { year, month } = ukParts(bookingCreatedAt);
  const next = new Date(Date.UTC(year, month, 1));
  const issueDate = ukMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
  return { key: `${year}-${String(month).padStart(2, "0")}`, start: ukMidnight(year, month, 1), end: issueDate, issueDate, dueDate: ukMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 15) };
}
export function invoiceTerms(accountType: string | undefined, issuedAt: Date, fallback?: { paymentTerms: string | null; dueDate: Date | null }) {
  if (accountType === "TRADE") { const p = ukParts(issuedAt); return { paymentTerms: TRADE_PAYMENT_TERMS, dueDate: ukMidnight(p.year, p.month, 15) }; }
  if (accountType !== "BUSINESS" && fallback) return fallback;
  return { paymentTerms: "Due immediately", dueDate: new Date(issuedAt) };
}
export function invoiceDisplayStatus(status: string) {
  if (status === "DRAFT") return "PENDING";
  if (status === "PAID") return "PAID";
  if (["FINALISED", "SENT", "ISSUED", "OVERDUE", "PARTIALLY_PAID"].includes(status)) return "UNPAID/DUE";
  return status.replace(/_/g, " ").toUpperCase();
}
