import { Router } from "express";
import { Prisma } from "@prisma/client";
import { centralAdminAccess } from "../lib/centralAdmin";
import { prisma } from "../lib/prisma";
import { assertPlan, fleetTransaction, staffActor } from "../lib/fleetOperations";
import {
  calendarDate, contractMonthBounds, contractShiftInclude, contractToday, contractVehicleTypes,
  createContractShifts, refreshContractDraft, scheduledContractShifts, shiftReview, contractShiftTiming, shiftTimePattern,
} from "../lib/commercialContracts";

const router = Router();
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const monthOf = (date: Date) => date.toISOString().slice(0, 7);
const invoiceSelect = { invoiceNumber: true, status: true, total: true } as const;

router.use((req, res, next) => {
  const access = centralAdminAccess(req);
  if (!access.authorised) return res.status(access.status).json({ error: access.error });
  next();
});

router.get("/:customerId", async (req, res) => {
  const { customerId } = req.params;
  const month = text(req.query.month) || monthOf(contractToday());
  let range;
  try { range = contractMonthBounds(month); } catch { return res.status(400).json({ error: "Select a valid month." }); }
  const [customer, contracts] = await Promise.all([
    prisma.user.findUnique({ where: { id: customerId }, select: {
      name: true, companyName: true, accountStatus: true,
      billingProfile: { select: { poRequired: true } },
      commercialTariffAssignment: { select: { tariff: { select: { name: true, rates: { select: { vehicleType: true } } } } } },
    } }),
    prisma.commercialContract.findMany({ where: { customerId }, orderBy: { startsOn: "desc" }, include: {
      shifts: { where: { serviceDate: range }, orderBy: { serviceDate: "asc" }, include: contractShiftInclude },
      invoices: { where: { month }, select: { invoice: { select: invoiceSelect } } },
    } }),
  ]);
  if (!customer) return res.status(404).json({ error: "Customer account not found." });
  const tariff = customer.commercialTariffAssignment?.tariff;
  return res.json({
    customerName: customer.companyName || customer.name,
    canCreate: customer.accountStatus === "ACTIVE" && Boolean(tariff),
    tariffName: tariff?.name,
    vehicleTypes: contractVehicleTypes.filter(vehicleType => tariff?.rates.some(rate => rate.vehicleType === vehicleType)),
    poRequired: customer.billingProfile?.poRequired ?? false,
    contracts: contracts.map(contract => ({
      ...contract,
      shifts: contract.shifts.map(shift => ({
        ...shift,
        review: shift.serviceDate < contractToday() || shift.booking.status === "CANCELLED" ? shiftReview(shift) : null,
      })),
    })),
  });
});

