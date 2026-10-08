import crypto from "crypto";
import {
  BookingStatus,
  DriverDeliveryOutcome,
  DriverIncidentReason,
  DriverReviewStatus,
  DriverStopStatus,
  DriverStopType,
  PODStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";

export class DriverPortalError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "DriverPortalError";
  }
}

export const driverJobInclude = {
  quote: true,
  vehicle: true,
  pod: true,
  driverStops: { orderBy: { sequence: "asc" as const }, include: { evidence: true } },
  driverIncidents: { orderBy: { createdAt: "desc" as const } },
  trackingEvents: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

type PortalBooking = Prisma.BookingGetPayload<{ include: typeof driverJobInclude }>;
type Tx = Prisma.TransactionClient;

export function text(value: unknown, limit = 2000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function drops(value: unknown): unknown[] {
  if (typeof value === "string") {
    try { return drops(JSON.parse(value)); } catch { return []; }
  }
  if (Array.isArray(value)) return value;
  const data = object(value);
  for (const key of ["drops", "extraDrops", "items", "addresses"]) {
    if (Array.isArray(data[key])) return data[key] as unknown[];
  }
  return [];
}

function dropAddress(value: unknown) {
  if (typeof value === "string") return text(value);
  const data = object(value);
  for (const key of ["address", "fullAddress", "dropAddress", "deliveryAddress", "location", "formattedAddress"]) {
    if (text(data[key])) return text(data[key]);
  }
  const details = object(data.addressDetails);
  return [details.addressLine1, details.addressLine2, details.townCity, details.county, details.postcode]
    .map(value => text(value)).filter(Boolean).join(", ");
}

export function requestId(value: unknown) {
  const id = text(value, 120);
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(id)) {
    throw new DriverPortalError(400, "A valid request identifier is required.");
  }
  return id;
}

export function capturedDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 5 * 60_000) {
    throw new DriverPortalError(400, "Invalid capture time.");
  }
  return date;
}

