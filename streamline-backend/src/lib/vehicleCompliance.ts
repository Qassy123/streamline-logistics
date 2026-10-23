type VehicleDates = { taxDueDate?: Date | null; motExpiry?: Date | null };
function ukDay(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
export function vehicleComplianceBlocks(vehicle: VehicleDates, until: Date, now = new Date()) {
  const today = ukDay(now), lastDay = ukDay(new Date(Math.max(+now, +until - 1)));
  const result: string[] = [];
  for (const [label, value] of [["Vehicle tax", vehicle.taxDueDate], ["MOT", vehicle.motExpiry]] as const) {
    if (!value) continue;
    const due = ukDay(value);
    if (due < today) result.push(`${label} has expired (${due}). Update the vehicle record before booking.`);
    else if (due < lastDay) result.push(`${label} expires before this booking ends (${due}). Select a compliant vehicle.`);
  }
  return result;
}
