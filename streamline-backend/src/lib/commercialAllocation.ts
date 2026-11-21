import { Prisma, type CommercialTariffRate } from "@prisma/client";
import { z } from "zod";
import { calendarDate, contractShiftTiming } from "./commercialContracts";

const time = z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/);
export const allocationInput = z.object({
  driverId: z.string().max(100).nullish(),
  driverName: z.string().trim().max(120),
  routeReference: z.string().trim().max(120),
  vehicleId: z.string().max(100).nullish(),
  registration: z.string().trim().max(30),
  vehicleType: z.string().min(1).max(100),
  hours: z.union([z.literal(8), z.literal(12)]),
  startDate: z.string(),
  startTime: time,
});

const odometer = z.coerce.number().finite().min(0).max(99999999);
export const completionInput = z.object({
  finishDate: z.string(),
  finishTime: time,
  odoStart: odometer,
  odoFinish: odometer,
  waitingId: z.string().max(100),
  waitingHours: z.coerce.number().positive().max(48),
  loadingId: z.string().max(100),
  additionalId: z.string().max(100),
  additionalQuantity: z.coerce.number().positive().max(10000),
  additions: z.preprocess(value => {
    if (typeof value !== "string" || value.length > 5000) return value;
    try { return JSON.parse(value); } catch { return value; }
  }, z.array(z.object({ id: z.string().min(1).max(100), quantity: z.coerce.number().positive().max(10000) })).max(30).default([])),
  discountId: z.string().max(100),
});

export type Allocation = z.infer<typeof allocationInput>;
export type Completion = z.infer<typeof completionInput>;
type Decimal = Prisma.Decimal;
const zero = new Prisma.Decimal(0);
export const round = (value: Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const surchargeSource = "COMMERCIAL_START_SURCHARGE";
export const nightSource = "COMMERCIAL_NIGHT_PREMIUM";

const londonClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23",
});

export function nightPremium(start: Date, end: Date, fare: Decimal, shiftHours: number, percent: Decimal | null | undefined) {
  let milliseconds = 0;
  // UK offsets use whole hours. Split at UTC hour boundaries to also count clock-change nights correctly.
  for (let cursor = +start; cursor < +end;) {
    const next = Math.min(+end, (Math.floor(cursor / 3600000) + 1) * 3600000);
    const hour = Number(londonClock.format(new Date(cursor)));
    if (hour >= 22 || hour < 6) milliseconds += next - cursor;
    cursor = next;
  }
  const hours = new Prisma.Decimal(milliseconds).div(3600000);
  const rate = percent ?? zero;
  const amount = round(fare.mul(milliseconds).div(shiftHours * 3600000).mul(rate).div(100));
  return { hours, percent: rate, amount };
}

export function allocationWeekEnd(day: Date) {
  const date = new Date(day);
  date.setUTCDate(day.getUTCDate() + (7 - day.getUTCDay()) % 7);
  return date.toISOString().slice(0, 10);
}

