"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DriverRequestError, useDriverPortal } from "@/components/driver/DriverPortalShell";
import { checkpointDraftUpload, confirmDriverDraft, createDraftMedia, getDriverDraft, markDraftNeedsReview, markDraftPending, saveDriverDraft, type DriverDraft, type DraftMedia } from "@/lib/driverDrafts";

const checks = ["TYRES", "LIGHTS", "BRAKES", "MIRRORS", "FLUIDS", "LOAD_SECURITY", "BODYWORK"] as const;
type Check = { id: string; requestId?: string; checkDate?: string; createdAt: string; notes: string | null; unsafeToDrive: boolean; hasDefect?: boolean; dispatchResponse?: string | null; acknowledgedAt?: string | null; resolvedAt?: string | null; items: Record<string, string> };
type VehicleData = { vehicle: { id: string; name: string; registration: string | null; mileage: number | null; make?: string | null; model?: string | null } | null; checks: Check[]; unresolvedDefects: Check[]; today: string };
const input = "min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base";
const button = "min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50";
const label = (key: string) => key.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());

export default function VehiclePage() {
  const { driver, request, online, refreshSession } = useDriverPortal();
  const [data, setData] = useState<VehicleData | null>(null), [draft, setDraft] = useState<DriverDraft | null>(null);
  const [items, setItems] = useState<Record<string, string>>({}), [odometer, setOdometer] = useState(""), [notes, setNotes] = useState(""), [unsafe, setUnsafe] = useState(false), [photos, setPhotos] = useState<DraftMedia[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [ready, setReady] = useState(false), [dirty, setDirty] = useState(false);
  const flight = useRef(false), generation = useRef(0);
  const vehicleId = driver.vehicle?.id || "";
  const binding = { driverId: driver.id, kind: "VEHICLE_CHECK" as const, vehicleId };
  const refresh = useCallback(async () => { const result = await request<VehicleData>("/api/driver/jobs/vehicle"); setData(result); return result; }, [request]);
  useEffect(() => {
    const cycle = ++generation.current; setReady(false); setDraft(null); setItems({}); setNotes(""); setOdometer(""); setUnsafe(false); setPhotos([]); setDirty(false); setError("");
    void (async () => {
      try {
        if (navigator.onLine) await refresh();
        if (!vehicleId) return;
        const saved = await getDriverDraft({ driverId: driver.id, kind: "VEHICLE_CHECK", vehicleId });
        if (cycle !== generation.current) return;
        if (saved) { setDraft(saved); setItems((saved.fields.items || {}) as Record<string, string>); setOdometer(String(saved.fields.odometer ?? "")); setNotes(String(saved.fields.notes || "")); setUnsafe(saved.fields.unsafeToDrive === true); setPhotos(saved.photos); }
      } catch (failure) { if (cycle === generation.current) setError(failure instanceof Error ? failure.message : "Unable to read this vehicle check."); }
      finally { if (cycle === generation.current) setReady(true); }
    })();
    return () => { generation.current++; };
  }, [driver.id, vehicleId, refresh]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const locked = draft?.phase === "PENDING_SUBMISSION" || draft?.phase === "NEEDS_REVIEW";
  function changed() { setDirty(true); setMessage("Changes are not saved yet. Save this draft before leaving."); }
  async function save() {
    const row = await saveDriverDraft({ ...binding, fields: { items, odometer, notes, unsafeToDrive: unsafe }, photos, capturedAt: new Date().toISOString() }, draft?.revision ?? null);
    setDraft(row); setDirty(false); setMessage("Draft saved on this device. Dispatch has not received it yet."); return row;
  }
  async function run(submit: boolean) {
    if (flight.current || !vehicleId || !ready) return;
    flight.current = true; setBusy(true); setError("");
    let row: DriverDraft | null = draft;
    try {
      if (!submit) { await save(); return; }
      if (row?.phase === "NEEDS_REVIEW") throw new Error(row.reviewMessage || "Contact dispatch to review this saved check.");
      if (!row || row.phase === "EDITING") {
        if (checks.some(key => !["PASS", "DEFECT"].includes(items[key]))) throw new Error("Choose Pass or Defect for all seven checks.");
        if ((unsafe || Object.values(items).includes("DEFECT")) && !notes.trim()) throw new Error("Describe the defect before submitting.");
        if (odometer && (!/^\d+$/.test(odometer) || Number(odometer) > 10_000_000)) throw new Error("Enter a valid mileage.");
        row = await save(); row = await markDraftPending(row.id, driver.id, row.revision); setDraft(row);
      }
      if (!row) throw new Error("Unable to save the pending check.");
      if (!online) { setMessage("Saved on this device. Reconnect and select Send saved check."); return; }
      const current = await refresh();
      if (current.vehicle?.id !== row.vehicleId) throw new DriverRequestError("Dispatch changed your van. This draft needs review before sending.", 409);
      const receipt = current.checks.find(check => check.requestId === row!.requestId);
      if (receipt) { await confirmDriverDraft(row.id, driver.id, row.requestId); setDraft(null); setItems({}); setNotes(""); setPhotos([]); setMessage("Vehicle check confirmed by the server."); return; }
      for (const photo of row.photos) {
        if (photo.uploadedUrl) continue;
        const form = new FormData(); form.set("vehicleId", row.vehicleId!); form.set("requestId", photo.id); form.set("file", photo.blob, photo.name);
        const uploaded = await request<{ url: string }>("/api/driver/jobs/vehicle/photo", { method: "POST", body: form });
        row = await checkpointDraftUpload(row.id, driver.id, row.requestId, photo.id, uploaded.url); setDraft(row);
        if (!row) throw new Error("Upload checkpoint could not be saved.");
      }
      const result = await request<{ check: Check; message: string }>("/api/driver/jobs/vehicle/checks", { method: "POST", body: JSON.stringify({ ...row.fields, vehicleId: row.vehicleId, requestId: row.requestId, capturedAt: row.capturedAt, photoUrls: row.photos.map(photo => photo.uploadedUrl) }) });
      if (result.check.requestId !== row.requestId) throw new Error("Unable to confirm this exact check. Keep the saved draft and retry.");
      await confirmDriverDraft(row.id, driver.id, row.requestId); setDraft(null); setItems({}); setNotes(""); setOdometer(""); setUnsafe(false); setPhotos([]); setDirty(false); setMessage(result.message); await refresh(); await refreshSession();
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : "Unable to save this check."; setError(text);
      if (row?.phase === "PENDING_SUBMISSION" && failure instanceof DriverRequestError && [400, 403, 404, 409, 422].includes(failure.status)) setDraft(await markDraftNeedsReview(row.id, driver.id, row.requestId, text));
    } finally { flight.current = false; setBusy(false); }
  }
  async function addPhotos(files: FileList | null) { try { if (!files) return; const additions = Array.from(files).map(file => createDraftMedia(file, file.name)); if (photos.length + additions.length > 8) throw new Error("Use up to eight photos."); setPhotos([...photos, ...additions]); changed(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to add photos."); } }
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-[#071D49]">Your vehicle</h1><p className="mt-1 text-sm text-slate-600">Dispatch assigns your van. Report defects before starting work.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{message && <p role="status" className="rounded-xl bg-blue-50 p-4 text-blue-900">{message}</p>}
    {!vehicleId ? <div className="rounded-2xl bg-white p-5">No vehicle assigned. Call dispatch to arrange a van.</div> : <>
      <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">{driver.vehicle?.name}</h2><p className="text-slate-600">{driver.vehicle?.registration || "Registration not recorded"}</p>{data?.vehicle?.mileage != null && <p className="mt-2 text-sm">Recorded mileage: {data.vehicle.mileage.toLocaleString()}</p>}</section>
      {data?.unresolvedDefects.map(defect => <div key={defect.id} className={`rounded-xl p-4 ${defect.unsafeToDrive ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}><p className="font-bold">{defect.unsafeToDrive ? "Unsafe defect — do not drive this van" : "Open vehicle defect"}</p><p className="mt-1">{defect.notes}</p><p className="mt-2 text-sm">{defect.dispatchResponse || "Awaiting dispatch review"}</p></div>)}
      <section className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">Daily vehicle check</h2><p className="text-sm text-slate-600">{data?.today || "Check saved with the UK date of capture"}. Choose each result yourself. Save a draft before leaving this page.</p>
        <fieldset disabled={!ready || busy || !!locked} className="space-y-4 disabled:opacity-70">{checks.map(key => <div key={key}><label htmlFor={key} className="mb-1 block text-sm font-semibold">{label(key)}</label><select id={key} value={items[key] || ""} onChange={event => { setItems({ ...items, [key]: event.target.value }); changed(); }} className={input}><option value="">Select result</option><option value="PASS">Pass</option><option value="DEFECT">Defect</option></select></div>)}
          <label className="block text-sm font-semibold">Odometer / mileage<input value={odometer} onChange={event => { setOdometer(event.target.value); changed(); }} inputMode="numeric" className={`${input} mt-1`} /></label>
          <label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" checked={unsafe} onChange={event => { setUnsafe(event.target.checked); changed(); }} className="h-5 w-5" />This vehicle is unsafe to drive</label>
          <label className="block text-sm font-semibold">Notes / defect details<textarea value={notes} maxLength={5000} onChange={event => { setNotes(event.target.value); changed(); }} rows={4} className={`${input} mt-1`} /></label>
          <label className="block text-sm font-semibold">Photos (optional, up to eight)<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={event => { void addPhotos(event.target.files); event.target.value = ""; }} className="mt-2 block w-full text-sm" /></label>
          {photos.map(photo => <div key={photo.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><span className="truncate text-sm">{photo.name}</span><button type="button" onClick={() => { setPhotos(photos.filter(item => item.id !== photo.id)); changed(); }} className="min-h-11 px-3 text-red-700">Remove</button></div>)}
        </fieldset>
        {locked ? <p className="text-sm text-amber-900">{draft?.phase === "NEEDS_REVIEW" ? draft.reviewMessage : "Saved submission pending server confirmation. Its contents are locked for a safe retry."}</p> : <button disabled={busy || !ready} onClick={() => void run(false)} className="min-h-12 rounded-xl border px-5 py-3 font-semibold">Save draft on device</button>}
        <button disabled={busy || !ready || draft?.phase === "NEEDS_REVIEW"} onClick={() => void run(true)} className={`${button} w-full`}>{busy ? "Saving…" : locked ? "Send saved check" : "Submit vehicle check"}</button>
      </section>
      <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Recent checks</h2><button disabled={!online || busy} onClick={() => void refresh().catch(failure => setError(failure.message))} className="min-h-11 px-3 text-blue-700">Refresh</button></div><p className="text-xs text-slate-500">Most recent 20 checks. Offline records may be out of date.</p>{data?.checks.map(check => <div key={check.id} className="mt-3 border-t pt-3"><p className="text-sm font-semibold">{check.checkDate} · {check.unsafeToDrive ? "Unsafe defect" : check.hasDefect ? "Defect reported" : "Check recorded"}</p><p className="text-sm text-slate-600">{check.notes}</p>{check.dispatchResponse && <p className="mt-1 text-sm text-blue-800">Dispatch: {check.dispatchResponse}</p>}</div>)}</section>
    </>}
  </div>;
}
