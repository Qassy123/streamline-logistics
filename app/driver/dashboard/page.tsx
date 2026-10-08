"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, MapPin, Navigation, RefreshCw, Truck } from "lucide-react";
import { driverStatusLabel, useDriverPortal, type PortalDriver, type PortalVehicle } from "@/components/driver/DriverPortalShell";

type TodayStop = {
  id: string; type: string; label: string; address: string; status: string;
  contactName: string | null; contactPhone: string | null;
  evidence: { reviewStatus: string; exceptionReason: string | null; reviewNotes: string | null } | null;
};
type TodayJob = {
  id: string; reference: string; status: string; collectionDate: string; collectionWindow: string;
  collectionAddress: string; deliveryAddress: string; acknowledgedAt: string | null;
  estimatedStartTime: string | null; vehicle: PortalVehicle | null; nextStop: TodayStop | null;
  stopSummary: { totalStops: number; completedStops: number; extraDrops: number; hasReturn: boolean };
  load: { description: string; category: string; fragile: boolean; palletCount: number | null };
  dispatchNotes: string | null;
};
type Dashboard = {
  driver: PortalDriver; today: string; serverTime: string; currentJob: TodayJob | null; nextJob: TodayJob | null;
  todayJobs: TodayJob[]; upcomingJobs: TodayJob[]; completedJobs: TodayJob[];
  stats: { todayJobs: number; assignedJobs: number; activeJobs: number; completedJobs: number };
  hasMoreAssignedJobs: boolean;
};
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#006CFF] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function calendarDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(date) : "Date not available";
}
function clockTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(date) : null;
}
function phoneLink(value: string | null) {
  const number = value?.replace(/[^\d+]/g, "") || "";
  return /^\+?\d{7,15}$/.test(number) ? `tel:${number}` : null;
}
function jobHref(job: TodayJob) { return `/driver/jobs/${encodeURIComponent(job.id)}`; }
function nextAction(job: TodayJob) {
  if (job.nextStop?.evidence?.reviewStatus === "PENDING") return "View delivery exception";
  if (job.nextStop?.evidence?.reviewStatus === "REJECTED") return "Correct delivery evidence";
  if (job.status !== "IN_PROGRESS") return job.acknowledgedAt ? "Review job & start journey" : "Review & acknowledge job";
  if (!job.nextStop) return "Open job progress";
  if (job.nextStop.status === "ARRIVED") return job.nextStop.type === "COLLECTION" ? "Open collection handover" : "Capture delivery proof";
  return "Open next stop";
}

