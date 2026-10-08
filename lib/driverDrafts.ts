// Browser-only storage. A committed local draft is never a confirmed job update.
// Call these functions from client effects/event handlers, not during server rendering.
export type DraftKind = "DELIVERY" | "INCIDENT" | "VEHICLE_CHECK";
export type DraftPhase = "EDITING" | "PENDING_SUBMISSION" | "NEEDS_REVIEW";
export type DraftJson = null | boolean | number | string | DraftJson[] | { [key: string]: DraftJson };
export type DraftMedia = { id: string; name: string; blob: Blob; uploadedUrl?: string };
export type DraftBinding = {
  driverId: string; kind: DraftKind; bookingId?: string; stopId?: string;
  assignedAt?: string; vehicleId?: string;
};
export type DriverDraft = DraftBinding & {
  id: string; requestId: string; revision: number; phase: DraftPhase;
  fields: { [key: string]: DraftJson }; photos: DraftMedia[]; signature: DraftMedia | null;
  capturedAt: string; createdAt: string; updatedAt: string; reviewMessage?: string;
};
export type QueuedDriverAction = {
  id: string; driverId: string; bookingId: string; assignedAt: string;
  vehicleId: string | null; stopId: string | null; requestId: string;
  action: "ACCEPT" | "START" | "EN_ROUTE" | "ARRIVE" | "COMPLETE_COLLECTION";
  capturedAt: string; queuedAt: string; queueOrder: number; phase: "PENDING" | "NEEDS_REVIEW"; reviewMessage?: string;
};
export type CachedDriverJob = { id: string; driverId: string; bookingId: string; assignedAt: string | null; savedAt: string; job: { [key: string]: DraftJson } };
export type DriverActionInput = Omit<QueuedDriverAction, "id" | "queuedAt" | "queueOrder" | "phase" | "reviewMessage">;
export class DriverDraftError extends Error { constructor(message: string) { super(message); this.name = "DriverDraftError"; } }

const DB_NAME = "streamline-driver-drafts";
const MAX_PHOTOS = 8, MAX_MEDIA_BYTES = 8 * 1024 * 1024, MAX_DRIVER_BYTES = 200 * 1024 * 1024;
const photoTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
let database: Promise<IDBDatabase> | null = null;

function storageError(error?: DOMException | null) {
  return new DriverDraftError(error?.name === "QuotaExceededError" ? "Your device is out of draft storage. Upload or review saved drafts before adding more. This draft has not been saved." : "Unable to save or read driver drafts on this device. Allow site storage and try again. Keep this page open until your work is saved.");
}
function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new DriverDraftError("Driver draft storage is unavailable on this device."));
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    let abandoned = false;
    request.onupgradeneeded = () => {
      for (const name of ["drafts", "actions", "jobs"]) {
        const store = request.result.createObjectStore(name, { keyPath: "id" });
        store.createIndex("driverId", "driverId", { unique: false });
      }
    };
    request.onblocked = () => { abandoned = true; database = null; reject(new DriverDraftError("Close other driver portal tabs, then retry saving your draft.")); };
    request.onerror = () => { database = null; reject(storageError(request.error)); };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) { db.close(); return; }
      db.onversionchange = () => { db.close(); database = null; };
      db.onclose = () => { database = null; };
      resolve(db);
    };
  });
  const opening = database;
  void opening.catch(() => { if (database === opening) database = null; });
  return database;
}

// Resolve writes only after the transaction commits, including quota/storage failures.
async function transaction<T>(name: string, mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(name, mode); } catch { database = null; reject(storageError()); return; }
    let value: T, hasValue = false, failure: Error | null = null;
    const fail = (error: Error) => { failure = error; try { tx.abort(); } catch { reject(error); } };
    tx.oncomplete = () => { if (hasValue) resolve(value); else reject(new DriverDraftError("The draft operation did not finish. Please retry.")); };
    tx.onabort = () => reject(failure || storageError(tx.error));
    tx.onerror = () => { /* The transaction abort event supplies the final failure. */ };
    try { run(tx.objectStore(name), result => { value = result; hasValue = true; }, fail); }
    catch (error) { fail(error instanceof Error ? error : storageError()); }
  });
}

