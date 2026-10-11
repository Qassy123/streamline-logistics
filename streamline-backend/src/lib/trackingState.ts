// Shared phone-GPS rules. Booking/shift records and operational evidence keep their own retention.
export const TRACKING_FRESH_MS = 120_000;
export const TRACKING_RETENTION_DAYS = 366;
export const TRACKING_MAP_HISTORY_DAYS = 30;
export const TRACKING_SHARE_MS = 24 * 60 * 60 * 1000;
export type TrackingPoint = { id?: string; driverId?: string | null; vehicleId?: string | null; assignedAtSnapshot?: Date | null; latitude: unknown; longitude: unknown; accuracy?: unknown; heading?: unknown; speed?: unknown; createdAt: Date; capturedAt?: Date | null };
export type TrackingSubject = { driverId?: string | null; vehicleId?: string | null; driverAssignedAt?: Date | null; status: string; trackingStartedAt?: Date | null; trackingEndedAt?: Date | null; driverLocations: TrackingPoint[] };
export function retentionCutoff(now = new Date()) { return new Date(now.getTime() - TRACKING_RETENTION_DAYS * 86_400_000); }
export function trackingState(booking: TrackingSubject, eligible: boolean, now = new Date()) {
  const enabled = booking.status === "IN_PROGRESS" && !!booking.trackingStartedAt && !booking.trackingEndedAt;
  const raw = booking.driverLocations[0];
  const captured = raw?.capturedAt || raw?.createdAt;
  const since = booking.driverAssignedAt?.getTime() || 0;
  const accepted = !!raw && raw.driverId === booking.driverId && raw.vehicleId === booking.vehicleId && (raw.assignedAtSnapshot?.getTime() || 0) === since && !!captured && captured.getTime() >= since && raw.createdAt.getTime() >= (booking.trackingStartedAt?.getTime() || 0) && captured.getTime() >= now.getTime() - TRACKING_MAP_HISTORY_DAYS * 86_400_000
    && captured.getTime() <= now.getTime() + 30_000 && raw.createdAt.getTime() <= now.getTime() + 30_000;
  const latitude = Number(raw?.latitude), longitude = Number(raw?.longitude);
  const valid = accepted && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const point = valid ? { id: raw!.id, latitude, longitude, accuracy: raw!.accuracy == null ? null : Number(raw!.accuracy),
    heading: raw!.heading == null ? null : Number(raw!.heading), speed: raw!.speed == null ? null : Number(raw!.speed),
    createdAt: raw!.createdAt, capturedAt: captured! } : null;
  const stale = !!point && now.getTime() - captured!.getTime() > TRACKING_FRESH_MS;
  const live = enabled && eligible && !!point && !stale;
  return { trackingActive: enabled, trackingLive: live, latestLocation: point, lastLocationAt: point?.capturedAt || null,
    locationStale: stale, locationState: !enabled ? "STOPPED" : !eligible ? "PAUSED" : !point ? "WAITING" : stale ? "STALE" : "RECENT",
    source: "PHONE", sourceLabel: "Phone location", hardwareTrackerConnected: false, eta: null,
    serverTime: now, freshForSeconds: TRACKING_FRESH_MS / 1000 };
}

// Viewers must check current assignment and an open working activity, not just a started session.
export function driverEligible(booking: { driverId?: string | null; vehicleId?: string | null; driver?: { id: string; active: boolean; portalOnDuty: boolean; vehicleId: string | null } | null }, workingDriverIds: Set<string>) {
  return !!booking.driverId && !!booking.vehicleId && booking.driver?.id === booking.driverId && booking.driver.active
    && booking.driver.portalOnDuty && booking.driver.vehicleId === booking.vehicleId && workingDriverIds.has(booking.driverId);
}

export function customerTracking(booking: TrackingSubject, eligible: boolean, now = new Date()) {
  const state = trackingState(booking, eligible, now);
  // Customers see an eligible journey's latest point only. Stopped/reassigned/off-duty location is private.
  return { ...state, latestLocation: state.trackingActive && eligible ? state.latestLocation : null,
    lastLocationAt: state.trackingActive && eligible ? state.lastLocationAt : null };
}
