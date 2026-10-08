// One phone-location watcher per open portal tab, independent of the job page's mount.
// Browser location can pause when the phone is locked, another app opens or this tab closes.
export type TrackingRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
export type PhoneTrackingBinding = { driverId: string; bookingId: string; assignedAt: string; vehicleId: string };
export type PhoneTrackingState = {
  phase: "OFF" | "STARTING" | "WAITING" | "SENDING" | "RECENT" | "PAUSED" | "BLOCKED" | "STOPPING";
  driverId: string | null; bookingId: string | null; sharing: boolean; stopPending: boolean;
  lastConfirmedAt: string | null; message: string; trackingUrl: string | null;
};
type TrackingPayload = {
  trackingActive: boolean; trackingUrl?: string | null; lastLocationAt: string | null;
  job: { id: string; status: string; assignedAt: string | null; vehicle: { id: string } | null };
};
type Point = { latitude: number; longitude: number; accuracy: number | null; heading: number | null; speed: number | null; capturedAt: string };
const off: PhoneTrackingState = { phase: "OFF", driverId: null, bookingId: null, sharing: false, stopPending: false, lastConfirmedAt: null, message: "Phone location sharing is off.", trackingUrl: null };
let state: PhoneTrackingState = { ...off };
let binding: PhoneTrackingBinding | null = null;
let sender: TrackingRequest | null = null;
let watcher: number | null = null, timer: number | null = null;
let latest: Point | null = null, tickBusy = false, startBusy = false, epoch = 0;
let tickAbort: AbortController | null = null;
let stopRequestId: string | null = null;
const listeners = new Set<() => void>();
let removeEvents: (() => void) | null = null;

function publish(change: Partial<PhoneTrackingState>) {
  state = { ...state, ...change };
  for (const listener of listeners) { try { listener(); } catch { /* A page subscriber cannot interrupt the tracking service. */ } }
}
export function subscribePhoneTracking(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getPhoneTrackingState(driverId: string): PhoneTrackingState { return state.driverId === driverId ? { ...state } : { ...off }; }
function identifier() {
  if (!window.crypto?.randomUUID) throw new Error("Phone tracking requires a supported browser and a secure connection.");
  return window.crypto.randomUUID();
}
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to confirm phone tracking. Refresh or contact dispatch."; }
function status(error: unknown) { return error && typeof error === "object" && "status" in error ? Number(error.status) : 0; }
function positionPoint(position: GeolocationPosition): Point {
  const { latitude, longitude, accuracy, heading, speed } = position.coords;
  const age = Date.now() - position.timestamp;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(position.timestamp) || age > 45_000 || age < -300_000) throw new Error("Waiting for a fresh phone location.");
  return { latitude, longitude, accuracy: Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100000 ? accuracy : null,
    heading: heading != null && Number.isFinite(heading) && heading >= 0 && heading < 360 ? heading : null,
    speed: speed != null && Number.isFinite(speed) && speed >= 0 && speed <= 200 ? speed : null,
    capturedAt: new Date(position.timestamp).toISOString() };
}
function sameAssignment(payload: TrackingPayload, current: PhoneTrackingBinding) {
  return payload.job?.id === current.bookingId && payload.job.status === "IN_PROGRESS" && payload.job.vehicle?.id === current.vehicleId
    && !!payload.job.assignedAt && Date.parse(payload.job.assignedAt) === Date.parse(current.assignedAt);
}
function shareUrl(value?: string | null) {
  if (!value) return null;
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith("/tracking/") && /^[a-f0-9]{64}$/i.test(url.searchParams.get("token") || "") ? url.toString() : null;
}
function stopWatcher() {
  epoch++; tickAbort?.abort(); tickAbort = null;
  if (watcher !== null) navigator.geolocation.clearWatch(watcher);
  if (timer !== null) window.clearInterval(timer);
  watcher = null; timer = null; latest = null; removeEvents?.(); removeEvents = null;
}
// Use on sign-out/session invalidation. This stops the device immediately; it does not claim a server update.
export function pausePhoneTracking(driverId: string, reason = "Phone sharing paused on this device. Check the job's tracking status before resuming.") {
  if (binding?.driverId !== driverId) return;
  stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: true, message: reason });
}
function firstPosition(): Promise<Point> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
    try { resolve(positionPoint(position)); } catch (error) { reject(error); }
  }, error => reject(new Error(error.code === 1 ? "Location access was denied. Allow it in your browser settings or contact dispatch." : "Unable to read phone location. Check location services and try again.")), { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }));
}

