"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useAdminSession } from "@/components/admin/AdminSession";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const field = "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "min-h-10 rounded-lg bg-[#E55300] px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const dateLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/London" });

type Shift = {
  id: string;
  serviceDate: string;
  hours: number;
  guaranteed: boolean;
  actualMiles: string | null;
  decision: "BILL" | "WAIVE" | null;
  review: string | null;
  booking: { id: string; reference: string; status: string; estimatedStartTime: string | null };
};
type Contract = {
  id: string;
  vehicleType: string;
  startsOn: string;
  endsOn: string;
  startsAt: string;
  tariffName: string;
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
    const requested = query.get("month") || "";
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today().slice(0, 7);
  });
  const [overview, setOverview] = useState<Overview>();
  const [creating, setCreating] = useState(false);
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
      ...Object.fromEntries(form), requestId: requestId.current,
      weeklyPattern: weekdays.map((_, index) => Number(form.get(`day${index}`))),
    });
    if (success) {
      requestId.current = "";
      setCreating(false);
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
            <label className="text-sm font-semibold">Shift start (UK time)<input className={field} name="startsAt" type="time" defaultValue="08:00" required /></label>
            <label className="text-sm font-semibold">Van type<select className={field} name="vehicleType" required>
              <option value="">Select a van</option>
              {overview.vehicleTypes.map(vehicle => <option key={vehicle}>{vehicle}</option>)}
            </select></label>
            <label className="text-sm font-semibold lg:col-span-2">Collection address<input className={field} name="collectionAddress" maxLength={1500} required /></label>
            <label className="text-sm font-semibold lg:col-span-2">Delivery address<input className={field} name="deliveryAddress" maxLength={1500} required /></label>
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
          <button className={button} disabled={busy || !overview.vehicleTypes.length}>Save contract and create shifts</button>
        </form>
      )}
      <label className="block max-w-xs text-sm font-semibold">View shift month
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
        return (
          <section key={contract.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{contract.vehicleType} · {contract.tariffName}</h2>
                <p className="text-sm text-slate-600">{dateLabel.format(new Date(contract.startsOn))} to {dateLabel.format(new Date(contract.endsOn))} · {contract.startsAt} start</p>
                <p className="mt-1 text-sm text-slate-600">
                  8 hours {money.format(Number(contract.fare8Hours))} / {contract.includedMiles8} miles ·
                  {" "}12 hours {money.format(Number(contract.fare12Hours))} / {contract.includedMiles12} miles ·
                  {" "}{money.format(Number(contract.extraMileRate))} per extra mile
                </p>
              </div>
              {invoice && <Link className="font-bold text-orange-800 underline" href={`/admin/invoices?invoice=${encodeURIComponent(invoice.invoiceNumber)}`}>
                Invoice {invoice.invoiceNumber} · {money.format(Number(invoice.total))}
              </Link>}
            </div>
            {pendingReview > 0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {pendingReview} shift(s) need billing review. Guaranteed unused shifts are included at the agreed fare until waived.
            </p>}
            {canEdit && contract.endsOn.slice(0, 10) >= today() && (
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
                const canReview = editable && shift.booking.status !== "IN_PROGRESS" &&
                  (shift.booking.status === "COMPLETED" || shift.booking.status === "CANCELLED" ||
                    Boolean(shift.booking.estimatedStartTime && new Date(shift.booking.estimatedStartTime) < new Date()));
                return (
                  <div key={shift.id} className="grid gap-3 py-3 lg:grid-cols-[1fr_1fr]">
                    <div className="text-sm">
                      <p className="font-bold">{dateLabel.format(new Date(shift.serviceDate))} · {shift.hours} hours · {shift.guaranteed ? "Guaranteed" : "Extra"}</p>
                      <p className="text-slate-600">
                        <Link className="font-semibold underline" href={`/admin/bookings?booking=${encodeURIComponent(shift.booking.id)}`}>{shift.booking.reference}</Link>
                        {" "}· {shift.booking.status.replaceAll("_", " ")}
                      </p>
                      {shift.review && <p className="text-amber-800">{shift.review}</p>}
                    </div>
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
