import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { centralAdminAccess } from "../lib/centralAdmin";
import { allocationBankHoliday, allocationCharges, allocationSurcharge, allocationInput, allocationWeekEnd, completionInput, refreshAllocationGroupTotals, nightPremium, nightSource, round } from "../lib/commercialAllocation";
import { calendarDate, contractMonthBounds, contractShiftTiming } from "../lib/commercialContracts";
import { reconcileDriverActivity } from "../lib/driverPortal";
import { assertPlan, fleetMutation } from "../lib/fleetOperations";
import { reserveInvoiceNumber } from "../lib/invoiceNumber";
import { renderCommercialAllocationInvoicePdf } from "../lib/invoicePdf";
import { prisma } from "../lib/prisma";
import { generateBookingReference } from "./bookings";
import { invoiceInclude, sendInvoiceEmail } from "./invoices";

const router = Router();
const zero = new Prisma.Decimal(0);
const shiftFilter = { commercialAllocation: { not: Prisma.DbNull } } satisfies Prisma.BookingWhereInput;
const allocationInvoice = { commercialPeriod: { not: null } } satisfies Prisma.InvoiceWhereInput;
const chargeFilter = { active: true, tariffId: null } satisfies Prisma.TariffChargeWhereInput;

async function settings(tx: Prisma.TransactionClient) {
  return tx.companySettings.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true, vatRate: true } });
}

async function lockCustomer(tx: Prisma.TransactionClient, customerId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;
}

function discountFilter(customerId: string): Prisma.DiscountRuleWhereInput {
  const now = new Date();
  return { active: true, AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    { OR: [{ customerId: null }, { customerId }] },
  ] };
}

router.use((req, res, next) => {
  const access = centralAdminAccess(req);
  if (!access.authorised) return res.status(access.status).json({ error: access.error });
  next();
});

router.get("/:customerId", async (req, res) => {
  const { customerId } = req.params;
  const assignment = await prisma.commercialTariffAssignment.findUnique({
    where: { customerId }, include: { tariff: { include: { rates: true } } },
  });
  const [shifts, invoices, charges, discounts, routeReferences] = await Promise.all([
    prisma.booking.findMany({ where: { userId: customerId, ...shiftFilter, status: { not: "CANCELLED" } },
      select: { id: true, reference: true, status: true, commercialAllocation: true }, orderBy: { collectionDate: "desc" } }),
    prisma.invoice.findMany({ where: { userId: customerId, ...allocationInvoice, status: { not: "VOID" } },
      select: { id: true, invoiceNumber: true, bookingId: true, invoiceType: true, status: true, total: true, commercialPeriod: true,
        commercialGroupId: true, commercialEmailStage: true, supplyDate: true,
        lines: { select: { id: true, description: true, quantity: true, grossAmount: true }, orderBy: { createdAt: "asc" } }, adjustments: { select: { id: true, name: true, netAmount: true } } },
      orderBy: { createdAt: "desc" } }),
    prisma.tariffCharge.findMany({ where: chargeFilter, orderBy: { name: "asc" } }),
    prisma.discountRule.findMany({ where: discountFilter(customerId), orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: { userId: customerId, ...shiftFilter, customerReference: { not: null } },
      select: { customerReference: true }, distinct: ["customerReference"], orderBy: { customerReference: "asc" } }),
  ]);
  if (!assignment && !shifts.length && !invoices.length) return res.status(404).json({ error: "Commercial account not found." });
  return res.json({ tariff: assignment?.tariff ?? null, shifts, invoices, charges, discounts,
    routeReferences: routeReferences.map(row => row.customerReference) });
});

router.get("/:customerId/lookup", async (req, res) => {
  const query = String(req.query.q ?? "").trim().slice(0, 100);
  if (query.length < 3) return res.json({ options: [] });
  if (!(await prisma.commercialTariffAssignment.findUnique({ where: { customerId: req.params.customerId } }))) {
    return res.status(404).json({ error: "Commercial account not found." });
  }
  if (req.query.kind === "driver") {
    const rows = await prisma.driver.findMany({ where: { name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true }, orderBy: { name: "asc" }, take: 20 });
    return res.json({ options: rows.map(row => ({ id: row.id, label: row.name })) });
  }
  const rows = await prisma.vehicle.findMany({ where: { registration: { contains: query, mode: "insensitive" } },
    select: { id: true, registration: true, vehicleType: true }, orderBy: { registration: "asc" }, take: 20 });
  return res.json({ options: rows.map(row => ({ id: row.id, label: row.registration, vehicleType: row.vehicleType })) });
});