router.post("/:customerId", async (req, res) => {
  const { customerId } = req.params;
  const requestId = text(req.body?.requestId);
  const startsAt = text(req.body?.startsAt);
  const vehicleType = text(req.body?.vehicleType);
  const collectionAddress = text(req.body?.collectionAddress);
  const variableDelivery = req.body?.variableDelivery === true;
  const deliveryAddress = variableDelivery ? "" : text(req.body?.deliveryAddress);
  const purchaseOrder = text(req.body?.purchaseOrder) || null;
  const pattern = req.body?.weeklyPattern;
  let startsOn, endsOn;
  try { startsOn = calendarDate(req.body?.startsOn); endsOn = calendarDate(req.body?.endsOn); }
  catch { return res.status(400).json({ error: "Enter valid contract start and end dates." }); }
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || (startsAt && !shiftTimePattern.test(startsAt)) ||
      !contractVehicleTypes.includes(vehicleType) || !collectionAddress || (!variableDelivery && !deliveryAddress) ||
      collectionAddress.length > 1500 || deliveryAddress.length > 1500 || (purchaseOrder?.length ?? 0) > 120 ||
      startsOn < contractToday() || endsOn < startsOn || +endsOn - +startsOn > 365 * 86400000 ||
      !Array.isArray(pattern) || pattern.length !== 7 || !pattern.every(hours => [0, 8, 12].includes(hours)) ||
      pattern.filter(Boolean).length < 5) {
    return res.status(400).json({ error: "Enter a van, route, up to 12 months of future dates and at least five weekly shifts." });
  }
  const shifts = scheduledContractShifts(startsOn, endsOn, pattern);
  if (!shifts.length) return res.status(400).json({ error: "The selected dates contain no scheduled shifts." });
  try {
    const contract = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121121)`;
      const saved = await tx.commercialContract.findUnique({ where: { requestId } });
      if (saved) {
        if (saved.customerId !== customerId) throw new Error("This contract request belongs to another customer.");
        return saved;
      }
      const customer = await tx.user.findUnique({ where: { id: customerId }, select: {
        accountStatus: true, billingProfile: { select: { poRequired: true } },
        commercialTariffAssignment: { select: { tariff: { select: { name: true, rates: { where: { vehicleType } } } } } },
      } });
      const tariff = customer?.commercialTariffAssignment?.tariff;
      const rate = tariff?.rates[0];
      if (customer?.accountStatus !== "ACTIVE" || !tariff || !rate) throw new Error("Select a van with saved rates on this customer’s assigned tariff.");
      if (customer.billingProfile?.poRequired && !purchaseOrder) throw new Error("A purchase order is required for this customer.");
      const savedContract = await tx.commercialContract.create({ data: {
        requestId, customerId, startsOn, endsOn, startsAt, vehicleType, collectionAddress, deliveryAddress,
        purchaseOrder, weeklyPattern: pattern, tariffName: tariff.name,
        fare8Hours: rate.fare8Hours, includedMiles8: rate.includedMiles8,
        fare12Hours: rate.fare12Hours, includedMiles12: rate.includedMiles12, extraMileRate: rate.extraMileRate,
      } });
      await createContractShifts(tx, savedContract, shifts, true, centralAdminAccess(req).admin?.id);
      return savedContract;
    }, { timeout: 30000 });
    return res.status(201).json({ id: contract.id, message: "Contract and recurring shifts saved." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error;
    return res.status(409).json({ error: error instanceof Error ? error.message : "Unable to create the contract." });
  }
});

router.post("/:customerId/:contractId/extra-shifts", async (req, res) => {
  const { customerId, contractId } = req.params;
  let serviceDate;
  try { serviceDate = calendarDate(req.body?.serviceDate); }
  catch { return res.status(400).json({ error: "Select a valid shift date." }); }
  const hours = req.body?.hours;
  if ((hours !== 8 && hours !== 12) || serviceDate < contractToday()) return res.status(400).json({ error: "Select an 8- or 12-hour future shift." });
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121121)`;
      const contract = await tx.commercialContract.findFirst({ where: { id: contractId, customerId, customer: { accountStatus: "ACTIVE" } } });
      if (!contract || serviceDate < contract.startsOn || serviceDate > contract.endsOn) throw new Error("Choose a date within this active contract.");
      if (await tx.commercialContractShift.findUnique({ where: { contractId_serviceDate: { contractId, serviceDate } } })) {
        throw new Error("A shift is already scheduled for this date.");
      }
      await createContractShifts(tx, contract, [{ serviceDate, hours }], false, centralAdminAccess(req).admin?.id);
    });
    return res.status(201).json({ message: "Extra shift added to Planning." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error;
    return res.status(409).json({ error: error instanceof Error ? error.message : "Unable to add the shift." });
  }
});

const weekMs = 7 * 86400000;
function rotaMonday(value: unknown) {
  const date = calendarDate(value);
  if (date.getUTCDay() !== 1) throw new Error("Select the Monday of the rota week.");
  return date;
}

router.get("/:customerId/:contractId/rota", async (req, res) => {
  const { customerId, contractId } = req.params;
  let monday;
  try { monday = rotaMonday(req.query.week); }
  catch { return res.status(400).json({ error: "Select the Monday of the rota week." }); }
  const contract = await prisma.commercialContract.findFirst({
    where: { id: contractId, customerId },
    select: { shifts: {
      where: { serviceDate: { gte: new Date(+monday - weekMs), lt: new Date(+monday + weekMs) } },
      include: contractShiftInclude, orderBy: { serviceDate: "asc" },
    } },
  });
  if (!contract) return res.status(404).json({ error: "Commercial contract not found." });
  return res.json({
    shifts: contract.shifts.filter(shift => shift.serviceDate >= monday),
    previous: contract.shifts.filter(shift => shift.serviceDate < monday),
  });
});

