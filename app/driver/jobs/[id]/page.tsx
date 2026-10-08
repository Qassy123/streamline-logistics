"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Navigation, RefreshCw } from "lucide-react";
import { DriverRequestError, driverStatusLabel, useDriverPortal, type PortalVehicle } from "@/components/driver/DriverPortalShell";
import { cacheDriverJob, checkpointDraftUpload, confirmDriverDraft, confirmQueuedDriverAction, createDraftMedia, getCachedDriverJob, getDriverDraft, listDriverDrafts, listQueuedDriverActions, markDraftNeedsReview, markDraftPending, markQueuedActionNeedsReview, queueDriverAction, removeCachedDriverJob, reopenReviewedDraft, saveDriverDraft,
  type DraftBinding, type DraftJson, type DraftMedia, type DriverDraft, type QueuedDriverAction } from "@/lib/driverDrafts";
import { getPhoneTrackingState, pausePhoneTracking, startPhoneTracking, stopPhoneTracking, subscribePhoneTracking } from "@/lib/driverPhoneTracking";

type Evidence = { recipientName: string | null; signatureUrl: string | null; photoUrls: string[]; notes: string | null; outcome: string; reviewStatus: string; exceptionReason: string | null; reviewNotes: string | null; receivedAt: string };
type Stop = { id: string; sequence: number; type: "COLLECTION" | "DROP" | "DELIVERY" | "RETURN"; label: string; address: string; contactName: string | null; contactPhone: string | null; notes: string | null; status: string; completedAt: string | null; evidence: Evidence | null };
type Job = {
  id: string; reference: string; status: string; assignedAt: string | null; acknowledgedAt: string | null; journeyStartedAt: string | null;
  collectionDate: string; collectionWindow: string; collectionAddress: string; deliveryAddress: string;
  customerReference: string | null; purchaseOrderNumber: string | null; dispatchNotes: string | null; vehicle: PortalVehicle | null;
  customer: { name: string; company: string; phone: string };
  load: { description: string; category: string; fragile: boolean; palletCount: number | null; instructions: string; handoverNotes: string };
  stops: Stop[]; nextStop: Stop | null;
  pod: { status: string; recipientName: string | null; signatureUrl: string | null; photoUrl: string | null; deliveredAt: string | null; notes: string | null } | null;
  incidents: { id: string; reason: string; notes: string; photoUrls: string[]; dispatchResponse: string | null; acknowledgedAt: string | null; resolvedAt: string | null; createdAt: string; revisedArrivalAt: string | null }[];
  trackingEvents: { id: string; title: string; description: string | null; createdAt: string }[];
};
type Action = QueuedDriverAction["action"];
const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#006CFF] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const control = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100";
const outcomes = ["DELIVERED", "REFUSED_SIGNATURE", "AUTHORISED_UNATTENDED", "PARTIAL_DELIVERY", "FAILED_DELIVERY"];
const incidentReasons = ["DELAY", "ACCESS_BLOCKED", "NO_RECIPIENT", "GOODS_NOT_READY", "DAMAGED_GOODS", "BREAKDOWN", "OTHER"];
function sameTime(a: string | null | undefined, b: string | null | undefined) { return !!a && !!b && Date.parse(a) === Date.parse(b); }
function closed(job: Job) { return ["COMPLETED", "CANCELLED", "EXPIRED", "PENDING_PAYMENT"].includes(job.status); }
function timeLabel(value: string | null | undefined) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "Not recorded"; }
function tel(value: string | null | undefined) { const number = value?.replace(/[^\d+]/g, "") || ""; return /^\+?\d{7,15}$/.test(number) ? `tel:${number}` : null; }
function proofUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "res.cloudinary.com" ? value : null; } catch { return null; } }
function field(draft: DriverDraft, key: string) { return typeof draft.fields[key] === "string" ? draft.fields[key] as string : ""; }
function validateJob(job: Job, bookingId: string) { if (job?.id !== bookingId || !Array.isArray(job.stops) || !Array.isArray(job.incidents)) throw new Error("Unable to read the stop plan. Refresh or contact dispatch."); return job; }

// This view previews unconfirmed device work; it never changes the server's status or completed count.
function previewJob(job: Job, actions: QueuedDriverAction[], drafts: DriverDraft[]): Job {
  const result = { ...job, stops: job.stops.map(stop => ({ ...stop })) };
  if (closed(job)) return result;
  for (const action of actions.filter(row => row.bookingId === job.id && row.vehicleId === (job.vehicle?.id || null) && row.phase === "PENDING" && sameTime(row.assignedAt, job.assignedAt))) {
    if (action.action === "ACCEPT") result.acknowledgedAt = action.capturedAt;
    if (action.action === "START") { result.journeyStartedAt = action.capturedAt; result.status = "IN_PROGRESS"; const first = result.stops.find(stop => stop.status !== "COMPLETED"); if (first) first.status = "EN_ROUTE"; }
    const stop = result.stops.find(stop => stop.id === action.stopId);
    if (stop && action.action === "EN_ROUTE") stop.status = "EN_ROUTE";
    if (stop && action.action === "ARRIVE") stop.status = "ARRIVED";
    if (stop && action.action === "COMPLETE_COLLECTION" && stop.type === "COLLECTION") stop.status = "COMPLETED";
  }
  for (const draft of drafts.filter(row => row.bookingId === job.id && row.kind === "DELIVERY" && row.phase === "PENDING_SUBMISSION" && field(row, "outcome") === "DELIVERED" && sameTime(row.assignedAt, job.assignedAt))) {
    const stop = result.stops.find(stop => stop.id === draft.stopId); if (stop) stop.status = "COMPLETED";
  }
  result.nextStop = result.stops.find(stop => stop.status !== "COMPLETED") || null;
  return result;
}
function availableAction(job: Job): { action: Action; label: string; stopId?: string } | null {
  if (closed(job) || !job.assignedAt) return null;
  if (!job.acknowledgedAt) return { action: "ACCEPT", label: "Acknowledge assigned job" };
  if (!job.journeyStartedAt) return { action: "START", label: "Start journey to collection" };
  const stop = job.nextStop; if (!stop || stop.evidence?.reviewStatus === "PENDING") return null;
  if (stop.status === "PENDING") return { action: "EN_ROUTE", label: `Travel to ${stop.label.toLowerCase()}`, stopId: stop.id };
  if (stop.status === "EN_ROUTE") return { action: "ARRIVE", label: `Arrived at ${stop.label.toLowerCase()}`, stopId: stop.id };
  if (stop.status === "ARRIVED" && stop.type === "COLLECTION") return { action: "COMPLETE_COLLECTION", label: "Confirm goods collected", stopId: stop.id };
  return null;
}