router.post("/:customerId/shifts", async (req, res) => {
  const parsed = allocationInput.safeParse(req.body);
  const requestId = z.string().uuid().safeParse(req.body?.requestId);
  if (!parsed.success || !requestId.success) return res.status(400).json({ error: "Enter the shift details, date and start time." });
  const { customerId } = req.params;
  const shift = parsed.data;
  shift.driverId ||= undefined;
  shift.vehicleId ||= undefined;
  const day = calendarDate(shift.startDate);
  const timing = contractShiftTiming(day, shift.startTime, shift.hours);
  const access = centralAdminAccess(req);
  const result = await prisma.$transaction(async tx => {
    await lockCustomer(tx, customerId);
    const existing = await tx.booking.findFirst({ where: { id: requestId.data, userId: customerId, ...shiftFilter } });
    if (existing) return existing;
    const customer = await tx.user.findUniqueOrThrow({ where: { id: customerId }, include: {
      commercialTariffAssignment: { include: { tariff: { include: { rates: true } } } },
    } });
    if (!customer.commercialTariffAssignment || customer.accountStatus !== "ACTIVE") throw new Error("Select an active commercial account.");
    const registration = shift.registration.toUpperCase();
    const vehicle = shift.vehicleId ? await tx.vehicle.findUniqueOrThrow({ where: { id: shift.vehicleId } })
      : registration ? await tx.vehicle.findFirst({ where: { registration: { equals: registration, mode: "insensitive" } } }) : null;
    const driver = shift.driverId ? await tx.driver.findUniqueOrThrow({ where: { id: shift.driverId } }) : null;
    shift.vehicleType = vehicle?.vehicleType || shift.vehicleType;
    shift.registration = vehicle?.registration || registration;
    shift.driverName = driver?.name || shift.driverName;
    const rate = customer.commercialTariffAssignment.tariff.rates.find(row => row.vehicleType === shift.vehicleType);
    if (!rate) throw new Error("Save rates for this vehicle category first.");
    const fare = shift.hours === 8 ? rate.fare8Hours : rate.fare12Hours;
    const night = nightPremium(timing.estimatedStartTime!, timing.estimatedEndTime!, fare, shift.hours, rate.nightHoursPercent);
    const netFare = fare.add(night.amount);
    const company = await settings(tx);
    if (driver || vehicle) {
      await fleetMutation(tx, access.admin ? { id: access.admin.id, label: access.admin.name } : undefined, "Commercial shift allocation");
      await assertPlan(tx, { bookingId: requestId.data, driverId: driver?.id, vehicleId: vehicle?.id,
        startsAt: timing.estimatedStartTime!, endsAt: timing.estimatedEndTime! });
    }
    return tx.booking.create({ data: {
      id: requestId.data, reference: await generateBookingReference(tx), userId: customerId,
      status: driver ? "ASSIGNED" : "CONFIRMED", driverId: driver?.id, vehicleId: vehicle?.id,
      driverAssignedAt: driver ? new Date() : null, vehicleAssignedAt: vehicle ? new Date() : null,
      createdByAdminId: access.admin?.id, assignedByAdminId: access.admin?.id,
      collectionDate: day, ...timing, collectionAddress: "", deliveryAddress: "", vehicleType: shift.vehicleType,
      customerReference: shift.routeReference || null, totalPrice: netFare.add(round(netFare.mul(company.vatRate).div(100))),
      commercialAllocation: { ...shift, driverId: driver?.id ?? null, vehicleId: vehicle?.id ?? null },
      ...(vehicle ? { reservation: { create: { vehicleId: vehicle.id, status: "CONFIRMED",
        reservedFrom: timing.estimatedStartTime!, reservedUntil: timing.estimatedEndTime! } } } : {}),
    } });
  });
  return res.status(201).json({ id: result.id, reference: result.reference });
});

