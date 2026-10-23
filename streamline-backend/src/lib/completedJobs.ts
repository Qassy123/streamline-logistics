import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
export async function reviewJob(id: string, action: "COMPLETE" | "CANCEL", reason: string) {
  if (!id || reason.trim().length < 5) throw new Error("Enter a reason of at least five characters.");
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121012)`;
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const booking = await tx.booking.findUnique({ where: { id }, include: { user: true, payments: true } });
    if (!booking || booking.archivedCustomerId) throw new Error("Job not found.");
    const status = action === "COMPLETE" ? "COMPLETED" : "CANCELLED";
    if (booking.status === status) return booking;
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(booking.status)) throw new Error("This job already has a final outcome.");
    if (action === "COMPLETE" && booking.status === "PENDING_PAYMENT") throw new Error("Payment must be confirmed before completing this job.");
    if (action === "COMPLETE" && booking.user?.accountType === "BUSINESS") {
      const paid = booking.payments.filter(p => p.status === "PAID").reduce((n,p) => n.add(p.amount), new Prisma.Decimal(0));
      if (paid.lessThan(booking.totalPrice)) throw new Error("Business bookings must be paid in full before work is confirmed.");
    }
    const updated = await tx.booking.update({ where: { id }, data: { status, trackingEndedAt: new Date(), trackingEvents: { create: { status, title: action === "COMPLETE" ? "Job completed by admin" : "Job cancelled by admin", description: reason.trim(), userVisible: true } } } });
    if (action === "CANCEL") await tx.vehicleReservation.updateMany({ where: { bookingId: id, status: { in: ["ACTIVE", "CONFIRMED"] } }, data: { status: "CANCELLED", expiresAt: null } });
    await tx.auditLog.create({ data: { action: action === "COMPLETE" ? "JOB_COMPLETED" : "JOB_CANCELLED", entityType: "Booking", entityId: id, reason: reason.trim(), oldValue: { status: booking.status }, newValue: { status } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
