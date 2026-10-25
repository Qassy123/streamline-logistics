import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { calculateAdminQuote } from "../routes/quotes";
import { getReservationWindow } from "./reservationWindow";
import { assertPlan, fleetMutation } from "./fleetOperations";
import { findFleetVehicle } from "./fleetAvailability";
import { queueBusinessRefund, refreshTradeBalance, syncTradeBookingPrice } from "./bookingFinance";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function money(value: unknown, label: string) { const source = String(value ?? 0); if (!/^-?\d+(?:\.\d{1,2})?$/.test(source))
    throw new Error(`${label} must be a valid amount with at most two decimal places.`); const amount = new Prisma.Decimal(source); if (amount.abs().greaterThan(10000000))
    throw new Error(`${label} is too large.`); return amount; }
const json = (value: unknown) => value === null || value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue;
export const bookingEditInclude = { user: true, quote: true, vehicle: true, driver: true, reservation: true, payments: true, invoices: true, refundRequests: true, pod: true } satisfies Prisma.BookingInclude;
export async function editBooking(id: string, body: Record<string, unknown>) {
    const current = await prisma.booking.findUnique({ where: { id }, include: bookingEditInclude });
    if (!current || current.archivedCustomerId)
        throw new Error("Booking not found.");
    if (["CANCELLED", "EXPIRED"].includes(current.status))
        throw new Error("Cancelled or expired bookings cannot be edited.");
    if (body.expectedUpdatedAt && +new Date(String(body.expectedUpdatedAt)) !== +current.updatedAt)
        throw new Error("This booking changed. Reopen it before saving.");
    const nextVehicleId = body.vehicleId === undefined ? current.vehicleId : text(body.vehicleId) || null;
    if (body.driverId !== undefined && (text(body.driverId) || null) !== current.driverId)
        throw new Error("Assign or remove drivers through Admin Drivers.");
    if (current.driverId && nextVehicleId !== current.vehicleId)
        throw new Error("Change an assigned job's van through Admin Drivers.");
    const vehicle = nextVehicleId ? await prisma.vehicle.findUnique({ where: { id: nextVehicleId } }) : null;
    if (nextVehicleId && !vehicle)
        throw new Error("Selected vehicle not found.");
    const collectionDate = body.collectionDate === undefined ? current.collectionDate : new Date(String(body.collectionDate));
    if (!Number.isFinite(+collectionDate))
        throw new Error("Enter a valid collection date.");
    const collectionWindow = body.collectionWindow === undefined ? current.collectionWindow : text(body.collectionWindow);
    const collectionAddress = body.collectionAddress === undefined ? current.collectionAddress : text(body.collectionAddress), deliveryAddress = body.deliveryAddress === undefined ? current.deliveryAddress : text(body.deliveryAddress);
    const returnAddress = body.returnAddress === undefined ? current.returnAddress : text(body.returnAddress) || null;
    if (!collectionAddress || !deliveryAddress || collectionAddress.length > 1500 || deliveryAddress.length > 1500)
        throw new Error("Enter valid collection and delivery addresses.");
    let extraDrops = body.extraDrops === undefined ? current.extraDrops : body.extraDrops;
    if (typeof extraDrops === "string") {
        try {
            extraDrops = JSON.parse(extraDrops);
        }
        catch {
            throw new Error("Re-enter the additional stop addresses before saving.");
        }
    }
    if (extraDrops !== null && (!Array.isArray(extraDrops) || extraDrops.length > 100 || extraDrops.some(drop => !drop || typeof drop !== "object" || !text((drop as Record<string, unknown>).address) || text((drop as Record<string, unknown>).address).length > 1500)))
        throw new Error("Enter valid additional stop addresses.");
    const quote = current.quote, vehicleSize = vehicle?.vehicleType || quote?.vehicleSize || current.vehicleType || "Small Van";
    const routeChanged = collectionAddress !== current.collectionAddress || deliveryAddress !== current.deliveryAddress || returnAddress !== current.returnAddress || JSON.stringify(extraDrops) !== JSON.stringify(current.extraDrops) || vehicleSize !== quote?.vehicleSize || body.recalculatePrice === true;
    const scheduleChanged = +collectionDate !== +current.collectionDate || collectionWindow !== current.collectionWindow || nextVehicleId !== current.vehicleId;
    const adjustment = money(body.adjustmentAmount, "Adjustment");
    const manual = body.manualPrice === true || (body.manualPrice === undefined && body.totalPrice !== undefined);
    const calculated = (routeChanged || manual) ? await calculateAdminQuote({ collectionAddress, deliveryAddress, returnAddress, extraDrops, vehicleSize, deliveryType: quote?.deliveryType || current.journeyType || "Same Day Delivery", journeyType: quote?.journeyType || "One Way", discountType: "FIXED", discountValue: quote?.discountAmount || 0 }) : null;
    const base = manual ? money(body.totalPrice, "Booking charge") : calculated ? new Prisma.Decimal(calculated.totalPrice).add(current.priceAdjustment) : current.totalPrice;
    const total = base.add(adjustment).toDecimalPlaces(2);
    if (total.lessThan(0))
        throw new Error("Booking charge cannot be negative.");
    const priceAdjustment = manual && calculated ? money(body.totalPrice, "Booking charge").sub(calculated.totalPrice).add(adjustment) : new Prisma.Decimal(current.priceAdjustment).add(adjustment);
    const financialChanged = !total.equals(current.totalPrice);
    if (current.status === "PENDING_PAYMENT" && (scheduleChanged || financialChanged))
        throw new Error("Complete or cancel the pending payment before changing its reserved time or price.");
    const reason = text(body.adjustmentReason) || "Admin booking details and price correction";
    const window = scheduleChanged ? getReservationWindow(collectionDate, collectionWindow, 6) : null;
    return prisma.$transaction(async (tx) => {
        await fleetMutation(tx, { label: "Admin booking editor" }, reason);
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(73121012)`;
        await tx.$queryRaw `SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
        const latest = await tx.booking.findUnique({ where: { id } });
        if (!latest || +latest.updatedAt !== +current.updatedAt)
            throw new Error("This booking changed. Reopen it before saving.");
        const billingType = current.billingAccountType || current.user?.accountType || "BUSINESS";
        if (financialChanged && await tx.bookingRefund.findFirst({ where: { bookingId: id, status: { in: ["PROCESSING", "APPROVED_MANUAL"] } } }))
            throw new Error("Complete the approved refund before changing this booking's price.");
        if (window) {
            let reservedVehicleId = nextVehicleId || current.reservation?.vehicleId || null;
            if (!nextVehicleId) {
                const available = await findFleetVehicle(tx, { vehicleType: vehicleSize, ...window, excludeBookingId: id });
                reservedVehicleId = available?.id || null;
            }
            if (!reservedVehicleId)
                throw new Error("No vehicle is available for the revised collection time.");
            await assertPlan(tx, { bookingId: id, quoteId: current.quoteId, driverId: current.driverId, vehicleId: reservedVehicleId, startsAt: window.reservedFrom, endsAt: window.reservedUntil });
            if (current.reservation)
                await tx.vehicleReservation.update({ where: { id: current.reservation.id }, data: { vehicleId: reservedVehicleId, reservedFrom: window.reservedFrom, reservedUntil: window.reservedUntil, expiresAt: current.reservation.expiresAt, status: current.reservation.status } });
            else
                await tx.vehicleReservation.create({ data: { bookingId: id, quoteId: current.quoteId, vehicleId: reservedVehicleId, reservedFrom: window.reservedFrom, reservedUntil: window.reservedUntil, status: "CONFIRMED" } });
        }
        await tx.invoiceBooking.updateMany({ where: { bookingId: id, invoice: { status: "DRAFT" } }, data: { bookingDate: collectionDate, routeDescription: `${collectionAddress} → ${deliveryAddress}`, serviceDescription: vehicleSize, ...(body.purchaseOrderNumber !== undefined ? { poReference: text(body.purchaseOrderNumber) || null } : {}) } });
        const vatRate = (await tx.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { vatRate: true } }))?.vatRate || new Prisma.Decimal(20);
        const net = total.div(new Prisma.Decimal(1).add(vatRate.div(100))).toDecimalPlaces(2), vat = total.sub(net);
        if (quote)
            await tx.quote.update({ where: { id: quote.id }, data: { collectionDate, collectionWindow, collectionAddress, deliveryAddress, returnAddress, extraDrops: json(extraDrops), vehicleSize, totalPrice: total, vatAmount: vat, adminPrice: net.add(quote.discountAmount || 0), ...(calculated ? { distanceMiles: calculated.distanceMiles, basePrice: calculated.basePrice, fuelSurcharge: calculated.fuelSurcharge, pricingBreakdown: calculated.pricingBreakdown } : {}), ...(collectionAddress !== current.collectionAddress ? { collectionAddressDetails: json(body.collectionAddressDetails) } : {}), ...(deliveryAddress !== current.deliveryAddress ? { deliveryAddressDetails: json(body.deliveryAddressDetails) } : {}) } });
        const data: Prisma.BookingUpdateInput = { collectionDate, collectionWindow, collectionAddress, deliveryAddress, returnAddress, extraDrops: json(extraDrops), totalPrice: total, priceAdjustment, billingAccountType: billingType, vehicleType: vehicleSize, vehicle: nextVehicleId ? { connect: { id: nextVehicleId } } : { disconnect: true }, ...(window ? { estimatedStartTime: window.reservedFrom, estimatedEndTime: window.reservedUntil, vehicleAvailableAt: window.reservedUntil } : {}) };
        for (const field of ["customerReference", "purchaseOrderNumber", "internalNotes", "dispatchNotes"] as const)
            if (body[field] !== undefined)
                data[field] = text(body[field]) || null;
        await tx.booking.update({ where: { id }, data });
        if (financialChanged) {
            if (billingType === "TRADE")
                await syncTradeBookingPrice(tx, current, current.totalPrice, total, reason);
            else
                await queueBusinessRefund(tx, { ...current, totalPrice: total }, reason);
        }
        if (billingType === "TRADE" && current.userId)
            await refreshTradeBalance(tx, current.userId);
        await tx.auditLog.create({ data: { action: "BOOKING_DETAILS_CORRECTED", entityType: "Booking", entityId: id, reason, oldValue: { total: current.totalPrice.toFixed(2), collectionAddress: current.collectionAddress, deliveryAddress: current.deliveryAddress, start: current.estimatedStartTime?.toISOString() || null, end: current.estimatedEndTime?.toISOString() || null }, newValue: { total: total.toFixed(2), adjustment: adjustment.toFixed(2), distanceMiles: calculated?.distanceMiles || Number(quote?.distanceMiles || 0), collectionAddress, deliveryAddress, start: window?.reservedFrom.toISOString() || current.estimatedStartTime?.toISOString() || null, end: window?.reservedUntil.toISOString() || current.estimatedEndTime?.toISOString() || null } } });
        return tx.booking.findUniqueOrThrow({ where: { id }, include: bookingEditInclude });
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
