type CalendarBooking = { estimatedStartTime?: string | null; estimatedEndTime?: string | null; collectionDate: string; collectionWindow: string };
const londonParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function calendarMinutes(value: string | null | undefined, day: string): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(+date) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parts = londonParts.formatToParts(date);
  const part = (key: string) => Number(parts.find(item => item.type === key)?.value);
  const dateDelta = (Date.UTC(part("year"), part("month") - 1, part("day")) - Date.parse(day + "T00:00:00Z")) / 86400000;
  return dateDelta * 1440 + part("hour") * 60 + part("minute");
}
export function calendarInterval(booking: CalendarBooking, day: string) {
  let start = calendarMinutes(booking.estimatedStartTime, day);
  let end = calendarMinutes(booking.estimatedEndTime, day);
  if (start === null) {
    const match = /^(\d{2}):(\d{2})-/.exec(booking.collectionWindow || "");
    const dateDelta = (Date.parse(booking.collectionDate.slice(0, 10) + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) / 86400000;
    if (!match || !Number.isFinite(dateDelta) || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    start = dateDelta * 1440 + Number(match[1]) * 60 + Number(match[2]);
  }
  if (end === null) end = start + 360;
  if (end <= start || end <= 0 || start >= 1440) return null;
  return { start: Math.max(0, start), end: Math.min(1440, end) };
}
export function dropCollectionWindow(offset: number, hourWidth: number) {
  const hour = Math.max(0, Math.min(22, Math.floor(offset / hourWidth)));
  return `${String(hour).padStart(2, "0")}:00-${String(hour + 2).padStart(2, "0")}:00`;
}
