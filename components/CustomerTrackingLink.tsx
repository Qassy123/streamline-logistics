"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import GoogleLocationMap from "./GoogleLocationMap";
const API = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://streamline-logistics-production.up.railway.app").replace(/\/$/, "");
type Payload = { booking: { reference: string; status: string; plannedArrivalAt: string | null }; trackingLive: boolean; locationState: string; expiresAt: string;
  latestLocation: { latitude: number; longitude: number; capturedAt: string; createdAt: string; accuracy: number | null } | null;
  trackingEvents: { id: string; title: string; createdAt: string }[] };
const time = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: "Europe/London" });
export default function CustomerTrackingLink({ reference, token }: { reference: string; token: string }) {
  const [data, setData] = useState<Payload | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const flight = useRef(false), mounted = useRef(false), generation = useRef(0), abort = useRef<AbortController | null>(null), expired = useRef(false);
  const refresh = useCallback(async () => {
    if (flight.current || expired.current || document.visibilityState !== "visible") return;
    if (!navigator.onLine) { setError("You are offline. Any displayed location is last known."); return; }
    if (!/^[a-f0-9]{64}$/i.test(token)) { setError("This tracking link is unavailable or expired."); return; }
    const cycle = generation.current;
    flight.current = true; setBusy(true); const controller = new AbortController(); abort.current = controller;
    try { const response = await fetch(`${API}/api/tracking/public/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`, { cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal });
      const result = await response.json(); if (!mounted.current || cycle !== generation.current) return;
      if (!response.ok) { if (response.status === 404) { expired.current = true; setData(null); } throw new Error(result.error || "Unable to refresh tracking."); }
      setData(result); setError(""); setNow(Date.now());
    } catch(e) { if (mounted.current && cycle === generation.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to refresh tracking."); }
    finally { flight.current = false; if (mounted.current && cycle === generation.current) setBusy(false); }
  }, [reference, token]);
  useEffect(() => { generation.current++; mounted.current = true; expired.current = false; setData(null); void refresh(); const timer = window.setInterval(()=>{setNow(Date.now());void refresh();},15000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online",visible); document.addEventListener("visibilitychange",visible);
    return () => { generation.current++; mounted.current = false; abort.current?.abort(); window.clearInterval(timer); window.removeEventListener("online",visible); document.removeEventListener("visibilitychange",visible); };
  },[refresh]);
  const point = data?.latestLocation, linkValid = !!data && Date.parse(data.expiresAt)>now;
  const live = linkValid && data?.trackingLive && !!point && now-Date.parse(point.capturedAt)<=120000 && !error;
  return <main className="mx-auto min-h-[100dvh] max-w-3xl space-y-5 p-4 sm:p-6"><h1 className="text-2xl font-bold">Track your delivery</h1><p className="text-sm text-slate-600">Phone location updates while the driver shares this journey. Updates can pause when the portal is hidden or offline.</p><button className="min-h-12 rounded-xl bg-blue-600 px-5 text-white disabled:opacity-50" disabled={busy || expired.current} onClick={()=>void refresh()}>{busy ? "Refreshing…" : "Refresh tracking"}</button>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
    {data && linkValid && <><section className="space-y-3 rounded-2xl border p-5"><h2 className="text-xl font-bold">{data.booking.reference}</h2><p>{data.booking.status.replaceAll("_"," ")}</p><p role="status" className="font-semibold">{live ? "Recent phone location" : point ? "Last known location — updates paused or stale" : data.locationState === "STOPPED" ? "Phone sharing stopped" : "Waiting for driver location"}</p>{data.booking.plannedArrivalAt && <p className="text-sm">Planned arrival: {time(data.booking.plannedArrivalAt)}. This is a dispatch plan; live ETA is unavailable.</p>}{point && <><p className="text-sm">Captured: {time(point.capturedAt)} · Accuracy: {point.accuracy == null ? "not reported" : `${Math.round(point.accuracy)} m`}</p><div className="h-[320px] overflow-hidden rounded-xl"><GoogleLocationMap latitude={point.latitude} longitude={point.longitude} title={live ? "Recent phone location" : "Last known phone location"} /></div></>}</section><section className="space-y-3 rounded-2xl border p-5"><h2 className="text-xl font-bold">Journey updates</h2>{data.trackingEvents.map(event=><article key={event.id} className="border-l-2 border-blue-200 pl-3"><p className="font-semibold">{event.title}</p><p className="text-xs">{time(event.createdAt)}</p></article>)}{!data.trackingEvents.length && <p>No journey updates yet.</p>}</section><p className="text-xs text-slate-600">This private read-only link expires {time(data.expiresAt)}. Keep it private.</p></>}
    {data && !linkValid && <p role="status">This link has expired. Ask dispatch for a new tracking link.</p>}
  </main>;
}