router.patch("/:customerId/:contractId/rota", async (req, res) => {
  const { customerId, contractId } = req.params;
  const { admin } = centralAdminAccess(req);
  if (!admin || !["SUPER_ADMIN", "OFFICE_MANAGER"].includes(admin.role)) {
    return res.status(403).json({ error: "You do not have permission to edit the rota." });
  }
  let monday;
  try { monday = rotaMonday(req.body?.week); }
  catch { return res.status(400).json({ error: "Select the Monday of the rota week." }); }
  const updates = req.body?.shifts as { id: string; startsAt: string; expectedUpdatedAt: string }[] | undefined;
  if (!Array.isArray(updates) || !updates.length || updates.length > 7 || updates.some(update =>
    !update || typeof update.id !== "string" || typeof update.startsAt !== "string" ||
    (update.startsAt !== "" && !shiftTimePattern.test(update.startsAt)) ||
    typeof update.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(update.expectedUpdatedAt))) ||
    new Set(updates.map(update => update.id)).size !== updates.length) {
    return res.status(400).json({ error: "Enter valid shift start times." });
  }
  try {
    await fleetTransaction(staffActor(admin), "Commercial contract weekly rota updated", async tx => {
      const shifts = await tx.commercialContractShift.findMany({
        where: { contractId, contract: { customerId }, id: { in: updates.map(update => update.id) },
          serviceDate: { gte: monday, lt: new Date(+monday + weekMs) } },
        include: contractShiftInclude,
      });
      if (shifts.length !== updates.length) throw new Error("Some shifts no longer belong to this rota. Reload the week.");
      for (const shift of shifts) {
        const { booking } = shift;
        const update = updates.find(item => item.id === shift.id)!;
        const label = shift.serviceDate.toISOString().slice(0, 10);
        if (+booking.updatedAt !== Date.parse(update.expectedUpdatedAt)) throw new Error("A booking has changed. Reload the rota before saving.");
        if (booking.status !== "CONFIRMED" || booking.driverId || booking.driverJourneyStartedAt ||
            shift.serviceDate < contractToday() || (booking.estimatedStartTime && booking.estimatedStartTime <= new Date())) {
          throw new Error(`Only upcoming shifts without an assigned driver can be edited (${label}).`);
        }
        const timing = contractShiftTiming(shift.serviceDate, update.startsAt, shift.hours);
        const { estimatedStartTime: startsAt, estimatedEndTime: endsAt } = timing;
        if (startsAt && startsAt <= new Date()) throw new Error(`Choose a future start time for ${label}.`);
        const reservation = booking.reservation;
        const liveHold = reservation && ["ACTIVE", "CONFIRMED"].includes(reservation.status) ? reservation : null;
        const vehicleId = booking.vehicleId || liveHold?.vehicleId;
        if (vehicleId) {
          if (!startsAt || !endsAt) throw new Error(`Remove the van reservation before clearing the start time for ${label}.`);
          await assertPlan(tx, { bookingId: booking.id, vehicleId, startsAt, endsAt });
          if (liveHold) await tx.vehicleReservation.update({
            where: { id: liveHold.id }, data: { reservedFrom: startsAt, reservedUntil: endsAt },
          });
        }
        const saved = await tx.booking.updateMany({
          where: { id: booking.id, updatedAt: booking.updatedAt, status: "CONFIRMED", driverId: null }, data: timing,
        });
        if (saved.count !== 1) throw new Error("A booking has changed. Reload the rota before saving.");
      }
    });
    return res.json({ message: "Weekly rota saved." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2010", "P2004", "P2034"].includes(error.code)) return res.status(409).json({ error: "A booking or van allocation changed. Reload the rota and try again." });
      throw error;
    }
    return res.status(409).json({ error: error instanceof Error ? error.message : "Unable to save the rota." });
  }
});

router.patch("/:customerId/:contractId/shifts/:shiftId", async (req, res) => {
  const { customerId, contractId, shiftId } = req.params;
  const mileage = req.body?.actualMiles;
  const mileageText = typeof mileage === "number" || typeof mileage === "string" ? String(mileage).trim() : "";
  const decision = req.body?.decision;
  if ((mileage !== undefined && mileage !== null && !/^\d{1,6}(\.\d{1,2})?$/.test(mileageText)) ||
      (decision !== undefined && decision !== null && decision !== "BILL" && decision !== "WAIVE")) {
    return res.status(400).json({ error: "Enter valid actual mileage and a billing decision." });
  }
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121012)`;
      const shift = await tx.commercialContractShift.findFirst({
        where: { id: shiftId, contractId, contract: { customerId } },
        include: { ...contractShiftInclude, contract: true },
      });
      if (!shift || (shift.serviceDate > contractToday() && shift.booking.status !== "CANCELLED") || shift.booking.status === "IN_PROGRESS" ||
          (shift.booking.estimatedStartTime && shift.booking.estimatedStartTime > new Date() && shift.booking.status !== "CANCELLED")) {
        throw new Error("This shift is unavailable for billing review.");
      }
      const month = monthOf(shift.serviceDate);
      const linked = await tx.commercialContractInvoice.findUnique({
        where: { contractId_month: { contractId, month } }, include: { invoice: { select: { status: true } } },
      });
      if (linked && linked.invoice.status !== "DRAFT") throw new Error("This month’s invoice has been finalised.");
      await tx.commercialContractShift.update({ where: { id: shift.id }, data: {
        actualMiles: mileage === undefined ? undefined : mileage === null ? null : new Prisma.Decimal(mileageText),
        decision: decision === undefined ? undefined : decision,
      } });
      if (linked) await refreshContractDraft(tx, shift.contract, month, linked.invoiceId);
    });
    return res.json({ message: "Shift billing details saved." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error;
    return res.status(409).json({ error: error instanceof Error ? error.message : "Unable to save the shift." });
  }
});

router.use((error: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  console.error("Commercial contract error:", error);
  res.status(500).json({ error: "Unable to manage commercial contracts." });
});

export default router;
