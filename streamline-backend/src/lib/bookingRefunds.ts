import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { createBookingCredit } from "./bookingFinance";
async function lockedRefund(tx: Prisma.TransactionClient, bookingId: string, id: string) {
    await tx.$queryRaw `SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const row = await tx.bookingRefund.findUnique({ where: { id }, include: { payment: true, booking: true } });
    if (!row || row.bookingId !== bookingId)
        throw new Error("Refund request not found.");
    return row;
}
export async function approveBookingRefund(bookingId: string, id: string) {
    const row = await prisma.$transaction(async (tx) => {
        const row = await lockedRefund(tx, bookingId, id);
        if (["SUCCEEDED", "APPROVED_MANUAL"].includes(row.status))
            return row;
        if (!["PENDING_APPROVAL", "PROCESSING", "FAILED"].includes(row.status))
            throw new Error("This refund request is no longer available for approval.");
        if (row.payment.status !== "PAID" || row.payment.bookingId !== bookingId)
            throw new Error("The original confirmed payment is required.");
        const payments = await tx.payment.findMany({ where: { bookingId, status: "PAID" } });
        const committed = await tx.bookingRefund.findMany({ where: { bookingId, id: { not: id }, status: { in: ["SUCCEEDED", "PROCESSING", "APPROVED_MANUAL"] } } });
        const paid = payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
        const owed = paid.sub(row.booking.totalPrice).sub(committed.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0)));
        const originalRemaining = row.payment.amount.sub(committed.filter(refund => refund.paymentId === row.paymentId).reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0)));
        if (row.amount.greaterThan(originalRemaining))
            throw new Error("The refund exceeds the original payment's remaining refundable amount.");
        if (row.amount.greaterThan(owed))
            throw new Error("The booking price/refund changed. Refresh before approving.");
        if (row.method !== "STRIPE") {
            if (row.status !== "PENDING_APPROVAL")
                throw new Error("Review the current manual-refund status.");
            await createBookingCredit(tx, row.booking, row.amount, `Refund approved for manual return by original payment method (${row.id}).`, true);
            await tx.bookingRefund.update({ where: { id }, data: { status: "APPROVED_MANUAL", approvedAt: new Date(), lastError: null } });
            await tx.auditLog.create({ data: { action: "BOOKING_REFUND_APPROVED_MANUAL", entityType: "Booking", entityId: bookingId, reason: row.reason, newValue: { refundId: id, amount: row.amount.toFixed(2), method: row.method } } });
            return { ...row, status: "APPROVED_MANUAL" };
        }
        if (!process.env.STRIPE_SECRET_KEY)
            throw new Error("Stripe refund processing is not configured.");
        if (row.currency.toUpperCase() !== "GBP" || row.payment.provider.toLowerCase() !== "stripe")
            throw new Error("Review the original payment currency and provider.");
        await tx.bookingRefund.update({ where: { id }, data: { status: "PROCESSING", approvedAt: row.approvedAt || new Date(), lastError: null } });
        return { ...row, status: "PROCESSING" };
    });
    if (row.method !== "STRIPE" || row.status === "SUCCEEDED")
        return row;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let refund: Awaited<ReturnType<typeof stripe.refunds.retrieve>>;
    try {
        if (row.providerRefundId)
            refund = await stripe.refunds.retrieve(row.providerRefundId);
        else {
            const originalId = row.payment.providerPaymentId;
            if (!originalId)
                throw new Error("Original Stripe payment reference missing.");
            let paymentIntent: string;
            if (originalId.startsWith("cs_")) {
                const session = await stripe.checkout.sessions.retrieve(originalId);
                if (session.payment_status !== "paid" || session.metadata?.quoteId !== row.booking.quoteId || session.currency?.toUpperCase() !== row.currency || session.amount_total !== Math.round(Number(row.payment.amount) * 100))
                    throw new Error("Original Stripe checkout does not match this booking payment.");
                paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
            }
            else if (originalId.startsWith("pi_")) {
                const intent = await stripe.paymentIntents.retrieve(originalId);
                if (intent.status !== "succeeded" || intent.currency.toUpperCase() !== row.currency || intent.amount_received < Math.round(Number(row.payment.amount) * 100))
                    throw new Error("Original Stripe payment does not match the recorded payment.");
                paymentIntent = intent.id;
            }
            else
                throw new Error("Review the original Stripe payment reference.");
            if (!paymentIntent)
                throw new Error("Original Stripe payment intent missing.");
            refund = await stripe.refunds.create({ payment_intent: paymentIntent, amount: Math.round(Number(row.amount) * 100), metadata: { bookingId, bookingRefundId: id } }, { idempotencyKey: `booking-refund-${id}` });
        }
    }
    catch {
        await prisma.bookingRefund.updateMany({ where: { id, status: "PROCESSING" }, data: { lastError: "Stripe has not confirmed the refund. Check/retry this same request; do not create another refund manually until the original is verified." } });
        throw new Error("Stripe has not confirmed the refund. Use Check / retry to safely reconcile the same refund request.");
    }
    return prisma.$transaction(async (tx) => {
        const current = await lockedRefund(tx, bookingId, id);
        if (current.status === "SUCCEEDED")
            return current;
        const status = refund.status === "succeeded" ? "SUCCEEDED" : ["failed", "canceled"].includes(refund.status || "") ? "FAILED" : "PROCESSING";
        if (status === "SUCCEEDED")
            await createBookingCredit(tx, current.booking, current.amount, `Refund returned through original Stripe payment (${id}).`, true);
        const updated = await tx.bookingRefund.update({ where: { id }, data: { status, providerRefundId: refund.id, completedAt: status === "SUCCEEDED" ? new Date() : null, lastError: status === "FAILED" ? "Stripe reports that this refund failed. Review the payment in Stripe." : null } });
        await tx.auditLog.create({ data: { action: `BOOKING_REFUND_${status}`, entityType: "Booking", entityId: bookingId, reason: current.reason, newValue: { refundId: id, providerRefundId: refund.id, amount: current.amount.toFixed(2) } } });
        return updated;
    });
}
export async function completeManualBookingRefund(bookingId: string, id: string, reference: string) {
    if (reference.trim().length < 3 || reference.length > 150)
        throw new Error("Enter the bank/payment refund reference.");
    return prisma.$transaction(async (tx) => {
        const row = await lockedRefund(tx, bookingId, id);
        if (row.status === "SUCCEEDED")
            return row;
        if (row.method === "STRIPE" || row.status !== "APPROVED_MANUAL")
            throw new Error("Only an approved manual refund can be recorded as completed.");
        const updated = await tx.bookingRefund.update({ where: { id }, data: { status: "SUCCEEDED", manualReference: reference.trim(), completedAt: new Date() } });
        await tx.auditLog.create({ data: { action: "BOOKING_MANUAL_REFUND_RECORDED", entityType: "Booking", entityId: bookingId, reason: reference.trim(), newValue: { refundId: id, amount: row.amount.toFixed(2), method: row.method } } });
        return updated;
    });
}
