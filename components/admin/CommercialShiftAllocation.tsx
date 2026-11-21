"use client";

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Shift = {
  driverId?: string; driverName: string; routeReference: string; vehicleId?: string; registration: string;
  vehicleType: string; hours: number; startDate: string; startTime: string;
  finishDate?: string; finishTime?: string; odoStart?: number; odoFinish?: number;
};
type ShiftRow = { id: string; reference: string; status: string; commercialAllocation: Shift };
type Invoice = {
  id: string; invoiceNumber: string; bookingId: string | null; invoiceType: string; status: string; total: string;
  commercialPeriod: string; supplyDate?: string; commercialGroupId: string | null; commercialEmailStage: string | null;
  adjustments: { id: string; name: string; netAmount: string }[];
  lines: { id: string; description: string; quantity: string; grossAmount: string }[];
};
type Charge = { id: string; name: string; calculation: string; amount: string; type: string };
type Overview = {
  tariff: { name: string; rates: { vehicleType: string }[] } | null;
  shifts: ShiftRow[]; invoices: Invoice[]; charges: Charge[];
  discounts: { id: string; name: string }[]; routeReferences: string[];
};
type Option = { id: string; label: string; vehicleType?: string };
type Mode = "allocate" | "shift" | "invoices";

const input = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const buttonBase = "inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50";
const button = buttonBase + " border-slate-300 bg-white text-slate-900 hover:border-orange-600";
const primary = buttonBase + " border-orange-700 bg-orange-700 text-white hover:bg-orange-800";
const times = Array.from({ length: 96 }, (_, index) =>
  `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
const money = (value: string | number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));
const dateLabel = (day: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(day));
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", dateStyle: "short" }).format(new Date());
const emptyShift = (): Shift => ({ driverName: "", routeReference: "", registration: "", vehicleType: "", hours: 0, startDate: "", startTime: "" });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await adminFetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to manage commercial shifts.");
  return data as T;
}
const json = (body: unknown): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

async function downloadPdf(endpoint: string, id: string) {
  const response = await adminFetch(`${endpoint}/invoices/${encodeURIComponent(id)}/pdf`);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Unable to download the invoice.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = /filename="?([^";]+)/i.exec(response.headers.get("content-disposition") || "")?.[1] || "Shift-invoice.pdf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold">{label}<span className="mt-1 block">{children}</span></label>;
}

function TimeSelect({ name, value, onChange, required }: {
  name?: string; value?: string; onChange?: (value: string) => void; required?: boolean;
}) {
  return <select className={input} name={name} defaultValue={value} required={required} onChange={event => onChange?.(event.target.value)}>
    <option value="">N/A</option>{times.map(time => <option key={time}>{time}</option>)}
  </select>;
}

function Lookup({ endpoint, kind, label, value, onChange }: {
  endpoint: string; kind: "driver" | "vehicle"; label: string; value: string; onChange: (value: string, row?: Option) => void;
}) {
  const listId = useId();
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const exact = options.filter(row => row.label.toLowerCase().replaceAll(" ", "") === value.toLowerCase().replaceAll(" ", ""));
  const detected = kind === "vehicle" && exact.length === 1 ? exact[0] : undefined;
  useEffect(() => {
    if (detected && value.length >= 3) onChange(value, detected);
  }, [value, detected, onChange]);
  useEffect(() => {
    if (value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void request<{ options: Option[] }>(`${endpoint}/lookup?kind=${kind}&q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) { setOptions(result.options); setError(""); } })
        .catch(() => { if (!controller.signal.aborted) setError("Search unavailable. You can enter the value manually."); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [value, endpoint, kind]);
  return <Field label={label}>
    <input className={input} value={value} list={listId} placeholder="N/A" maxLength={kind === "vehicle" ? 30 : 120}
      onChange={event => {
        const text = event.target.value;
        const matches = options.filter(row => row.label === text);
        onChange(text === "N/A" ? "" : text, matches.length === 1 ? matches[0] : undefined);
      }} />
    <datalist id={listId}><option value="N/A" />{value.trim().length >= 3 && options.map(row => <option key={row.id} value={row.label} />)}</datalist>
    {error && value.trim().length >= 3 && <span className="text-xs text-red-700">{error}</span>}
  </Field>;
}

