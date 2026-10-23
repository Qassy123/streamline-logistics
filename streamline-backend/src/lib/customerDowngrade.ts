import { Prisma } from "@prisma/client";
export async function downgradeCustomer(tx: Prisma.TransactionClient, userId: string, reason: string) {
    await tx.$executeRaw `SELECT pg_advisory_xact_lock(73121012)`;
    await tx.$queryRaw `SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error("Customer account not found.");
    if (user.accountType === "TRADE") {
        await tx.booking.updateMany({ where: { userId, billingAccountType: null }, data: { billingAccountType: "TRADE" } });
        const invoices = await tx.invoice.findMany({ where: { userId, billingAccountType: null }, include: { auditEvents: true } });
        for (const invoice of invoices)
            await tx.invoice.update({ where: { id: invoice.id }, data: { billingAccountType: invoice.auditEvents.some(event => event.eventType === "PAY_NOW_INVOICE_CREATED") ? "BUSINESS" : "TRADE" } });
    }
    await tx.user.update({ where: { id: userId }, data: { accountType: "BUSINESS", accountStatus: "ACTIVE" } });
    const billing = { paymentMode: "PAY_NOW" as const, invoiceMode: "PER_BOOKING" as const, billingFrequency: "PER_BOOKING" as const, paymentTermsDays: 0, creditFacilityOnHold: false, holdReason: null };
    await tx.billingProfile.upsert({ where: { userId }, update: billing, create: { userId, ...billing } });
    await tx.auditLog.create({ data: { action: "CUSTOMER_DOWNGRADED_TO_BUSINESS", entityType: "User", entityId: userId, reason, oldValue: { accountType: user.accountType }, newValue: { accountType: "BUSINESS" } } });
}
