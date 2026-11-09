import { randomUUID } from "node:crypto";
import { Prisma, type CommercialContract } from "@prisma/client";
import { prisma } from "./prisma";
import { reserveInvoiceNumber } from "./invoiceNumber";
import { tradeMonth, ukMidnight, ukParts, TRADE_PAYMENT_TERMS } from "./billingPolicy";
import { getReservationWindow } from "./reservationWindow";

const dayMs = 86400000;
const sourceType = "COMMERCIAL_CONTRACT";
export const contractVehicleTypes = ["Small Van", "SWB Van", "LWB High Roof Van", "XLWB High Roof Van", "Luton Tail Lift Van"];

type Tx = Prisma.TransactionClient;
type ShiftHours = 8 | 12;
export const contractShiftInclude = {
  booking: { select: { id: true, reference: true, status: true, deliveryAddress: true, estimatedStartTime: true,
    estimatedEndTime: true, driverId: true, vehicleId: true, driverJourneyStartedAt: true, updatedAt: true,
    reservation: { select: { id: true, vehicleId: true, status: true } }, } },
} satisfies Prisma.CommercialContractShiftInclude;
type Shift = Prisma.CommercialContractShiftGetPayload<{ include: typeof contractShiftInclude }>;

export function calendarDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date.");
  const day = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value) throw new Error("Enter a valid date.");
  return day;
}

export function contractMonthBounds(month: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Select a valid month.");
  const [year, number] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(year, number - 1, 1)), lt: new Date(Date.UTC(year, number, 1)) };
}

export const shiftTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function contractShiftTiming(serviceDate: Date, startsAt: string, hours: number) {
  if (!startsAt) return { collectionWindow: "", estimatedStartTime: null, estimatedEndTime: null, vehicleAvailableAt: null };
  const { reservedFrom: start } = getReservationWindow(serviceDate, `${startsAt}-${startsAt}`);
  const end = new Date(+start + hours * 3600000);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (clock.format(start) !== startsAt) throw new Error("This start time falls in the UK clock change. Choose a different time.");
  return { collectionWindow: `${startsAt}-${clock.format(end)}`, estimatedStartTime: start, estimatedEndTime: end, vehicleAvailableAt: end };
}

export function contractToday(now = new Date()) {
  const { year, month, day } = ukParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

export function scheduledContractShifts(startsOn: Date, endsOn: Date, pattern: number[]) {
  const shifts: { serviceDate: Date; hours: ShiftHours }[] = [];
  for (let time = +startsOn; time <= +endsOn; time += dayMs) {
    const serviceDate = new Date(time);
    const hours = pattern[(serviceDate.getUTCDay() + 6) % 7];
    if (hours === 8 || hours === 12) shifts.push({ serviceDate, hours });
  }
  return shifts;
}

function rateFor(contract: CommercialContract, hours: number) {
  return hours === 8
    ? { fare: contract.fare8Hours, included: contract.includedMiles8 }
    : { fare: contract.fare12Hours, included: contract.includedMiles12 };
}

export async function createContractShifts(
  tx: Tx, contract: CommercialContract,
  dates: { serviceDate: Date; hours: ShiftHours }[],
  guaranteed: boolean, adminId?: string,
) {
  const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vatRate: true } });
  if (!settings) throw new Error("Configure company settings before creating shifts.");
  const grossMultiplier = settings.vatRate.div(100).add(1);
  const rows = dates.map(({ serviceDate, hours }) => {
    const bookingId = randomUUID();
    return {
      shift: { contractId: contract.id, bookingId, serviceDate, hours, guaranteed },
      booking: {
        id: bookingId, reference: `CONTRACT-${bookingId}`, status: "CONFIRMED" as const,
        userId: contract.customerId, billingAccountType: "TRADE" as const, vehicleType: contract.vehicleType,
        collectionDate: serviceDate, ...contractShiftTiming(serviceDate, contract.startsAt, hours),
        collectionAddress: contract.collectionAddress, deliveryAddress: contract.deliveryAddress,
        totalPrice: rateFor(contract, hours).fare.mul(grossMultiplier).toDecimalPlaces(2), purchaseOrderNumber: contract.purchaseOrder,
        createdByAdminId: adminId,
      },
    };
  });
  if (rows.some(({ booking }) => booking.estimatedStartTime && booking.estimatedStartTime <= new Date())) throw new Error("The shift start time must be in the future.");
  await tx.booking.createMany({ data: rows.map(row => row.booking) });
  await tx.commercialContractShift.createMany({ data: rows.map(row => row.shift) });
}

export function shiftReview(shift: Shift) {
  if (shift.decision === "WAIVE") return null;
  if (shift.booking.status === "COMPLETED") return shift.actualMiles === null ? "Record actual mileage." : null;
  if (shift.booking.status === "IN_PROGRESS") return "Complete or close the active shift before billing.";
  return shift.decision === "BILL" ? null : "Confirm whether to bill or waive this unused shift.";
}

function priceShift(contract: CommercialContract, shift: Shift) {
  const { fare, included } = rateFor(contract, shift.hours);
  const waived = shift.decision === "WAIVE" || (!shift.guaranteed && shift.booking.status !== "COMPLETED" && shift.decision !== "BILL");
  const excess = !waived && shift.actualMiles !== null ? Prisma.Decimal.max(0, shift.actualMiles.sub(included)) : new Prisma.Decimal(0);
  return { fare: waived ? new Prisma.Decimal(0) : fare, excess, billable: !waived };
}

