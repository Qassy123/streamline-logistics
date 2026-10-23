import { Prisma } from "@prisma/client";
import { reserveInvoiceNumber } from "./invoiceNumber";
import { tradeMonth, TRADE_PAYMENT_TERMS } from "./billingPolicy";
type Tx = Prisma.TransactionClient;
const zero = () => new Prisma.Decimal(0);
export async function bookingInvoices(tx: Tx, bookingId: string) { return tx.invoice.findMany({ where: { OR: [{ bookingId }, { invoiceBookings: { some: { bookingId } } }], status: { notIn: ["VOID", "CANCELLED"] } }, include: { lines: true, invoiceBookings: true, creditNotes: true }, orderBy: { createdAt: "desc" } }); }
export async function createBookingCredit(tx: Tx, booking: {
    id: string;
    reference: string;
}, amount: Prisma.Decimal, reason: string, allowUninvoiced = false) {
    let remaining = amount;
    for (const invoice of await bookingInvoices(tx, booking.id)) {
        if (remaining.lessThanOrEqualTo(0))
            break;
        if (invoice.status === "DRAFT")
            continue;
        const credits = invoice.creditNotes.filter(note => note.status === "ISSUED");
        const totalCredits = credits.reduce((sum, note) => sum.add(note.amount), zero());
        const booked = invoice.invoiceBookings.find(join => join.bookingId === booking.id);
        const share = invoice.bookingId === booking.id ? invoice.total : booked?.grossAmount || invoice.lines.filter(line => line.bookingId === booking.id).reduce((sum, line) => sum.add(line.grossAmount), zero());
        const ownCredits = credits.filter(note => note.reason?.startsWith(`${booking.reference}:`)).reduce((sum, note) => sum.add(note.amount), zero());
        const available = Prisma.Decimal.max(0, Prisma.Decimal.min(invoice.total.sub(totalCredits), share.sub(ownCredits)));
        const value = Prisma.Decimal.min(remaining, available);
        if (value.lessThanOrEqualTo(0))
            continue;
        const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" } });
        if (!settings)
            throw new Error("Configure company settings first.");
        const counter = await tx.companySettings.update({ where: { id: settings.id }, data: { nextCreditNoteNumber: { increment: 1 } }, select: { nextCreditNoteNumber: true } });
        const number = `${settings.creditNotePrefix}-${String(counter.nextCreditNoteNumber - 1).padStart(6, "0")}`;
        await tx.creditNote.create({ data: { creditNoteNumber: number, invoiceId: invoice.id, amount: value, status: "ISSUED", reason: `${booking.reference}: ${reason}` } });
        await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "BOOKING_PRICE_CREDIT", description: `${number}: ${booking.reference} price correction`, metadata: { bookingId: booking.id, amount: value.toFixed(2), reason } } });
        remaining = remaining.sub(value);
    }
    if (remaining.greaterThan(0)) {
        if (!allowUninvoiced)
            throw new Error("The reduction exceeds the booking's remaining invoiced charges. Review existing credits first.");
        await tx.auditLog.create({ data: { action: "BOOKING_REFUND_WITHOUT_INVOICE_CREDIT", entityType: "Booking", entityId: booking.id, reason: "Original money returned; no remaining invoice charge to credit.", newValue: { amount: remaining.toFixed(2), reason } } });
    }
}
export async function syncTradeBookingPrice(tx: Tx, booking: {
    id: string;
    reference: string;
    userId: string | null;
    createdAt: Date;
}, oldTotal: Prisma.Decimal, newTotal: Prisma.Decimal, reason: string) {
    const delta = newTotal.sub(oldTotal);
    if (delta.equals(0))
        return;
    const invoices = await bookingInvoices(tx, booking.id);
    if (!invoices.length)
        return;
    let remaining = delta;
    const drafts = invoices.filter(invoice => invoice.status === "DRAFT");
    for (const draft of drafts) {
        if (remaining.equals(0))
            break;
        const booked = draft.invoiceBookings.find(join => join.bookingId === booking.id);
        const share = draft.bookingId === booking.id ? draft.total : booked?.grossAmount || draft.lines.filter(line => line.bookingId === booking.id).reduce((sum, line) => sum.add(line.grossAmount), zero());
        const correction = remaining.greaterThan(0) ? remaining : Prisma.Decimal.max(remaining, Prisma.Decimal.min(share, draft.total).negated());
        if (correction.equals(0))
            continue;
        const rate = draft.lines.find(line => line.bookingId === booking.id)?.vatRate || new Prisma.Decimal(20);
        const net = correction.div(new Prisma.Decimal(1).add(rate.div(100))).toDecimalPlaces(2), vat = correction.sub(net);
        await tx.invoiceLine.create({ data: { invoiceId: draft.id, bookingId: booking.id, bookingReference: booking.reference, chargeType: correction.lessThan(0) ? "DISCOUNT" : "OTHER", description: `Booking correction · ${booking.reference}: ${reason}`, quantity: 1, unitPrice: net, netAmount: net, vatRate: rate, vatAmount: vat, grossAmount: correction, sourceType: "BOOKING_CHANGE", sourceId: booking.id } });
        await tx.invoice.update({ where: { id: draft.id }, data: { subtotal: { increment: net }, vatAmount: { increment: vat }, total: { increment: correction }, checkedAt: null } });
        await tx.invoiceBooking.updateMany({ where: { invoiceId: draft.id, bookingId: booking.id }, data: { netAmount: { increment: net }, vatAmount: { increment: vat }, grossAmount: { increment: correction } } });
        await tx.invoiceAuditEvent.create({ data: { invoiceId: draft.id, eventType: "BOOKING_PRICE_UPDATED", description: `${booking.reference} corrected by £${correction.toFixed(2)}.`, metadata: { bookingId: booking.id, reason } } });
        remaining = remaining.sub(correction);
    }
    if (remaining.equals(0))
        return;
    if (remaining.lessThan(0))
        await createBookingCredit(tx, booking, remaining.abs(), reason);
    else {
        const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" } });
        if (!settings)
            throw new Error("Configure company settings first.");
        const invoiceNumber = await reserveInvoiceNumber(tx, settings.id), rate = settings.vatRate;
        const net = delta.div(new Prisma.Decimal(1).add(rate.div(100))).toDecimalPlaces(2), vat = delta.sub(net), month = tradeMonth(booking.createdAt);
        await tx.invoice.create({ data: { invoiceNumber, userId: booking.userId, bookingId: booking.id, billingAccountType: "TRADE", status: "DRAFT", invoiceType: "SINGLE", subtotal: net, vatAmount: vat, total: delta, issuedAt: month.issueDate, dueDate: month.dueDate, paymentTerms: TRADE_PAYMENT_TERMS, notes: `Additional charge for ${booking.reference}; original issued invoices are retained.`, lines: { create: { bookingId: booking.id, bookingReference: booking.reference, chargeType: "OTHER", description: `Additional booking charge: ${reason}`, quantity: 1, unitPrice: net, netAmount: net, vatRate: rate, vatAmount: vat, grossAmount: delta, sourceType: "BOOKING_CHANGE", sourceId: booking.id } }, auditEvents: { create: { eventType: "BOOKING_ADDITIONAL_CHARGE", description: reason, metadata: { bookingId: booking.id } } } } });
    }
}
export async function refreshTradeBalance(tx: Tx, userId: string) {
    const invoices = await tx.invoice.findMany({ where: { userId, status: { notIn: ["PAID", "VOID", "CREDITED", "CANCELLED"] } }, include: { allocations: true, creditNotes: true } });
    let exposure = invoices.reduce((sum, invoice) => { const paid = invoice.allocations.reduce((n, p) => n.add(p.amount), zero()); const credited = invoice.creditNotes.filter(n => n.status === "ISSUED").reduce((n, p) => n.add(p.amount), zero()); return sum.add(Prisma.Decimal.max(0, invoice.total.sub(paid).sub(credited))); }, zero());
    const open = await tx.booking.aggregate({ where: { userId, status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] }, invoices: { none: {} }, invoiceBookings: { none: {} } }, _sum: { totalPrice: true } });
    exposure = exposure.add(open._sum.totalPrice || 0);
    await tx.tradeAccount.updateMany({ where: { userId }, data: { currentBalance: exposure } });
    return exposure;
}
export async function queueBusinessRefund(tx: Tx, booking: {
    id: string;
    reference: string;
    totalPrice: Prisma.Decimal;
}, reason: string) {
    const refunds = await tx.bookingRefund.findMany({ where: { bookingId: booking.id } });
    if (refunds.some(row => ["PROCESSING", "APPROVED_MANUAL"].includes(row.status)))
        throw new Error("Finish the approved refund before changing this booking's price again.");
    await tx.bookingRefund.updateMany({ where: { bookingId: booking.id, status: { in: ["PENDING_APPROVAL", "FAILED"] } }, data: { status: "CANCELLED" } });
    const payments = await tx.payment.findMany({ where: { bookingId: booking.id, status: "PAID" }, orderBy: { createdAt: "desc" } });
    const refunded = refunds.filter(row => row.status === "SUCCEEDED");
    let remaining = payments.reduce((sum, p) => sum.add(p.amount), zero()).sub(refunded.reduce((sum, row) => sum.add(row.amount), zero())).sub(booking.totalPrice);
    for (const payment of payments) {
        if (remaining.lessThanOrEqualTo(0))
            break;
        const spent = refunded.filter(row => row.paymentId === payment.id).reduce((sum, row) => sum.add(row.amount), zero());
        const amount = Prisma.Decimal.min(remaining, payment.amount.sub(spent));
        if (amount.lessThanOrEqualTo(0))
            continue;
        if (payment.currency.toUpperCase() !== "GBP")
            throw new Error("Review the original payment currency before requesting this refund.");
        await tx.bookingRefund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount, currency: payment.currency, method: payment.provider.toLowerCase() === "stripe" ? "STRIPE" : payment.paymentMethod === "BANK_TRANSFER" ? "BACS" : "MANUAL", reason, status: "PENDING_APPROVAL" } });
        remaining = remaining.sub(amount);
    }
}