export default function CommercialShiftAllocation({ customerId, bookingId, mode, canWrite = true, onCancelled }: {
  customerId: string; bookingId?: string; mode: Mode; canWrite?: boolean; onCancelled?: () => void | Promise<void>;
}) {
  const endpoint = `/api/admin/commercial-allocations/${encodeURIComponent(customerId)}`;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyShift);
  const [requestId, setRequestId] = useState("");
  const [selectedId, setSelectedId] = useState(bookingId || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const routeList = useId();
  const shift = overview?.shifts.find(row => row.id === selectedId);

  useEffect(() => {
    const controller = new AbortController();
    void request<Overview>(endpoint, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setOverview(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [endpoint]);

  async function refresh() { setOverview(await request<Overview>(endpoint)); }
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save the commercial change."); }
    finally { setBusy(false); }
  }
  function newShift() {
    setForm(emptyShift()); setRequestId(crypto.randomUUID()); setSelectedId(""); setShowForm(true);
  }
  function update<K extends keyof Shift>(key: K, value: Shift[K]) { setForm(current => ({ ...current, [key]: value })); }
  const changeVehicle = useCallback((registration: string, vehicle?: Option) => {
    setForm(current => ({ ...current, registration, vehicleId: vehicle?.id,
      vehicleType: vehicle?.vehicleType || (current.vehicleId ? "" : current.vehicleType) }));
  }, []);
  async function applyShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const saved = await request<{ id: string; reference: string }>(endpoint + "/shifts", json({ ...form, requestId }));
      setSelectedId(saved.id); setShowForm(false); await refresh();
      setMessage(`Shift ${saved.reference} added to Existing Bookings.`);
    });
  }
  async function completeShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      const saved = await request<{ id: string }>(`${endpoint}/shifts/${selectedId}/invoice`, json(values));
      await refresh();
      setMessage("Pending shift invoice saved.");
      await downloadPdf(endpoint, saved.id);
    });
  }
  const shiftInvoice = overview?.invoices.find(row => row.bookingId === selectedId);

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-xl font-bold text-[#071D49]">{mode === "invoices" ? "Weekly Invoices" : "Shift Allocation + Invoices"}</h2>
    {overview?.tariff && <p className="text-sm text-slate-600">{overview.tariff.name}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {!overview && !error && <p role="status">Loading commercial details…</p>}
    {overview && mode === "allocate" && !showForm && !shift && canWrite && overview.tariff &&
      <button type="button" className={primary} onClick={newShift}>Add Shift</button>}
    {overview && showForm && <form onSubmit={applyShift} className="space-y-4">
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Lookup endpoint={endpoint} kind="driver" label="Driver Allocated" value={form.driverName}
          onChange={(driverName, driver) => setForm(current => ({ ...current, driverName, driverId: driver?.id }))} />
        <Field label="Route / Ref No">
          <input className={input} list={routeList} value={form.routeReference} placeholder="N/A" maxLength={120}
            onChange={event => update("routeReference", event.target.value === "N/A" ? "" : event.target.value)} />
          <datalist id={routeList}><option value="N/A" />{overview.routeReferences.map(value => <option key={value} value={value} />)}</datalist>
        </Field>
        <Lookup endpoint={endpoint} kind="vehicle" label="Vehicle Reg" value={form.registration} onChange={changeVehicle} />
        <Field label="Vehicle Category"><select className={input} value={form.vehicleType} required disabled={Boolean(form.vehicleId)}
          onChange={event => update("vehicleType", event.target.value)}>
          <option value="">N/A</option>{[...new Set([...(overview.tariff?.rates || []).map(rate => rate.vehicleType), ...(form.vehicleType ? [form.vehicleType] : [])])]
            .map(type => <option key={type}>{type}</option>)}
        </select></Field>
        <Field label="8 / 12 Hour Shift"><select className={input} value={form.hours || ""} required onChange={event => update("hours", Number(event.target.value))}>
          <option value="">N/A</option><option value={8}>8 Hour</option><option value={12}>12 Hour</option>
        </select></Field>
        <Field label="Start Date"><input className={input} type="date" required value={form.startDate} onChange={event => update("startDate", event.target.value)} /></Field>
        <Field label="Start Time"><TimeSelect required value={form.startTime} onChange={value => update("startTime", value)} /></Field>
      </fieldset>
      <button className={primary} disabled={busy}>APPLY SHIFT</button>
    </form>}
    {overview && shift && mode !== "invoices" && <>
      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries({ "Driver Allocated": shift.commercialAllocation.driverName, "Route / Ref No": shift.commercialAllocation.routeReference,
          "Vehicle Reg": shift.commercialAllocation.registration, "Vehicle Category": shift.commercialAllocation.vehicleType,
          "8 / 12 Hour Shift": `${shift.commercialAllocation.hours} Hour` })
          .map(([label, value]) => <div key={label}><p className="text-sm font-semibold">{label}</p><p>{value || "N/A"}</p></div>)}
      </div>
      {!shiftInvoice && canWrite && <>
        {shift.status !== "COMPLETED" && <button className={button} disabled={busy} onClick={() => {
          if (!window.confirm(`Cancel commercial shift ${shift.reference}?`)) return;
          void run(async () => {
            await request(`${endpoint}/shifts/${shift.id}/cancel`, json({}));
            setSelectedId(""); await refresh(); await onCancelled?.();
            setMessage("Shift cancelled.");
          });
        }}>CANCEL SHIFT</button>}
        <CompletionForm key={shift.id} endpoint={endpoint} shift={shift} overview={overview} busy={busy} onSubmit={completeShift} />
      </>}
      {shiftInvoice && <button type="button" className={button} disabled={busy}
        onClick={() => void run(() => downloadPdf(endpoint, shiftInvoice.id))}>Download Shift Invoice</button>}
      {mode === "allocate" && canWrite && overview.tariff && <button type="button" className={button} disabled={busy} onClick={newShift}>Add Shift</button>}
    </>}
    {overview && mode === "shift" && !shift && <p>This shift is no longer on the bookings grid.</p>}
    {overview && mode === "invoices" && <CommercialInvoiceGroups overview={overview} endpoint={endpoint}
      canWrite={canWrite} busy={busy} run={run} refresh={refresh} />}
  </section>;
}

