import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DriverPortalError } from "./driverPortal";

function configure() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new DriverPortalError(503, "Photo storage is not configured. Contact dispatch.");
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
}
export function validateImage(file: Express.Multer.File | undefined) {
  if (!file || !file.buffer.length || file.buffer.length > 8 * 1024 * 1024) throw new DriverPortalError(400, "Upload one image no larger than 8 MB.");
  const b = file.buffer;
  const jpeg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const png = b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = b.length > 12 && b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP";
  const heic = b.length > 20 && b.toString("ascii",4,8) === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1/.test(b.toString("ascii",8,Math.min(b.length,32)));
  const matches = file.mimetype === "image/jpeg" && jpeg || file.mimetype === "image/png" && png || file.mimetype === "image/webp" && webp || ["image/heic","image/heif"].includes(file.mimetype) && heic;
  if (!matches) throw new DriverPortalError(400, "Choose a genuine JPEG, PNG, WebP or HEIC image.");
  return crypto.createHash("sha256").update(b).digest("hex");
}
type Binding = { driverId: string; requestId: string; recordRequestId?: string | null; purpose: string; kind: string; bookingId?: string | null; vehicleId?: string | null; stopId?: string | null; handoverId?: string | null };
// The post-upload permission check runs inside the same fleet lock as assignment changes.
export async function storeEvidence(file: Express.Multer.File | undefined, binding: Binding, folder: string, permitted: (tx: Prisma.TransactionClient) => Promise<void>) {
  configure(); const sha256 = validateImage(file);
  const previous = await prisma.driverEvidenceUpload.findUnique({ where: { driverId_requestId: { driverId: binding.driverId, requestId: binding.requestId } } });
  if (previous) {
    if (previous.sha256 !== sha256 || ["purpose","kind","bookingId","vehicleId","stopId","handoverId","recordRequestId"].some(key => (previous[key as keyof typeof previous] || null) !== (binding[key as keyof Binding] || null))) throw new DriverPortalError(409, "This photo request belongs to different evidence. Keep the original request or choose a new photo.");
    await prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`; await permitted(tx); });
    return previous;
  }
  const publicId = `${folder}/${binding.kind}-${binding.driverId}-${binding.requestId}-${sha256.slice(0,16)}`;
  const uploaded = await cloudinary.uploader.upload(`data:${file!.mimetype};base64,${file!.buffer.toString("base64")}`, { public_id: publicId, resource_type: "image", type: "authenticated", overwrite: false, unique_filename: false });
  // A failed permission check leaves a private orphan, never a public customer image.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`; await permitted(tx);
    const existing = await tx.driverEvidenceUpload.findUnique({ where: { driverId_requestId: { driverId: binding.driverId, requestId: binding.requestId } } });
    if (existing) {
      if (existing.sha256 !== sha256 || existing.publicId !== uploaded.public_id) throw new DriverPortalError(409, "This upload request already contains different evidence.");
      return existing;
    }
    return tx.driverEvidenceUpload.create({ data: { ...binding, publicId: uploaded.public_id, url: uploaded.secure_url, mimeType: file!.mimetype, bytes: file!.buffer.length, sha256 } });
  }, { isolationLevel: "Serializable" });
}
export async function requireUploaded(tx: Prisma.TransactionClient, urls: string[], binding: Omit<Binding,"requestId"|"kind">, kind = "photo", allowLegacy = false) {
  if (new Set(urls).size !== urls.length || urls.length > 8) throw new DriverPortalError(400, "Use up to eight different photos.");
  for (const url of urls) {
    const upload = await tx.driverEvidenceUpload.findUnique({ where: { url } });
    if (!upload) {
      // Legacy media may remain on already-existing drafts; new private uploads always need an ownership record.
      if (allowLegacy && legacyUrl(url, binding)) continue;
      throw new DriverPortalError(400, "Use images uploaded by you for this record.");
    }
    if (upload.driverId !== binding.driverId || upload.purpose !== binding.purpose || upload.kind !== kind || ["bookingId","vehicleId","stopId","handoverId","recordRequestId"].some(key => binding[key as keyof typeof binding] !== undefined && (upload[key as keyof typeof upload] || null) !== (binding[key as keyof typeof binding] || null))) throw new DriverPortalError(403, "This image belongs to another driver, stop or vehicle record.");
  }
}
function legacyUrl(value: string, binding: Omit<Binding,"requestId"|"kind">) {
  try {
    const u = new URL(value), prefix = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
    if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com" || u.username || u.password || !u.pathname.startsWith(prefix)) return false;
    const folder = binding.bookingId ? `streamline-logistics/pod/${binding.bookingId}/${binding.purpose === "INCIDENT" ? "incidents" : `stops/${binding.stopId}`}/` : `streamline-logistics/vehicle-checks/${binding.driverId}/${binding.vehicleId}/`;
    return u.pathname.includes("/"+folder);
  } catch { return false; }
}
export function privateEvidenceLink(value: string) {
  try {
    const u = new URL(value), prefix = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/`;
    if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com" || u.username || u.password || !u.pathname.startsWith(prefix)) return value;
    const match = u.pathname.slice(prefix.length).match(/^v\d+\/(streamline-logistics\/(?:pod|vehicle-checks|handovers)\/[^?]+)\.([a-zA-Z0-9]+)$/);
    if (!match) return value;
    configure();
    return cloudinary.utils.private_download_url(match[1], match[2], { type: "authenticated", resource_type: "image", attachment: false, expires_at: Math.floor(Date.now()/1000)+300 });
  } catch { return value; }
}
export function evidenceLinks<T>(value: T): T {
  if (Array.isArray(value)) return value.map(evidenceLinks) as T;
  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Buffer) && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key,item]) => {
    if (["photoUrls","returnPhotoUrls"].includes(key) && Array.isArray(item)) return [key,item.map(url=>typeof url==="string"?privateEvidenceLink(url):url)];
    if (["photoUrl","signatureUrl"].includes(key) && typeof item==="string") return [key,privateEvidenceLink(item)];
    return [key,evidenceLinks(item)];
  })) as T;
  return value;
}
