"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FleetStaffGate, { type FleetApi, fleetButton, fleetTime } from "./FleetStaffGate";
import FleetTrackingMap from "./FleetTrackingMap";
type Row = { vehicle: { id: string; name: string; registration: string | null; vehicleType: string }; booking: { id: string; reference: string; status: string; destination: string; plannedArrivalAt: string | null; driver: { name: string } | null } | null;
  trackingLive: boolean; locationState: string; latestLocation: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string; createdAt: string } | null; openJobs: number };
type Payload = { rows: Row[]; page: number; pages: number; total: number; truncatedJobs: boolean; serverTime: string };
export default function LiveFleetTracking() { return <FleetStaffGate>{api => <FleetView api={api} />}</FleetStaffGate>; }
export function FleetView({ api }: { api: FleetApi }) {
  const apiRef = useRef(api), flight = useRef(false), generation = useRef(0);
  apiRef.current = api;
  const [data, setData] = useState<Payload | null>(null), [page, setPage] = useState(1), [error, setError] = useState(""), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const refresh = useCallback(async (manual = false) => {
    if (flight.current || (!manual && (document.visibilityState !== "visible" || !navigator.onLine))) return;
    const cycle = generation.current; flight.current = true; setBusy(true);
    try { const result = await apiRef.current<Payload>(`/api/tracking/fleet?page=${page}`); if (cycle !== generation.current) return; setData(result); setError(""); setNow(Date.now()); }
    catch (e) { if (cycle === generation.current) setError(e instanceof Error ? e.message : "Unable to refresh locations."); }
    finally { flight.current = false; if (cycle === generation.current) setBusy(false); }
  }, [page]);
  useEffect(() => {
    generation.current++; setData(null); void refresh();
    const timer = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 15000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", visible); document.addEventListener("visibilitychange", visible);
    return () => { generation.current++; window.clearInterval(timer); window.removeEventListener("online", visible); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  const points = useMemo(() => (data?.rows || []).flatMap(row => row.latestLocation ? [{ id: row.vehicle.id, label: row.vehicle.registration || row.vehicle.name,
    ...row.latestLocation, live: row.trackingLive && now - Date.parse(row.latestLocation.capturedAt) <= 120000 }] : []), [data, now]);
  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Live fleet map</h2><button className={fleetButton} disabled={busy} onClick={() => void refresh(true)}>{busy ? "Refreshing…" : "Refresh locations"}</button></div>
    <p className="text-sm text-slate-600">Authorized phone GPS refreshes every 15 seconds while this page is open. Locations older than two minutes are last known, not live. Drivers must be working this journey with the assigned van.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error} Retained results below may be out of date.</p>}
    <FleetTrackingMap points={points} />
    <p className="text-sm">{data ? points.filter(p=>p.live).length : "—"} recent locations · {data?.total ?? "—"} active vans · Page {page} of {data?.pages || 1}. {data && `Last refresh: ${fleetTime(data.serverTime)}`}</p>
    {data?.truncatedJobs && <p role="alert">This page has more than 500 open jobs. Refresh after dispatch reviews the open jobs; the map shows a limited result.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.rows.map(row => {
      const point = row.latestLocation, live = row.trackingLive && !!point && now-Date.parse(point.capturedAt)<=120000;
      return <article key={row.vehicle.id} className="min-w-0 space-y-2 rounded-xl border p-4"><h3 className="font-bold break-words">{row.vehicle.registration || row.vehicle.name}</h3><p className={`text-sm font-semibold ${live ? "text-blue-700" : "text-amber-800"}`}>{live ? "Recent phone GPS" : point ? "Last known / sharing paused" : "No phone location"}</p><p className="text-sm">{row.booking ? `${row.booking.reference} · ${row.booking.driver?.name || "No driver"}` : "No journey in progress"}</p>{row.booking && <p className="break-words text-sm">{row.booking.status.replaceAll("_", " ")} · Next destination: {row.booking.destination}</p>}{point && <p className="text-xs">Captured: {fleetTime(point.capturedAt)} · Accuracy: {point.accuracy == null ? "not reported" : `${Math.round(point.accuracy)} m`}</p>}{row.booking?.plannedArrivalAt && <p className="text-xs">Planned arrival: {fleetTime(row.booking.plannedArrivalAt)}. Live ETA unavailable.</p>}{row.openJobs > 1 && <p className="text-xs text-amber-800">{row.openJobs} open jobs on this van; showing the most recent eligible location.</p>}{row.booking && <a className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700" href={`/admin/bookings?search=${encodeURIComponent(row.booking.reference)}`}>Open booking</a>}</article>;
    })}</div>
    {!busy && data && !data.rows.length && <p>No active vans on this page.</p>}
    <div className="flex gap-3"><button className={fleetButton} disabled={busy || page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button className={fleetButton} disabled={busy || !data || page>=data.pages} onClick={()=>setPage(p=>p+1)}>Next</button></div>
  </section>;
}
