"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CornerDownLeft, Loader2, MapPin, RefreshCw, Search, Truck } from "lucide-react";
import { driverStatusLabel, useDriverPortal, type PortalVehicle } from "@/components/driver/DriverPortalShell";

type Scope = "ALL" | "TODAY" | "UPCOMING" | "COMPLETED" | "ACTIVE";
type Job = {
  id: string; reference: string; status: string; collectionDate: string; collectionWindow: string;
  collectionAddress: string; deliveryAddress: string; acknowledgedAt: string | null; vehicle: PortalVehicle | null;
  nextStop: { label: string; address: string; status: string; evidence?: { reviewStatus: string } | null } | null;
  stopSummary?: { totalStops: number; completedStops: number; extraDrops: number; hasReturn: boolean };
};
type JobList = { jobs: Job[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; serverTime: string };
type Filters = { scope: Scope; status: string; query: string; page: number };
const scopes: { value: Scope; label: string }[] = [{ value: "ALL", label: "All" }, { value: "TODAY", label: "Today" }, { value: "ACTIVE", label: "Open jobs" }, { value: "UPCOMING", label: "Upcoming" }, { value: "COMPLETED", label: "Completed" }];
const statuses = ["PENDING_PAYMENT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"];
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const control = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

function parseFilters(params: { get: (key: string) => string | null }): Filters {
  const scope = (params.get("scope") || "ALL").toUpperCase();
  const status = (params.get("status") || "ALL").toUpperCase();
  const page = Number(params.get("page") || "1");
  return { scope: scopes.some(item => item.value === scope) ? scope as Scope : "ALL", status: statuses.includes(status) ? status : "ALL", query: (params.get("q") || "").trim().slice(0, 100), page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1 };
}
function filterParams(filters: Filters, forApi = false) {
  const params = new URLSearchParams();
  params.set("scope", filters.scope);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.query) params.set("q", filters.query);
  if (filters.page > 1 || forApi) params.set("page", String(filters.page));
  if (forApi) params.set("pageSize", "25");
  return params.toString();
}
function jobDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(date) : "Date not recorded";
}
function statusChoices(scope: Scope) {
  if (scope === "COMPLETED") return ["COMPLETED"];
  if (scope === "UPCOMING") return ["CONFIRMED", "ASSIGNED"];
  if (scope === "ACTIVE") return ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"];
  if (scope === "TODAY") return ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];
  return statuses;
}

function JobsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { online, request } = useDriverPortal();
  const filters = parseFilters(params || new URLSearchParams());
  const filterKey = filterParams(filters, true);
  const [query, setQuery] = useState(filters.query);
  const [snapshot, setSnapshot] = useState<{ key: string; data: JobList } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const data = snapshot?.key === filterKey ? snapshot.data : null;
  useEffect(() => { setQuery(filters.query); }, [filters.query]);

  function navigate(change: Partial<Filters>) {
    const next = { ...filters, ...change };
    router.push(`/driver/jobs?${filterParams(next)}`, { scroll: false });
  }
  const load = useCallback(async () => {
    const current = ++generation.current;
    activeRequest.current?.abort();
    const abort = new AbortController(); activeRequest.current = abort;
    if (mounted.current) { setLoading(true); setError(""); }
    try {
      const payload = await request<JobList>(`/api/driver/jobs/?${filterKey}`, { signal: abort.signal });
      if (!mounted.current || current !== generation.current) return;
      if (!Array.isArray(payload.jobs) || !payload.pagination || !Number.isInteger(payload.pagination.page) || !Number.isInteger(payload.pagination.total) || payload.pagination.total < 0 || !Number.isInteger(payload.pagination.totalPages) || payload.pagination.totalPages < 0) throw new Error("Unable to read your jobs. Refresh or contact dispatch.");
      const lastPage = Math.max(1, payload.pagination.totalPages);
      if (payload.pagination.page > lastPage) {
        const next = new URLSearchParams(filterKey); next.set("page", String(lastPage)); next.delete("pageSize");
        router.replace(`/driver/jobs?${next}`, { scroll: false }); return;
      }
      setSnapshot({ key: filterKey, data: payload });
    } catch (failure) {
      if (mounted.current && current === generation.current && !abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load jobs.");
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
      if (activeRequest.current === abort) activeRequest.current = null;
    }
  }, [filterKey, request, router]);

  useEffect(() => {
    mounted.current = true; void load();
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); };
    const reconnect = () => { void load(); };
    const timer = window.setInterval(visible, 30_000);
    window.addEventListener("online", reconnect); document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; generation.current++; activeRequest.current?.abort(); window.clearInterval(timer); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", visible); };
  }, [load]);

  const availableStatuses = statusChoices(filters.scope);
  const first = data && data.pagination.total ? (data.pagination.page - 1) * data.pagination.pageSize + 1 : 0;
  const last = data ? Math.min(data.pagination.total, (data.pagination.page - 1) * data.pagination.pageSize + data.jobs.length) : 0;
  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Jobs</h1><p className="mt-1 text-sm text-slate-500">Work assigned to you by dispatch.</p></div><button className={secondary} disabled={loading || !online} onClick={() => void load()}><RefreshCw size={17} className={loading ? "animate-spin" : ""} />Refresh</button></div>
    <nav aria-label="Job filters" className="flex flex-wrap gap-2">{scopes.map(scope => <Link key={scope.value} href={`/driver/jobs?${filterParams({ ...filters, scope: scope.value, status: "ALL", page: 1 })}`} scroll={false} prefetch={false} aria-current={filters.scope === scope.value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filters.scope === scope.value ? "bg-[#006CFF] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{scope.label}</Link>)}</nav>
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); navigate({ query: query.trim(), page: 1 }); }}><div className="relative min-w-0 flex-1"><label className="sr-only" htmlFor="driver-job-search">Search jobs</label><Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-4 text-slate-400" /><input id="driver-job-search" className={`${control} pl-10`} maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Reference or address" /></div><button className={secondary} type="submit">Search</button></form>
      <div className="mt-3 flex flex-wrap items-center gap-3"><label className="min-w-0 flex-1"><span className="sr-only">Job status</span><select className={control} value={filters.status} onChange={event => navigate({ status: event.target.value, page: 1 })}><option value="ALL">All statuses in this view</option>{(availableStatuses.includes(filters.status) || filters.status === "ALL" ? availableStatuses : [filters.status, ...availableStatuses]).map(status => <option key={status} value={status}>{driverStatusLabel(status)}</option>)}</select></label>{filters.query || filters.status !== "ALL" ? <button className={secondary} onClick={() => { setQuery(""); navigate({ query: "", status: "ALL", page: 1 }); }}>Clear filters</button> : null}</div>
    </section>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{error}{data ? <p className="mt-1 font-semibold">These results may have changed. Refresh before continuing.</p> : null}<button className="mt-2 min-h-11 font-bold underline" disabled={loading || !online} onClick={() => void load()}>Retry loading</button></div> : null}
    {loading && !data ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />Loading jobs…</p> : data ? <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>Showing {first}–{last} of {data.pagination.total} {data.pagination.total === 1 ? "job" : "jobs"}</p>{loading ? <span role="status">Refreshing…</span> : null}</div>
      <div className="space-y-3">{data.jobs.map(job => <JobCard key={job.id} job={job} />)}{!data.jobs.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center"><h2 className="font-bold text-[#071D49]">No jobs in this view</h2><p className="mt-2 text-sm leading-6 text-slate-500">Change the filters or check All. Dispatch assigns your work.</p></div> : null}</div>
      <div className="flex items-center justify-between gap-2"><button className={secondary} disabled={loading || filters.page <= 1 || !online} onClick={() => navigate({ page: filters.page - 1 })}>Previous</button><span className="text-xs text-slate-500">Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)}</span><button className={secondary} disabled={loading || filters.page >= data.pagination.totalPages || !online} onClick={() => navigate({ page: filters.page + 1 })}>Next</button></div>
    </> : !error ? <button className={secondary} disabled={!online} onClick={() => void load()}>Load jobs</button> : null}
  </div>;
}

