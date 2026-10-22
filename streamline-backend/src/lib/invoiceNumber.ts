import { Prisma } from "@prisma/client";
export function shortInvoiceNumber(number: number) {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Invalid invoice counter.");
  return String(number).padStart(2, "0");
}
export async function reserveInvoiceNumber(tx: Prisma.TransactionClient, settingsId: string) {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const counter = await tx.companySettings.update({ where: { id: settingsId }, data: { nextInvoiceNumber: { increment: 1 } }, select: { nextInvoiceNumber: true } });
    const invoiceNumber = shortInvoiceNumber(counter.nextInvoiceNumber - 1);
    if (!await tx.invoice.findUnique({ where: { invoiceNumber }, select: { id: true } })) return invoiceNumber;
  }
  throw new Error("Unable to reserve a unique invoice number. Check the invoice counter.");
}