router.post("/:customerId/shifts/:id/cancel", async (req, res) => {
  const { customerId, id } = req.params;
  await prisma.$transaction(async tx => {
    await lockCustomer(tx, customerId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`;
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const shift = await tx.booking.findFirstOrThrow({ where: { id, userId: customerId, ...shiftFilter } });
    if (shift.status === "CANCELLED") return;
    if (shift.status === "COMPLETED" || await tx.invoice.count({ where: { bookingId: id, ...allocationInvoice } })) {
      throw new Error("A completed or invoiced shift cannot be cancelled.");
    }
    await fleetMutation(tx, undefined, "Commercial shift cancelled");
    await tx.booking.update({ where: { id }, data: { status: "CANCELLED", trackingEndedAt: new Date() } });
    await tx.vehicleReservation.updateMany({ where: { bookingId: id }, data: { status: "CANCELLED", expiresAt: null } });
    if (shift.driverId) await reconcileDriverActivity(tx, shift.driverId);
  });
  return res.json({ success: true });
});

async function pricedShift(tx: Prisma.TransactionClient, customerId: string, booking: { id: string; reference: string },
  shift: z.infer<typeof allocationInput>, finish: z.infer<typeof completionInput>, holiday: boolean) {
  const tariff = await tx.commercialTariffAssignment.findUniqueOrThrow({ where: { customerId } });
  const rate = await tx.commercialTariffRate.findUniqueOrThrow({ where: { tariffId_vehicleType: { tariffId: tariff.tariffId, vehicleType: shift.vehicleType } } });
  const company = await settings(tx);
  const calculated = allocationCharges(shift, finish, rate, holiday);
  const lines: Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput[] = [];
  function addLine(description: string, quantity: Prisma.Decimal, unitPrice: Prisma.Decimal, vatRate: Prisma.Decimal,
    chargeType: Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput["chargeType"], netAmount = round(quantity.mul(unitPrice))) {
    const vatAmount = round(netAmount.mul(vatRate).div(100));
    lines.push({ bookingId: booking.id, bookingReference: booking.reference, description, quantity, unitPrice,
      chargeType, netAmount, vatRate, vatAmount, grossAmount: netAmount.add(vatAmount), sourceType: "COMMERCIAL_ALLOCATION" });
  }
  const net = () => lines.reduce((sum, line) => sum.add(line.netAmount as Prisma.Decimal), zero);
  for (const line of calculated.charges) addLine(line.description, line.quantity, line.unitPrice, company.vatRate, line.chargeType);
  for (const [chargeId, requestedQuantity, role] of [
    [finish.waitingId, finish.waitingHours, "WAITING"],
    [finish.loadingId, 1, "LOADING"],
    [finish.additionalId, finish.additionalQuantity, "OTHER"],
    ...finish.additions.map(charge => [charge.id, charge.quantity, "OTHER"] as const),
  ] as const) {
    if (!chargeId) continue;
    const charge = await tx.tariffCharge.findFirstOrThrow({ where: { ...chargeFilter, id: chargeId } });
    if (role === "WAITING" && (charge.calculation !== "PER_HOUR" || charge.type !== "WAITING" && !/waiting/i.test(charge.name))) {
      throw new Error("Select an hourly waiting charge.");
    }
    const quantity = new Prisma.Decimal(["PER_HOUR", "PER_MILE", "PER_STOP"].includes(charge.calculation) ? requestedQuantity : 1);
    const amount = charge.calculation === "PERCENTAGE" ? round(net().mul(charge.amount).div(100)) : round(quantity.mul(charge.amount));
    addLine(charge.name, quantity, charge.amount, charge.vatApplicable ? company.vatRate : zero, role === "WAITING" ? "WAITING" : "OTHER", amount);
  }
  if (finish.discountId) {
    const discount = await tx.discountRule.findFirstOrThrow({ where: { ...discountFilter(customerId), id: finish.discountId } });
    const amount = discount.type === "FIXED_AMOUNT" ? discount.value : round(net().mul(discount.value).div(100));
    const capped = Prisma.Decimal.min(net(), amount).neg();
    addLine(discount.name, new Prisma.Decimal(1), capped, company.vatRate, "DISCOUNT", capped);
  }
  if (calculated.surcharge) {
    const [label, percent] = calculated.surcharge;
    const base = lines.map(line => ({
      netAmount: line.netAmount as Prisma.Decimal, vatAmount: line.vatAmount as Prisma.Decimal, vatRate: line.vatRate as Prisma.Decimal,
    }));
    lines.push(...allocationSurcharge(base, `${label} (${percent}%)`, percent).map(line => ({
      ...line, bookingId: booking.id, bookingReference: booking.reference,
    })));
  }
  if (calculated.night.amount.gt(0)) {
    const { hours, percent, amount } = calculated.night;
    addLine(`Night premium · 22:00–06:00 · ${hours.toDecimalPlaces(4)} hours at ${percent}%`,
      new Prisma.Decimal(1), amount, company.vatRate, "OTHER", amount);
    lines[lines.length - 1].sourceType = nightSource;
  }
  const subtotal = net();
  const vatAmount = lines.reduce((sum, line) => sum.add(line.vatAmount as Prisma.Decimal), zero);
  const total = subtotal.add(vatAmount);
  if (subtotal.lt(0) || vatAmount.lt(0)) throw new Error("The selected charges and discounts would reduce the invoice below zero.");
  return { calculated, company, lines, subtotal, vatAmount, total };
}

router.post("/:customerId/shifts/:id/preview", async (req, res) => {
  const { customerId, id } = req.params;
  const finish = completionInput.parse(req.body);
  const booking = await prisma.booking.findFirstOrThrow({ where: { id, userId: customerId, ...shiftFilter, status: { not: "CANCELLED" } } });
  const shift = allocationInput.parse(booking.commercialAllocation);
  const holiday = await allocationBankHoliday(shift.startDate);
  const price = await pricedShift(prisma, customerId, booking, shift, finish, holiday);
  return res.json({ lines: price.lines, total: price.total });
});

router.post("/:customerId/shifts/:id/invoice", async (req, res) => {
  const { customerId, id } = req.params;
  if ([req.body?.odoStart, req.body?.odoFinish].some(value => value === "" || value == null)) {
    return res.status(400).json({ error: "Enter both odometer readings." });
  }
  const finish = completionInput.safeParse(req.body);
  if (!finish.success) return res.status(400).json({ error: "Enter the finish date, finish time and both odometer readings." });
  const booking = await prisma.booking.findFirstOrThrow({ where: { id, userId: customerId, ...shiftFilter } });
  const shift = allocationInput.parse(booking.commercialAllocation);
  const existing = await prisma.invoice.findFirst({ where: { bookingId: id, ...allocationInvoice } });
  if (existing) return res.json({ id: existing.id });
  const holiday = await allocationBankHoliday(shift.startDate);
  const result = await prisma.$transaction(async tx => {
    await lockCustomer(tx, customerId);
    const existing = await tx.invoice.findFirst({ where: { bookingId: id, ...allocationInvoice } });
    if (existing) return existing;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`;
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.booking.findFirstOrThrow({ where: { id, userId: customerId, ...shiftFilter, status: { not: "CANCELLED" } } });
    const { calculated, company, lines, subtotal, vatAmount, total } = await pricedShift(tx, customerId, current, shift, finish.data, holiday);
    const date = calendarDate(shift.startDate);
    const invoice = await tx.invoice.create({ data: {
      bookingId: id, userId: customerId, invoiceNumber: await reserveInvoiceNumber(tx, company.id),
      commercialPeriod: allocationWeekEnd(date), supplyDate: date, subtotal, vatAmount, total,
      customerReference: shift.routeReference || null, lines: { create: lines },
      auditEvents: { create: { eventType: "DRAFT_CREATED", description: "Commercial shift invoice generated." } },
    } });
    await fleetMutation(tx, undefined, "Commercial shift completed");
    await tx.booking.update({ where: { id }, data: { status: "COMPLETED", totalPrice: total,
      trackingEndedAt: calculated.end, commercialAllocation: { ...shift, ...finish.data } } });
    await tx.vehicleReservation.updateMany({ where: { bookingId: id }, data: { status: "CANCELLED", expiresAt: null } });
    if (current.driverId) await reconcileDriverActivity(tx, current.driverId);
    return invoice;
  });
  return res.status(201).json({ id: result.id });
});

router.post("/:customerId/consolidate", async (req, res) => {
  const { customerId } = req.params;
  const period = String(req.body?.period ?? "");
  const weekly = period.length === 10;
  const day = weekly ? calendarDate(period) : undefined;
  if (day && allocationWeekEnd(day) !== period) throw new Error("Choose a Sunday week-ending date.");
  const range = weekly ? undefined : contractMonthBounds(period);
  const invoice = await prisma.$transaction(async tx => {
    await lockCustomer(tx, customerId);
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "userId" = ${customerId} AND "commercialPeriod" IS NOT NULL ORDER BY id FOR UPDATE`;
    const existing = await tx.invoice.findFirst({ where: { userId: customerId, commercialPeriod: period, invoiceType: "CONSOLIDATED", status: "DRAFT" } });
    const members = await tx.invoice.findMany({ where: {
      userId: customerId, ...allocationInvoice, invoiceType: "SINGLE", status: "DRAFT", commercialGroupId: null,
      ...(weekly ? { commercialPeriod: period } : { supplyDate: range }),
    } });
    if (!members.length && existing) return existing;
    if (!members.length) throw new Error("There are no pending, unconsolidated shift invoices for this period.");
    const company = await settings(tx);
    const sum = (key: "subtotal" | "vatAmount" | "total") => members.reduce((total, invoice) => total.add(invoice[key]), zero);
    const group = existing || await tx.invoice.create({ data: {
      userId: customerId, invoiceNumber: await reserveInvoiceNumber(tx, company.id), invoiceType: "CONSOLIDATED",
      commercialPeriod: period, subtotal: sum("subtotal"), vatAmount: sum("vatAmount"), total: sum("total"),
      auditEvents: { create: { eventType: "DRAFT_CREATED", description: "Commercial shift invoices consolidated." } },
    } });
    await tx.invoice.updateMany({ where: { id: { in: members.map(row => row.id) } }, data: { commercialGroupId: group.id } });
    if (existing) await refreshAllocationGroupTotals(tx, group.id);
    return group;
  });
  return res.status(201).json({ id: invoice.id });
});

async function printInvoice(id: string, customerId: string) {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id, userId: customerId, ...allocationInvoice, status: { not: "VOID" } }, include: invoiceInclude(),
  });
  const pdf = await renderCommercialAllocationInvoicePdf(invoice);
  return { invoice, pdf };
}

router.get("/:customerId/invoices/:id/pdf", async (req, res) => {
  const { invoice, pdf } = await printInvoice(req.params.id, req.params.customerId);
  return res.type("application/pdf").attachment(`Invoice-${invoice.invoiceNumber}.pdf`).send(pdf);
});

async function emailInvoice(id: string, customerId: string, stage: "ISSUED" | "PAID") {
  const pending = `${stage}_PENDING`;
  const sending = `${stage}_SENDING`;
  const claimed = await prisma.invoice.updateMany({
    where: { id, userId: customerId, commercialEmailStage: pending }, data: { commercialEmailStage: sending },
  });
  if (!claimed.count) return;
  try {
    const { invoice, pdf } = await printInvoice(id, customerId);
    const profile = await prisma.billingProfile.findUnique({ where: { userId: customerId }, select: { accountsEmail: true } });
    const recipient = profile?.accountsEmail || invoice.user?.accountsEmail;
    if (!recipient) throw new Error("Set an accounts email for this customer before sending.");
    await sendInvoiceEmail({
      to: recipient, invoiceNumber: invoice.invoiceNumber, accountName: invoice.user?.companyName || invoice.user?.name || recipient,
      bookingReference: invoice.booking?.customerReference || invoice.booking?.reference || "Commercial shifts",
      subtotal: invoice.subtotal, vatAmount: invoice.vatAmount, total: invoice.total, dueDate: invoice.dueDate, pdfBuffer: pdf,
      adjustments: invoice.adjustments, paid: stage === "PAID",
    });
    await prisma.invoice.updateMany({ where: { id, commercialEmailStage: sending },
      data: { commercialEmailStage: `${stage}_SENT`, ...(stage === "ISSUED" ? { sentAt: new Date() } : {}) } });
  } catch (error) {
    await prisma.invoice.updateMany({ where: { id, commercialEmailStage: sending }, data: { commercialEmailStage: pending } });
    console.error("Commercial invoice email failed:", error);
    throw new Error(`The invoice was ${stage === "PAID" ? "marked paid" : "finalised"}, but email failed. Use Retry Email.`);
  }
}

router.post("/:customerId/invoices/:id/:action", async (req, res) => {
  const { customerId, id, action } = req.params;
  const allowed = ["finalise-send", "unfinalise", "record-payment", "retry-email"];
  if (!allowed.includes(action)) return res.status(404).json({ error: "Unknown invoice action." });
  const stage = await prisma.$transaction(async tx => {
    await lockCustomer(tx, customerId);
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} OR "commercialGroupId" = ${id} ORDER BY id FOR UPDATE`;
    const invoice = await tx.invoice.findFirstOrThrow({ where: { id, userId: customerId, ...allocationInvoice, status: { not: "VOID" } },
      include: { commercialMembers: true, user: { select: { accountsEmail: true, billingProfile: { select: { accountsEmail: true, paymentTermsDays: true } } } } } });
    if (invoice.commercialGroupId) throw new Error("Use the consolidated invoice for this action.");
    if (action === "retry-email") {
      return invoice.commercialEmailStage === "ISSUED_PENDING" ? "ISSUED" : invoice.commercialEmailStage === "PAID_PENDING" ? "PAID" : undefined;
    }
    if (invoice.commercialEmailStage?.endsWith("_SENDING")) throw new Error("An invoice email is still being sent.");
    const members = invoice.commercialMembers;
    const ids = [id, ...members.map(row => row.id)];
    const now = new Date();
    const terms = invoice.user?.billingProfile?.paymentTermsDays;
    const dueDate = terms == null ? null : new Date(+now + terms * 86400000);
    if (action === "unfinalise") {
      if (invoice.status !== "ISSUED") throw new Error("Only unpaid issued invoices can be unfinalised.");
      await tx.invoice.updateMany({ where: { id: { in: ids } }, data: {
        status: "DRAFT", issuedAt: null, finalisedAt: null, sentAt: null,
        commercialEmailStage: null, dueDate: null, paymentTerms: null, pdfStorageKey: null, pdfUrl: null,
      } });
      await tx.invoiceAuditEvent.create({ data: { invoiceId: id, eventType: "UNFINALISED", description: "Returned to pending commercial invoices." } });
      return;
    }
    if (action === "finalise-send" && !invoice.user?.billingProfile?.accountsEmail && !invoice.user?.accountsEmail) {
      throw new Error("Set an accounts email for this customer before sending.");
    }
    if (action === "finalise-send") {
      if (invoice.status === "ISSUED" && invoice.commercialEmailStage === "ISSUED_PENDING") return "ISSUED";
      if (invoice.status !== "DRAFT" || members.some(member => member.status !== "DRAFT")) throw new Error("Only pending invoices can be finalised.");
      await tx.invoice.updateMany({ where: { id: { in: ids } }, data: { status: "ISSUED", issuedAt: now, finalisedAt: now, dueDate, paymentTerms: terms == null ? null : terms === 0 ? "Due immediately" : `Payment due within ${terms} days` } });
      await tx.invoice.update({ where: { id }, data: { commercialEmailStage: "ISSUED_PENDING" } });
      await tx.invoiceAuditEvent.create({ data: { invoiceId: id, eventType: "FINALISED", description: "Commercial invoice issued." } });
      return "ISSUED";
    }
    if (invoice.status === "PAID" && invoice.commercialEmailStage === "PAID_PENDING") return "PAID";
    if (invoice.status !== "ISSUED" || members.some(member => member.status !== "ISSUED")) throw new Error("Record payment against an issued invoice.");
    const payment = z.object({ amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
      method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"]), reference: z.string().trim().max(120) }).parse(req.body);
    const amount = new Prisma.Decimal(payment.amount);
    if (members.length && !members.reduce((sum, item) => sum.add(item.total), zero).eq(invoice.total)) {
      throw new Error("The total no longer matches the included invoices. Unfinalise the group and review the invoices.");
    }
    if (!amount.eq(invoice.total)) throw new Error("Record the full invoice total.");
    if (amount.gt(0)) {
      await tx.payment.create({ data: {
        invoiceId: id, userId: customerId, bookingId: invoice.bookingId, provider: "MANUAL", status: "PAID",
        amount, paymentMethod: payment.method, reference: payment.reference || null, paidAt: now,
        allocations: { create: (members.length ? members : [invoice]).filter(row => row.total.gt(0)).map(row => ({ invoiceId: row.id, amount: row.total })) },
      } });
    }
    await tx.invoice.updateMany({ where: { id: { in: ids } }, data: { status: "PAID", paidAt: now } });
    await tx.invoice.update({ where: { id }, data: { commercialEmailStage: "PAID_PENDING" } });
    await tx.invoiceAuditEvent.create({ data: { invoiceId: id, eventType: "PAYMENT_RECORDED", description: "Commercial invoice paid in full." } });
    return "PAID";
  });
  if (stage) await emailInvoice(id, customerId, stage);
  return res.json({ success: true });
});

router.use((error: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ error: "The selected shift, invoice or rate is unavailable." });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("Commercial allocation error:", error);
    return res.status(409).json({ error: "Unable to save the commercial change. Refresh and try again." });
  }
  return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to complete this commercial operation." });
});

export default router;