export default function DriverDashboardPage() {
  const { driver, online, sessionStale, unreadNotifications, request, refreshSession, refreshNotifications } = useDriverPortal();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const dutyFlight = useRef(false);
  const dutyAbort = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async () => {
    if (dutyFlight.current) return;
    const current = ++generation.current;
    activeRequest.current?.abort();
    const abort = new AbortController(); activeRequest.current = abort;
    if (mounted.current) setRefreshing(true);
    try {
      const payload = await request<Dashboard>("/api/driver/jobs/dashboard", { signal: abort.signal });
      if (!mounted.current || current !== generation.current) return;
      if (!payload.driver?.id || !payload.stats || !Array.isArray(payload.todayJobs) || !Array.isArray(payload.upcomingJobs) || !Array.isArray(payload.completedJobs)) throw new Error("Unable to read today's work. Refresh or contact dispatch.");
      setData(payload); setStale(false); setError("");
    } catch (failure) {
      if (mounted.current && current === generation.current && !abort.signal.aborted) {
        setStale(true); setError(failure instanceof Error ? failure.message : "Unable to load today's work.");
      }
    } finally {
      if (mounted.current && current === generation.current) { setLoading(false); setRefreshing(false); }
      if (activeRequest.current === abort) activeRequest.current = null;
    }
  }, [request]);

  useEffect(() => {
    mounted.current = true; void loadDashboard();
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine) void loadDashboard(); };
    const reconnect = () => { void loadDashboard(); };
    const timer = window.setInterval(visible, 30_000);
    window.addEventListener("online", reconnect); document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; generation.current++; activeRequest.current?.abort(); dutyAbort.current?.abort(); window.clearInterval(timer); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", visible); };
  }, [loadDashboard]);

  async function changeDuty() {
    if (!data || dutyFlight.current || !online || sessionStale || stale || refreshing) return;
    dutyFlight.current = true; generation.current++; activeRequest.current?.abort();
    const abort = new AbortController(); dutyAbort.current = abort;
    setSavingDuty(true); setError(""); setMessage("");
    try {
      const target = !data.driver.onDuty;
      const result = await request<{ driver: PortalDriver }>("/api/driver/jobs/duty", { method: "PATCH", signal: abort.signal, body: JSON.stringify({ onDuty: target }) });
      if (!mounted.current) return;
      if (!result.driver?.id) throw new Error("Unable to confirm your duty status. Refresh before trying again.");
      setData(current => current ? { ...current, driver: result.driver } : current);
      setMessage(result.driver.onDuty ? "You are on duty. Open your assigned job when ready." : "You are off duty.");
      await refreshSession();
    } catch (failure) {
      if (mounted.current && !abort.signal.aborted) { setStale(true); setError(failure instanceof Error ? failure.message : "Unable to change duty status. Refresh to check it."); }
    } finally {
      dutyFlight.current = false; dutyAbort.current = null;
      if (mounted.current) { setSavingDuty(false); void loadDashboard(); void refreshNotifications(); }
    }
  }

  const activeDriver = data?.driver || driver;
  const highlighted = data?.currentJob || data?.nextJob || null;
  const todayJobs = data?.todayJobs || [];
  const todayIds = new Set(todayJobs.map(job => job.id));
  const laterJobs = (data?.upcomingJobs || []).filter(job => !todayIds.has(job.id) && job.id !== highlighted?.id).slice(0, 4);
  const cannotGoOffDuty = activeDriver.onDuty && !!data?.currentJob;

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Today</h1><p className="mt-1 text-sm text-slate-500">{data ? calendarDate(data.today) : "Your assigned work"}</p></div><button className={secondary} disabled={refreshing || savingDuty || !online} onClick={() => void loadDashboard()}><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /><span>{refreshing ? "Refreshing" : "Refresh"}</span></button></div>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{error}{data ? <p className="mt-1 font-semibold">The work shown below may have changed. Refresh before continuing.</p> : null}</div> : null}
    {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div><p className="font-bold">{activeDriver.onDuty ? "On duty" : "Off duty"}</p><p className="mt-1 text-xs text-slate-500">{activeDriver.availability === "BUSY" ? "Journey in progress" : "Dispatch assigns your van and work."}</p></div><button className={secondary} disabled={loading || !data || refreshing || savingDuty || !online || sessionStale || stale || cannotGoOffDuty} onClick={() => void changeDuty()}>{savingDuty ? <><Loader2 size={16} className="animate-spin" />Saving</> : activeDriver.onDuty ? "Go off duty" : "Go on duty"}</button>{cannotGoOffDuty ? <p className="w-full text-xs text-slate-500">Finish the active job or call dispatch before going off duty.</p> : null}</section>
    {unreadNotifications > 0 ? <Link href="/driver/profile" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{unreadNotifications} unread dispatch {unreadNotifications === 1 ? "message" : "messages"}<ArrowRight size={17} /></Link> : null}
    {loading && !data ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />Loading today's work…</p> : data ? <>
      <div className="grid grid-cols-4 gap-2">{[{ label: "Today", value: data.stats.todayJobs }, { label: "Assigned", value: data.stats.assignedJobs }, { label: "Active", value: data.stats.activeJobs }, { label: "Completed", value: data.stats.completedJobs }].map(item => <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-2 py-3 text-center"><p className="text-xl font-bold text-[#071D49]">{item.value}</p><p className="mt-1 text-[11px] text-slate-500">{item.label}</p></div>)}</div>
      <p className="!mt-2 text-xs text-slate-500">Today includes completed work; Completed is your total completed jobs.</p>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">{data.currentJob ? "Current job" : "Next assigned job"}</h2>
        {highlighted ? <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#071D49]">{highlighted.reference}</p><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{driverStatusLabel(highlighted.status)}</span></div>
          <p className="mt-2 text-sm text-slate-500">{calendarDate(highlighted.collectionDate)} · {highlighted.collectionWindow || "Window not recorded"}{clockTime(highlighted.estimatedStartTime) ? ` · Planned ${clockTime(highlighted.estimatedStartTime)} UK time` : ""}</p>
          {highlighted.nextStop ? <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><MapPin size={15} />{highlighted.nextStop.label} · {driverStatusLabel(highlighted.nextStop.status)}</p><p className="mt-2 break-words font-semibold leading-6">{highlighted.nextStop.address}</p>{highlighted.nextStop.contactName ? <p className="mt-2 text-sm text-slate-600">{highlighted.nextStop.contactName}</p> : null}{phoneLink(highlighted.nextStop.contactPhone) ? <a className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-blue-700" href={phoneLink(highlighted.nextStop.contactPhone)!}>Call stop contact</a> : null}</div> : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No next stop is available. Open the job to check its details or contact dispatch.</p>}
          <p className="mt-3 text-xs text-slate-500">{highlighted.stopSummary.completedStops} / {highlighted.stopSummary.totalStops} stops complete{highlighted.stopSummary.extraDrops ? ` · ${highlighted.stopSummary.extraDrops} additional drops` : ""}{highlighted.stopSummary.hasReturn ? " · Return included" : ""}</p>
          {highlighted.load.description || highlighted.load.category ? <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-semibold">Load: </span>{highlighted.load.description || highlighted.load.category}{highlighted.load.palletCount != null ? ` · ${highlighted.load.palletCount} pallets` : ""}{highlighted.load.fragile ? " · Fragile goods" : ""}</p> : null}
          {highlighted.dispatchNotes ? <p className="mt-3 whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><span className="font-bold">Dispatch: </span>{highlighted.dispatchNotes}</p> : null}
          {highlighted.nextStop?.evidence?.reviewStatus === "PENDING" ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Delivery exception awaiting dispatch review. This stop is not complete yet.</p> : null}
          {highlighted.nextStop?.evidence?.reviewStatus === "REJECTED" ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">Dispatch requested corrected delivery evidence. {highlighted.nextStop.evidence.reviewNotes}</p> : null}
          {highlighted.vehicle && highlighted.vehicle.id !== activeDriver.vehicle?.id ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The job's planned van differs from your assigned van. Contact dispatch before starting.</p> : null}
          <Link href={jobHref(highlighted)} className={`${primary} mt-4 w-full`}>{nextAction(highlighted)}<ArrowRight size={17} /></Link>
          {highlighted.nextStop?.address ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(highlighted.nextStop.address)}`} target="_blank" rel="noopener noreferrer" className={`${secondary} mt-2 w-full`}><Navigation size={17} />Navigate to {highlighted.nextStop.label.toLowerCase()}</a> : null}
        </> : <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center"><CheckCircle2 size={26} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">No open jobs assigned</p><p className="mt-1 text-sm leading-6 text-slate-500">Dispatch will assign your work. Refresh to check for updates.</p></div>}
      </section>
      <Link href="/driver/vehicle" className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex min-w-0 items-center gap-3"><Truck size={23} className="shrink-0 text-[#006CFF]" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{activeDriver.vehicle ? activeDriver.vehicle.registration || activeDriver.vehicle.name : "No van assigned"}</span><span className="mt-1 block text-xs text-slate-500">{activeDriver.vehicle ? "View your van & daily checks" : "Contact dispatch for a van"}</span></span></span><ArrowRight size={18} className="shrink-0 text-slate-400" /></Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-bold">Today's open work</h2><Link href="/driver/jobs?scope=TODAY" className="py-2 text-sm font-bold text-blue-700">View all</Link></div><div className="mt-2 space-y-2">{todayJobs.slice(0, 8).map(job => <JobRow key={job.id} job={job} />)}{!todayJobs.length ? <p className="py-4 text-sm text-slate-500">No open jobs for today in this view. Use View all for the full day's work.</p> : null}</div>{todayJobs.length > 8 || data.hasMoreAssignedJobs ? <p className="mt-3 text-xs text-slate-500">This is a preview. View all for the full list.</p> : null}</section>
      {laterJobs.length ? <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold">Other assigned work</h2><Link href="/driver/jobs" className="py-2 text-sm font-bold text-blue-700">All jobs</Link></div><div className="mt-2 space-y-2">{laterJobs.map(job => <JobRow key={job.id} job={job} />)}</div></section> : null}
      <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer content-center font-bold">Recently completed ({data.completedJobs.length})</summary><div className="mt-2 space-y-2">{data.completedJobs.map(job => <JobRow key={job.id} job={job} />)}{!data.completedJobs.length ? <p className="py-3 text-sm text-slate-500">No completed jobs yet.</p> : null}<Link href="/driver/jobs?scope=COMPLETED" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700">View completed history</Link></div></details>
      <p className="text-center text-xs leading-5 text-slate-500">Vehicle GPS integration is awaiting a tracker provider.{data.serverTime ? ` Work last checked at ${clockTime(data.serverTime)} UK time.` : ""}</p>
    </> : <button className={`${secondary} w-full`} disabled={refreshing || !online} onClick={() => void loadDashboard()}>Retry loading today's work</button>}
  </div>;
}

function JobRow({ job }: { job: TodayJob }) {
  return <Link href={jobHref(job)} className="block rounded-xl border border-slate-200 p-3 transition hover:border-blue-300 hover:bg-blue-50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">{job.reference}</span><span className="text-xs font-semibold text-slate-500">{driverStatusLabel(job.status)}</span></div><p className="mt-1 text-xs text-slate-500">{calendarDate(job.collectionDate)} · {job.collectionWindow || "No window"}</p><p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-slate-700">{job.collectionAddress} → {job.deliveryAddress}</p>{job.vehicle ? <p className="mt-2 text-xs text-slate-500">{job.vehicle.registration || job.vehicle.name} · {job.vehicle.vehicleType}</p> : null}</Link>;
}
