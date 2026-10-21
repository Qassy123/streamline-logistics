import { Prisma } from "@prisma/client";
export function fiveYearsAfter(deletedAt: Date) {
  const until = new Date(deletedAt); until.setUTCFullYear(until.getUTCFullYear() + 5); return until;
}
export async function archiveAndDeleteCustomer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId }, include: { tradeAccount: true, billingProfile: true, notes: true, documents: true, emailLogs: true, savedRoutes: true } });
  if (!user) throw new Error("Customer account not found.");
  const { passwordHash: _password, ...account } = user;
  const decisionEmails = await tx.tradeDecisionEmail.findMany({ where: { userId } });
  const snapshot = { ...account, decisionEmails };
  const deletedAt = new Date(), retainUntil = fiveYearsAfter(deletedAt);
  const archive = await tx.customerArchive.create({ data: { originalUserId: user.id, deletedAt, retainUntil, snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue } });
  const where = { userId }, data = { userId: null, archivedCustomerId: archive.id };
  await tx.quote.updateMany({ where, data });
  await tx.booking.updateMany({ where, data: { ...data, trackingShareTokenHash: null, trackingShareExpiresAt: null } });
  await tx.invoice.updateMany({ where, data });
  await tx.payment.updateMany({ where, data });
  await tx.tradeDecisionEmail.deleteMany({ where });
  await tx.userSession.deleteMany({ where });
  await tx.passwordResetToken.deleteMany({ where });
  await tx.savedRoute.deleteMany({ where });
  await tx.customerNote.deleteMany({ where });
  await tx.billingProfile.deleteMany({ where });
  await tx.tradeAccount.deleteMany({ where });
  await tx.creditOverride.deleteMany({ where });
  await tx.user.delete({ where: { id: userId } });
  return { archiveId: archive.id, retainUntil };
}
