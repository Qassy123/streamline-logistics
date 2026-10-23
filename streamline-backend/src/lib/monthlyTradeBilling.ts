import { reserveInvoiceNumber } from "./invoiceNumber";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { tradeMonth, ukParts, ukMidnight, TRADE_PAYMENT_TERMS } from "./billingPolicy";
export async function processMonthlyTradeBilling(now = new Date()) {
  const current = ukParts(now), cutoff = ukMidnight(current.year, current.month, 1);
  const candidates = await prisma.booking.findMany({ where: { archivedCustomerId: null, createdAt: { lt: cutoff }, status: "COMPLETED", OR: [{billingAccountType:"TRADE"},{billingAccountType:null,user:{is:{accountType:"TRADE"}}}], invoices: { none: {} }, invoiceBookings: { none: {} } }, select: { id: true, userId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const groups = new Map<string, { userId: string; month: ReturnType<typeof tradeMonth> }>();
  for (const b of candidates) if (b.userId) { const month = tradeMonth(b.createdAt); groups.set(`${b.userId}:${month.key}`, { userId: b.userId, month }); }
  const created: { invoiceId: string; invoiceNumber: string; userId: string; bookingCount: number; month: string }[] = [], failures: { userId: string; error: string }[] = [];
  for (const { userId, month } of groups.values()) {
    try {
      const result = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121012)`;
        const user = await tx.user.findUnique({ where: { id: userId }, include: { billingProfile: true } });
        if (!user) return null;
        const bookings = await tx.booking.findMany({ where: { userId, OR:[{billingAccountType:"TRADE"},{billingAccountType:null,user:{is:{accountType:"TRADE"}}}], archivedCustomerId: null, createdAt: { gte: month.start, lt: month.end }, status: "COMPLETED", invoices: { none: {} }, invoiceBookings: { none: {} } }, orderBy: { createdAt: "asc" } });
        if (!bookings.length) return null;
        if (user.billingProfile?.poRequired && bookings.some(b => !b.purchaseOrderNumber)) throw new Error("Required PO reference missing; correct the booking and retry monthly billing.");
        const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" } });
        if (!settings) throw new Error("Configure company settings first.");
        const invoiceNumber = await reserveInvoiceNumber(tx, settings.id);
        const vatRate = new Prisma.Decimal(settings.vatRate);
        const items = bookings.map(booking => { const gross = new Prisma.Decimal(booking.totalPrice).toDecimalPlaces(2); const net = vatRate.greaterThan(0) ? gross.div(new Prisma.Decimal(1).add(vatRate.div(100))).toDecimalPlaces(2) : gross; return { booking, gross, net, vat: gross.sub(net) }; });
        const sum = (key: "gross" | "net" | "vat") => items.reduce((n, item) => n.add(item[key]), new Prisma.Decimal(0));
        const invoice = await tx.invoice.create({ data: { invoiceNumber, userId, billingAccountType:"TRADE", status: "DRAFT", invoiceType: bookings.length > 1 ? "CONSOLIDATED" : "SINGLE", issuedAt: month.issueDate, dueDate: month.dueDate, paymentTerms: TRADE_PAYMENT_TERMS, subtotal: sum("net"), vatAmount: sum("vat"), total: sum("gross"), ...(bookings.length === 1 ? { bookingId: bookings[0].id } : {}) } });
        for (const { booking: b, gross, net, vat } of items) {
          await tx.invoiceBooking.create({ data: { invoiceId: invoice.id, bookingId: b.id, bookingReference: b.reference, bookingDate: b.collectionDate, routeDescription: `${b.collectionAddress} → ${b.deliveryAddress}`, serviceDescription: b.vehicleType || "Courier service", poReference: b.purchaseOrderNumber, netAmount: net, vatAmount: vat, grossAmount: gross } });
          await tx.invoiceLine.create({ data: { invoiceId: invoice.id, bookingId: b.id, chargeType: "BASE_SERVICE", description: `Courier service · ${b.reference}`, quantity: new Prisma.Decimal(1), unitPrice: net, netAmount: net, vatRate, vatAmount: vat, grossAmount: gross, bookingReference: b.reference, sourceType: "BOOKING", sourceId: b.id } });
        }
        await tx.invoiceAuditEvent.create({ data: { invoiceId: invoice.id, eventType: "DRAFT_CREATED", description: `Monthly trade invoice for bookings made in ${month.key}; issued on the 1st, due on the 15th.`, metadata: { bookingMonth: month.key, automaticBillingCycle: true, bookingCount: bookings.length } } });
        return { invoiceId: invoice.id, invoiceNumber, userId, bookingCount: bookings.length, month: month.key };
      }, { timeout: 60000 });
      if (result) created.push(result);
    } catch (error) { failures.push({ userId, error: error instanceof Error ? error.message : "Monthly billing failed." }); }
  }
  return { success: failures.length === 0, processedAt: now.toISOString(), created, skipped: [], failures };
}
