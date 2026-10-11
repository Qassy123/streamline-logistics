"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDriverPortal } from "./DriverPortalShell";

type Activity = { kind: string; startedAt: string; endedAt: string | null };
type Shift = { id: string; startedAt: string; endedAt: string | null; activities: Activity[] };
type Current = { shift: Shift | null; serverTime: string };
const button = "min-h-12 rounded-xl bg-[#006CFF] px-4 py-3 font-bold text-white disabled:opacity-50";
const duration = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;

export default function DriverShiftCard() {
  const { driver, request, refreshSession, online, sessionStale } = useDriverPortal();
  const [data, setData] = useState<Current | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now()), [offset, setOffset] = useState(0), [kind, setKind] = useState("OTHER_WORK");
  const flight = useRef(false), pending = useRef<{ action: string; kind?: string; requestId: string } | null>(null);
  const load = useCallback(async () => {
    const result = await request<Current>("/api/driver/shifts/current");
    setData(result); setOffset(Date.parse(result.serverTime) - Date.now());
  }, [request]);
  useEffect(() => { if (online) void load().catch(failure => setError(failure.message)); }, [online, load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const shift = data?.shift, active = shift?.activities.find(item => !item.endedAt), serverNow = now + offset;
  const elapsed = shift ? Math.max(0, (serverNow - Date.parse(shift.startedAt)) / 1000) : 0;
  const working = shift?.activities.reduce((sum, item) => ["WORK", "DRIVING", "OTHER_WORK"].includes(item.kind)
    ? sum + Math.max(0, (item.endedAt ? Date.parse(item.endedAt) : serverNow) - Date.parse(item.startedAt)) / 1000 : sum, 0) || 0;
  async function act(action: string, selectedKind?: string) {
    if (flight.current || !online) return;
    if (action === "clock-out" && !window.confirm("Finish your shift? Any running break will end too.")) return;
    flight.current = true; setBusy(true); setError("");
    try {
      // An ambiguous retry keeps the original identifier, even if the first response was lost.
      if (pending.current && (pending.current.action !== action || pending.current.kind !== selectedKind)) {
        throw new Error("Retry the previous action or refresh to check your shift before choosing another action.");
      }
      pending.current ||= { action, kind: selectedKind, requestId: crypto.randomUUID() };
      await request(`/api/driver/shifts/${action}`, { method: "POST", body: JSON.stringify(pending.current) });
      pending.current = null; await load(); await refreshSession();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Update not confirmed. Refresh to check your shift.");
    } finally { flight.current = false; setBusy(false); }
  }
  const disabled = busy || !online || sessionStale || !data;
  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#071D49]">My shift</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold">{!data ? "Checking…" : !shift ? "Off shift" : active?.kind === "BREAK" ? "On break" : "Clocked in"}</span></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!online && <p className="text-sm text-amber-800">Reconnect to record attendance. Offline clicks are not clock-ins.</p>}
    {shift && <><p className="text-sm">Started {new Date(shift.startedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {active?.kind.replaceAll("_", " ").toLowerCase()}</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#F4F8FF] p-3"><p className="text-xs">Attendance</p><strong>{duration(elapsed)}</strong></div><div className="rounded-xl bg-[#F4F8FF] p-3"><p className="text-xs">Recorded work</p><strong>{duration(working)}</strong></div></div></>}
    {!shift ? <button disabled={disabled} className={`${button} w-full`} onClick={() => void act("clock-in")}>Clock in</button> : <><button disabled={disabled} className={`${button} w-full`} onClick={() => void act(active?.kind === "BREAK" ? "end-break" : "start-break")}>{active?.kind === "BREAK" ? "End break" : "Start break"}</button><button disabled={disabled} className="min-h-12 w-full rounded-xl border p-3 font-bold disabled:opacity-50" onClick={() => void act("clock-out")}>Clock out</button><details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Record another activity</summary><label className="block text-sm">Activity<select value={kind} onChange={event => setKind(event.target.value)} className="my-2 min-h-12 w-full rounded-xl border p-3"><option value="WORK">Work</option><option value="DRIVING">Driving</option><option value="OTHER_WORK">Other work</option><option value="REST">Rest</option><option value="POA">Period of availability</option></select></label><button disabled={disabled} className={button} onClick={() => void act("activity", kind)}>Change activity</button><p className="mt-2 text-xs text-slate-500">Use only while safely parked. A job journey is not automatically recorded as driving time.</p></details></>}
    <div className="flex items-center justify-between"><Link href="/driver/timesheets" className="min-h-11 py-3 font-semibold text-blue-700">My timesheets</Link><button disabled={busy || !online} className="min-h-11 px-3 text-blue-700" onClick={() => { void load().then(() => { pending.current = null; setError(""); }).catch(failure => setError(failure.message)); }}>Refresh</button></div>
    <p className="text-xs text-slate-500">{driver.name} · Attendance, working time and payable time are calculated separately.</p>
  </section>;
}
