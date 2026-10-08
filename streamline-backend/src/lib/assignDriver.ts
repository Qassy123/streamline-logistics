import type { Driver } from "@prisma/client";

// Kept as a compatibility export. Dispatch explicitly assigns work in Admin → Drivers.
export async function assignRandomAvailableDriverToBooking(_bookingId: string): Promise<Driver | null> {
  return null;
}