let holidayCache: { expiresAt: number; dates: string[] } | undefined;
export async function allocationBankHoliday(day: string) {
  if (holidayCache && holidayCache.expiresAt > Date.now() &&
      holidayCache.dates.some(date => date.slice(0, 4) === day.slice(0, 4))) return holidayCache.dates.includes(day);
  const response = await fetch("https://www.gov.uk/bank-holidays.json", { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error("Bank holiday dates are unavailable. Retry before creating the invoice.");
  const data = await response.json() as { "england-and-wales"?: { events?: { date: string }[] } };
  const events = data["england-and-wales"]?.events;
  if (!Array.isArray(events) || !events.some(event => event.date.slice(0, 4) === day.slice(0, 4))) {
    throw new Error("Bank holiday dates are unavailable for this year.");
  }
  holidayCache = { expiresAt: Date.now() + 3600000, dates: events.map(event => event.date) };
  return holidayCache.dates.includes(day);
}

type PriceLine = { netAmount: Decimal; vatRate: Decimal; vatAmount: Decimal };

export function allocationSurcharge(lines: PriceLine[], description: string, percent: Decimal) {
  const byVat = new Map<string, Decimal>();
  for (const line of lines) {
    const rate = line.vatRate.toString();
    byVat.set(rate, (byVat.get(rate) || zero).add(line.netAmount));
  }
  return [...byVat].map(([rate, base]) => {
    const vatRate = new Prisma.Decimal(rate);
    const netAmount = round(base.mul(percent).div(100));
    const vatAmount = round(netAmount.mul(vatRate).div(100));
    return {
      description, netAmount, vatRate, vatAmount, quantity: new Prisma.Decimal(1),
      unitPrice: netAmount, grossAmount: netAmount.add(vatAmount), chargeType: "OTHER" as const,
      sourceType: surchargeSource, sourceId: percent.toString(),
    };
  });
}

export async function refreshAllocationGroupTotals(tx: Prisma.TransactionClient, id: string) {
  const { _sum } = await tx.invoice.aggregate({
    where: { commercialGroupId: id }, _sum: { subtotal: true, vatAmount: true, total: true },
  });
  await tx.invoice.update({ where: { id }, data: { subtotal: _sum.subtotal ?? zero, vatAmount: _sum.vatAmount ?? zero, total: _sum.total ?? zero } });
}

export async function refreshAllocationInvoiceTotals(tx: Prisma.TransactionClient, invoiceId: string) {
  const lines = await tx.invoiceLine.findMany({ where: { invoiceId } });
  const surcharge = lines.find(line => line.sourceType === surchargeSource);
  const base = lines.filter(line => line.sourceType !== surchargeSource);
  const rebuilt = surcharge?.sourceId
    ? allocationSurcharge(base.filter(line => line.sourceType !== nightSource), surcharge.description, new Prisma.Decimal(surcharge.sourceId))
    : [];
  if (surcharge) {
    await tx.invoiceLine.deleteMany({ where: { invoiceId, sourceType: surchargeSource } });
    if (rebuilt.length) await tx.invoiceLine.createMany({ data: rebuilt.map(line => ({
      ...line, invoiceId, bookingId: surcharge.bookingId, bookingReference: surcharge.bookingReference,
    })) });
  }
  const next = [...base, ...rebuilt];
  const subtotal = next.reduce((sum, line) => sum.add(line.netAmount), zero);
  const vatAmount = next.reduce((sum, line) => sum.add(line.vatAmount), zero);
  if (subtotal.lt(0) || vatAmount.lt(0)) throw new Error("This adjustment would reduce the invoice below zero.");
  return { subtotal, vatAmount, total: subtotal.add(vatAmount) };
}

export function allocationCharges(shift: Allocation, finish: Completion, rate: CommercialTariffRate, bankHoliday: boolean) {
  const day = calendarDate(shift.startDate);
  const endDay = calendarDate(finish.finishDate);
  const start = contractShiftTiming(day, shift.startTime, shift.hours).estimatedStartTime!;
  const end = contractShiftTiming(endDay, finish.finishTime, shift.hours).estimatedStartTime!;
  if (end <= start || end > new Date()) throw new Error("Enter a finish date and time after the start and before billing.");
  if (finish.odoFinish < finish.odoStart) throw new Error("Finish odometer must be at least the starting odometer.");

  const extraMiles = Prisma.Decimal.max(zero, new Prisma.Decimal(finish.odoFinish).sub(finish.odoStart)
    .sub(shift.hours === 8 ? rate.includedMiles8 : rate.includedMiles12));
  const overtimeMinutes = Math.max(0, (+end - +start) / 60000 - shift.hours * 60);
  const overtimeRate = rate.overtimePerQuarter;
  if (overtimeMinutes && overtimeRate === null) throw new Error("Save the selected overtime rate in Commercial Tariffs before billing.");
  const surcharge = bankHoliday ? ["Bank holiday start", rate.bankHolidayStartPercent ?? new Prisma.Decimal(50)] as const
    : day.getUTCDay() === 6 ? ["Saturday start", rate.saturdayStartPercent ?? new Prisma.Decimal(20)] as const
    : day.getUTCDay() === 0 ? ["Sunday start", rate.sundayStartPercent ?? new Prisma.Decimal(25)] as const
    : null;

  return {
    end, surcharge,
    night: nightPremium(start, end, shift.hours === 8 ? rate.fare8Hours : rate.fare12Hours, shift.hours, rate.nightHoursPercent),
    charges: [
      { chargeType: "BASE_SERVICE" as const, description: `${shift.hours}-hour shift · ${shift.vehicleType}`,
        quantity: new Prisma.Decimal(1), unitPrice: shift.hours === 8 ? rate.fare8Hours : rate.fare12Hours },
      { chargeType: "EXTRA_MILEAGE" as const, description: "Exceeded mileage", quantity: extraMiles, unitPrice: rate.extraMileRate },
      { chargeType: "OTHER" as const, description: "Overtime per 15 minutes",
        quantity: new Prisma.Decimal(Math.ceil(overtimeMinutes / 15)), unitPrice: overtimeRate ?? zero },
    ].filter(line => line.quantity.gt(0)),
  };
}