function identifier(value: string, label: string) {
  if (typeof value !== "string" || !value || value.length > 120 || /[\u0000-\u001f]/.test(value)) throw new DriverDraftError(`Invalid ${label}. Refresh the job before saving.`);
  return value;
}
function validTime(value: string, label: string) {
  if (!value || !Number.isFinite(Date.parse(value))) throw new DriverDraftError(`Invalid ${label}.`);
  return new Date(value).toISOString();
}
function newId() {
  if (typeof window === "undefined" || !window.crypto?.randomUUID) throw new DriverDraftError("Secure draft storage needs a supported browser and a secure connection.");
  return window.crypto.randomUUID();
}
function cloneFields(fields: { [key: string]: DraftJson }) {
  function inspect(value: DraftJson, depth = 0): void {
    if (depth > 10) throw new DriverDraftError("Draft details are too complex.");
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(item => inspect(item, depth + 1)); return; }
    if (typeof value === "object" && value && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [key, item] of Object.entries(value)) {
        if (["password", "token", "authorization", "sessiontoken", "drivertoken", "__proto__", "constructor", "prototype"].includes(key.toLowerCase())) throw new DriverDraftError("Login credentials cannot be stored in a driver draft.");
        inspect(item, depth + 1);
      }
      return;
    }
    throw new DriverDraftError("Draft details must contain plain text, numbers or form values.");
  }
  if (!fields || Array.isArray(fields) || typeof fields !== "object") throw new DriverDraftError("Invalid draft details.");
  inspect(fields);
  const json = JSON.stringify(fields);
  if (new TextEncoder().encode(json).length > 64 * 1024) throw new DriverDraftError("Draft notes are too long to save.");
  return JSON.parse(json) as { [key: string]: DraftJson };
}
function mediaSize(media: DraftMedia) {
  identifier(media.id, "photo identifier");
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(media.id)) throw new DriverDraftError("Invalid photo request identifier.");
  if (!(media.blob instanceof Blob) || !media.blob.size || media.blob.size > MAX_MEDIA_BYTES || !photoTypes.includes(media.blob.type)) throw new DriverDraftError("Use a JPEG, PNG, WebP or HEIC image no larger than 8 MB.");
  if (media.uploadedUrl) validateUploadUrl(media.uploadedUrl);
  return media.blob.size;
}
function validateUploadUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new DriverDraftError("Invalid uploaded photo address."); }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") throw new DriverDraftError("Use the photo address returned by the driver upload service.");
}
function draftSize(draft: Pick<DriverDraft, "photos" | "signature">) {
  if (draft.photos.length > MAX_PHOTOS) throw new DriverDraftError("Save no more than 8 photos per draft.");
  const all = [...draft.photos, ...(draft.signature ? [draft.signature] : [])];
  if (new Set(all.map(item => item.id)).size !== all.length) throw new DriverDraftError("Each photo and signature needs its own identifier.");
  return all.reduce((total, item) => total + mediaSize(item), 0);
}
function bindingKey(binding: DraftBinding) {
  identifier(binding.driverId, "driver");
  if (!["DELIVERY", "INCIDENT", "VEHICLE_CHECK"].includes(binding.kind)) throw new DriverDraftError("Invalid draft type.");
  if (binding.kind === "VEHICLE_CHECK") identifier(binding.vehicleId || "", "assigned van");
  else { identifier(binding.bookingId || "", "booking"); validTime(binding.assignedAt || "", "job assignment"); }
  if (binding.kind === "DELIVERY") identifier(binding.stopId || "", "delivery stop");
  return JSON.stringify([binding.driverId, binding.kind, binding.bookingId || "", binding.stopId || "", binding.assignedAt ? validTime(binding.assignedAt, "job assignment") : "", binding.vehicleId || ""]);
}
function owned<T extends { driverId: string }>(row: T | undefined, driverId: string): T {
  if (!row || row.driverId !== driverId) throw new DriverDraftError("This saved draft is not available to this driver.");
  return row;
}
function updateDraft(id: string, driverId: string, change: (draft: DriverDraft) => DriverDraft | null) {
  identifier(driverId, "driver");
  return transaction<DriverDraft | null>("drafts", "readwrite", (store, done, fail) => {
    const read = store.get(id);
    read.onsuccess = () => {
      try { const row = change(owned(read.result as DriverDraft | undefined, driverId)); if (row) store.put(row); else store.delete(id); done(row); }
      catch (error) { fail(error instanceof Error ? error : storageError()); }
    };
  });
}

