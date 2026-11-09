"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import PostcodeAddressLookup, { formatPostcodeAddress } from "@/components/PostcodeAddressLookup";
import { useAdminSession } from "@/components/admin/AdminSession";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const field = "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "min-h-10 rounded-lg bg-[#E55300] px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const dateLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/London" });
const timeLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayMs = 86400000;
function mondayOf(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return new Date(+date - ((date.getUTCDay() + 6) % 7) * dayMs).toISOString().slice(0, 10);
}
const shiftStart = (shift: Shift) => shift.booking.estimatedStartTime ? timeLabel.format(new Date(shift.booking.estimatedStartTime)) : "";

type Shift = {
  id: string;
  serviceDate: string;
  hours: number;
  guaranteed: boolean;
  actualMiles: string | null;
  decision: "BILL" | "WAIVE" | null;
  review: string | null;
  cancellationReason?: string | null;
  estimatedMiles?: string | null;
  booking: {
    id: string; reference: string; status: string; collectionAddress: string; deliveryAddress: string; totalPrice: string; estimatedStartTime: string | null;
    estimatedEndTime: string | null; driverId: string | null; driverJourneyStartedAt: string | null; updatedAt: string;
  };
};
type Contract = {
  id: string;
  vehicleType: string;
  startsOn: string;
  endsOn: string;
  tariffName: string;
  collectionAddress: string;
  deliveryAddress: string;
  weeklyPattern: number[];
  updatedAt: string;
  endedAt: string | null;
  weeklyMileageFrom?: string | null;
  purchaseOrder?: string | null;
  fare8Hours: string;
  fare12Hours: string;
  includedMiles8: string;
  includedMiles12: string;
  extraMileRate: string;
  shifts: Shift[];
  invoices: { invoice: { invoiceNumber: string; status: string; total: string } }[];
};
type Overview = {
  customerName: string;
  canCreate: boolean;
  tariffName?: string;
  vehicleTypes: string[];
  poRequired: boolean;
  contracts: Contract[];
};

export default function CommercialContractsPage() {
  return <Suspense fallback={<p className="p-6" role="status">Loading contracts…</p>}><CommercialContracts /></Suspense>;
}

function CommercialContracts() {
  const query = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const { admin } = useAdminSession();
  const canEdit = admin.role === "SUPER_ADMIN" || admin.role === "OFFICE_MANAGER";
  const [month, setMonth] = useState(() => {
    const requested = query.get("month") || query.get("week")?.slice(0, 7) || "";
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today().slice(0, 7);
  });
  const [overview, setOverview] = useState<Overview>();
  const [creating, setCreating] = useState(false);
  const [editingContract, setEditingContract] = useState<string | null>(null);
  const [copyingContract, setCopyingContract] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<string | null>(null);
  const [variableDelivery, setVariableDelivery] = useState(false);
  const [openRota, setOpenRota] = useState<string | null>(() => query.get("contract"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestId = useRef("");
  const endpoint = `/api/admin/commercial-contracts/${encodeURIComponent(id)}`;

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await adminFetch(`${endpoint}?month=${encodeURIComponent(month)}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load commercial contracts.");
      if (!signal?.aborted) setOverview(data);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Unable to load commercial contracts.");
    }
  }, [endpoint, month]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function save(path: string, body: object, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(endpoint + path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.code === "CONTRACT_OVERLAP" && !("allowOverlap" in body)) {
        if (!window.confirm(data.error)) return false;
        const approved = await adminFetch(endpoint + path, {
          method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, allowOverlap: true }),
        });
        const result = await approved.json();
        if (!approved.ok) throw new Error(result.error || "Unable to save this change.");
        setMessage(result.message);
        await load();
        return true;
      }
      if (!response.ok) throw new Error(data.error || "Unable to save this change.");
      setMessage(data.message);
      await load();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save this change.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    const success = await save("", {
      ...Object.fromEntries(form), requestId: requestId.current, variableDelivery,
      weeklyPattern: weekdays.map((_, index) => Number(form.get(`day${index}`))),
    });
    if (success) {
      requestId.current = "";
      setCreating(false);
      setVariableDelivery(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1350px] space-y-5 px-4 py-8 sm:px-6">
      <Link className="text-sm font-semibold text-slate-600" href={`/admin/customers/${id}`}>← Customer Account</Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Commercial Contracts</h1>
          {overview && <p className="mt-1 text-sm text-slate-600">{overview.customerName}</p>}
        </div>
        {canEdit && overview?.canCreate && (
          <button type="button" className={button} disabled={busy} onClick={() => setCreating(value => !value)}>
            {creating ? "Close form" : "New contract"}
          </button>
        )}
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {overview && !overview.canCreate && <p className="text-sm text-slate-600">An active customer account with an assigned commercial tariff is required to start a new contract.</p>}
      {creating && overview && (
        <form onSubmit={create} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">New contract · {overview.tariffName}</h2>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">Start date<input className={field} name="startsOn" type="date" min={today()} required /></label>
            <label className="text-sm font-semibold">End date<input className={field} name="endsOn" type="date" min={today()} required /></label>
            <label className="text-sm font-semibold">Van type<select className={field} name="vehicleType" required>
              <option value="">Select a van</option>
              {overview.vehicleTypes.map(vehicle => <option key={vehicle}>{vehicle}</option>)}
            </select></label>
            <div className="lg:col-span-2">
              <ContractAddressField label="Collection address" name="collectionAddress" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={variableDelivery} onChange={event => setVariableDelivery(event.target.checked)} />
                Delivery address varies by shift
              </label>
              {variableDelivery ? (
                <p className="text-sm text-slate-600">Add the delivery address in Weekly Rota before assigning a driver.</p>
              ) : (
                <ContractAddressField label="Delivery address" name="deliveryAddress" />
              )}
            </div>
            <label className="text-sm font-semibold lg:col-span-2">Purchase order<input className={field} name="purchaseOrder" maxLength={120} required={overview.poRequired} /></label>
          </fieldset>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <legend className="mb-2 text-sm font-bold">Weekly pattern · at least five days</legend>
            {weekdays.map((day, index) => (
              <label key={day} className="text-sm font-semibold">{day}
                <select className={field} name={`day${index}`} defaultValue={index < 5 ? 8 : 0}>
                  <option value={0}>No shift</option><option value={8}>8 hours</option><option value={12}>12 hours</option>
                </select>
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-slate-600">The weekly pattern repeats between the contract dates. Add the start times in Weekly Rota after saving.</p>
          <button className={button} disabled={busy || !overview.vehicleTypes.length}>Save contract and create shifts</button>
        </form>
      )}
      <label className="block max-w-xs text-sm font-semibold">Shift history and billing month
        <span className="my-1 block font-normal text-slate-600">Filters the shift list and invoice below.</span>
        <input className={field} type="month" value={month} onChange={event => {
          if (!event.target.value) return;
          setOverview(undefined);
          setError("");
          setMonth(event.target.value);
        }} />
      </label>
      {!overview && !error && <p role="status">Loading contracts…</p>}
      {overview?.contracts.length === 0 && <p>No commercial contracts for this customer.</p>}
      {overview?.contracts.map(contract => {
        const invoice = contract.invoices[0]?.invoice;
        const editable = canEdit && (!invoice || invoice.status === "DRAFT");
        const pendingReview = contract.shifts.filter(shift => shift.review).length;
        const active = !contract.endedAt && contract.endsOn.slice(0, 10) >= today();
        return (
          <section key={contract.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{contract.vehicleType} · {contract.tariffName}</h2>
                <p className="text-sm text-slate-600">{dateLabel.format(new Date(contract.startsOn))} to {dateLabel.format(new Date(contract.endsOn))}</p>
                {contract.endedAt && <p className="text-sm font-semibold text-amber-800">Ended {dateLabel.format(new Date(contract.endedAt))}</p>}
                <p className="mt-1 text-sm text-slate-600">
                  8 hours {money.format(Number(contract.fare8Hours))} / {contract.includedMiles8} miles ·
                  {" "}12 hours {money.format(Number(contract.fare12Hours))} / {contract.includedMiles12} miles ·
                  {" "}{money.format(Number(contract.extraMileRate))} per extra mile
                </p>
              </div>
              <button type="button" className={button} aria-expanded={openRota === contract.id}
                onClick={() => setOpenRota(current => current === contract.id ? null : contract.id)}>
                {openRota === contract.id ? "Close Weekly Rota" : "Weekly Rota"}
              </button>
              {canEdit && active && <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => setEditingContract(current => current === contract.id ? null : contract.id)}>
                  {editingContract === contract.id ? "Close edit" : "Edit contract"}
                </button>
                <button type="button" disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-800"
                  onClick={async () => {
                    if (!window.confirm("End this contract and remove its future unstarted shifts? Completed shifts and invoice history will be kept.")) return;
                    if (await save(`/${contract.id}`, { expectedUpdatedAt: contract.updatedAt }, "DELETE")) {
                      setEditingContract(null);
                      setOpenRota(null);
                    }
                  }}>End contract</button>
              </div>}
              {invoice && <Link className="font-bold text-orange-800 underline" href={`/admin/invoices?invoice=${encodeURIComponent(invoice.invoiceNumber)}`}>
                Invoice {invoice.invoiceNumber} · {money.format(Number(invoice.total))}
              </Link>}
            </div>
            {canEdit && overview.canCreate && <button type="button" className="text-sm font-semibold text-orange-800 underline"
              onClick={() => setCopyingContract(value => value === contract.id ? null : contract.id)}>
              {copyingContract === contract.id ? "Close renewal" : "Copy contract"}
            </button>}
            {copyingContract === contract.id && <ContractRenewal key={contract.id} contract={contract}
              endpoint={`${endpoint}/${contract.id}`} busy={busy} onCopy={async body => {
                if (await save("", body)) setCopyingContract(null);
              }} />}
            <CommercialBillingReview contract={contract} endpoint={`${endpoint}/${contract.id}`} month={month}
              canEdit={canEdit && active} refresh={overview} onSaved={load}
              onlyReview={reviewFilter === contract.id} onFilter={() => setReviewFilter(value => value === contract.id ? null : contract.id)}
              pendingShifts={pendingReview} />
            {editingContract === contract.id && active && (
              <EditContractForm key={contract.id} contract={contract} busy={busy} onSave={async body => {
                if (await save(`/${contract.id}`, body, "PATCH")) {
                  setEditingContract(null);
                  setOpenRota(null);
                }
              }} />
            )}
            {openRota === contract.id && (
              <WeeklyRota key={`${contract.id}:${query.get("shift") || ""}`} endpoint={`${endpoint}/${contract.id}`} canEdit={canEdit} onSaved={load}
                initialDate={query.get("contract") === contract.id ? query.get("week") : null}
                initialShift={query.get("contract") === contract.id ? query.get("shift") : null} />
            )}
            {pendingReview > 0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {pendingReview} shift(s) need billing review. Guaranteed unused shifts are included at the agreed fare until waived.
            </p>}
            {canEdit && active && (
              <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void save(`/${contract.id}/extra-shifts`, { serviceDate: data.get("date"), hours: Number(data.get("hours")) });
              }}>
                <label className="text-sm font-semibold">Extra shift date
                  <input name="date" type="date" className={field} min={contract.startsOn.slice(0, 10) > today() ? contract.startsOn.slice(0, 10) : today()}
                    max={contract.endsOn.slice(0, 10)} required />
                </label>
                <label className="text-sm font-semibold">Shift length
                  <select name="hours" className={field}><option value="8">8 hours</option><option value="12">12 hours</option></select>
                </label>
                <button className={button} disabled={busy}>Add extra shift</button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {contract.shifts.length === 0 && <p className="text-sm text-slate-600">No shifts in this month.</p>}
              {contract.shifts.map(shift => {
                if (reviewFilter === contract.id && !shift.review) return null;
                const weeklyShift = Boolean(contract.weeklyMileageFrom && shift.serviceDate >= contract.weeklyMileageFrom);
                const canReview = editable && shift.booking.status !== "IN_PROGRESS" &&
                  (shift.booking.status === "COMPLETED" || shift.booking.status === "CANCELLED" ||
                    Boolean(shift.booking.estimatedStartTime && new Date(shift.booking.estimatedStartTime) < new Date()));
                return (
                  <div key={shift.id} className="grid gap-3 py-3 lg:grid-cols-[1fr_1fr]">
                    <div className="text-sm">
                      <p className="font-bold">{dateLabel.format(new Date(shift.serviceDate))} · {shift.hours} hours · {shift.guaranteed ? "Guaranteed" : "Extra"}</p>
                      <p className="text-slate-600">
                        <Link className="font-semibold underline" href={`/admin/bookings?booking=${encodeURIComponent(shift.booking.id)}`}>{shift.booking.reference}</Link>
                        {" "}· {shift.booking.status.replaceAll("_", " ")} · {shiftStart(shift) || "Time to be confirmed"}
                      </p>
                      {shift.booking.deliveryAddress ? (
                        <p className="text-slate-600">{shift.booking.deliveryAddress}</p>
                      ) : ["CONFIRMED", "ASSIGNED"].includes(shift.booking.status) ? (
                        <Link className="font-semibold text-amber-800 underline" href={`?month=${month}&contract=${contract.id}&week=${shift.serviceDate.slice(0, 10)}&shift=${shift.id}`} onClick={() => setOpenRota(contract.id)}>
                          Add delivery address in Weekly Rota
                        </Link>
                      ) : null}
                      {shift.review && <p className="text-amber-800">{shift.review}</p>}
                    </div>
                    {shift.cancellationReason && <p className="text-sm text-slate-600">Cancellation reason: {shift.cancellationReason}</p>}
                    {weeklyShift && canReview && shift.booking.status !== "COMPLETED" && (
                      <form key={shift.decision ?? "pending"} className="flex flex-wrap items-end gap-2" onSubmit={event => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void save(`/${contract.id}/shifts/${shift.id}`, { decision: form.get("decision") }, "PATCH");
                      }}>
                        <label className="text-xs font-semibold">Billing decision
                          <select name="decision" className={field} defaultValue={shift.decision ?? ""} required>
                            <option value="">Select a decision</option>
                            <option value="BILL">Confirm charge</option>
                            <option value="WAIVE">Waive charge</option>
                          </select>
                        </label>
                        <button className={button} disabled={busy}>Save decision</button>
                      </form>
                    )}
                    {!weeklyShift && <>
                    {canReview ? (
                      <form key={`${shift.actualMiles}:${shift.decision}`} className="flex flex-wrap items-end gap-2" onSubmit={event => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void save(`/${contract.id}/shifts/${shift.id}`, {
                          actualMiles: data.get("miles") || null, decision: data.get("decision") || null,
                        }, "PATCH");
                      }}>
                        <label className="text-xs font-semibold">Actual miles<input name="miles" className={field} type="number" step="0.01" min="0"
                          max="999999.99" defaultValue={shift.actualMiles ?? ""} /></label>
                        <label className="text-xs font-semibold">Billing decision
                          <select name="decision" className={field} defaultValue={shift.decision ?? ""}>
                            <option value="">{shift.booking.status === "COMPLETED" ? "Bill completed shift" : "Select a decision"}</option>
                            <option value="BILL">Confirm charge</option><option value="WAIVE">Waive charge</option>
                          </select>
                        </label>
                        <button className={button} disabled={busy}>Save shift</button>
                      </form>
                    ) : <p className="text-sm text-slate-600">
                      {shift.actualMiles !== null ? `${shift.actualMiles} miles` : "Mileage not recorded"}
                      {shift.decision === "WAIVE" ? " · Waived" : shift.decision === "BILL" ? " · Charge confirmed" : ""}
                    </p>}
                    </>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function WeeklyRota({ endpoint, canEdit, onSaved, initialDate, initialShift }: {
  endpoint: string;
  canEdit: boolean;
  onSaved: () => Promise<void>;
  initialDate: string | null;
  initialShift: string | null;
}) {
  const [week, setWeek] = useState(() => mondayOf(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && Number.isFinite(Date.parse(initialDate)) ? initialDate : today()));
  function stepWeek(offset: number) {
    setWeek(new Date(Date.parse(`${week}T00:00:00Z`) + offset * 7 * dayMs).toISOString().slice(0, 10));
  }
  return (
    <section aria-label="Weekly Rota" className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className={button} onClick={() => stepWeek(-1)}>Previous week</button>
        <label className="text-sm font-semibold">Week starting Monday
          <input className={field} type="date" value={week}
            onChange={event => { if (event.target.value) setWeek(mondayOf(event.target.value)); }} />
        </label>
        <button type="button" className={button} onClick={() => stepWeek(1)}>Next week</button>
      </div>
      <RotaWeek key={week} endpoint={endpoint} week={week} canEdit={canEdit} onSaved={onSaved} initialShift={initialShift} />
    </section>
  );
}

function RotaWeek({ endpoint, week, canEdit, onSaved, initialShift }: {
  endpoint: string;
  week: string;
  canEdit: boolean;
  onSaved: () => Promise<void>;
  initialShift: string | null;
}) {
  const [editingAddress, setEditingAddress] = useState<string | null>(initialShift);
  const [rota, setRota] = useState<{ shifts: Shift[]; previous: Shift[] }>();
  const [times, setTimes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadWeek = useCallback(async (signal?: AbortSignal) => {
    const response = await adminFetch(`${endpoint}/rota?week=${encodeURIComponent(week)}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load the weekly rota.");
    if (!signal?.aborted) {
      setRota(data);
      setTimes({});
    }
  }, [endpoint, week]);
  useEffect(() => {
    const controller = new AbortController();
    void loadWeek(controller.signal).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load the rota.");
    });
    return () => controller.abort();
  }, [loadWeek]);

  const isEditable = (shift: Shift) => canEdit && shift.booking.status === "CONFIRMED" && !shift.booking.driverId && !shift.booking.driverJourneyStartedAt &&
    shift.serviceDate.slice(0, 10) >= today() &&
    (!shift.booking.estimatedStartTime || Date.parse(shift.booking.estimatedStartTime) > Date.now());
  const updates = rota?.shifts.filter(shift => isEditable(shift) && times[shift.id] !== undefined && times[shift.id] !== shiftStart(shift))
    .map(shift => ({ id: shift.id, startsAt: times[shift.id], expectedUpdatedAt: shift.booking.updatedAt })) ?? [];
  const previousTimes = new Map(rota?.previous.filter(shift => shiftStart(shift) && shift.booking.status !== "CANCELLED")
    .map(shift => [new Date(shift.serviceDate).getUTCDay(), shiftStart(shift)]));
  const copyable = rota?.shifts.filter(shift => isEditable(shift) && previousTimes.has(new Date(shift.serviceDate).getUTCDay())) ?? [];

  async function saveRota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!updates.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/rota`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, shifts: updates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the weekly rota.");
      await loadWeek();
      setMessage(data.message);
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save the rota.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelShift(shift: Shift) {
    const reason = window.prompt("Enter a short reason for cancelling this shift.")?.trim();
    if (!reason) return;
    if (reason.length > 500) { setError("Use a cancellation reason of up to 500 characters."); return; }
    const label = dateLabel.format(new Date(shift.serviceDate));
    if (!window.confirm(`Cancel the shift on ${label}? It will be flagged for monthly billing review.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`/api/bookings/admin/${encodeURIComponent(shift.booking.id)}/cancel`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to cancel this shift.");
      setRota(current => current ? { ...current, shifts: current.shifts.map(row => row.id === shift.id ?
        { ...row, decision: null, booking: { ...row.booking, status: "CANCELLED" } } : row) } : current);
      setMessage("Shift cancelled and flagged for monthly billing review.");
      try {
        await recordCancellationReason(shift, reason);
      } catch {
        setError("Shift cancelled. Use Add cancellation reason to finish recording it.");
      }
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to cancel this shift.");
    } finally {
      setBusy(false);
    }
  }

  async function recordCancellationReason(shift: Shift, reason: string) {
    const response = await adminFetch(`${endpoint}/shifts/${encodeURIComponent(shift.id)}/cancellation-reason`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save the cancellation reason.");
    await loadWeek();
    await onSaved();
  }

  async function addCancellationReason(shift: Shift) {
    const reason = window.prompt("Enter a short reason for cancelling this shift.", shift.cancellationReason || "")?.trim();
    if (!reason) return;
    setBusy(true);
    setError("");
    try { await recordCancellationReason(shift, reason); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save the cancellation reason."); }
    finally { setBusy(false); }
  }

  async function changeHours(shift: Shift, hours: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/shifts/${encodeURIComponent(shift.id)}/hours`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, expectedUpdatedAt: shift.booking.updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update shift hours.");
      await loadWeek();
      await onSaved();
      setMessage(data.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update shift hours."); }
    finally { setBusy(false); }
  }

  const editableAddress = rota?.shifts.find(shift => shift.id === editingAddress && isEditable(shift));

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editableAddress) return;
    const deliveryAddress = new FormData(event.currentTarget).get("deliveryAddress");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/shifts/${encodeURIComponent(editableAddress.id)}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryAddress, expectedUpdatedAt: editableAddress.booking.updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the delivery address.");
      await loadWeek();
      setEditingAddress(null);
      setMessage(`Delivery address saved. Estimated route ${data.distanceMiles.toFixed(1)} miles. Estimated price ${money.format(Number(data.total))} including VAT.`);
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save the delivery address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CommercialWeekMileage endpoint={endpoint} week={week} canEdit={canEdit} refresh={rota}
        shifts={rota?.shifts ?? []} onSaved={async () => { await loadWeek(); await onSaved(); }} />
      {editableAddress && (
        <form onSubmit={saveAddress} className="space-y-3 rounded-xl border border-slate-300 bg-white p-4">
          <h3 className="font-bold">Delivery address for {dateLabel.format(new Date(editableAddress.serviceDate))}</h3>
          <p className="text-sm text-slate-600">Collection from {editableAddress.booking.collectionAddress}</p>
          <ContractAddressField key={editableAddress.id} label="Delivery address" name="deliveryAddress"
            initialAddress={editableAddress.booking.deliveryAddress} disabled={busy} />
          <div className="flex gap-3">
            <button className={button} disabled={busy}>{busy ? "Saving…" : "Save address and recalculate"}</button>
            <button type="button" disabled={busy} onClick={() => setEditingAddress(null)} className="text-sm font-semibold underline">Close address editor</button>
          </div>
        </form>
      )}
    <form onSubmit={saveRota} className="space-y-3">
      <p className="text-sm text-slate-600">Enter the UK start time for each shift. Save the rota to confirm the finish times.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-800">{message}</p>}
      {!rota && !error && <p role="status">Loading weekly rota…</p>}
      {rota?.shifts.length === 0 && <p className="text-sm text-slate-600">No contract shifts this week.</p>}
      {rota?.shifts.map(shift => {
        const date = new Date(shift.serviceDate);
        const finish = shift.booking.estimatedEndTime ? new Date(shift.booking.estimatedEndTime) : null;
        const start = times[shift.id] ?? shiftStart(shift);
        return (
          <div key={shift.id} className="grid items-center gap-2 border-b border-slate-200 pb-2 sm:grid-cols-4">
            <Link className="text-sm font-semibold underline" href={`/admin/bookings?booking=${encodeURIComponent(shift.booking.id)}`}>
              {dateLabel.format(date)} · {shift.hours} hours
            </Link>
            {isEditable(shift) ? (
              <input aria-label={`Start time for ${dateLabel.format(date)}`} type="time" className={field} value={start} disabled={busy}
                onChange={event => {
                  const value = event.target.value;
                  setTimes(current => ({ ...current, [shift.id]: value }));
                }} />
            ) : <span className="text-sm">{start || "Time to be confirmed"}</span>}
            <p className="text-sm text-slate-600">
              {start !== shiftStart(shift) ? "Finish time confirmed on save" : finish ?
                `Finish ${timeLabel.format(finish)}${finish.toLocaleDateString("sv-SE", { timeZone: "Europe/London" }) !== shift.serviceDate.slice(0, 10) ? " (next day)" : ""}`
                : "Time to be confirmed"}
            </p>
            <div className="space-y-1 text-sm sm:col-span-4">
              <p>{shift.booking.deliveryAddress || "Delivery address needed"} · Estimated {money.format(Number(shift.booking.totalPrice))} incl. VAT</p>
              {shift.booking.status === "CONFIRMED" && !shift.booking.estimatedStartTime && shift.serviceDate.slice(0, 10) < today() && (
                <p className="font-semibold text-amber-900">Needs resolution · past shift has no start time</p>
              )}
              {shift.booking.status === "CONFIRMED" && !shift.booking.estimatedStartTime && shift.serviceDate.slice(0, 10) >= today() && (
                <p className="font-semibold text-amber-900">Next action · set a start time</p>
              )}
              {shift.booking.status === "CONFIRMED" && shift.booking.estimatedStartTime && shift.booking.deliveryAddress && !shift.booking.driverId && (
                <Link className="font-semibold underline" href={`/admin/bookings?booking=${encodeURIComponent(shift.booking.id)}`}>Ready for assignment · Open booking</Link>
              )}
              {shift.booking.status === "ASSIGNED" && <p className="font-semibold text-green-800">Driver assigned</p>}
              {shift.booking.status === "COMPLETED" && <p className="font-semibold text-green-800">Completed · check mileage in this week’s review</p>}
              {isEditable(shift) && <label className="mt-2 flex items-center gap-2 text-sm font-semibold">Shift hours
                <select className="rounded-lg border border-slate-300 px-2 py-1" value={shift.hours} disabled={busy || !!updates.length}
                  onChange={event => void changeHours(shift, Number(event.target.value))}>
                  <option value={8}>8 hours</option><option value={12}>12 hours</option>
                </select>
              </label>}
              {shift.booking.status === "CANCELLED" && <div className="mt-1">
                {shift.cancellationReason && <p>Cancellation reason: {shift.cancellationReason}</p>}
                {canEdit && <button type="button" disabled={busy || !!updates.length} className="font-semibold text-orange-800 underline"
                  onClick={() => void addCancellationReason(shift)}>
                  {shift.cancellationReason ? "Edit cancellation reason" : "Add cancellation reason"}
                </button>}
              </div>}
              {isEditable(shift) && <button type="button" disabled={busy || !!updates.length} className="font-semibold text-orange-800 underline"
                onClick={() => { setEditingAddress(shift.id); setError(""); setMessage(""); }}>
                {shift.booking.deliveryAddress ? "Edit delivery address" : "Add delivery address"}
              </button>}
            </div>
            {shift.booking.status === "CANCELLED" ? (
              <span className="text-sm font-semibold text-amber-800">Cancelled · {shift.decision === "WAIVE" ? "Waived" : shift.decision === "BILL" ? "Charge confirmed" : "Billing review"}</span>
            ) : canEdit && !shift.booking.driverJourneyStartedAt && ["CONFIRMED", "ASSIGNED"].includes(shift.booking.status) ? (
              <button type="button" disabled={busy} onClick={() => void cancelShift(shift)}
                className="justify-self-start rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">
                Cancel shift
              </button>
            ) : null}
          </div>
        );
      })}
      {canEdit && !!rota?.shifts.length && <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={busy || !copyable.length} onClick={() => setTimes(current => ({
            ...current, ...Object.fromEntries(copyable.map(shift => [shift.id, previousTimes.get(new Date(shift.serviceDate).getUTCDay())!])),
          }))}>Copy previous week</button>
        <button className={button} disabled={busy || !updates.length}>{busy ? "Saving…" : "Save rota"}</button>
      </div>}
    </form>
    </>
  );
}

function ContractAddressField({ label, name, initialAddress = "", disabled = false }: {
  label: string; name: string; initialAddress?: string; disabled?: boolean;
}) {
  const [address, setAddress] = useState(initialAddress);
  return (
    <div className="space-y-2">
      <PostcodeAddressLookup label={`Find ${label.toLowerCase()} by postcode`} accent="orange" disabled={disabled}
        onSelect={selected => setAddress(formatPostcodeAddress(selected))} />
      <label className="block text-sm font-semibold">{label}
        <input className={field} name={name} value={address} onChange={event => setAddress(event.target.value)}
          required maxLength={1500} disabled={disabled} />
      </label>
    </div>
  );
}

function EditContractForm({ contract, busy, onSave }: {
  contract: Contract;
  busy: boolean;
  onSave: (body: object) => Promise<void>;
}) {
  const [variableDelivery, setVariableDelivery] = useState(!contract.deliveryAddress);
  return (
    <form className="space-y-4 rounded-xl border border-slate-300 p-4" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void onSave({ ...Object.fromEntries(form), variableDelivery, expectedUpdatedAt: contract.updatedAt,
        weeklyPattern: weekdays.map((_, index) => Number(form.get(`day${index}`))) });
    }}>
      <h3 className="font-bold">Edit contract</h3>
      <p className="text-sm text-slate-600">Changes apply to future unassigned shifts without a van reservation. Existing shift-specific delivery addresses are kept.</p>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">End date
          <input type="date" className={field} name="endsOn" min={today()} defaultValue={contract.endsOn.slice(0, 10)} required />
        </label>
        <ContractAddressField label="Collection address" name="collectionAddress" initialAddress={contract.collectionAddress} disabled={busy} />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={variableDelivery} onChange={event => setVariableDelivery(event.target.checked)} />
            Delivery address varies by shift
          </label>
          {!variableDelivery && <ContractAddressField label="Default delivery address" name="deliveryAddress" initialAddress={contract.deliveryAddress} disabled={busy} />}
        </div>
      </fieldset>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <legend className="mb-2 text-sm font-bold">Weekly pattern</legend>
        {weekdays.map((day, index) => (
          <label key={day} className="text-sm font-semibold">{day}
            <select className={field} name={`day${index}`} defaultValue={contract.weeklyPattern[index]}>
              <option value={0}>No shift</option><option value={8}>8 hours</option><option value={12}>12 hours</option>
            </select>
          </label>
        ))}
      </fieldset>
      <button className={button} disabled={busy}>Save contract changes</button>
    </form>
  );
}

type WeekReview = {
  weekStart: string;
  weekEnd: string;
  month: string;
  closed: boolean;
  due: boolean;
  locked: boolean;
  issues: { reference: string; date: string; reason: string }[];
  estimatedMiles: string | null;
  includedMiles: string;
  actualMiles: string | null;
  excessMiles: string | null;
  netCharge: string | null;
  updatedAt: string | null;
};
type WeeklyReviewResponse = { weeks: WeekReview[]; suggestedStart: string };
function useCommercialReview(endpoint: string, refresh?: unknown) {
  const [review, setReview] = useState<WeeklyReviewResponse>();
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await adminFetch(`${endpoint}/weekly-review`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load weekly review.");
      if (!signal?.aborted) {
        setReview(data);
        setError("");
      }
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Unable to load weekly review.");
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);

  return { review, error, load };
}

function CommercialBillingReview({ contract, endpoint, month, canEdit, refresh, onSaved, onlyReview, onFilter, pendingShifts }: {
  contract: Contract; endpoint: string; month: string; canEdit: boolean; refresh: Overview; onSaved: () => Promise<void>;
  onlyReview: boolean; onFilter: () => void; pendingShifts: number;
}) {
  const { review, error } = useCommercialReview(endpoint, refresh);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [enableDate, setEnableDate] = useState("");
  const weeks = review?.weeks.filter(week => week.month === month) ?? [];
  const due = review?.weeks.filter(week => week.due) ?? [];
  const draft = contract.invoices[0]?.invoice;
  const monthClosed = month < today().slice(0, 7);
  const status = draft ? draft.status === "DRAFT" ? (pendingShifts || weeks.some(week => week.due) ? "Needs review" : "Draft ready") : draft.status.replaceAll("_", " ")
    : monthClosed && (contract.shifts.length > 0 || weeks.length > 0) ? "Draft missing" : "Draft not due";
  const weekLink = (week: WeekReview) => `?month=${week.month}&contract=${encodeURIComponent(contract.id)}&week=${week.weekStart}`;
  async function enableMileage() {
    if (!review) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/weekly-review/enable`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: enableDate || review.suggestedStart }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to enable weekly mileage.");
      setMessage("Weekly mileage enabled.");
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to enable weekly mileage."); }
    finally { setBusy(false); }
  }
  return (
    <section aria-label="Monthly Billing Review" className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold">Monthly Billing Review</h3>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{status}</span>
        {due.length > 0 && <a className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950 underline"
          href={weekLink(due[0])}>Weekly review due · {due.length}</a>}
        <button type="button" onClick={onFilter} aria-pressed={onlyReview} className="text-sm font-semibold underline">
          {onlyReview ? "Show all shifts" : "Needs billing review"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {!contract.weeklyMileageFrom && review && canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Start weekly mileage
            <select className="ml-2 rounded-lg border border-slate-300 p-2" value={enableDate || review.suggestedStart}
              disabled={busy} onChange={event => setEnableDate(event.target.value)}>
              {[0, 7].map(days => {
                const date = new Date(Date.parse(`${review.suggestedStart}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
                return <option key={date} value={date}>{date}</option>;
              })}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void enableMileage()} className={button}>Enable weekly mileage</button>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      {weeks.length > 0 && <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>{["Week ending", "Estimated", "Included", "Actual", "Excess", "Charge ex VAT", "Review"].map(label =>
            <th className="whitespace-nowrap p-2" key={label}>{label}</th>)}</tr></thead>
          <tbody>{weeks.map(week => <tr key={week.weekStart} className="border-t border-slate-200">
            <th className="whitespace-nowrap p-2">{week.weekEnd}</th>
            <td className="p-2">{week.estimatedMiles ?? "—"}</td>
            <td className="p-2">{week.includedMiles}</td>
            <td className="p-2">{week.actualMiles ?? "—"}</td>
            <td className="p-2">{week.excessMiles ?? "—"}</td>
            <td className="p-2">{week.netCharge === null ? "—" : money.format(Number(week.netCharge))}</td>
            <td className="p-2"><a className="font-semibold underline" href={weekLink(week)}>{week.due ? "Review week" : "Open week"}</a></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {contract.weeklyMileageFrom && <p className="text-sm text-slate-600">Weekly mileage goes on the invoice for the month the week ends in. Shift fares stay with their service dates.</p>}
      {onlyReview && !pendingShifts && <p className="text-sm text-slate-600">No shifts in this month need a billing decision.</p>}
    </section>
  );
}

function CommercialWeekMileage({ endpoint, week, canEdit, refresh, shifts, onSaved }: {
  endpoint: string; week: string; canEdit: boolean; refresh: unknown; shifts: Shift[]; onSaved: () => Promise<void>;
}) {
  const { review, error, load } = useCommercialReview(endpoint, refresh);
  const row = review?.weeks.find(item => item.weekStart === week);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveMileage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row) return;
    const actualMiles = new FormData(event.currentTarget).get("actualMiles");
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/weekly-review`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, actualMiles, expectedUpdatedAt: row.updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save mileage.");
      setMessage(data.message);
      await load();
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save mileage."); }
    finally { setBusy(false); }
  }

  async function saveDecision(shift: Shift, decision: FormDataEntryValue | null) {
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch(`${endpoint}/shifts/${encodeURIComponent(shift.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the billing decision.");
      await load();
      await onSaved();
      setMessage("Billing decision saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save the billing decision."); }
    finally { setBusy(false); }
  }

  if (!row && !error) return null;
  return <section className="space-y-2 rounded-xl border border-slate-300 bg-white p-3">
    <h3 className="font-bold">Weekly mileage</h3>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {row && <>
      <p className="text-sm">{row.includedMiles} included miles · {row.actualMiles ?? "—"} actual · {row.excessMiles ?? "—"} excess</p>
      <p className="text-sm">Estimated route miles {row.estimatedMiles ?? "—"} · Extra mileage charge {row.netCharge === null ? "—" : money.format(Number(row.netCharge))} ex VAT</p>
      {row.closed && canEdit && !row.locked && <form onSubmit={saveMileage} className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Actual miles for the week
          <input className={field} name="actualMiles" type="number" min="0" max="999999.99" step="0.01"
            key={row.updatedAt ?? "new"} defaultValue={row.actualMiles ?? ""} required disabled={busy} />
        </label>
        <button className={button} disabled={busy}>Save weekly mileage</button>
      </form>}
      {!row.closed && <p className="text-sm text-slate-600">Enter actual miles when this week ends.</p>}
      {row.locked && <p className="text-sm text-slate-600">This week’s invoice is finalised.</p>}
      {row.closed && row.issues.length > 0 && <ul className="list-disc space-y-2 pl-5 text-sm">
        {row.issues.map(issue => {
          const shift = shifts.find(item => item.booking.reference === issue.reference);
          return <li key={issue.reference}>
            {issue.reference} · {issue.reason}
            {shift?.cancellationReason && <p className="text-slate-600">{shift.cancellationReason}</p>}
            {canEdit && !row.locked && shift && !["IN_PROGRESS", "COMPLETED"].includes(shift.booking.status) &&
              <form className="flex flex-wrap items-end gap-2 pt-1" onSubmit={event => {
                event.preventDefault();
                void saveDecision(shift, new FormData(event.currentTarget).get("decision"));
              }}>
                <label className="text-xs font-semibold">Billing decision
                  <select name="decision" className={field} defaultValue={shift.decision ?? ""} required disabled={busy}>
                    <option value="">Select a decision</option><option value="BILL">Confirm charge</option><option value="WAIVE">Waive charge</option>
                  </select>
                </label>
                <button className={button} disabled={busy}>Save decision</button>
              </form>}
          </li>;
        })}
      </ul>}
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}

type RenewalRate = { fare8Hours: string; fare12Hours: string; includedMiles8: string; includedMiles12: string; extraMileRate: string };
function ContractRenewal({ contract, endpoint, busy, onCopy }: {
  contract: Contract; endpoint: string; busy: boolean; onCopy: (body: object) => Promise<void>;
}) {
  const [preview, setPreview] = useState<{ tariff: string; rate: RenewalRate; rateKey: string }>();
  const [error, setError] = useState("");
  const request = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    void adminFetch(`${endpoint}/renewal`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to preview renewal rates.");
      if (!controller.signal.aborted) setPreview(data);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to preview renewal rates.");
    });
    return () => controller.abort();
  }, [endpoint]);
  const nextDate = new Date(Date.parse(contract.endsOn) + dayMs).toISOString().slice(0, 10);
  const suggestedStart = nextDate > today() ? nextDate : today();
  return <form className="space-y-3 rounded-xl border border-slate-300 p-4" onSubmit={event => {
    event.preventDefault();
    if (!preview) return;
    const form = new FormData(event.currentTarget);
    request.current ||= crypto.randomUUID();
    void onCopy({
      ...Object.fromEntries(form), requestId: request.current, renewalRate: preview.rateKey, vehicleType: contract.vehicleType,
      collectionAddress: contract.collectionAddress, deliveryAddress: contract.deliveryAddress,
      variableDelivery: !contract.deliveryAddress, weeklyPattern: contract.weeklyPattern,
    });
  }}>
    <h3 className="font-bold">Copy contract</h3>
    <p className="text-sm">Copies the van, weekly pattern and default addresses into a new contract.</p>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {preview && <p className="text-sm"><strong>{preview.tariff}</strong> · 8h {money.format(Number(preview.rate.fare8Hours))} / {preview.rate.includedMiles8} mi · 12h {money.format(Number(preview.rate.fare12Hours))} / {preview.rate.includedMiles12} mi · {money.format(Number(preview.rate.extraMileRate))} per excess mile</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">New start date<input className={field} name="startsOn" type="date" min={today()} defaultValue={suggestedStart} required /></label>
      <label className="text-sm font-semibold">New end date<input className={field} name="endsOn" type="date" min={today()} required /></label>
      <label className="text-sm font-semibold">Purchase order<input className={field} name="purchaseOrder" maxLength={120} defaultValue={contract.purchaseOrder ?? ""} /></label>
    </div>
    <button className={button} disabled={busy || !preview}>Create renewal at these rates</button>
  </form>;
}