async function monthShifts(tx: Tx, contractId: string, month: string) {
  return tx.commercialContractShift.findMany({
    where: { contractId, serviceDate: contractMonthBounds(month) },
    include: contractShiftInclude, orderBy: { serviceDate: "asc" },
  });
}

export async function refreshContractDraft(tx: Tx, contract: CommercialContract, month: string, invoiceId: string, finalising = false) {
  const shifts = await monthShifts(tx, contract.id, month);
  if (finalising) {
    const unreviewed = shifts.filter(shiftReview);
    if (unreviewed.length) throw new Error(`Review ${unreviewed.length} shift(s) in Commercial Contracts before finalising this invoice.`);
  }
  const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vatRate: true } });
  if (!settings) throw new Error("Configure company settings before creating a contract invoice.");
  const vatRate = settings.vatRate;
  const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
  const rows = shifts.map(shift => ({ shift, ...priceShift(contract, shift) }));
  const lines: Prisma.InvoiceLineCreateManyInput[] = [];
  function line(description: string, quantity: number | Prisma.Decimal, unitPrice: Prisma.Decimal, chargeType: "BASE_SERVICE" | "MILEAGE") {
    const netAmount = money(unitPrice.mul(quantity));
    const vatAmount = money(netAmount.mul(vatRate).div(100));
    lines.push({ invoiceId, sourceType, sourceId: contract.id, description, quantity, unitPrice, netAmount,
      vatAmount, grossAmount: netAmount.add(vatAmount), vatRate, chargeType });
  }
  for (const hours of [8, 12]) {
    const count = rows.filter(row => row.shift.hours === hours && row.billable).length;
    if (count) line(`${hours}-hour shift - ${contract.vehicleType}`, count, rateFor(contract, hours).fare, "BASE_SERVICE");
  }
  const extra = sum(rows.map(row => row.excess));
  if (extra.gt(0)) line("Extra mileage (per mile)", extra, contract.extraMileRate, "MILEAGE");

  await tx.invoiceLine.deleteMany({ where: { invoiceId, sourceType } });
  if (lines.length) await tx.invoiceLine.createMany({ data: lines });
  await tx.invoiceBooking.deleteMany({ where: { invoiceId } });
  if (rows.length) await tx.invoiceBooking.createMany({ data: rows.map(({ shift, fare, excess, billable }) => {
    const netAmount = money(fare.add(excess.mul(contract.extraMileRate)));
    const vatAmount = money(netAmount.mul(vatRate).div(100));
    return { invoiceId, bookingId: shift.bookingId, bookingReference: shift.booking.reference,
      bookingDate: shift.serviceDate, poReference: contract.purchaseOrder,
      serviceDescription: `${shift.hours}-hour shift${billable ? "" : " (waived)"}`,
      netAmount, vatAmount, grossAmount: netAmount.add(vatAmount) };
  }) });
  const totals = await tx.invoiceLine.findMany({ where: { invoiceId }, select: { netAmount: true, vatAmount: true, grossAmount: true } });
  await tx.invoice.update({ where: { id: invoiceId }, data: {
    subtotal: sum(totals.map(line => line.netAmount)),
    vatAmount: sum(totals.map(line => line.vatAmount)),
    total: sum(totals.map(line => line.grossAmount)),
    checkedAt: null,
  } });
}

export async function processCommercialContractBilling(now = new Date()) {
  const { year, month } = ukParts(now);
  const cutoff = new Date(Date.UTC(year, month - 1, 1));
  const [pastShifts, existing] = await Promise.all([
    prisma.commercialContractShift.findMany({ where: { serviceDate: { lt: cutoff } }, select: { contractId: true, serviceDate: true }, distinct: ["contractId", "serviceDate"] }),
    prisma.commercialContractInvoice.findMany({ select: { contractId: true, month: true } }),
  ]);
  const known = new Set(existing.map(row => `${row.contractId}:${row.month}`));
  for (const shift of pastShifts) {
    const dates = tradeMonth(shift.serviceDate);
    const key = `${shift.contractId}:${dates.key}`;
    if (known.has(key)) continue;
    known.add(key);
    try {
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121012)`;
        const contract = await tx.commercialContract.findUnique({ where: { id: shift.contractId } });
        if (!contract || await tx.commercialContractInvoice.findUnique({ where: { contractId_month: { contractId: contract.id, month: dates.key } } })) return;
        const settings = await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
        if (!settings) throw new Error("Configure company settings before creating a contract invoice.");
        const invoice = await tx.invoice.create({ data: {
          invoiceNumber: await reserveInvoiceNumber(tx, settings.id), userId: contract.customerId,
          billingAccountType: "TRADE", status: "DRAFT", invoiceType: "SINGLE",
          issuedAt: dates.issueDate, dueDate: dates.dueDate, paymentTerms: TRADE_PAYMENT_TERMS,
          purchaseOrderNumber: contract.purchaseOrder, notes: `Commercial contract shifts for ${dates.key}.`,
          subtotal: 0, vatAmount: 0, total: 0,
        } });
        await tx.commercialContractInvoice.create({ data: { contractId: contract.id, month: dates.key, invoiceId: invoice.id } });
        await refreshContractDraft(tx, contract, dates.key, invoice.id);
        await tx.invoiceAuditEvent.create({ data: {
          invoiceId: invoice.id, eventType: "DRAFT_CREATED",
          description: `Monthly commercial contract invoice for ${dates.key}.`,
          metadata: { contractId: contract.id, contractMonth: dates.key },
        } });
      });
    } catch (error) {
      console.error("Commercial contract billing failed for a contract month:", error);
    }
  }
}
