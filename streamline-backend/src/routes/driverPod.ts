import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingStatus, DriverStopStatus, DriverStopType, PODStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  authenticateDriver, DriverPortalError, readDriverJob, requestId, requireAssignmentVersion,
  requireOpenJob, submitStopEvidence, text, validateEvidenceUrl, withBookingLock,
} from "../lib/driverPortal";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

type Handler = (req: express.Request, res: express.Response, driverId: string) => Promise<unknown>;
function driverRoute(handler: Handler): express.RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const driver = await authenticateDriver(req.headers.authorization);
      if (!driver) return void res.status(401).json({ error: "Please sign in to the driver portal." });
      await handler(req, res, driver.id);
    } catch (error) {
      if (error instanceof DriverPortalError) return void res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        return void res.status(409).json({ error: "This job changed. Refresh and retry using the same request identifier." });
      }
      console.error("Driver proof of delivery error:", error);
      res.status(500).json({ error: "Unable to confirm delivery evidence. Keep your draft and retry." });
    }
  };
}

function bookingId(req: express.Request) {
  const id = text(req.params.bookingId, 100);
  if (!id) throw new DriverPortalError(400, "Booking identifier is required.");
  return id;
}

async function currentBooking(id: string, driverId: string) {
  const booking = await prisma.booking.findFirst({ where: { id, driverId }, include: { pod: true } });
  if (!booking) throw new DriverPortalError(404, "This job is no longer assigned to you.");
  return booking;
}

function requireWritableEvidence(booking: Awaited<ReturnType<typeof currentBooking>>) {
  requireOpenJob(booking);
  if (booking.pod?.status === PODStatus.COMPLETED || booking.pod?.deliveredAt) {
    throw new DriverPortalError(409, "The existing completed proof of delivery is locked. Contact dispatch if this job needs correction.");
  }
}

router.get("/:bookingId", driverRoute(async (req, res, driverId) => {
  const job = await readDriverJob(bookingId(req), driverId);
  res.json({ pod: job.pod, stops: job.stops, nextStop: job.nextStop, job });
}));

router.get("/:bookingId/stops/:stopId", driverRoute(async (req, res, driverId) => {
  const job = await readDriverJob(bookingId(req), driverId);
  const stop = job.stops.find(value => value.id === text(req.params.stopId, 100));
  if (!stop) throw new DriverPortalError(404, "Delivery stop not found on this job.");
  res.json({ stop, evidence: stop.evidence });
}));

