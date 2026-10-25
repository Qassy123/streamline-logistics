type CalendarBooking = { estimatedStartTime?: string | null; estimatedEndTime?: string | null; collectionDate: string; collectionWindow: string; vehicleAvailableAt?: string | null; reservation?: { status?: string | null; reservedUntil?: string | null } | null };
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
// Keep the grid consistent with fleet capacity: at least six elapsed hours,
// including the portion after midnight. A longer saved hold is also preserved.
export function calendarBookingWindow(booking: CalendarBooking) {
  let start = booking.estimatedStartTime ? new Date(booking.estimatedStartTime) : null;
  if (!start || !Number.isFinite(+start)) {
    const day = booking.collectionDate.slice(0, 10), match = /^(\d{2}):(\d{2})-/.exec(booking.collectionWindow || "");
    if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    const guess = Date.parse(`${day}T${match[1]}:${match[2]}:00Z`);
    if (!Number.isFinite(guess)) return null;
    // Same UK offset rule as the reservation writer; add the duration in UTC.
    const offset = (calendarMinutes(new Date(guess).toISOString(), day)! - Number(match[1]) * 60 - Number(match[2])) * 60000;
    start = new Date(guess - offset);
  }
  const candidates = [booking.estimatedEndTime, booking.vehicleAvailableAt,
    booking.reservation && ["ACTIVE", "CONFIRMED"].includes(booking.reservation.status || "") ? booking.reservation.reservedUntil : null]
    .flatMap(value => value && Number.isFinite(Date.parse(value)) ? [Date.parse(value)] : []);
  const end = new Date(Math.max(+start + 6 * 3600000, ...candidates));
  return { start, end };
}
export function calendarInterval(booking: CalendarBooking, day: string) {
  const window = calendarBookingWindow(booking);
  if (!window) return null;
  const start = calendarMinutes(window.start.toISOString(), day), end = calendarMinutes(window.end.toISOString(), day);
  if (start === null || end === null || end <= start || end <= 0 || start >= 1440) return null;
  return { start: Math.max(0, start), end: Math.min(1440, end) };
}
export function calendarTimeText(booking: CalendarBooking) {
  const window = calendarBookingWindow(booking);
  if (!window) return booking.collectionWindow || "Time not set";
  const time = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const dayNumber = (date: Date) => {
    const parts = londonParts.formatToParts(date);
    const part = (key: string) => Number(parts.find(item => item.type === key)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000;
  };
  const days = dayNumber(window.end) - dayNumber(window.start);
  return `${time(window.start)} - ${time(window.end)}${days === 1 ? " (next day)" : days > 1 ? ` (+${days} days)` : ""}`;
}
export function dropCollectionWindow(offset: number, hourWidth: number) {
  const hour = Math.max(0, Math.min(22, Math.floor(offset / hourWidth)));
  return `${String(hour).padStart(2, "0")}:00-${String(hour + 2).padStart(2, "0")}:00`;
}

