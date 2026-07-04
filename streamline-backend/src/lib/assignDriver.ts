import { BookingStatus } from "@prisma/client";
import { prisma } from "./prisma";

const ACTIVE_DRIVER_BOOKING_STATUSES = [
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
];

export async function assignRandomAvailableDriverToBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) return null;
  if (booking.driverId) return null;

  const drivers = await prisma.driver.findMany({
    where: {
      active: true,
      availability: "AVAILABLE",
      bookings: {
        none: {
          status: {
            in: ACTIVE_DRIVER_BOOKING_STATUSES,
          },
          estimatedStartTime: booking.estimatedEndTime
            ? {
                lt: booking.estimatedEndTime,
              }
            : undefined,
          estimatedEndTime: booking.estimatedStartTime
            ? {
                gt: booking.estimatedStartTime,
              }
            : undefined,
        },
      },
    },
  });

  if (drivers.length === 0) {
    console.warn(`No available driver found for booking ${booking.reference}`);
    return null;
  }

  const selectedDriver = drivers[Math.floor(Math.random() * drivers.length)];

  const updatedBooking = await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      driverId: selectedDriver.id,
      status: BookingStatus.ASSIGNED,
      trackingEvents: {
        create: {
          status: BookingStatus.ASSIGNED,
          title: "Driver assigned",
          description: "A driver has been assigned to this booking.",
          userVisible: true,
        },
      },
    },
    include: {
      driver: true,
    },
  });

  return updatedBooking.driver;
}