async function tick() {
  if (tickBusy || !binding || !sender || watcher === null) return;
  if (!navigator.onLine || document.visibilityState !== "visible") {
    latest = null; publish({ phase: "PAUSED", message: !navigator.onLine ? "Offline. No old GPS points will be replayed as live location." : "Phone location can pause while this portal is in the background." }); return;
  }
  if (!latest || Date.now() - Date.parse(latest.capturedAt) > 45_000) { publish({ phase: "WAITING", message: "Waiting for a fresh phone location. The last confirmed point may be stale." }); return; }
  const current = { ...binding }, send = sender, cycle = epoch, point = { ...latest };
  const abort = new AbortController(); tickAbort = abort; tickBusy = true;
  try {
    const checked = await send<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(current.bookingId)}`, { signal: abort.signal });
    if (cycle !== epoch) return;
    if (!sameAssignment(checked, current) || !checked.trackingActive) {
      stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: false, message: "The job or tracking assignment changed. Refresh the job before sharing location again." }); return;
    }
    if (Date.now() - Date.parse(point.capturedAt) > 45_000) { publish({ phase: "WAITING", message: "Waiting for a fresh location reading." }); return; }
    publish({ phase: "SENDING", message: "Sending current phone location…" });
    const result = await send<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(current.bookingId)}/location`, { method: "POST", signal: abort.signal,
      body: JSON.stringify({ ...point, requestId: identifier(), expectedAssignedAt: current.assignedAt, expectedVehicleId: current.vehicleId }) });
    if (cycle !== epoch) return;
    if (!result.trackingActive || !sameAssignment(result, current)) { stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: false, message: "Tracking is no longer active for this assignment." }); return; }
    publish({ phase: "RECENT", lastConfirmedAt: result.lastLocationAt, message: "Phone location confirmed by the server." });
  } catch (error) {
    if (cycle !== epoch) return;
    if ([401, 403, 404, 409].includes(status(error))) { stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: false, message: message(error) }); }
    else publish({ phase: "PAUSED", message: message(error) });
  } finally { tickBusy = false; if (tickAbort === abort) tickAbort = null; }
}