export function createDraftMedia(blob: Blob, name = "driver-photo"): DraftMedia {
  const media = { id: newId(), blob, name: name.slice(0, 200) }; mediaSize(media); return media;
}
export function getDriverDraft(binding: DraftBinding) {
  const id = bindingKey(binding);
  return transaction<DriverDraft | null>("drafts", "readonly", (store, done) => { const read = store.get(id); read.onsuccess = () => done(read.result ? owned(read.result, binding.driverId) : null); });
}
export function listDriverDrafts(driverId: string) {
  identifier(driverId, "driver");
  return transaction<DriverDraft[]>("drafts", "readonly", (store, done) => { const read = store.index("driverId").getAll(driverId); read.onsuccess = () => done((read.result as DriverDraft[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); });
}
export function saveDriverDraft(input: DraftBinding & { fields: { [key: string]: DraftJson }; photos?: DraftMedia[]; signature?: DraftMedia | null; capturedAt: string }, expectedRevision: number | null = null) {
  const id = bindingKey(input), fields = cloneFields(input.fields), photos = (input.photos || []).map(item => ({ ...item })), signature = input.signature ? { ...input.signature } : null;
  const size = draftSize({ photos, signature }), capturedAt = validTime(input.capturedAt, "capture time");
  return transaction<DriverDraft>("drafts", "readwrite", (store, done, fail) => {
    const read = store.index("driverId").getAll(input.driverId);
    read.onsuccess = () => {
      try {
        const rows = read.result as DriverDraft[], existing = rows.find(row => row.id === id);
        if (existing && (existing.revision !== expectedRevision || existing.phase !== "EDITING")) throw new DriverDraftError("This draft changed or is awaiting confirmation. Reload it before editing.");
        if (!existing && expectedRevision !== null) throw new DriverDraftError("This draft no longer exists. Refresh before saving.");
        if (!existing && rows.length >= 50) throw new DriverDraftError("You have 50 saved drafts. Upload or review them before adding another.");
        if (rows.filter(row => row.id !== id).reduce((total, row) => total + draftSize(row), size) > MAX_DRIVER_BYTES) throw new DriverDraftError("Your saved draft photos exceed 200 MB. Upload or review them before adding more.");
        const now = new Date().toISOString();
        const row: DriverDraft = { driverId: input.driverId, kind: input.kind, bookingId: input.bookingId, stopId: input.stopId, assignedAt: input.assignedAt ? validTime(input.assignedAt, "job assignment") : undefined, vehicleId: input.vehicleId,
          id, requestId: existing?.requestId || newId(), revision: (existing?.revision || 0) + 1, phase: "EDITING", fields, photos, signature, capturedAt, createdAt: existing?.createdAt || now, updatedAt: now };
        store.put(row); done(row);
      } catch (error) { fail(error instanceof Error ? error : storageError()); }
    };
  });
}
export function markDraftPending(id: string, driverId: string, revision: number) {
  return updateDraft(id, driverId, row => {
    if (row.revision !== revision || row.phase !== "EDITING") throw new DriverDraftError("Reload this draft before submitting it.");
    return { ...row, phase: "PENDING_SUBMISSION", revision: row.revision + 1, updatedAt: new Date().toISOString() };
  });
}
export function checkpointDraftUpload(id: string, driverId: string, requestId: string, mediaId: string, url: string) {
  validateUploadUrl(url);
  return updateDraft(id, driverId, row => {
    if (row.requestId !== requestId || row.phase !== "PENDING_SUBMISSION") throw new DriverDraftError("This upload belongs to an older submission. Reload the draft.");
    const matches = [...row.photos, ...(row.signature ? [row.signature] : [])].filter(item => item.id === mediaId);
    if (matches.length !== 1) throw new DriverDraftError("This photo is no longer part of the draft.");
    if (matches[0].uploadedUrl && matches[0].uploadedUrl !== url) throw new DriverDraftError("This photo upload is already recorded. Refresh the draft.");
    return { ...row, photos: row.photos.map(item => item.id === mediaId ? { ...item, uploadedUrl: url } : item), signature: row.signature?.id === mediaId ? { ...row.signature, uploadedUrl: url } : row.signature, revision: row.revision + 1, updatedAt: new Date().toISOString() };
  });
}
export function markDraftNeedsReview(id: string, driverId: string, requestId: string, message: string) {
  return updateDraft(id, driverId, row => {
    if (row.requestId !== requestId) throw new DriverDraftError("This review belongs to an older draft.");
    return { ...row, phase: "NEEDS_REVIEW", reviewMessage: message.slice(0, 1000), revision: row.revision + 1, updatedAt: new Date().toISOString() };
  });
}
// Only call after a fresh server read confirms the older submission did not complete.
export function reopenReviewedDraft(id: string, driverId: string, revision: number) {
  return updateDraft(id, driverId, row => {
    if (row.phase !== "NEEDS_REVIEW" || row.revision !== revision) throw new DriverDraftError("Review and reload this draft before editing it.");
    return { ...row, phase: "EDITING", requestId: newId(), reviewMessage: undefined, revision: row.revision + 1, updatedAt: new Date().toISOString() };
  });
}
// Call only after the server positively confirms this exact requestId; never on network failure.
export function confirmDriverDraft(id: string, driverId: string, requestId: string) {
  return updateDraft(id, driverId, row => { if (row.requestId !== requestId) throw new DriverDraftError("The server confirmation belongs to another draft."); return null; });
}
export function discardDriverDraft(id: string, driverId: string, revision: number) {
  return updateDraft(id, driverId, row => {
    if (row.revision !== revision || row.phase === "PENDING_SUBMISSION") throw new DriverDraftError("Check the pending submission with the server before deleting it.");
    return null;
  });
}

function validateAction(input: DriverActionInput) {
  identifier(input.driverId, "driver"); identifier(input.bookingId, "booking"); identifier(input.requestId, "request identifier");
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(input.requestId)) throw new DriverDraftError("Invalid action request identifier.");
  if (!["ACCEPT", "START", "EN_ROUTE", "ARRIVE", "COMPLETE_COLLECTION"].includes(input.action)) throw new DriverDraftError("This action cannot be queued. GPS locations must be captured live.");
  if (["ACCEPT", "START"].includes(input.action) ? !!input.stopId : !input.stopId) throw new DriverDraftError("The action does not match its stop.");
  if (input.stopId) identifier(input.stopId, "stop");
  return { ...input, assignedAt: validTime(input.assignedAt, "job assignment"), capturedAt: validTime(input.capturedAt, "capture time") };
}
export function queueDriverAction(input: DriverActionInput) {
  const action = validateAction(input), id = JSON.stringify([input.driverId, input.requestId]);
  return transaction<QueuedDriverAction>("actions", "readwrite", (store, done, fail) => {
    const read = store.index("driverId").getAll(input.driverId);
    read.onsuccess = () => {
      try {
        const rows = read.result as QueuedDriverAction[], existing = rows.find(row => row.id === id);
        if (existing) {
          for (const key of ["bookingId", "assignedAt", "vehicleId", "stopId", "action", "capturedAt"] as const) if (existing[key] !== action[key]) throw new DriverDraftError("This request identifier already belongs to another action.");
          done(existing); return;
        }
        if (rows.length >= 300) throw new DriverDraftError("You have too many pending updates. Connect and review them before recording more.");
        const row: QueuedDriverAction = { ...action, id, queuedAt: new Date().toISOString(), queueOrder: rows.reduce((maximum, row) => Math.max(maximum, row.queueOrder || 0), 0) + 1, phase: "PENDING" }; store.put(row); done(row);
      } catch (error) { fail(error instanceof Error ? error : storageError()); }
    };
  });
}
export function listQueuedDriverActions(driverId: string) {
  identifier(driverId, "driver");
  return transaction<QueuedDriverAction[]>("actions", "readonly", (store, done) => { const read = store.index("driverId").getAll(driverId); read.onsuccess = () => done((read.result as QueuedDriverAction[]).sort((a, b) => a.queueOrder - b.queueOrder || a.id.localeCompare(b.id))); });
}
export function markQueuedActionNeedsReview(id: string, driverId: string, message: string) {
  return transaction<QueuedDriverAction>("actions", "readwrite", (store, done, fail) => {
    const read = store.get(id); read.onsuccess = () => {
      try { const row = owned(read.result as QueuedDriverAction | undefined, driverId); const updated: QueuedDriverAction = { ...row, phase: "NEEDS_REVIEW", reviewMessage: message.slice(0, 1000) }; store.put(updated); done(updated); }
      catch (error) { fail(error instanceof Error ? error : storageError()); }
    };
  });
}
// Retry the stored requestId only after checking the fresh assignment/stop plan; no automatic sender lives here.
export function confirmQueuedDriverAction(id: string, driverId: string, requestId: string) {
  return transaction<void>("actions", "readwrite", (store, done, fail) => {
    const read = store.get(id); read.onsuccess = () => {
      try { const row = owned(read.result as QueuedDriverAction | undefined, driverId); if (row.requestId !== requestId) throw new DriverDraftError("This confirmation belongs to another queued update."); store.delete(id); done(undefined); }
      catch (error) { fail(error instanceof Error ? error : storageError()); }
    };
  });
}
export function cacheDriverJob(driverId: string, bookingId: string, assignedAt: string | null, job: { [key: string]: DraftJson }) {
  identifier(driverId, "driver"); identifier(bookingId, "booking");
  const row: CachedDriverJob = { id: JSON.stringify([driverId, bookingId]), driverId, bookingId, assignedAt: assignedAt ? validTime(assignedAt, "job assignment") : null, savedAt: new Date().toISOString(), job: cloneFields(job) };
  return transaction<CachedDriverJob>("jobs", "readwrite", (store, done) => {
    const read = store.index("driverId").getAll(driverId); read.onsuccess = () => {
      const others = (read.result as CachedDriverJob[]).filter(item => item.id !== row.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      others.slice(49).forEach(item => store.delete(item.id)); store.put(row); done(row);
    };
  });
}
export function getCachedDriverJob(driverId: string, bookingId: string) {
  identifier(driverId, "driver"); identifier(bookingId, "booking");
  return transaction<CachedDriverJob | null>("jobs", "readonly", (store, done) => { const read = store.get(JSON.stringify([driverId, bookingId])); read.onsuccess = () => done(read.result ? owned(read.result, driverId) : null); });
}
export function removeCachedDriverJob(driverId: string, bookingId: string) {
  identifier(driverId, "driver"); identifier(bookingId, "booking");
  return transaction<void>("jobs", "readwrite", (store, done) => { store.delete(JSON.stringify([driverId, bookingId])); done(undefined); });
}
