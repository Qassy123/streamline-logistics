"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Job = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  completedAt?: string | null;
  collectionAddress: string;
  deliveryAddress: string;
  driver?: { name: string } | null;
};
type Review = { id: string; reference: string; action: "COMPLETE" | "CANCEL" };
const outcomes = ["COMPLETED", "OPEN", "CANCELLED", "ALL"] as const;
const outcomeLabels = { COMPLETED: "Completed jobs", OPEN: "Open jobs", CANCELLED: "Cancelled jobs", ALL: "All outcomes" };

export default function CustomerCompletedJobs({ customerId, apiBase }: { customerId: string; apiBase: string }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [outcome, setOutcome] = useState<(typeof outcomes)[number]>("COMPLETED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const loadVersion = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const base = `${apiBase.replace(/\/$/, "")}/api/bookings/admin/completed-jobs`;
  const listId = `completed-jobs-${customerId}`;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!customerId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const key = localStorage.getItem("streamline_admin_key")?.trim() || "";
      if (!key) throw new Error("Sign in to the admin customer account view before loading jobs.");
      const query = new URLSearchParams({ customerId, status: outcome, search, page: String(page) });
      const response = await fetch(`${base}?${query}`, { cache: "no-store", signal, headers: { "x-admin-key": key } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load this customer's jobs.");
      if (!signal?.aborted && version === loadVersion.current) {
        setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        const nextPages = data.pages || 1;
        setPages(nextPages);
        if (page > nextPages) setPage(nextPages);
        setTotal(data.total || 0);
      }
    } catch (requestError) {
      if (!signal?.aborted && version === loadVersion.current) {
        setJobs([]);
        setError(requestError instanceof Error ? requestError.message : "Unable to load this customer's jobs.");
      }
    } finally {
      if (!signal?.aborted && version === loadVersion.current) setLoading(false);
    }
  }, [base, customerId, outcome, search, page]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => void load(controller.signal);
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [open, load, reload]);

  async function submitReview() {
    if (!review || saving) return;
    if (reason.trim().length < 5) { setError("Enter a reason of at least five characters."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(review.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": localStorage.getItem("streamline_admin_key") || "" },
        body: JSON.stringify({ customerId, action: review.action, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update this job.");
      setMessage(`${review.reference}: ${review.action === "COMPLETE" ? "completion confirmed" : "job cancelled"}.`);
      setReview(null); setReason("");
      setReload(value => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update this job.");
    } finally { setSaving(false); }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-300 bg-white" aria-label="Customer completed jobs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div><h2 className="text-lg font-bold text-slate-950">Completed Jobs</h2><p className="mt-1 text-sm text-slate-600">View completed work and review job outcomes for this customer.</p></div>
        <button type="button" aria-expanded={open} aria-controls={listId} disabled={saving} onClick={() => setOpen(value => !value)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">{open ? "Hide jobs" : "View completed jobs"}</button>
      </div>
      {open && <div id={listId} className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Outcome<select value={outcome} onChange={event => { setOutcome(event.target.value as (typeof outcomes)[number]); setPage(1); }} className="mt-1 block min-h-11 rounded-lg border border-slate-300 p-2">{outcomes.map(value => <option key={value} value={value}>{outcomeLabels[value]}</option>)}</select></label>
          <label className="flex-1 text-sm font-semibold">Search job reference<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} maxLength={120} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 p-2" /></label>
          <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading || saving} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        <div className="overflow-x-auto rounded-lg border border-slate-200" aria-busy={loading}>
          <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Job", "Collection date", "Completion date", "Journey", "Driver", "Outcome", "Review"].map(label => <th key={label} className="p-3 font-bold">{label}</th>)}</tr></thead>
            <tbody>{jobs.map(job => <tr key={job.id} className="border-t border-slate-200"><td className="p-3"><Link href={`/admin/bookings?booking=${encodeURIComponent(job.id)}`} className="font-bold text-blue-700 underline">{job.reference}</Link></td><td className="whitespace-nowrap p-3">{new Date(job.collectionDate).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td><td className="whitespace-nowrap p-3">{job.completedAt ? new Date(job.completedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" }) : job.status === "COMPLETED" ? "Not recorded" : "—"}</td><td className="max-w-sm p-3">{job.collectionAddress} to {job.deliveryAddress}</td><td className="p-3">{job.driver?.name || "Unassigned"}</td><td className="p-3">{job.status.replaceAll("_", " ")}</td><td className="p-3">{!["COMPLETED", "CANCELLED", "EXPIRED", "PENDING_PAYMENT"].includes(job.status) && <div className="flex flex-wrap gap-2">{(["COMPLETE", "CANCEL"] as const).map(action => <button type="button" key={action} disabled={saving} onClick={() => { setReview({ id: job.id, reference: job.reference, action }); setReason(""); setError(""); }} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">{action === "COMPLETE" ? "Confirm completed" : "Cancel job"}</button>)}</div>}</td></tr>)}</tbody>
          </table>
          {!jobs.length && !loading && !error && <p className="p-5 text-sm text-slate-600">{outcome === "COMPLETED" ? "No completed jobs for this customer yet." : "No matching jobs for this customer."}</p>}
          {loading && !jobs.length && <p role="status" className="p-5 text-sm text-slate-600">Loading this customer's jobs...</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} matching {total === 1 ? "job" : "jobs"}</span><div className="flex items-center gap-3"><button type="button" disabled={page <= 1 || loading || saving} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-50">Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages || loading || saving} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-50">Next</button></div></div>
      </div>}
      {review && <div role="dialog" aria-modal="true" aria-labelledby={`${listId}-review`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"><div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6"><h3 id={`${listId}-review`} className="text-xl font-bold">{review.action === "COMPLETE" ? "Confirm job completed" : "Cancel uncompleted job"}</h3><p className="text-sm text-slate-600">{review.reference}</p><label className="block text-sm font-semibold">Reason (at least five characters)<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} className="mt-2 w-full rounded-lg border border-slate-300 p-3" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" disabled={saving || reason.trim().length < 5} onClick={() => void submitReview()} className="min-h-11 rounded-lg bg-blue-700 px-4 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Confirm"}</button><button type="button" disabled={saving} onClick={() => setReview(null)} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">Back</button></div></div></div>}
    </section>
  );
}