export async function startPhoneTracking(next: PhoneTrackingBinding, request: TrackingRequest): Promise<PhoneTrackingState> {
  if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) throw new Error("Phone location requires HTTPS and a browser with location access.");
  if (!navigator.onLine) throw new Error("Connect to the internet before enabling phone location.");
  if (!next.driverId || !next.bookingId || !next.vehicleId || !Number.isFinite(Date.parse(next.assignedAt))) throw new Error("Refresh the job and its assigned van before enabling tracking.");
  if (startBusy || ["STARTING", "STOPPING"].includes(state.phase)) throw new Error("Wait for the current tracking request to finish.");
  if (binding && binding.driverId !== next.driverId) { stopWatcher(); binding = null; sender = null; stopRequestId = null; publish({ ...off }); }
  if (binding && watcher !== null) {
    if (binding.driverId === next.driverId && binding.bookingId === next.bookingId && binding.assignedAt === next.assignedAt && binding.vehicleId === next.vehicleId) return getPhoneTrackingState(next.driverId);
    throw new Error("Stop phone tracking for the other job before starting this one.");
  }
  if (state.stopPending) throw new Error("Confirm the previous tracking stop before starting another session.");
  binding = { ...next }; sender = request; stopRequestId = null;
  publish({ phase: "STARTING", driverId: next.driverId, bookingId: next.bookingId, sharing: false, stopPending: false, lastConfirmedAt: null, trackingUrl: state.driverId === next.driverId && state.bookingId === next.bookingId ? state.trackingUrl : null, message: "Checking the job and requesting phone location…" });
  const cycle = ++epoch;
  startBusy = true;
  let serverStarted = false, startAttempted = false;
  try {
    const point = await firstPosition();
    if (cycle !== epoch) throw new Error("Phone tracking was interrupted. Refresh before trying again.");
    const checked = await request<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(next.bookingId)}`);
    if (cycle !== epoch) throw new Error("Phone tracking was interrupted. Refresh before trying again.");
    if (!sameAssignment(checked, next)) throw new Error("Accept and start this job with your assigned van before enabling phone tracking.");
    if (Date.now() - Date.parse(point.capturedAt) > 45_000) throw new Error("The location reading expired. Try again for a fresh reading.");
    startAttempted = true;
    const data = await request<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(next.bookingId)}/start`, { method: "POST", body: JSON.stringify({ ...point, requestId: identifier(), expectedAssignedAt: next.assignedAt, expectedVehicleId: next.vehicleId }) });
    serverStarted = true;
    if (cycle !== epoch) throw new Error("Phone tracking was interrupted. Check its server status.");
    if (!data.trackingActive || !sameAssignment(data, next)) throw new Error("Unable to confirm tracking for this assignment.");
    latest = point;
    watcher = navigator.geolocation.watchPosition(position => {
      if (cycle !== epoch) return;
      try { latest = positionPoint(position); }
      catch { latest = null; publish({ phase: "WAITING", message: "Waiting for a fresh phone location." }); }
    }, error => {
      if (cycle !== epoch) return;
      latest = null;
      if (error.code === 1) { stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: true, message: "Location permission was withdrawn. Confirm the server tracking stop." }); }
      else publish({ phase: "WAITING", message: "Phone location is unavailable. Check location services." });
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
    const visible = () => { if (document.visibilityState !== "visible") { latest = null; publish({ phase: "PAUSED", message: "Phone sharing can pause in the background." }); } else void tick(); };
    const offline = () => { latest = null; publish({ phase: "PAUSED", message: "Offline. Waiting for a fresh live reading after reconnecting." }); };
    const online = () => { void tick(); };
    const changedSession = (event: StorageEvent) => { if (event.key === "driverToken" || event.key === null) pausePhoneTracking(next.driverId, "Your login changed in another tab. Refresh before sharing phone location."); };
    window.addEventListener("online", online); window.addEventListener("offline", offline); window.addEventListener("storage", changedSession); document.addEventListener("visibilitychange", visible);
    removeEvents = () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.removeEventListener("storage", changedSession); document.removeEventListener("visibilitychange", visible); };
    timer = window.setInterval(() => void tick(), 15_000);
    const url = shareUrl(data.trackingUrl);
    publish({ phase: data.lastLocationAt && Date.now() - Date.parse(data.lastLocationAt) <= 45_000 ? "RECENT" : "WAITING", sharing: true, lastConfirmedAt: data.lastLocationAt, ...(url ? { trackingUrl: url } : {}), message: "Phone sharing enabled. Keep this portal open; locking your phone or opening another app can pause it." });
    return getPhoneTrackingState(next.driverId);
  } catch (error) {
    stopWatcher(); publish({ phase: "BLOCKED", sharing: false, stopPending: serverStarted || (startAttempted && (status(error) === 0 || status(error) >= 500)), message: message(error) }); throw error;
  } finally { startBusy = false; }
}

export async function stopPhoneTracking(driverId: string, request: TrackingRequest): Promise<void> {
  if (!binding || binding.driverId !== driverId) return;
  if (startBusy || state.phase === "STARTING" || state.phase === "STOPPING") throw new Error("Wait for the current tracking request to finish.");
  const current = { ...binding };
  stopWatcher(); publish({ phase: "STOPPING", sharing: false, stopPending: true, message: "Phone watcher stopped. Confirming the stop with the server…" });
  try {
    const checked = await request<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(current.bookingId)}`);
    if (!checked.trackingActive) { binding = null; sender = null; stopRequestId = null; publish({ ...off }); return; }
    stopRequestId ||= identifier();
    const result = await request<TrackingPayload>(`/api/driver/tracking/${encodeURIComponent(current.bookingId)}/stop`, { method: "POST", body: JSON.stringify({ requestId: stopRequestId, capturedAt: new Date().toISOString() }) });
    if (result.trackingActive) throw new Error("The server has not confirmed the tracking stop. Retry or contact dispatch.");
    binding = null; sender = null; stopRequestId = null;
    publish({ ...off });
  } catch (error) {
    publish({ phase: "BLOCKED", sharing: false, stopPending: true, message: "Phone sharing stopped on this device, but the server stop is unconfirmed. Retry when connected or contact dispatch." }); throw error;
  }
}