export function ukDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function sessionHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Existing sessions receive a bounded transition period; new login creates expiring sessions.
export async function authenticateDriver(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = sessionHash(token);
  const session = await prisma.driverPortalSession.findUnique({
    where: { tokenHash }, include: { driver: { include: { vehicle: true } } },
  });
  if (session) {
    if (session.revokedAt || session.expiresAt <= new Date() || !session.driver.active || session.driver.status !== "ACTIVE") return null;
    return session.driver;
  }
  const driver = await prisma.driver.findFirst({
    where: { sessionToken: token, active: true, status: "ACTIVE" }, include: { vehicle: true },
  });
  if (!driver) return null;
  await prisma.driverPortalSession.upsert({
    where: { tokenHash }, update: {},
    create: { driverId: driver.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
  });
  return driver;
}

export function safeDriver(driver: {
  id: string; name: string; username: string; email: string; phone: string | null;
  active: boolean; availability: string; portalOnDuty: boolean;
  vehicle: { id: string; name: string; registration: string | null; vehicleType: string } | null;
}) {
  return {
    id: driver.id, name: driver.name, username: driver.username, email: driver.email,
    phone: driver.phone, active: driver.active, availability: driver.availability,
    onDuty: driver.portalOnDuty,
    vehicle: driver.vehicle ? {
      id: driver.vehicle.id, name: driver.vehicle.name,
      registration: driver.vehicle.registration, vehicleType: driver.vehicle.vehicleType,
    } : null,
  };
}

export function safeDriverJob(booking: PortalBooking) {
  const quote = booking.quote;
  const stops = booking.driverStops.map(stop => ({
    id: stop.id, sequence: stop.sequence, type: stop.type, label: stop.label,
    address: stop.address, contactName: stop.contactName, contactPhone: stop.contactPhone,
    notes: stop.instructions, status: stop.status, enRouteAt: stop.enRouteAt,
    arrivedAt: stop.arrivedAt, completedAt: stop.completedAt,
    navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`,
    evidence: stop.evidence ? {
      recipientName: stop.evidence.recipientName, signatureUrl: stop.evidence.signatureUrl,
      photoUrls: stop.evidence.photoUrls, notes: stop.evidence.notes, outcome: stop.evidence.outcome,
      reviewStatus: stop.evidence.reviewStatus, exceptionReason: stop.evidence.exceptionReason,
      reviewNotes: stop.evidence.reviewNotes, capturedAt: stop.evidence.capturedAt,
      receivedAt: stop.evidence.receivedAt,
    } : null,
  }));
  return {
    id: booking.id, reference: booking.reference, status: booking.status,
    collectionDate: booking.collectionDate, collectionWindow: booking.collectionWindow,
    estimatedStartTime: booking.estimatedStartTime, estimatedEndTime: booking.estimatedEndTime,
    collectionAddress: booking.collectionAddress, deliveryAddress: booking.deliveryAddress,
    acknowledgedAt: booking.driverAcknowledgedAt, journeyStartedAt: booking.driverJourneyStartedAt,
    assignedAt: booking.driverAssignedAt, updatedAt: booking.updatedAt,
    customerReference: booking.customerReference, purchaseOrderNumber: booking.purchaseOrderNumber,
    dispatchNotes: booking.dispatchNotes,
    customer: { name: quote?.customerName || "", company: quote?.companyName || quote?.legalEntity || "", phone: quote?.customerPhone || "" },
    load: { description: quote?.loadDescription || "", category: quote?.whatAreWeCollecting || "",
      fragile: quote?.fragileGoods || false, palletCount: quote?.palletCount ?? null,
      instructions: quote?.specialInstructions || "", handoverNotes: quote?.handoverNotes || "" },
    vehicle: booking.vehicle ? { id: booking.vehicle.id, name: booking.vehicle.name,
      vehicleType: booking.vehicle.vehicleType, registration: booking.vehicle.registration } : null,
    stops, nextStop: stops.find(stop => stop.status !== DriverStopStatus.COMPLETED) || null,
    stopSummary: { totalStops: stops.length, completedStops: stops.filter(stop => stop.status === DriverStopStatus.COMPLETED).length,
      extraDrops: stops.filter(stop => stop.type === DriverStopType.DROP).length,
      hasReturn: stops.some(stop => stop.type === DriverStopType.RETURN) },
    incidents: booking.driverIncidents.map(incident => ({ id: incident.id, stopId: incident.stopId,
      reason: incident.reason, notes: incident.notes, photoUrls: incident.photoUrls,
      revisedArrivalAt: incident.revisedArrivalAt, createdAt: incident.createdAt,
      acknowledgedAt: incident.acknowledgedAt, resolvedAt: incident.resolvedAt, dispatchResponse: incident.dispatchResponse })),
    // Historic booking-level evidence stays readable without inventing stop-level completion.
    pod: booking.pod ? { status: booking.pod.status, recipientName: booking.pod.recipientName,
      signatureUrl: booking.pod.signatureUrl, photoUrl: booking.pod.photoUrl,
      deliveredAt: booking.pod.deliveredAt, notes: booking.pod.notes } : null,
    trackingEvents: booking.trackingEvents.filter(event => event.userVisible).map(event => ({ id: event.id, status: event.status,
      title: event.title, description: event.description, createdAt: event.createdAt })),
  };
}

const closedStatuses: BookingStatus[] = [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED];
export function requireOpenJob(booking: { status: BookingStatus }) {
  if (closedStatuses.includes(booking.status)) throw new DriverPortalError(409, "This job is closed and cannot be changed.");
  if (booking.status === BookingStatus.PENDING_PAYMENT) throw new DriverPortalError(409, "Dispatch must release this job before it can start.");
}

// Serialisation and a booking lock protect against duplicate/offline retries and reassignment races.
export async function withBookingLock<T>(bookingId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new DriverPortalError(409, "The job changed. Refresh and try again.");
}

export async function ensureDriverStops(tx: Tx, booking: PortalBooking) {
  if (booking.driverStops.length || closedStatuses.includes(booking.status)) return;
  const quote = booking.quote;
  const rows: Prisma.DriverStopCreateManyInput[] = [];
  function add(type: DriverStopType, key: string, label: string, address: string, detail: unknown = null) {
    if (!text(address)) return;
    const data = object(detail);
    rows.push({ bookingId: booking.id, stopKey: key, sequence: rows.length + 1, type, label,
      address: text(address), contactName: text(data.contactName) || null,
      contactPhone: text(data.contactPhone || data.phone) || null,
      instructions: text(data.notes || data.instructions || data.specialInstructions) || null });
  }
  add(DriverStopType.COLLECTION, "collection", "Collection", booking.collectionAddress, quote?.collectionAddressDetails);
  const extraDrops = drops(booking.extraDrops ?? quote?.extraDrops);
  extraDrops.forEach((drop, index) => add(DriverStopType.DROP, `drop-${index + 1}`, `Drop ${index + 1}`, dropAddress(drop), drop));
  add(DriverStopType.DELIVERY, "delivery", extraDrops.length ? "Final delivery" : "Delivery", booking.deliveryAddress, quote?.deliveryAddressDetails);
  const journey = text(booking.journeyType || quote?.journeyType).toLowerCase();
  const returnAddress = text(booking.returnAddress || quote?.returnAddress);
  if (returnAddress || /return|round|two[- ]way/.test(journey)) {
    add(DriverStopType.RETURN, "return", "Return", returnAddress || booking.collectionAddress);
  }
  if (rows.length < 2) throw new DriverPortalError(409, "Dispatch must check the collection and delivery addresses.");
  await tx.driverStop.createMany({ data: rows });
}

async function assignedJob(tx: Tx, bookingId: string, driverId: string) {
  const booking = await tx.booking.findFirst({ where: { id: bookingId, driverId }, include: driverJobInclude });
  if (!booking) throw new DriverPortalError(404, "This job is no longer assigned to you.");
  return booking;
}

export async function readDriverJob(bookingId: string, driverId: string) {
  return withBookingLock(bookingId, async tx => {
    const booking = await assignedJob(tx, bookingId, driverId);
    await ensureDriverStops(tx, booking);
    return safeDriverJob(await assignedJob(tx, bookingId, driverId));
  });
}

export async function reconcileDriverActivity(tx: Tx, driverId: string) {
  const driver = await tx.driver.findUnique({ where: { id: driverId } });
  if (!driver) return;
  const active = await tx.booking.count({ where: { driverId, status: BookingStatus.IN_PROGRESS } });
  await tx.driver.update({ where: { id: driverId }, data: {
    availability: !driver.portalOnDuty ? "OFFLINE" : active ? "BUSY" : "AVAILABLE",
  } });
}

async function appendEvent(tx: Tx, booking: PortalBooking, title: string, description: string, status: BookingStatus) {
  await tx.bookingTrackingEvent.create({ data: { bookingId: booking.id, title, description, status, userVisible: true } });
}

async function finishIfReady(tx: Tx, bookingId: string, driverId: string) {
  const booking = await assignedJob(tx, bookingId, driverId);
  if (!booking.driverStops.length || booking.driverStops.some(stop => stop.status !== DriverStopStatus.COMPLETED)) return;
  if (booking.driverStops.some(stop => stop.evidence?.reviewStatus === DriverReviewStatus.PENDING || stop.evidence?.reviewStatus === DriverReviewStatus.REJECTED)) return;
  for (const stop of booking.driverStops.filter(stop => stop.type !== DriverStopType.COLLECTION)) {
    const evidence = stop.evidence;
    if (!evidence || !evidence.photoUrls.length) throw new DriverPortalError(409, "Delivery evidence is missing for a completed stop.");
    if (evidence.outcome === DriverDeliveryOutcome.DELIVERED && (!evidence.recipientName || !evidence.signatureUrl)) {
      throw new DriverPortalError(409, "Recipient and signature are missing for a completed stop.");
    }
    if (evidence.outcome !== DriverDeliveryOutcome.DELIVERED && evidence.reviewStatus !== DriverReviewStatus.APPROVED) {
      throw new DriverPortalError(409, "Dispatch must approve the delivery exception before completion.");
    }
  }
  const finalEvidence = [...booking.driverStops].reverse().find(stop => stop.evidence)?.evidence;
  const completedAt = new Date();
  if (finalEvidence) {
    const data = { status: PODStatus.COMPLETED, recipientName: finalEvidence.recipientName,
      signatureUrl: finalEvidence.signatureUrl, photoUrl: finalEvidence.photoUrls[0] || null,
      notes: "Stop-level delivery evidence is available in the driver portal.", deliveredAt: completedAt };
    await tx.pOD.upsert({ where: { bookingId }, create: { bookingId, ...data }, update: data });
  }
  await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.COMPLETED, trackingEndedAt: completedAt } });
  await appendEvent(tx, booking, "Delivered", "All required stops have been completed.", BookingStatus.COMPLETED);
  await reconcileDriverActivity(tx, driverId);
}

export function requireAssignmentVersion(booking: { driverAssignedAt: Date | null; vehicleId: string | null }, assignedAt: unknown, vehicleId?: unknown) {
  if (assignedAt !== undefined && (typeof assignedAt !== "string" || !booking.driverAssignedAt || !Number.isFinite(Date.parse(assignedAt)) || Date.parse(assignedAt) !== booking.driverAssignedAt.getTime())) {
    throw new DriverPortalError(409, "Dispatch changed this assignment. Review your saved update before retrying.");
  }
  if (vehicleId !== undefined && vehicleId !== booking.vehicleId) throw new DriverPortalError(409, "Dispatch changed this job’s van. Refresh before retrying.");
}

export type DriverAction = "ACCEPT" | "START" | "EN_ROUTE" | "ARRIVE" | "COMPLETE_COLLECTION";
export async function performDriverAction(input: {
  bookingId: string; driverId: string; expectedAssignedAt?: unknown; expectedVehicleId?: unknown; requestId: unknown; action: DriverAction; stopId?: string; capturedAt?: unknown;
}) {
  if (!["ACCEPT", "START", "EN_ROUTE", "ARRIVE", "COMPLETE_COLLECTION"].includes(input.action)) {
    throw new DriverPortalError(400, "Invalid job action.");
  }
  if ((input.action === "ACCEPT" || input.action === "START") && input.stopId) {
    throw new DriverPortalError(400, "This action does not take a stop identifier.");
  }
  const id = requestId(input.requestId);
  const capturedAt = capturedDate(input.capturedAt);
  return withBookingLock(input.bookingId, async tx => {
    let booking = await assignedJob(tx, input.bookingId, input.driverId);
    const previous = await tx.driverJobAction.findUnique({ where: { driverId_requestId: { driverId: input.driverId, requestId: id } } });
    if (previous) {
      if (previous.bookingId !== input.bookingId || previous.action !== input.action || (previous.stopId || "") !== (input.stopId || "")) {
        throw new DriverPortalError(409, "This request identifier has already been used for another action.");
      }
      return safeDriverJob(booking);
    }
    requireAssignmentVersion(booking, input.expectedAssignedAt, input.expectedVehicleId);
    requireOpenJob(booking);
    await ensureDriverStops(tx, booking);
    booking = await assignedJob(tx, input.bookingId, input.driverId);
    const driver = await tx.driver.findUnique({ where: { id: input.driverId } });
    if (!driver?.active) throw new DriverPortalError(401, "Driver account is inactive.");
    let title = "";
    if (input.action === "ACCEPT") {
      if (booking.driverAcknowledgedAt) throw new DriverPortalError(409, "This job has already been accepted.");
      await tx.booking.update({ where: { id: booking.id }, data: { driverAcknowledgedAt: new Date(), status: BookingStatus.ASSIGNED } });
      title = "Job accepted";
    } else {
      if (!driver.portalOnDuty) throw new DriverPortalError(409, "Go on duty before starting work.");
      if (!booking.driverAcknowledgedAt) throw new DriverPortalError(409, "Accept the assigned job first.");
      const next = booking.driverStops.find(stop => stop.status !== DriverStopStatus.COMPLETED);
      if (!next) throw new DriverPortalError(409, "There are no remaining stops.");
      if (input.action === "START") {
        if (booking.driverJourneyStartedAt) throw new DriverPortalError(409, "This journey has already started.");
        if (!booking.vehicleId || !driver.vehicleId || driver.vehicleId !== booking.vehicleId || !booking.vehicle?.active) {
          throw new DriverPortalError(409, "Dispatch must assign this job and its van to you through Admin Drivers.");
        }
        const unsafeCheck = await tx.driverVehicleCheck.findFirst({ where: {
          vehicleId: booking.vehicleId, unsafeToDrive: true, resolvedAt: null,
        } });
        if (unsafeCheck) throw new DriverPortalError(409, "This van has an unresolved unsafe defect. Contact dispatch.");
        const other = await tx.booking.findFirst({ where: { driverId: input.driverId, id: { not: booking.id }, status: BookingStatus.IN_PROGRESS } });
        if (other) throw new DriverPortalError(409, "Finish your current job before starting another.");
        await tx.booking.update({ where: { id: booking.id }, data: { driverJourneyStartedAt: new Date(), status: BookingStatus.IN_PROGRESS } });
        await tx.driverStop.update({ where: { id: next.id }, data: { status: DriverStopStatus.EN_ROUTE, enRouteAt: new Date() } });
        title = `${next.label} en route`;
      } else {
        if (!booking.driverJourneyStartedAt) throw new DriverPortalError(409, "Start the journey first.");
        if (next.id !== input.stopId) throw new DriverPortalError(409, "Complete the current stop before continuing.");
        if (next.evidence?.reviewStatus === DriverReviewStatus.PENDING) throw new DriverPortalError(409, "Dispatch is reviewing this delivery exception.");
        if (input.action === "EN_ROUTE") {
          if (next.status !== DriverStopStatus.PENDING) throw new DriverPortalError(409, "This stop has already started.");
          await tx.driverStop.update({ where: { id: next.id }, data: { status: DriverStopStatus.EN_ROUTE, enRouteAt: new Date() } });
          title = `${next.label} en route`;
        } else if (input.action === "ARRIVE") {
          if (next.status !== DriverStopStatus.EN_ROUTE) throw new DriverPortalError(409, "Start travelling to this stop first.");
          await tx.driverStop.update({ where: { id: next.id }, data: { status: DriverStopStatus.ARRIVED, arrivedAt: new Date() } });
          title = `${next.label} arrived`;
        } else if (input.action === "COMPLETE_COLLECTION") {
          if (next.type !== DriverStopType.COLLECTION || next.status !== DriverStopStatus.ARRIVED) {
            throw new DriverPortalError(409, "Arrive at collection before confirming the goods are collected.");
          }
          await tx.driverStop.update({ where: { id: next.id }, data: { status: DriverStopStatus.COMPLETED, completedAt: new Date() } });
          title = "Goods collected";
        } else throw new DriverPortalError(400, "Invalid job action.");
      }
      await reconcileDriverActivity(tx, input.driverId);
    }
    await tx.driverJobAction.create({ data: { bookingId: booking.id, driverId: input.driverId,
      requestId: id, action: input.action, stopId: input.stopId || null, capturedAt } });
    await appendEvent(tx, booking, title, "Driver updated job progress.", input.action === "ACCEPT" ? BookingStatus.ASSIGNED : BookingStatus.IN_PROGRESS);
    return safeDriverJob(await assignedJob(tx, booking.id, input.driverId));
  });
}

// Evidence URLs must come from our configured upload folder for this booking.
export function validateEvidenceUrl(value: unknown, bookingId: string) {
  const raw = text(value, 2000);
  if (!raw) return "";
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) throw new DriverPortalError(503, "Delivery photo storage is not configured.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new DriverPortalError(400, "Invalid evidence URL."); }
  const prefix = `/${cloud}/image/upload/`;
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(prefix)
    || !url.pathname.slice(prefix.length).includes(`/streamline-logistics/pod/${bookingId}/`)) {
    throw new DriverPortalError(400, "Use evidence uploaded for this booking.");
  }
  return raw;
}

export async function submitStopEvidence(input: {
  bookingId: string; driverId: string; expectedAssignedAt?: unknown; expectedVehicleId?: unknown; stopId: string; requestId: unknown; recipientName?: unknown;
  signatureUrl?: unknown; photoUrls?: unknown; notes?: unknown; outcome?: unknown;
  exceptionReason?: unknown; capturedAt?: unknown; latitude?: unknown; longitude?: unknown; accuracy?: unknown;
}) {
  const id = requestId(input.requestId);
  const capturedAt = capturedDate(input.capturedAt);
  const outcome = text(input.outcome) || DriverDeliveryOutcome.DELIVERED;
  if (!Object.values(DriverDeliveryOutcome).includes(outcome as DriverDeliveryOutcome)) throw new DriverPortalError(400, "Invalid delivery outcome.");
  const recipientName = text(input.recipientName, 200);
  const signatureUrl = validateEvidenceUrl(input.signatureUrl, input.bookingId);
  if (!Array.isArray(input.photoUrls) || input.photoUrls.length > 8) throw new DriverPortalError(400, "Provide up to eight delivery photos.");
  const photoUrls = (input.photoUrls as unknown[]).map(url => validateEvidenceUrl(url, input.bookingId)).filter(Boolean);
  const exceptionReason = text(input.exceptionReason);
  if (outcome === DriverDeliveryOutcome.DELIVERED && (!recipientName || !signatureUrl || !photoUrls.length)) {
    throw new DriverPortalError(400, "Recipient name, signature and delivery photo are required.");
  }
  if (outcome !== DriverDeliveryOutcome.DELIVERED && (!exceptionReason || !photoUrls.length)) {
    throw new DriverPortalError(400, "Delivery exceptions require a reason and photo for dispatch review.");
  }
  function coordinate(value: unknown, max: number) {
    if (value == null) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > max) throw new DriverPortalError(400, "Invalid evidence location.");
    return value;
  }
  const latitude = coordinate(input.latitude, 90), longitude = coordinate(input.longitude, 180);
  if ((latitude == null) !== (longitude == null)) throw new DriverPortalError(400, "Provide both latitude and longitude.");
  const accuracy = coordinate(input.accuracy, 100000);
  if (accuracy != null && accuracy < 0) throw new DriverPortalError(400, "Invalid location accuracy.");
  return withBookingLock(input.bookingId, async tx => {
    const booking = await assignedJob(tx, input.bookingId, input.driverId);
    const previous = await tx.driverJobAction.findUnique({ where: { driverId_requestId: { driverId: input.driverId, requestId: id } } });
    if (previous) {
      if (previous.bookingId !== input.bookingId || previous.stopId !== input.stopId || previous.action !== "EVIDENCE") {
        throw new DriverPortalError(409, "This request identifier has already been used.");
      }
      return safeDriverJob(booking);
    }
    requireAssignmentVersion(booking, input.expectedAssignedAt, input.expectedVehicleId);
    requireOpenJob(booking);
    const next = booking.driverStops.find(stop => stop.status !== DriverStopStatus.COMPLETED);
    if (!booking.driverAcknowledgedAt || !booking.driverJourneyStartedAt || next?.id !== input.stopId
      || next.type === DriverStopType.COLLECTION || next.status !== DriverStopStatus.ARRIVED) {
      throw new DriverPortalError(409, "Arrive at the current delivery stop before submitting evidence.");
    }
    if (next.evidence && next.evidence.reviewStatus !== DriverReviewStatus.REJECTED) {
      throw new DriverPortalError(409, "Evidence has already been submitted for this stop.");
    }
    if (next.evidence) {
      // Preserve the rejected submission before the driver's next attempt replaces the active evidence.
      await tx.driverIncident.create({ data: { bookingId: booking.id, driverId: input.driverId, stopId: next.id,
        requestId: `evidence-history-${next.evidence.id}-${Date.now()}`, reason: DriverIncidentReason.OTHER,
        notes: `Archived rejected evidence: ${JSON.stringify(next.evidence)}`, photoUrls: next.evidence.photoUrls,
        acknowledgedAt: new Date(), acknowledgedBy: "SYSTEM", resolvedAt: new Date(), resolvedBy: "SYSTEM",
        dispatchResponse: "Evidence retained for audit before a new delivery attempt." } });
    }
    const data = { recipientName: recipientName || null, signatureUrl: signatureUrl || null, photoUrls,
      notes: text(input.notes) || null, outcome: outcome as DriverDeliveryOutcome,
      exceptionReason: exceptionReason || null,
      reviewStatus: outcome === DriverDeliveryOutcome.DELIVERED ? DriverReviewStatus.NOT_REQUIRED : DriverReviewStatus.PENDING,
      capturedAt, receivedAt: new Date(), latitude, longitude, accuracy,
      reviewedAt: null, reviewedBy: null, reviewNotes: null };
    await tx.driverStopEvidence.upsert({ where: { stopId: next.id }, create: { stopId: next.id, ...data }, update: data });
    await tx.driverJobAction.create({ data: { bookingId: booking.id, driverId: input.driverId,
      stopId: next.id, requestId: id, action: "EVIDENCE", capturedAt } });
    if (outcome === DriverDeliveryOutcome.DELIVERED) {
      await tx.driverStop.update({ where: { id: next.id }, data: { status: DriverStopStatus.COMPLETED, completedAt: new Date() } });
      await appendEvent(tx, booking, `${next.label} completed`, "Delivery evidence has been recorded.", BookingStatus.IN_PROGRESS);
      await finishIfReady(tx, booking.id, input.driverId);
    } else {
      await tx.bookingTrackingEvent.create({ data: { bookingId: booking.id, status: booking.status,
        title: `${next.label}: exception awaiting review`, description: exceptionReason, userVisible: false } });
    }
    return safeDriverJob(await assignedJob(tx, booking.id, input.driverId));
  });
}

// Only an authenticated admin route may call this; failed/partial deliveries cannot be approved as successful.
export async function reviewStopEvidence(input: {
  stopId: string; decision: "APPROVE" | "REJECT"; reviewedBy: string; notes: unknown;
}) {
  const stop = await prisma.driverStop.findUnique({ where: { id: input.stopId } });
  if (!stop) throw new DriverPortalError(404, "Delivery stop not found.");
  const notes = text(input.notes);
  if (!notes) throw new DriverPortalError(400, "Record a dispatch review note.");
  return withBookingLock(stop.bookingId, async tx => {
    const booking = await tx.booking.findUnique({ where: { id: stop.bookingId }, include: driverJobInclude });
    if (!booking?.driverId) throw new DriverPortalError(409, "Assign a driver before reviewing this stop.");
    requireOpenJob(booking);
    const current = booking.driverStops.find(value => value.id === input.stopId);
    if (current?.evidence?.reviewStatus !== DriverReviewStatus.PENDING) throw new DriverPortalError(409, "This evidence is not awaiting review.");
    if (input.decision === "APPROVE" && ![DriverDeliveryOutcome.REFUSED_SIGNATURE, DriverDeliveryOutcome.AUTHORISED_UNATTENDED].includes(current.evidence.outcome as "REFUSED_SIGNATURE" | "AUTHORISED_UNATTENDED")) {
      throw new DriverPortalError(409, "Failed or partial deliveries need a retry or an admin booking resolution; they cannot be marked delivered.");
    }
    await tx.driverStopEvidence.update({ where: { stopId: input.stopId }, data: {
      reviewStatus: input.decision === "APPROVE" ? DriverReviewStatus.APPROVED : DriverReviewStatus.REJECTED,
      reviewedAt: new Date(), reviewedBy: text(input.reviewedBy, 200), reviewNotes: notes,
    } });
    if (input.decision === "APPROVE") {
      await tx.driverStop.update({ where: { id: input.stopId }, data: { status: DriverStopStatus.COMPLETED, completedAt: new Date() } });
      await appendEvent(tx, booking, `${current.label} completed`, "Dispatch approved the recorded delivery exception.", BookingStatus.IN_PROGRESS);
      await finishIfReady(tx, booking.id, booking.driverId);
    }
    await tx.driverPortalNotification.create({ data: { driverId: booking.driverId,
      dedupeKey: `review-${current.evidence.id}-${Date.now()}`, bookingId: booking.id,
      title: input.decision === "APPROVE" ? "Delivery exception approved" : "Delivery needs another attempt", body: notes } });
    return safeDriverJob(await assignedJob(tx, booking.id, booking.driverId));
  });
}

export async function reportDriverIncident(input: {
  bookingId: string; driverId: string; expectedAssignedAt?: unknown; expectedVehicleId?: unknown; stopId?: string; requestId: unknown;
  reason: unknown; notes: unknown; photoUrls?: unknown; revisedArrivalAt?: unknown; capturedAt?: unknown;
}) {
  const id = requestId(input.requestId), notes = text(input.notes);
  const reason = text(input.reason) as DriverIncidentReason;
  if (!Object.values(DriverIncidentReason).includes(reason) || !notes) throw new DriverPortalError(400, "Choose a problem and enter its details.");
  const capturedAt = capturedDate(input.capturedAt);
  const revisedArrivalAt = input.revisedArrivalAt ? new Date(String(input.revisedArrivalAt)) : null;
  if (revisedArrivalAt && !Number.isFinite(revisedArrivalAt.getTime())) throw new DriverPortalError(400, "Invalid revised arrival time.");
  const photoUrls = Array.isArray(input.photoUrls) ? input.photoUrls.slice(0, 8).map(url => validateEvidenceUrl(url, input.bookingId)).filter(Boolean) : [];
  return withBookingLock(input.bookingId, async tx => {
    const booking = await assignedJob(tx, input.bookingId, input.driverId);
    const previous = await tx.driverIncident.findUnique({ where: { driverId_requestId: { driverId: input.driverId, requestId: id } } });
    if (previous) {
      if (previous.bookingId !== booking.id) throw new DriverPortalError(409, "This request identifier has already been used.");
      return previous;
    }
    requireAssignmentVersion(booking, input.expectedAssignedAt, input.expectedVehicleId);
    requireOpenJob(booking);
    if (input.stopId && !booking.driverStops.some(stop => stop.id === input.stopId)) throw new DriverPortalError(400, "Stop does not belong to this job.");
    const incident = await tx.driverIncident.create({ data: { bookingId: booking.id, driverId: input.driverId,
      stopId: input.stopId || null, requestId: id, reason, notes, photoUrls, revisedArrivalAt, capturedAt } });
    await tx.bookingTrackingEvent.create({ data: { bookingId: booking.id, status: booking.status,
      title: "Driver reported a problem", description: `${reason}: ${notes}`, userVisible: false } });
    return incident;
  });
}