// Uploads return media references only. Completing a stop is a separate validated transaction.
router.post("/:bookingId/upload", driverRoute(async (req, res, driverId) => {
  const id = bookingId(req);
  requireWritableEvidence(await currentBooking(id, driverId));
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new DriverPortalError(503, "Delivery photo storage is not configured. Contact dispatch.");
  }
  await new Promise<void>((resolve, reject) => upload.single("file")(req, res, error => {
    if (error) reject(new DriverPortalError(400, "Upload one image smaller than 8 MB.")); else resolve();
  }));
  requireAssignmentVersion(await currentBooking(id, driverId), req.body?.expectedAssignedAt, req.body?.expectedVehicleId);
  const type = text(req.body?.type, 20);
  if (type !== "signature" && type !== "photo") throw new DriverPortalError(400, "Choose signature or photo upload.");
  const uploadId = requestId(req.body?.requestId);
  const purpose = text(req.body?.purpose, 20) || "DELIVERY";
  if (!["DELIVERY", "INCIDENT"].includes(purpose)) throw new DriverPortalError(400, "Invalid photo purpose.");
  if (purpose === "INCIDENT" && type !== "photo") throw new DriverPortalError(400, "Problem reports accept photos only.");
  const job = await readDriverJob(id, driverId);
  const stopId = text(req.body?.stopId, 100);
  let folder = `streamline-logistics/pod/${id}/incidents`;
  if (purpose === "DELIVERY") {
    const stop = job.nextStop;
    if (!stopId || stop?.id !== stopId || stop.status !== DriverStopStatus.ARRIVED || stop.type === DriverStopType.COLLECTION) {
      throw new DriverPortalError(409, "Arrive at the current delivery stop before uploading its evidence.");
    }
    if (stop.evidence && stop.evidence.reviewStatus !== "REJECTED") {
      throw new DriverPortalError(409, "Evidence for this stop has already been submitted.");
    }
    folder = `streamline-logistics/pod/${id}/stops/${stop.id}`;
  } else if (stopId && !job.stops.some(stop => stop.id === stopId)) {
    throw new DriverPortalError(400, "Stop does not belong to this job.");
  }
  if (!req.file || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(req.file.mimetype)) {
    throw new DriverPortalError(400, "Choose a JPEG, PNG, WebP or HEIC image.");
  }
  const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`, {
    folder, resource_type: "image", public_id: `${type}-${uploadId}`, overwrite: false,
  });
  // An assignment or completion could change while the media upload is in flight.
  const current = await currentBooking(id, driverId);
  requireWritableEvidence(current);
  requireAssignmentVersion(current, req.body?.expectedAssignedAt, req.body?.expectedVehicleId);
  res.json({ message: "Evidence uploaded. Submit the delivery form to confirm this stop.",
    type, purpose, stopId: stopId || null, requestId: uploadId, url: result.secure_url });
}));

// Preserve the legacy draft URL without using a draft to complete a stop or booking.
// The new portal keeps unfinished per-stop forms on the device and submits once.
router.post("/:bookingId", driverRoute(async (req, res, driverId) => {
  const id = bookingId(req);
  const signatureUrl = validateEvidenceUrl(req.body?.signatureUrl, id);
  const photoUrl = validateEvidenceUrl(req.body?.photoUrl, id);
  const recipientName = text(req.body?.recipientName, 200);
  const notes = text(req.body?.notes);
  const pod = await withBookingLock(id, async tx => {
    const booking = await tx.booking.findFirst({ where: { id, driverId }, include: { pod: true } });
    if (!booking) throw new DriverPortalError(404, "This job is no longer assigned to you.");
    requireWritableEvidence(booking);
    const data = { recipientName: recipientName || undefined, signatureUrl: signatureUrl || undefined,
      photoUrl: photoUrl || undefined, notes: notes || undefined };
    return tx.pOD.upsert({ where: { bookingId: id },
      create: { bookingId: id, status: PODStatus.PENDING, ...data }, update: data });
  });
  res.json({ pod, message: "Draft saved. This does not mark any delivery stop completed." });
}));

async function completeStop(req: express.Request, res: express.Response, driverId: string) {
  const id = bookingId(req);
  // An explicit stop identifier is essential: a retry must never apply evidence to the next recipient.
  const stopId = text(req.params.stopId, 100) || text(req.body?.stopId, 100);
  if (!stopId) throw new DriverPortalError(400, "Select the delivery stop before submitting evidence.");
  const assigned = await currentBooking(id, driverId);
  if (assigned.status !== BookingStatus.COMPLETED) requireWritableEvidence(assigned);
  function stopMedia(value: unknown) {
    const url = validateEvidenceUrl(value, id);
    if (url && !new URL(url).pathname.includes(`/streamline-logistics/pod/${id}/stops/${stopId}/`)) {
      throw new DriverPortalError(400, "Use evidence uploaded for this delivery stop.");
    }
    return url;
  }
  const signatureUrl = stopMedia(req.body?.signatureUrl);
  const photoInput = req.body?.photoUrls ?? (text(req.body?.photoUrl) ? [req.body.photoUrl] : []);
  if (!Array.isArray(photoInput) || photoInput.length > 8) throw new DriverPortalError(400, "Provide up to eight delivery photos.");
  const photoUrls = photoInput.map(stopMedia);
  const job = await submitStopEvidence({
    bookingId: id, driverId, stopId, expectedAssignedAt: req.body?.expectedAssignedAt, expectedVehicleId: req.body?.expectedVehicleId, requestId: req.body?.requestId,
    recipientName: req.body?.recipientName, signatureUrl, photoUrls,
    notes: req.body?.notes, outcome: req.body?.outcome, exceptionReason: req.body?.exceptionReason,
    capturedAt: req.body?.capturedAt, latitude: req.body?.latitude,
    longitude: req.body?.longitude, accuracy: req.body?.accuracy,
  });
  const stop = job.stops.find(value => value.id === stopId);
  const pendingReview = stop?.evidence?.reviewStatus === "PENDING";
  res.json({ job, booking: job, pod: job.pod, stop,
    message: pendingReview ? "Exception recorded for dispatch review. This stop is not completed yet."
      : job.status === BookingStatus.COMPLETED ? "All stops completed. Delivery evidence saved."
      : "Delivery stop completed. Continue to the next stop." });
}

router.post("/:bookingId/stops/:stopId/complete", driverRoute(completeStop));
// Existing clients cannot use this URL to bypass the new stop/evidence requirements.
router.post("/:bookingId/complete", driverRoute(completeStop));

export default router;
