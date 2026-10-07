import { Prisma } from "@prisma/client";

export type ManualInvoiceDetails = {
  recipientName: string;
  recipientEmail: string;
  recipientAddress: string;
  recipientPhone: string;
  invoiceDate: string;
};

export function getManualInvoiceDetails(invoice: {
  auditEvents?: { eventType: string; metadata: Prisma.JsonValue | null }[];
}): ManualInvoiceDetails | null {
  const events = invoice.auditEvents || [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!["MANUAL_INVOICE_CREATED", "MANUAL_INVOICE_UPDATED"].includes(event.eventType)) continue;
    const value = event.metadata;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (typeof value.recipientName !== "string" || typeof value.recipientEmail !== "string" || typeof value.recipientAddress !== "string" || typeof value.invoiceDate !== "string") continue;
    return {
      recipientName: value.recipientName,
      recipientEmail: value.recipientEmail,
      recipientAddress: value.recipientAddress,
      recipientPhone: typeof value.recipientPhone === "string" ? value.recipientPhone : "",
      invoiceDate: value.invoiceDate,
    };
  }
  return null;
}

function text(value: unknown, label: string, maximum: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > maximum) throw new Error(`${label} is required and must be no longer than ${maximum} characters.`);
  return result;
}

function calendarDate(value: unknown, label: string, required = false) {
  const result = text(value, label, 10, required);
  if (!result) return null;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new Error(`${label} must be a valid date.`);
  return parsed;
}

function decimal(value: unknown, label: string, maximum: number, places: number) {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+(\.\d+)?$/.test(String(value))) throw new Error(`${label} must be a valid non-negative number.`);
  const parsed = new Prisma.Decimal(value);
  if (!parsed.isFinite() || parsed.lessThan(0) || parsed.greaterThan(maximum) || parsed.decimalPlaces() > places) throw new Error(`${label} must be between 0 and ${maximum}, with at most ${places} decimal places.`);
  return parsed;
}

export function parseManualInvoiceInput(body: Record<string, unknown>) {
  const recipientName = text(body.recipientName, "Recipient name", 150, true);
  const recipientEmail = text(body.recipientEmail, "Recipient email", 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Enter a valid recipient email address.");
  const recipientAddress = text(body.recipientAddress, "Billing address", 500, true);
  const recipientPhone = text(body.recipientPhone, "Recipient phone", 50);
  const invoiceDate = calendarDate(body.invoiceDate, "Invoice date", true)!;
  const dueDate = calendarDate(body.dueDate, "Due date", true)!;
  const supplyDate = calendarDate(body.supplyDate, "Supply date", true)!;
  if (dueDate < invoiceDate) throw new Error("Due date cannot be before the invoice date.");
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) throw new Error("Add between 1 and 50 invoice lines.");
  const lines = body.lines.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invoice line is invalid.");
    const line = item as Record<string, unknown>;
    const description = text(line.description, `Line ${index + 1} description`, 500, true);
    const quantity = decimal(line.quantity, `Line ${index + 1} quantity`, 100000, 3);
    if (quantity.lessThanOrEqualTo(0)) throw new Error(`Line ${index + 1} quantity must be greater than zero.`);
    const unitPrice = decimal(line.unitPrice, `Line ${index + 1} unit price`, 1000000, 2);
    const vatRate = decimal(line.vatRate, `Line ${index + 1} VAT rate`, 100, 2);
    const netAmount = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const vatAmount = netAmount.mul(vatRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { description, quantity, unitPrice, vatRate, netAmount, vatAmount, grossAmount: netAmount.add(vatAmount), chargeType: "OTHER" as const, sourceType: "MANUAL" };
  });
  const subtotal = lines.reduce((sum, line) => sum.add(line.netAmount), new Prisma.Decimal(0));
  const vatAmount = lines.reduce((sum, line) => sum.add(line.vatAmount), new Prisma.Decimal(0));
  const total = subtotal.add(vatAmount);
  if (total.lessThanOrEqualTo(0)) throw new Error("Invoice total must be greater than zero.");
  return {
    userId: text(body.userId, "Customer account", 100) || null,
    recipient: { recipientName, recipientEmail, recipientAddress, recipientPhone, invoiceDate: invoiceDate.toISOString().slice(0, 10) },
    invoiceDate, dueDate, supplyDate,
    customerReference: text(body.customerReference, "Customer reference", 100) || null,
    purchaseOrderNumber: text(body.purchaseOrderNumber, "Purchase order", 100) || null,
    paymentTerms: text(body.paymentTerms, "Payment terms", 150, true),
    notes: text(body.notes, "Notes", 2000) || null,
    lines, subtotal, vatAmount, total,
  };
}