export default function DriverJobDetailPage() {
  const params = useParams<{ id: string }>();
  return params?.id && typeof params.id === "string" ? <JobDetail key={params.id} bookingId={params.id} /> : <p role="alert">Invalid job link. Return to Jobs.</p>;
}

function JobDetail({ bookingId }: { bookingId: string }) {
  const { driver, request, online, sessionStale, refreshSession, refreshNotifications } = useDriverPortal();
  const [job, setJob] = useState<Job | null>(null), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false), [working, setWorking] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [actions, setActions] = useState<QueuedDriverAction[]>([]), [drafts, setDrafts] = useState<DriverDraft[]>([]);
  const [draftVersion, setDraftVersion] = useState(0), [showIncident, setShowIncident] = useState(false);
  const [tracking, setTracking] = useState(() => getPhoneTrackingState(driver.id));
  const mounted = useRef(false), busy = useRef(false), generation = useRef(0), loadAbort = useRef<AbortController | null>(null);
  const path = `/api/driver/jobs/${encodeURIComponent(bookingId)}`;

  const readPending = useCallback(async () => {
    try {
      const [queued, saved] = await Promise.all([listQueuedDriverActions(driver.id), listDriverDrafts(driver.id)]);
      if (mounted.current) { setActions(queued.filter(row => row.bookingId === bookingId)); setDrafts(saved.filter(row => row.bookingId === bookingId)); setStorageError(""); setDraftVersion(value => value + 1); }
    } catch (failure) { if (mounted.current) setStorageError(failure instanceof Error ? failure.message : "Draft storage is unavailable."); }
  }, [bookingId, driver.id]);
  const load = useCallback(async () => {
    if (busy.current) return;
    const cycle = ++generation.current; loadAbort.current?.abort();
    const abort = new AbortController(); loadAbort.current = abort; if (mounted.current) setRefreshing(true);
    try {
      const result = await request<{ job: Job }>(path, { signal: abort.signal });
      const fresh = validateJob(result.job, bookingId);
      if (!mounted.current || cycle !== generation.current) return;
      setJob(fresh); setStale(false); setError("");
      try { await cacheDriverJob(driver.id, bookingId, fresh.assignedAt, fresh as unknown as { [key: string]: DraftJson }); } catch (failure) { if (mounted.current) setStorageError(failure instanceof Error ? failure.message : "This job could not be saved for offline use."); }
      if (closed(fresh) && getPhoneTrackingState(driver.id).bookingId === bookingId) pausePhoneTracking(driver.id, "This job is closed. Phone sharing stopped on this device.");
    } catch (failure) {
      if (!mounted.current || cycle !== generation.current || abort.signal.aborted) return;
      setStale(true); setError(failure instanceof Error ? failure.message : "Unable to load the job.");
      if (failure instanceof DriverRequestError && [401, 403, 404].includes(failure.status)) { setJob(null); await removeCachedDriverJob(driver.id, bookingId).catch(() => undefined); }
      else { try { const cached = await getCachedDriverJob(driver.id, bookingId); if (cached && mounted.current && cycle === generation.current) setJob(validateJob(cached.job as unknown as Job, bookingId)); } catch { /* Keep the in-memory view if the device cache is unavailable. */ } }
    } finally { if (mounted.current && cycle === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [bookingId, driver.id, path, request]);
  useEffect(() => {
    mounted.current = true; void load(); void readPending();
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine) { void load(); void readPending(); } };
    const reconnect = () => { void load(); void readPending(); };
    const timer = window.setInterval(visible, 30_000);
    window.addEventListener("online", reconnect); document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; generation.current++; loadAbort.current?.abort(); window.clearInterval(timer); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", visible); };
  }, [load, readPending]);
  useEffect(() => { setTracking(getPhoneTrackingState(driver.id)); return subscribePhoneTracking(() => setTracking(getPhoneTrackingState(driver.id))); }, [driver.id]);

  async function freshAssignment(assignedAt: string | undefined | null, expectedVehicleId?: string | null) {
    const result = await request<{ job: Job }>(path); const fresh = validateJob(result.job, bookingId);
    if (mounted.current) { setJob(fresh); setStale(false); }
    if (!sameTime(fresh.assignedAt, assignedAt)) throw new DriverRequestError("Dispatch changed this assignment. Keep the saved record and contact dispatch; it cannot be replayed against the new assignment.", 409);
    if (expectedVehicleId !== undefined && (fresh.vehicle?.id || null) !== expectedVehicleId) throw new DriverRequestError("The planned van changed. Keep the saved update and contact dispatch before retrying it.", 409);
    return fresh;
  }
  async function sendDraft(draft: DriverDraft) {
    await freshAssignment(draft.assignedAt, draft.vehicleId);
    let current = draft;
    const media = [...draft.photos.map(item => ({ item, type: "photo" })), ...(draft.signature ? [{ item: draft.signature, type: "signature" }] : [])];
    for (const { item, type } of media) {
      if (item.uploadedUrl) continue;
      const body = new FormData(); body.append("file", item.blob, item.name); body.append("type", type); body.append("purpose", draft.kind === "DELIVERY" ? "DELIVERY" : "INCIDENT"); body.append("requestId", item.id); body.append("expectedAssignedAt", draft.assignedAt!); if (draft.vehicleId) body.append("expectedVehicleId", draft.vehicleId); if (draft.stopId) body.append("stopId", draft.stopId);
      const result = await request<{ url: string }>(`/api/driver/pod/${encodeURIComponent(bookingId)}/upload`, { method: "POST", body });
      current = (await checkpointDraftUpload(draft.id, driver.id, draft.requestId, item.id, result.url))!;
    }
    const fields = current.fields;
    if (draft.kind === "DELIVERY") {
      const result = await request<{ job: Job; message: string }>(`/api/driver/pod/${encodeURIComponent(bookingId)}/stops/${encodeURIComponent(draft.stopId!)}/complete`, { method: "POST", body: JSON.stringify({ requestId: draft.requestId, expectedAssignedAt: draft.assignedAt, expectedVehicleId: draft.vehicleId, capturedAt: draft.capturedAt,
        recipientName: fields.recipientName, outcome: fields.outcome, exceptionReason: fields.exceptionReason, notes: fields.notes, signatureUrl: current.signature?.uploadedUrl || null, photoUrls: current.photos.map(item => item.uploadedUrl) }) });
      validateJob(result.job, bookingId); await confirmDriverDraft(draft.id, driver.id, draft.requestId);
      if (mounted.current) { setJob(result.job); setMessage(result.message); }
      if (closed(result.job) && getPhoneTrackingState(driver.id).bookingId === bookingId) pausePhoneTracking(driver.id, "All stops are complete. Phone sharing stopped on this device.");
    } else if (draft.kind === "INCIDENT") {
      const result = await request<{ job: Job; message: string }>(`${path}/incidents`, { method: "POST", body: JSON.stringify({ requestId: draft.requestId, expectedAssignedAt: draft.assignedAt, expectedVehicleId: draft.vehicleId, stopId: draft.stopId || undefined, capturedAt: draft.capturedAt, reason: fields.reason, notes: fields.notes, revisedArrivalAt: fields.revisedArrivalAt || undefined, photoUrls: current.photos.map(item => item.uploadedUrl) }) });
      validateJob(result.job, bookingId); await confirmDriverDraft(draft.id, driver.id, draft.requestId); if (mounted.current) { setJob(result.job); setMessage(result.message); }
    }
  }
  async function sendQueuedAction(row: QueuedDriverAction) {
    await freshAssignment(row.assignedAt, row.vehicleId);
    const result = await request<{ job: Job }>(`${path}/actions`, { method: "POST", body: JSON.stringify({ action: row.action, stopId: row.stopId || undefined, requestId: row.requestId, capturedAt: row.capturedAt, expectedAssignedAt: row.assignedAt, expectedVehicleId: row.vehicleId }) });
    validateJob(result.job, bookingId); await confirmQueuedDriverAction(row.id, driver.id, row.requestId); if (mounted.current) setJob(result.job);
  }
  async function syncPending() {
    if (!navigator.onLine) { if (mounted.current) setMessage("Saved on this device. Updates remain pending until you reconnect and send them."); return; }
    const [queued, saved] = await Promise.all([listQueuedDriverActions(driver.id), listDriverDrafts(driver.id)]);
    const currentPlan = validateJob((await request<{ job: Job }>(path)).job, bookingId);
    // Replay the stop plan in causal order, even if the device clock changed while offline.
    const rank = (kind: string, stopId: string | undefined | null, action?: Action) => {
      if (kind === "INCIDENT") return -30;
      if (action === "ACCEPT") return -20;
      if (action === "START") return -10;
      const sequence = currentPlan.stops.find(stop => stop.id === stopId)?.sequence ?? -1000;
      return sequence * 10 + (kind === "DELIVERY" ? 3 : action === "EN_ROUTE" ? 0 : action === "ARRIVE" ? 1 : 2);
    };
    const operations = [
      ...queued.filter(row => row.bookingId === bookingId && row.phase === "PENDING").map(row => ({ type: "ACTION" as const, at: row.queuedAt, order: row.queueOrder, row })),
      ...saved.filter(row => row.bookingId === bookingId && row.phase === "PENDING_SUBMISSION").map(row => ({ type: "DRAFT" as const, at: field(row, "submittedAt") || row.updatedAt, order: Number.MAX_SAFE_INTEGER, row })),
    ].sort((a, b) => rank(a.type === "ACTION" ? "ACTION" : a.row.kind, a.row.stopId, a.type === "ACTION" ? a.row.action : undefined) - rank(b.type === "ACTION" ? "ACTION" : b.row.kind, b.row.stopId, b.type === "ACTION" ? b.row.action : undefined) || a.order - b.order || a.at.localeCompare(b.at));
    for (const operation of operations) {
      try {
        if (operation.type === "ACTION") {
          await sendQueuedAction(operation.row);
        } else await sendDraft(operation.row);
      } catch (failure) {
        if (failure instanceof DriverRequestError && [400, 403, 404, 409, 422].includes(failure.status)) {
          const text = failure.message;
          if (operation.type === "ACTION") await markQueuedActionNeedsReview(operation.row.id, driver.id, text);
          else await markDraftNeedsReview(operation.row.id, driver.id, operation.row.requestId, text);
        }
        throw failure; // Preserve later updates in their original order; never skip failed progress automatically.
      }
    }
    if (mounted.current && operations.length) setMessage("Pending updates confirmed by the server. Check the stop plan below for any delivery exceptions.");
    await refreshSession(); await refreshNotifications();
  }
  async function run(label: string, operation: () => Promise<void>) {
    if (busy.current) return; busy.current = true; generation.current++; loadAbort.current?.abort(); setRefreshing(false); setWorking(label); setError(""); setMessage("");
    try { await operation(); } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Unable to confirm the update. Keep your draft and retry."); }
    finally { busy.current = false; if (mounted.current) { setWorking(""); await readPending(); } }
  }
  const pending = actions.filter(row => row.phase === "PENDING").length + drafts.filter(row => row.phase === "PENDING_SUBMISSION").length;
  const view = job ? previewJob(job, actions, drafts) : null;
  const action = view ? availableAction(view) : null;
  const next = view?.nextStop || null;
  const matchingVan = !!job?.vehicle && driver.vehicle?.id === job.vehicle.id;
  const canWork = !!job && !closed(job) && !!job.assignedAt && !working && !refreshing;
  async function recordAction() {
    if (!job || !action || !job.assignedAt) return;
    await run("Saving progress", async () => {
      await queueDriverAction({ driverId: driver.id, bookingId, assignedAt: job.assignedAt!, vehicleId: job.vehicle?.id || null, action: action.action, stopId: action.stopId || null, requestId: window.crypto.randomUUID(), capturedAt: new Date().toISOString() });
      await syncPending();
    });
  }
  function editorBinding(kind: "DELIVERY" | "INCIDENT", stopId?: string): DraftBinding {
    return { driverId: driver.id, kind, bookingId, stopId, assignedAt: job?.assignedAt || undefined, vehicleId: job?.vehicle?.id };
  }
  async function submitDraft(draft: DriverDraft) { await run("Sending saved evidence", async () => { await markDraftPending(draft.id, driver.id, draft.revision); await syncPending(); }); }
  async function reviewDraft(draft: DriverDraft) {
    await run("Checking saved draft", async () => {
      const fresh = await freshAssignment(draft.assignedAt, draft.vehicleId);
      if (closed(fresh)) throw new Error("This job is closed. Keep the saved draft and contact dispatch.");
      const stop = fresh.nextStop;
      if (draft.kind === "DELIVERY" && (!stop || stop.id !== draft.stopId || stop.status !== "ARRIVED" || stop.evidence && stop.evidence.reviewStatus !== "REJECTED")) throw new Error("Dispatch must review this draft against the current stop before it can be edited.");
      await reopenReviewedDraft(draft.id, driver.id, draft.revision);
    });
  }

  return <div className="space-y-5">
    <Link href="/driver/jobs" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={17} />Back to jobs</Link>
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{job?.reference || "Job details"}</h1>{job ? <p className="mt-1 text-sm text-slate-500">{job.collectionDate.slice(0, 10)} · {job.collectionWindow || "Window not recorded"}</p> : null}</div><button className={button} disabled={!!working || refreshing || !online} onClick={() => { void load(); void readPending(); }}><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />Refresh</button></div>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p> : null}
    {storageError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{storageError}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">{message}</p> : null}
    {working ? <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{working}…</p> : null}
    {loading && !job ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading job…</p> : !job || !view ? <div className="rounded-2xl bg-white p-5"><p className="font-bold">Job unavailable</p><p className="mt-2 text-sm text-slate-500">Connect and refresh, or contact dispatch if the job was reassigned.</p></div> : <>
      {stale || !online ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Cached work may have changed. Device updates remain pending until the current assignment is checked by the server.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Server status: {driverStatusLabel(job.status)}</span><span className="text-xs text-slate-500">{job.stops.filter(stop => stop.status === "COMPLETED").length} / {job.stops.length} confirmed stops</span></div>
      {!matchingVan && !closed(job) ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your assigned van does not match this job. Contact dispatch before starting.</p> : null}
      {!driver.onDuty && !closed(job) ? <Link href="/driver/dashboard" className="block rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Go on duty on Today before starting work.</Link> : null}
      {pending || actions.some(row => row.phase === "NEEDS_REVIEW") || drafts.some(row => row.phase !== "EDITING") ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold">Saved device updates</h2><p className="mt-1 text-sm">{pending} pending. Stop actions below may preview your device work; only server-confirmed stops count as complete.</p><button className={`${button} mt-3 w-full`} disabled={!online || !!working || sessionStale || !pending} onClick={() => void run("Sending pending updates", syncPending)}>Send pending updates</button><div className="mt-3 space-y-2">{actions.map(row => <div key={row.id} className="text-xs leading-5"><p>{driverStatusLabel(row.action)} · {driverStatusLabel(row.phase)}{row.reviewMessage ? ` · ${row.reviewMessage}` : ""}</p>{row.phase === "NEEDS_REVIEW" ? <button className="min-h-11 font-bold text-blue-700 underline" disabled={!online || !!working || sessionStale} onClick={() => void run("Rechecking saved action", () => sendQueuedAction(row))}>Recheck and retry this action</button> : null}</div>)}{drafts.filter(row => row.phase !== "EDITING").map(row => <div key={row.id} className="text-xs leading-5"><p>{driverStatusLabel(row.kind)} · {driverStatusLabel(row.phase)}{row.reviewMessage ? ` · ${row.reviewMessage}` : ""}</p>{row.phase === "NEEDS_REVIEW" ? <button className="min-h-11 font-bold text-blue-700 underline" disabled={!online || !!working} onClick={() => void reviewDraft(row)}>Check whether this draft can be edited</button> : null}</div>)}</div></section> : null}
      {!closed(job) ? <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">{next ? next.label : pending ? "All stops recorded on device" : "Check job progress"}</h2>{next ? <><p className="mt-2 break-words font-semibold leading-6">{next.address}</p><p className="mt-2 text-xs text-slate-500">{driverStatusLabel(next.status)}{pending ? " · Device preview" : ""}</p>{next.notes ? <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6">{next.notes}</p> : null}{next.contactName ? <p className="mt-3 text-sm">Contact: {next.contactName}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><a className={button} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(next.address)}`}><Navigation size={17} />Navigate</a>{tel(next.contactPhone) ? <a className={button} href={tel(next.contactPhone)!}>Call contact</a> : null}</div>{next.evidence?.reviewStatus === "PENDING" ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Delivery exception awaiting dispatch review. This stop remains incomplete.</p> : null}{next.evidence?.reviewStatus === "REJECTED" ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">Evidence needs correction: {next.evidence.reviewNotes}</p> : null}</> : <p className="mt-2 text-sm text-slate-500">{pending ? "Send pending updates before this job can be confirmed complete." : "Refresh or call dispatch to check the stop plan."}</p>}{action ? <button className={`${primary} mt-4 w-full`} disabled={!canWork || (action.action !== "ACCEPT" && (!driver.onDuty || !matchingVan)) || (!!online && (stale || sessionStale))} onClick={() => void recordAction()}>{action.label}{!online ? " · save pending" : ""}</button> : null}</section> : <p className="flex items-center gap-2 rounded-xl bg-slate-100 p-4 text-sm font-semibold text-slate-600"><CheckCircle2 size={18} />This job is closed. Its proof and history remain available below.</p>}
      {next && next.type !== "COLLECTION" && !closed(job) && next.evidence?.reviewStatus !== "PENDING" && next.status === "ARRIVED" ? <DraftEditor key={`${job.assignedAt}-${next.id}-DELIVERY`} binding={editorBinding("DELIVERY", next.id)} version={draftVersion} disabled={!!working} onSubmit={submitDraft} onSaved={readPending} /> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Report a problem</h2><button className={button} disabled={closed(job) || !!working || !job.assignedAt} onClick={() => setShowIncident(value => !value)}>{showIncident ? "Close form" : "Open form"}</button></div><p className="mt-2 text-sm text-slate-500">Tell dispatch about delays, access, damaged goods or a breakdown.</p>{showIncident && !closed(job) ? <DraftEditor key={`${job.assignedAt}-${next?.id || "job"}-INCIDENT`} binding={editorBinding("INCIDENT", next?.id)} version={draftVersion} disabled={!!working} onSubmit={submitDraft} onSaved={readPending} /> : null}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Phone location sharing</h2><p className="mt-2 text-sm leading-6 text-slate-600">{tracking.bookingId === bookingId ? tracking.message : tracking.sharing ? "Phone sharing is active for another job. Stop it there first." : "Phone sharing is off on this device."}</p>{tracking.lastConfirmedAt && tracking.bookingId === bookingId ? <p className="mt-2 text-xs text-slate-500">Last server-confirmed point: {timeLabel(tracking.lastConfirmedAt)}</p> : null}<p className="mt-2 text-xs leading-5 text-slate-500">Keep the portal open. Locking the phone or opening another app can pause phone GPS. Vehicle tracker integration is not configured yet.</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!!working || !online || stale || sessionStale || pending > 0 || job.status !== "IN_PROGRESS" || !job.assignedAt || !matchingVan || !driver.onDuty || tracking.sharing || tracking.stopPending} onClick={() => void run("Starting phone sharing", async () => { await startPhoneTracking({ driverId: driver.id, bookingId, assignedAt: job.assignedAt!, vehicleId: job.vehicle!.id }, request); })}>Enable phone sharing</button><button className={button} disabled={!!working || !online || tracking.bookingId !== bookingId || (!tracking.sharing && !tracking.stopPending)} onClick={() => void run("Stopping phone sharing", () => stopPhoneTracking(driver.id, request))}>{tracking.stopPending ? "Confirm tracking stop" : "Stop phone sharing"}</button></div>{tracking.trackingUrl && tracking.bookingId === bookingId ? <button className={`${button} mt-2 w-full`} onClick={() => void run("Copying tracking link", async () => { await navigator.clipboard.writeText(tracking.trackingUrl!); setMessage("Customer tracking link copied."); })}>Copy customer tracking link</button> : null}</section>
      <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer content-center font-bold">Load, customer & dispatch details</summary><div className="mt-3 space-y-3 text-sm leading-6"><p>{job.customer.company || job.customer.name || "Customer not recorded"}</p>{tel(job.customer.phone) ? <a className="inline-flex min-h-11 items-center font-bold text-blue-700" href={tel(job.customer.phone)!}>Call customer</a> : null}<p><strong>Load: </strong>{job.load.description || job.load.category || "Not recorded"}{job.load.palletCount != null ? ` · ${job.load.palletCount} pallets` : ""}{job.load.fragile ? " · Fragile" : ""}</p>{[job.load.instructions, job.load.handoverNotes, job.dispatchNotes].filter(Boolean).map((notes, index) => <p key={index} className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3">{notes}</p>)}<p>Customer reference: {job.customerReference || "Not recorded"}</p><p>Purchase order: {job.purchaseOrderNumber || "Not recorded"}</p><Link href="/driver/vehicle" className="inline-flex min-h-11 items-center font-bold text-blue-700">Planned van: {job.vehicle?.registration || job.vehicle?.name || "Not assigned"}</Link></div></details>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Confirmed stop plan & proof</h2><div className="mt-3 space-y-3">{job.stops.map(stop => <details key={stop.id} className="rounded-xl border border-slate-200 p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{stop.label} · {driverStatusLabel(stop.status)}</summary><p className="mt-2 break-words text-sm leading-6">{stop.address}</p>{stop.completedAt ? <p className="mt-2 text-xs text-slate-500">Confirmed: {timeLabel(stop.completedAt)}</p> : null}{stop.evidence ? <EvidenceRecord evidence={stop.evidence} /> : <p className="mt-2 text-xs text-slate-500">{stop.type === "COLLECTION" ? "Collection handover" : "No evidence submitted"}</p>}</details>)}</div>{job.pod ? <details className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Booking proof / historic delivery record</summary><p className="mt-2 text-sm">{job.pod.recipientName || "Recipient not recorded"} · {driverStatusLabel(job.pod.status)}</p><p className="mt-2 text-xs">{timeLabel(job.pod.deliveredAt)}</p><ProofLinks photos={job.pod.photoUrl ? [job.pod.photoUrl] : []} signature={job.pod.signatureUrl} /></details> : null}</section>
      {job.incidents.length ? <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer content-center font-bold">Problem reports & dispatch responses ({job.incidents.length})</summary><div className="mt-3 space-y-3">{job.incidents.map(item => <article key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">{driverStatusLabel(item.reason)} · {item.resolvedAt ? "Resolved" : item.acknowledgedAt ? "Acknowledged" : "Awaiting dispatch"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.notes}</p>{item.revisedArrivalAt ? <p className="mt-2 text-xs">Revised arrival: {timeLabel(item.revisedArrivalAt)}</p> : null}{item.dispatchResponse ? <p className="mt-2 text-sm font-semibold">Dispatch: {item.dispatchResponse}</p> : null}<ProofLinks photos={item.photoUrls} /></article>)}</div></details> : null}
      <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer content-center font-bold">Confirmed timeline</summary><div className="mt-3 space-y-3">{job.trackingEvents.map(event => <article key={event.id} className="border-l-2 border-blue-200 pl-3"><p className="text-sm font-bold">{event.title}</p>{event.description ? <p className="mt-1 text-sm text-slate-600">{event.description}</p> : null}<p className="mt-1 text-xs text-slate-500">{timeLabel(event.createdAt)}</p></article>)}{!job.trackingEvents.length ? <p className="text-sm text-slate-500">No confirmed events yet.</p> : null}</div></details>
    </>}
  </div>;
}

function ProofLinks({ photos = [], signature }: { photos?: string[]; signature?: string | null }) {
  return <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-blue-700">{photos.map((url, index) => proofUrl(url) ? <a key={`${url}-${index}`} className="inline-flex min-h-11 items-center underline" href={url} target="_blank" rel="noopener noreferrer">Photo {index + 1}</a> : null)}{signature && proofUrl(signature) ? <a className="inline-flex min-h-11 items-center underline" href={signature} target="_blank" rel="noopener noreferrer">Signature</a> : null}</div>;
}
function EvidenceRecord({ evidence }: { evidence: Evidence }) {
  return <div className="mt-3 text-sm leading-6"><p>{evidence.recipientName || "Recipient not recorded"} · {driverStatusLabel(evidence.outcome)}</p><p className="mt-1 text-xs">Review: {driverStatusLabel(evidence.reviewStatus)}</p>{evidence.exceptionReason ? <p className="mt-2 whitespace-pre-wrap">{evidence.exceptionReason}</p> : null}{evidence.notes ? <p className="mt-2 whitespace-pre-wrap">{evidence.notes}</p> : null}{evidence.reviewNotes ? <p className="mt-2 font-semibold">Dispatch: {evidence.reviewNotes}</p> : null}<ProofLinks photos={evidence.photoUrls} signature={evidence.signatureUrl} /></div>;
}

type FormValues = { recipientName: string; outcome: string; exceptionReason: string; notes: string; reason: string; revisedArrivalAt: string; submittedAt: string };
const emptyForm: FormValues = { recipientName: "", outcome: "DELIVERED", exceptionReason: "", notes: "", reason: "DELAY", revisedArrivalAt: "", submittedAt: "" };
function validateSubmission(kind: DraftBinding["kind"], values: { form: FormValues; photos: DraftMedia[]; signature: DraftMedia | null }) {
  if (kind === "DELIVERY") {
    if (!outcomes.includes(values.form.outcome)) throw new Error("Choose a valid delivery outcome.");
    if (!values.photos.length) throw new Error("At least one photo is required.");
    if (values.form.outcome === "DELIVERED" && (!values.form.recipientName.trim() || !values.signature)) throw new Error("A successful delivery requires the recipient's name, signature and photo.");
    if (values.form.outcome !== "DELIVERED" && !values.form.exceptionReason.trim()) throw new Error("Record why the delivery proof is incomplete for dispatch review.");
  } else if (!values.form.notes.trim()) throw new Error("Describe the problem for dispatch.");
}
function DraftEditor({ binding, version, disabled, onSubmit, onSaved }: { binding: DraftBinding; version: number; disabled: boolean; onSubmit: (draft: DriverDraft) => Promise<void>; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<FormValues>({ ...emptyForm }), [photos, setPhotos] = useState<DraftMedia[]>([]), [signature, setSignature] = useState<DraftMedia | null>(null);
  const [draft, setDraft] = useState<DriverDraft | null>(null), [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [capturingSignature, setCapturingSignature] = useState(false), [error, setError] = useState("");
  const formRef = useRef({ form: { ...emptyForm }, photos: [] as DraftMedia[], signature: null as DraftMedia | null });
  const saved = useRef<DriverDraft | null>(null), saveChain = useRef<Promise<DriverDraft | null>>(Promise.resolve(null)), mounted = useRef(false), editGeneration = useRef(0), pendingSaves = useRef(0);
  const bindingString = JSON.stringify(binding);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (pendingSaves.current) return;
    let cancelled = false; const generation = editGeneration.current;
    void getDriverDraft(binding).then(row => {
      if (cancelled || !mounted.current || generation !== editGeneration.current) return;
      saved.current = row; setDraft(row);
      const values = row ? Object.fromEntries(Object.keys(emptyForm).map(key => [key, field(row, key)])) as FormValues : { ...emptyForm };
      if (!values.outcome) values.outcome = "DELIVERED"; if (!values.reason) values.reason = "DELAY";
      formRef.current = { form: values, photos: row?.photos || [], signature: row?.signature || null }; setForm(values); setPhotos(row?.photos || []); setSignature(row?.signature || null); setReady(true);
    }).catch(failure => { if (!cancelled && mounted.current) { setError(failure instanceof Error ? failure.message : "Unable to open the saved draft."); setReady(true); } });
    return () => { cancelled = true; };
    // Binding is stable for this assignment and stop; parent refresh rechecks persisted phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingString, version]);
  const locked = disabled || !ready || !!draft && draft.phase !== "EDITING";
  function persist(next = formRef.current): Promise<DriverDraft | null> {
    editGeneration.current++; pendingSaves.current++; const capture = { ...next, form: { ...next.form }, photos: [...next.photos] };
    setSaving(true); setError("");
    const operation = saveChain.current.catch(() => null).then(async () => {
      const row = await saveDriverDraft({ ...binding, fields: capture.form, photos: capture.photos, signature: capture.signature, capturedAt: new Date().toISOString() }, saved.current?.revision ?? null);
      saved.current = row; if (mounted.current) setDraft(row); return row;
    });
    saveChain.current = operation;
    void operation.catch(failure => { if (mounted.current) setError(failure instanceof Error ? failure.message : "This draft has not been saved. Keep the page open and retry."); }).finally(() => { pendingSaves.current--; if (mounted.current && saveChain.current === operation) setSaving(false); });
    return operation;
  }
  function change(key: keyof FormValues, value: string) { const next = { ...formRef.current, form: { ...formRef.current.form, [key]: value } }; formRef.current = next; setForm(next.form); void persist(next).catch(() => undefined); }
  function changeSignature(media: DraftMedia | null) { const next = { ...formRef.current, signature: media }; formRef.current = next; setSignature(media); void persist(next).catch(() => undefined); }
  async function choosePhotos(files: FileList | null) {
    if (!files || locked) return;
    try { const added = Array.from(files).map(file => createDraftMedia(file, file.name)); if (photos.length + added.length > 8) throw new Error("Choose no more than 8 photos."); const next = { ...formRef.current, photos: [...formRef.current.photos, ...added] }; formRef.current = next; setPhotos(next.photos); await persist(next); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save photos."); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (locked || capturingSignature) return;
    setError("");
    try {
      await saveChain.current;
      const values = formRef.current;
      validateSubmission(binding.kind, values);
      const next = { ...values, form: { ...values.form, submittedAt: new Date().toISOString() } }; formRef.current = next; setForm(next.form);
      const row = await persist(next); if (row) { await onSubmit(row); await onSaved(); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Keep the draft and retry."); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-bold">{binding.kind === "DELIVERY" ? "Delivery proof for this stop" : "Problem details"}</h2>
    {draft?.phase !== "EDITING" && draft ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{driverStatusLabel(draft.phase)}. Use Saved device updates above to retry or review it.</p> : null}
    <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
      {binding.kind === "DELIVERY" ? <><label className="block"><span className="mb-2 block text-sm font-semibold">Outcome</span><select className={control} value={form.outcome} onChange={event => change("outcome", event.target.value)}>{outcomes.map(value => <option key={value} value={value}>{driverStatusLabel(value)}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-semibold">Recipient name{form.outcome === "DELIVERED" ? " (required)" : " (if available)"}</span><input className={control} value={form.recipientName} maxLength={200} required={form.outcome === "DELIVERED"} onChange={event => change("recipientName", event.target.value)} /></label>{form.outcome !== "DELIVERED" ? <label className="block"><span className="mb-2 block text-sm font-semibold">Exception reason (required)</span><textarea className={control} rows={3} maxLength={4000} required value={form.exceptionReason} onChange={event => change("exceptionReason", event.target.value)} /><span className="mt-2 block text-xs leading-5 text-amber-800">Dispatch must review exceptions. Failed and partial deliveries are not counted as a completed delivery.</span></label> : null}<SignaturePad media={signature} disabled={locked || capturingSignature} onChange={changeSignature} onCaptureChange={setCapturingSignature} /></> : <><label className="block"><span className="mb-2 block text-sm font-semibold">Problem</span><select className={control} value={form.reason} onChange={event => change("reason", event.target.value)}>{incidentReasons.map(value => <option key={value} value={value}>{driverStatusLabel(value)}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-semibold">Revised arrival (optional, device timezone)</span><input type="datetime-local" className={control} value={form.revisedArrivalAt ? localDateTime(form.revisedArrivalAt) : ""} onChange={event => change("revisedArrivalAt", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label></>}
      <label className="block"><span className="mb-2 block text-sm font-semibold">{binding.kind === "INCIDENT" ? "Describe the problem (required)" : "Delivery notes"}</span><textarea className={control} maxLength={4000} rows={3} value={form.notes} required={binding.kind === "INCIDENT"} onChange={event => change("notes", event.target.value)} /></label>
      <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Camera size={17} />{binding.kind === "DELIVERY" ? "Delivery photos (at least one)" : "Problem photos (optional)"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:font-semibold file:text-blue-700" onChange={event => { void choosePhotos(event.target.files); event.target.value = ""; }} /><span className="mt-2 block text-xs text-slate-500">Up to 8 photos, 8 MB each. Photos stay on this device until sent.</span></label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map(photo => <div key={photo.id} className="min-w-0 rounded-xl border border-slate-200 p-2"><LocalImage media={photo} /><p className="mt-1 truncate text-xs text-slate-500">{photo.name}</p><button type="button" className="min-h-11 text-xs font-bold text-red-600" onClick={() => { const next = { ...formRef.current, photos: formRef.current.photos.filter(item => item.id !== photo.id) }; formRef.current = next; setPhotos(next.photos); void persist(next).catch(() => undefined); }}>Remove photo</button></div>)}</div>
    </fieldset>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p> : null}
    <p role="status" className="text-xs text-slate-500">{saving ? "Saving draft on this device…" : error ? "This draft may not be saved. Retry before leaving." : draft ? `Saved on device · ${timeLabel(draft.updatedAt)}` : "Start entering details to save a draft."}</p>
    <button type="button" className={`${button} w-full`} disabled={locked || saving || capturingSignature} onClick={() => void persist().then(() => onSaved()).catch(() => undefined)}>Save draft on device</button>
    <button type="submit" className={`${primary} w-full`} disabled={locked || saving || capturingSignature}>{binding.kind === "DELIVERY" ? "Submit delivery proof" : "Send report to dispatch"}</button>
  </form>;
}
function localDateTime(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }
function LocalImage({ media }: { media: DraftMedia }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(media.blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [media.blob]);
  return url ? <img src={url} alt="Saved driver photo" className="h-28 w-full rounded-lg object-cover" /> : null;
}
function SignaturePad({ media, disabled, onChange, onCaptureChange }: { media: DraftMedia | null; disabled: boolean; onChange: (value: DraftMedia | null) => void; onCaptureChange: (value: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null), pointer = useRef<number | null>(null), previous = useRef<{ x: number; y: number } | null>(null), pendingCapture = useRef(false), renderedBlob = useRef<Blob | null>(null), strokeGeneration = useRef(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = canvas.current, context = element?.getContext("2d"); if (!element || !context) return;
    if (media && renderedBlob.current === media.blob) return;
    renderedBlob.current = media?.blob || null;
    context.fillStyle = "white"; context.fillRect(0, 0, element.width, element.height);
    if (!media) return;
    let cancelled = false; const cycle = strokeGeneration.current, url = URL.createObjectURL(media.blob), image = new Image(); image.onload = () => { if (!cancelled && cycle === strokeGeneration.current) context.drawImage(image, 0, 0, element.width, element.height); }; image.src = url;
    return () => { cancelled = true; URL.revokeObjectURL(url); };
  }, [media?.blob]);
  function point(event: PointerEvent<HTMLCanvasElement>) { const element = event.currentTarget, rect = element.getBoundingClientRect(); return { x: (event.clientX - rect.left) * element.width / rect.width, y: (event.clientY - rect.top) * element.height / rect.height }; }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || pendingCapture.current || pointer.current !== null) return;
    strokeGeneration.current++; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId; previous.current = point(event); setError("");
    const context = event.currentTarget.getContext("2d"); if (context) { context.fillStyle = "#071D49"; context.beginPath(); context.arc(previous.current.x, previous.current.y, 2, 0, Math.PI * 2); context.fill(); }
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || pointer.current !== event.pointerId || !previous.current) return;
    const next = point(event), context = event.currentTarget.getContext("2d"); if (!context) return;
    context.strokeStyle = "#071D49"; context.lineWidth = 4; context.lineCap = "round"; context.lineJoin = "round"; context.beginPath(); context.moveTo(previous.current.x, previous.current.y); context.lineTo(next.x, next.y); context.stroke(); previous.current = next;
  }
  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return; pointer.current = null; previous.current = null; pendingCapture.current = true; onCaptureChange(true);
    event.currentTarget.toBlob(blob => { pendingCapture.current = false; onCaptureChange(false); if (!blob) { setError("The signature could not be saved. Draw it again."); return; } try { renderedBlob.current = blob; onChange(createDraftMedia(blob, "signature.png")); } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save signature."); } }, "image/png");
  }
  return <div><p className="mb-2 text-sm font-semibold">Recipient signature</p><canvas ref={canvas} width={900} height={300} aria-label="Draw recipient signature" className={`h-40 w-full touch-none rounded-xl border border-slate-300 bg-white ${disabled ? "opacity-60" : ""}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /><p className="mt-1 text-xs text-slate-500">Ask the recipient to sign in the box.</p><button type="button" className="min-h-11 text-xs font-bold text-red-600" disabled={disabled} onClick={() => { const element = canvas.current, context = element?.getContext("2d"); if (element && context) { context.fillStyle = "white"; context.fillRect(0, 0, element.width, element.height); } onChange(null); }}>Clear signature</button>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}</div>;
}