function CompletionForm({ endpoint, shift, overview, busy, onSubmit }: {
  endpoint: string; shift: ShiftRow; overview: Overview; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const details = shift.commercialAllocation;
  const [values, setValues] = useState<Record<string, FormDataEntryValue>>({});
  const [additions, setAdditions] = useState<{ id: string; quantity: number }[]>([]);
  const [discountId, setDiscountId] = useState("");
  const [discountChoice, setDiscountChoice] = useState("");
  const [preview, setPreview] = useState<{ description: string; quantity: string; unitPrice: string; grossAmount: string }[]>([]);
  const [previewError, setPreviewError] = useState("");
  const complete = ["finishDate", "finishTime", "odoStart", "odoFinish"].every(key => Boolean(values[key]));
  useEffect(() => {
    if (!complete) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void request<{ lines: typeof preview }>(`${endpoint}/shifts/${shift.id}/preview`, {
        ...json({ ...values, additions, discountId: discountId || discountChoice }), signal: controller.signal,
      })
        .then(result => { if (!controller.signal.aborted) setPreview(result.lines); })
        .catch(error => { if (!controller.signal.aborted) setPreviewError(error.message); });
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [values, complete, endpoint, shift.id, additions, discountId, discountChoice]);
  const note = (name: string) => {
    const rows = complete ? preview.filter(row => row.description.startsWith(name)) : [];
    return rows.length > 0 ? rows.map(row => `${row.quantity} × ${money(row.unitPrice)}`).join(", ") : "—";
  };
  return <form onSubmit={onSubmit} onChange={event => {
    setPreview([]);
    setPreviewError("");
    setValues(Object.fromEntries(new FormData(event.currentTarget)));
  }} className="space-y-4">
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Field label="Start Date"><input className={input} type="date" value={details.startDate} readOnly /></Field>
      <Field label="Start Time"><input className={input} value={details.startTime} readOnly /></Field>
      <Field label="Odo Start"><input className={input} name="odoStart" type="number" min="0" step="0.01" required /></Field>
      <Field label="Finish Date"><input className={input} name="finishDate" type="date" min={details.startDate} required /></Field>
      <Field label="Odo Finish"><input className={input} name="odoFinish" type="number" min="0" step="0.01" required /></Field>
      <Field label="Finish Time"><TimeSelect name="finishTime" required /></Field>
    </fieldset>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Exceeded Mileage Charge"><output>{note("Exceeded mileage")}</output></Field>
      <Field label="Waiting Charge P/H"><select className={input} name="waitingId"><option value="">N/A</option>
        {overview.charges.filter(charge => charge.calculation === "PER_HOUR" && (charge.type === "WAITING" || /waiting/i.test(charge.name)))
          .map(charge => <option key={charge.id} value={charge.id}>{charge.name} · {money(charge.amount)}</option>)}
      </select><input aria-label="Waiting hours" className={input + " mt-2"} name="waitingHours" type="number" min="0.25" max="48" step="0.25" defaultValue="1" required /></Field>
      <Field label="Overtime per 15 minutes"><output>{note("Overtime")}</output></Field>
      <Field label="Night hours between 22:00 hrs- 06:00 hrs"><output>
        {(complete ? preview : []).filter(line => line.description.startsWith("Night premium"))
          .map(line => `${line.description} · ${money(line.unitPrice)} excluding VAT`).join(", ") || "—"}
      </output></Field>
      <Field label="Weekend % / Charge"><output>{(complete ? preview : []).filter(line => /^(Saturday|Sunday|Bank holiday) start/.test(line.description))
        .map(line => `${line.description} · ${money(line.grossAmount)}`).join(", ") || "—"}</output></Field>
      <Field label="Loading Charge"><select className={input} name="loadingId"><option value="">N/A</option>
        {overview.charges.filter(charge => /\bloading\b/i.test(charge.name)).map(charge => <option key={charge.id} value={charge.id}>{charge.name} · {money(charge.amount)}</option>)}
      </select></Field>
    </fieldset>
    <fieldset disabled={busy} className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <legend className="px-2 text-sm font-bold">Additional Charges / Miscellaneous</legend>
      <input type="hidden" name="additions" value={JSON.stringify(additions)} />
      <input type="hidden" name="discountId" value={discountId || discountChoice} />
      <div className="grid items-end gap-2 sm:grid-cols-[1fr_7rem_auto]">
        <Field label="Additional charge"><select className={input} name="additionalId"><option value="">N/A</option>
          {overview.charges.map(charge => <option key={charge.id} value={charge.id}>{charge.name}</option>)}
        </select></Field>
        <Field label="Quantity"><input className={input} name="additionalQuantity" type="number" min="0.01" max="10000" step="0.01" defaultValue="1" required /></Field>
        <button type="button" className={button} disabled={!values.additionalId || additions.length >= 30} onClick={event => {
          const form = event.currentTarget.form;
          if (!form) return;
          const select = form.elements.namedItem("additionalId") as HTMLSelectElement;
          const quantity = form.elements.namedItem("additionalQuantity") as HTMLInputElement;
          if (!select.value || !quantity.reportValidity()) return;
          const added = { id: select.value, quantity: quantity.valueAsNumber };
          setAdditions(current => [...current, added]);
          select.value = ""; quantity.value = "1";
          setValues(Object.fromEntries(new FormData(form)));
        }}>Add Charge</button>
      </div>
      <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
        <Field label="Discount"><select className={input} value={discountChoice} onChange={event => setDiscountChoice(event.target.value)}>
          <option value="">N/A</option>{overview.discounts.map(discount => <option key={discount.id} value={discount.id}>{discount.name}</option>)}
        </select></Field>
        <button type="button" className={button} disabled={!discountChoice} onClick={() => {
          setDiscountId(discountChoice); setDiscountChoice("");
        }}>Apply Discount</button>
      </div>
      {additions.map((charge, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span>{overview.charges.find(row => row.id === charge.id)?.name} × {charge.quantity}</span>
        <button type="button" className={button} onClick={() => setAdditions(current => current.filter((_, i) => i !== index))}>Remove</button>
      </div>)}
      {discountId && <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span>{overview.discounts.find(row => row.id === discountId)?.name}</span>
        <button type="button" className={button} onClick={() => setDiscountId("")}>Remove discount</button>
      </div>}
    </fieldset>
    {complete && previewError && <p role="status" className="text-sm text-red-700">{previewError}</p>}
    <button className={primary} disabled={busy}>Generate PDF Shift Invoice</button>
  </form>;
}

function CommercialInvoiceGroups({ overview, endpoint, canWrite, busy, run, refresh }: {
  overview: Overview; endpoint: string; canWrite: boolean; busy: boolean;
  run: (operation: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>;
}) {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [selectedId, setSelectedId] = useState("");
  const pending = overview.invoices.filter(row => row.status === "DRAFT");
  const weeks = [...new Set(pending.filter(row => row.commercialPeriod.length === 10).map(row => row.commercialPeriod))].sort().reverse();
  const optional = pending.filter(row => row.invoiceType === "SINGLE" && !row.commercialGroupId);
  const issued = overview.invoices.filter(row => row.status === "ISSUED");
  const paid = overview.invoices.filter(row => row.status === "PAID");
  const invoice = overview.invoices.find(row => row.id === selectedId);
  const group = overview.invoices.find(row => row.id === invoice?.commercialGroupId);
  const groupMembers = overview.invoices.filter(row => row.commercialGroupId === invoice?.id);
  const status = (row: Invoice) => row.status === "PAID" ? "PAID" : row.status === "DRAFT" ? "PENDING" : "UNPAID/DUE";
  const rowButton = (row: Invoice) => <button key={row.id} type="button" className={button + " justify-between gap-3"} aria-pressed={row.id === selectedId}
    onClick={() => setSelectedId(row.id)}><span>{row.invoiceType === "CONSOLIDATED" ? "Consolidated invoice" : "Shift invoice"} {row.invoiceNumber}</span><span>{money(row.total)} · {status(row)}</span></button>;
  function consolidate(period: string) {
    return run(async () => {
      const result = await request<{ id: string }>(endpoint + "/consolidate", json({ period }));
      await refresh(); setSelectedId(result.id);
    });
  }
  function action(name: string, body: object = {}) {
    return run(async () => {
      try { await request(`${endpoint}/invoices/${selectedId}/${name}`, json(body)); }
      finally { await refresh(); }
    });
  }
  return <div className="space-y-4">
    {weeks.map(week => <section key={week} className="space-y-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Invoices Week Ending {dateLabel(week)}</h3>
        {canWrite && <button className={button} disabled={busy || !optional.some(row => row.commercialPeriod === week)}
          onClick={() => void consolidate(week)}>CONSOLIDATE TO ONE WEEKLY INVOICE</button>}
      </div>
      <div className="grid gap-2">{pending.filter(row => row.commercialPeriod === week).map(rowButton)}</div>
    </section>)}
    {canWrite && <div className="flex flex-wrap items-end gap-3">
      <Field label="Invoice month"><input className={input} type="month" value={month} onChange={event => setMonth(event.target.value)} /></Field>
      <button className={button} disabled={busy || !optional.some(row => row.supplyDate?.startsWith(month))}
        onClick={() => void consolidate(month)}>CONSOLIDATE INTO ONE MONTHLY INVOICE</button>
    </div>}
    <div className="grid gap-2">{pending.filter(row => row.commercialPeriod.length === 7).map(rowButton)}</div>
    <details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Finalised + Issued ({issued.length})</summary>
      <div className="mt-3 grid gap-2">{issued.map(rowButton)}</div></details>
    <details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Paid Invoices ({paid.length})</summary>
      <div className="mt-3 grid gap-2">{paid.map(rowButton)}</div></details>
    {invoice && <article className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <h3 className="font-bold">Invoice {invoice.invoiceNumber} · {status(invoice)}</h3>
      {group && <p>Included in <button className="font-semibold underline" onClick={() => setSelectedId(group.id)}>consolidated invoice {group.invoiceNumber}</button>.</p>}
      {groupMembers.length > 0 && <div className="grid gap-2">{groupMembers.map(rowButton)}</div>}
      <dl className="space-y-2">{invoice.lines.map(line => <div key={line.id} className="flex justify-between gap-3">
        <dt>{line.description}{Number(line.quantity) !== 1 ? ` × ${line.quantity}` : ""}</dt><dd>{money(line.grossAmount)}</dd>
      </div>)}<div className="flex justify-between border-t pt-2 font-bold"><dt>Total</dt><dd>{money(invoice.total)}</dd></div></dl>
      {invoice.status === "DRAFT" && (!group || group.status === "DRAFT") && canWrite && invoice.invoiceType === "SINGLE" && <InvoiceAdjustments key={invoice.id}
        invoice={invoice} overview={overview} busy={busy} run={run} refresh={refresh} />}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void run(() => downloadPdf(endpoint, invoice.id))}>Download PDF</button>
        {canWrite && !group && invoice.status === "DRAFT" && <button className={primary} disabled={busy} onClick={() => void action("finalise-send")}>Finalise + Send</button>}
        {canWrite && !group && invoice.status === "ISSUED" &&
          <button className={button} disabled={busy} onClick={() => void action("unfinalise")}>UNFINALISE</button>}
        {canWrite && !group && invoice.commercialEmailStage?.endsWith("_PENDING") &&
          <button className={button} disabled={busy} onClick={() => void action("retry-email")}>Retry Email</button>}
      </div>
      {canWrite && !group && invoice.status === "ISSUED" && <form key={invoice.id} className="grid items-end gap-3 sm:grid-cols-4" onSubmit={event => {
        event.preventDefault(); void action("record-payment", Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <Field label="Amount received (£)"><input className={input} type="number" name="amount" min="0" step="0.01" defaultValue={Number(invoice.total).toFixed(2)} required /></Field>
        <Field label="Payment method"><select className={input} name="method">
          <option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option>
        </select></Field>
        <Field label="Payment reference"><input className={input} name="reference" maxLength={120} /></Field>
        <button className={primary} disabled={busy}>Record Payment</button>
      </form>}
    </article>}
  </div>;
}

function InvoiceAdjustments({ invoice, overview, busy, run, refresh }: {
  invoice: Invoice; overview: Overview; busy: boolean; run: (operation: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>;
}) {
  const path = `/api/invoices/admin/${encodeURIComponent(invoice.id)}/adjustments`;
  return <section className="space-y-2 rounded-xl border p-4">
    <h4 className="font-bold">Additional Charges & Discounts</h4>
    {(["CHARGE", "DISCOUNT"] as const).map(sourceType => <form key={sourceType} className="flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
      if (values.sourceId) void run(async () => { await request(path, json({ ...values, sourceType })); await refresh(); });
    }}>
      <select name="sourceId" className={input + " max-w-sm"} aria-label={sourceType === "CHARGE" ? "Additional charge" : "Discount"} required>
        <option value="">N/A</option>{(sourceType === "CHARGE" ? overview.charges : overview.discounts)
          .map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      {sourceType === "CHARGE" && <input name="quantity" type="number" aria-label="Quantity" className={input + " max-w-24"} min="0.01" step="0.01" defaultValue="1" required />}
      <button className={button} disabled={busy}>{sourceType === "CHARGE" ? "Add Charge" : "Apply Discount"}</button>
    </form>)}
    {invoice.adjustments.map(row => <div key={row.id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
      <span>{row.name} · {money(row.netAmount)}</span>
      <button className={button} disabled={busy} aria-label={`Remove ${row.name}`} onClick={() => void run(async () => {
        await request(`${path}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); await refresh();
      })}>Remove</button>
    </div>)}
  </section>;
}