function JobCard({ job }: { job: Job }) {
  const closed = ["COMPLETED", "CANCELLED", "EXPIRED"].includes(job.status);
  const pendingReview = job.nextStop?.evidence?.reviewStatus === "PENDING";
  const rejectedReview = job.nextStop?.evidence?.reviewStatus === "REJECTED";
  return <Link href={`/driver/jobs/${encodeURIComponent(job.id)}`} prefetch={false} className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold text-[#071D49]">{job.reference}</h2><p className="mt-1 text-xs text-slate-500">{jobDate(job.collectionDate)} · {job.collectionWindow || "Window not recorded"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${job.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : job.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{driverStatusLabel(job.status)}</span></div>
    <div className="mt-3 space-y-1 text-sm leading-6 text-slate-700"><p className="break-words"><span className="font-semibold">From: </span>{job.collectionAddress}</p><p className="break-words"><span className="font-semibold">To: </span>{job.deliveryAddress}</p></div>
    {job.stopSummary ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{job.stopSummary.completedStops} / {job.stopSummary.totalStops} stops complete</span>{job.stopSummary.extraDrops ? <span>· {job.stopSummary.extraDrops} additional drops</span> : null}{job.stopSummary.hasReturn ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-700"><CornerDownLeft size={13} />Return</span> : null}</div> : null}
    {!closed && job.nextStop ? <div className="mt-3 rounded-xl bg-blue-50 p-3"><p className="flex items-start gap-2 text-sm text-[#071D49]"><MapPin size={16} className="mt-0.5 shrink-0" /><span className="break-words"><span className="font-bold">Next · {job.nextStop.label}: </span>{job.nextStop.address}</span></p></div> : null}
    {pendingReview ? <p className="mt-3 text-xs font-semibold text-amber-800">Delivery exception awaiting dispatch review</p> : rejectedReview ? <p className="mt-3 text-xs font-semibold text-red-700">Delivery evidence needs correction</p> : !closed && !job.acknowledgedAt ? <p className="mt-3 text-xs font-semibold text-blue-700">Awaiting your acknowledgement</p> : null}
    <div className="mt-3 flex items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 text-xs text-slate-500"><Truck size={14} className="shrink-0" /><span className="truncate">{job.vehicle ? `${job.vehicle.registration || job.vehicle.name} · ${job.vehicle.vehicleType}` : "Van not assigned"}</span></p><span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-blue-700">{closed ? "View record" : "Open job"}<ArrowRight size={14} /></span></div>
  </Link>;
}

export default function DriverJobsPage() {
  return <Suspense fallback={<p role="status" className="py-10 text-center text-sm text-slate-500">Loading jobs…</p>}><JobsContent /></Suspense>;
}
