"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Truck,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";
const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

const VEHICLES = [
  "Small Van",
  "SWB Van",
  "LWB Van",
  "XLWB Van",
  "Luton Tail Lift Van",
];
const WINDOWS = [
  "08:00-10:00",
  "10:00-12:00",
  "12:00-14:00",
  "14:00-16:00",
  "16:00-18:00",
  "Flexible",
];

type CustomerSummary = {
  id: string;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  accountNumber?: string | null;
  accountStatus?: string;
  quotes?: Quote[];
  relatedQuotes?: Quote[];
};

type Quote = {
  id: string;
  status: string;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  vehicleSize: string;
  totalPrice?: string | number | null;
  customerReference?: string | null;
  createdAt: string;
};

type Calculation = {
  distanceMiles: number;
  durationMinutes: number | null;
  basePrice: number;
  fuelSurcharge: number;
  adminPrice: number;
  discountAmount: number;
  vatAmount: number;
  totalPrice: number;
  extraDropCount: number;
};

type FormState = {
  deliveryType: string;
  journeyType: "One-way" | "Return";
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress: string;
  extraDrops: string[];
  vehicleSize: string;
  collectionDate: string;
  collectionWindow: string;
  customerReference: string;
  purchaseOrderNumber: string;
  notes: string;
  discountType: "NONE" | "FIXED" | "PERCENTAGE";
  discountValue: string;
  discountReason: string;
};

const EMPTY_FORM: FormState = {
  deliveryType: "Dedicated",
  journeyType: "One-way",
  collectionAddress: "",
  deliveryAddress: "",
  returnAddress: "",
  extraDrops: [],
  vehicleSize: "",
  collectionDate: "",
  collectionWindow: "",
  customerReference: "",
  purchaseOrderNumber: "",
  notes: "",
  discountType: "NONE",
  discountValue: "",
  discountReason: "",
};

function getAdminKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(amount)
    : "—";
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload?.message || payload?.error || "Request failed.");
  return payload;
}

export default function CustomerQuotesPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"calculate" | "save" | "send" | "">(
    "",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/customers/${customerId}`,
        {
          headers: { "x-admin-key": getAdminKey() },
          cache: "no-store",
        },
      );
      const payload = await parseResponse(response);
      const data = payload.customer || payload.data || payload;
      setCustomer(data);
      setQuotes(
        Array.isArray(data.quotes)
          ? data.quotes
          : Array.isArray(data.relatedQuotes)
            ? data.relatedQuotes
            : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer quotes.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const payload = useMemo(
    () => ({
      ...form,
      extraDrops: form.extraDrops
        .map((address, index) => ({
          order: index + 1,
          address: address.trim(),
        }))
        .filter((drop) => drop.address),
      discountValue: Number(form.discountValue || 0),
    }),
    [form],
  );

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setCalculation(null);
    setMessage("");
  }

  function validate() {
    if (!form.collectionAddress.trim())
      return "Collection address is required.";
    if (!form.deliveryAddress.trim()) return "Delivery address is required.";
    if (form.journeyType === "Return" && !form.returnAddress.trim())
      return "Return address is required for a return journey.";
    if (!form.vehicleSize) return "Vehicle type is required.";
    if (!form.collectionDate) return "Collection date is required.";
    if (!form.collectionWindow) return "Time window is required.";
    if (form.discountType !== "NONE" && Number(form.discountValue) <= 0)
      return "Enter a valid discount value.";
    if (form.discountType !== "NONE" && form.discountReason.trim().length < 3)
      return "Enter a discount reason.";
    return "";
  }

  async function calculate() {
    const issue = validate();
    if (issue) return setError(issue);
    setWorking("calculate");
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/quotes/admin/calculate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await parseResponse(response);
      setCalculation(data.calculation);
      setMessage("Journey time and price calculated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to calculate quote.",
      );
    } finally {
      setWorking("");
    }
  }

  async function createQuote(sendToCustomer: boolean) {
    const issue = validate();
    if (issue) return setError(issue);
    if (!calculation)
      return setError(
        "Calculate the journey and price before saving the quote.",
      );
    if (
      sendToCustomer &&
      !window.confirm(
        `Save and email this quote to ${customer?.email || "the customer"}?`,
      )
    )
      return;
    setWorking(sendToCustomer ? "send" : "save");
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/quotes/admin/customer/${customerId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({ ...payload, sendToCustomer }),
        },
      );
      const data = await parseResponse(response);
      setMessage(
        data.warning ||
          (sendToCustomer
            ? "Quote saved and sent to the customer."
            : "Quote saved to the customer account."),
      );
      setForm(EMPTY_FORM);
      setCalculation(null);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create quote.",
      );
    } finally {
      setWorking("");
    }
  }

  const displayName = customer?.companyName || customer?.name || "Customer";

  if (loading) return <LoadingBox label="Loading customer and quote history" />;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href={`/admin/customers/${customerId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={16} /> Back to customer
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Create quote from customer account
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {displayName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {customer?.accountNumber || "No account number"} · {customer?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
        >
          <RefreshCw size={18} /> Refresh
        </button>
      </header>

      {customer?.accountStatus && customer.accountStatus !== "ACTIVE" ? (
        <ErrorBox message="This account is not active. Reactivate it before creating a new quote." />
      ) : null}
      {error ? <ErrorBox message={error} /> : null}
      {message ? <SuccessBox message={message} /> : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void calculate();
          }}
        >
          <Section title="Journey" icon={MapPin}>
            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label="Journey type"
                value={form.journeyType}
                onChange={(value) =>
                  update("journeyType", value as FormState["journeyType"])
                }
                options={["One-way", "Return"]}
              />
              <Select
                label="Service type"
                value={form.deliveryType}
                onChange={(value) => update("deliveryType", value)}
                options={["Dedicated", "Same Day", "Scheduled"]}
              />
              <Field
                label="Collection address"
                value={form.collectionAddress}
                onChange={(value) => update("collectionAddress", value)}
                placeholder="Full address including postcode"
                required
              />
              <Field
                label="Delivery address"
                value={form.deliveryAddress}
                onChange={(value) => update("deliveryAddress", value)}
                placeholder="Full address including postcode"
                required
              />
              {form.journeyType === "Return" ? (
                <Field
                  label="Return address"
                  value={form.returnAddress}
                  onChange={(value) => update("returnAddress", value)}
                  placeholder="Return destination including postcode"
                  required
                />
              ) : null}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-800">
                  Extra stops
                </h3>
                <button
                  type="button"
                  onClick={() => update("extraDrops", [...form.extraDrops, ""])}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                >
                  <Plus size={15} /> Add stop
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {form.extraDrops.map((drop, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={drop}
                      onChange={(event) => {
                        const next = [...form.extraDrops];
                        next[index] = event.target.value;
                        update("extraDrops", next);
                      }}
                      placeholder={`Stop ${index + 1} address including postcode`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      aria-label={`Remove stop ${index + 1}`}
                      onClick={() =>
                        update(
                          "extraDrops",
                          form.extraDrops.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                      className="rounded-xl border border-red-200 bg-red-50 px-3 text-red-700"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                {form.extraDrops.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No extra stops added.
                  </p>
                ) : null}
              </div>
            </div>
          </Section>

          <Section title="Vehicle and schedule" icon={Truck}>
            <div className="grid gap-5 md:grid-cols-3">
              <Select
                label="Vehicle type"
                value={form.vehicleSize}
                onChange={(value) => update("vehicleSize", value)}
                options={VEHICLES}
                placeholder="Choose vehicle"
              />
              <Field
                label="Collection date"
                type="date"
                value={form.collectionDate}
                onChange={(value) => update("collectionDate", value)}
                required
              />
              <Select
                label="Time window"
                value={form.collectionWindow}
                onChange={(value) => update("collectionWindow", value)}
                options={WINDOWS}
                placeholder="Choose window"
              />
            </div>
          </Section>

          <Section title="Reference and notes" icon={Mail}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Customer reference"
                value={form.customerReference}
                onChange={(value) => update("customerReference", value)}
              />
              <Field
                label="Purchase order number"
                value={form.purchaseOrderNumber}
                onChange={(value) => update("purchaseOrderNumber", value)}
              />
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Notes / special instructions
              </span>
              <textarea
                rows={5}
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              />
            </label>
          </Section>

          <Section title="Discount" icon={Calculator}>
            <div className="grid gap-5 md:grid-cols-3">
              <Select
                label="Discount type"
                value={form.discountType}
                onChange={(value) =>
                  update("discountType", value as FormState["discountType"])
                }
                options={["NONE", "FIXED", "PERCENTAGE"]}
              />
              {form.discountType !== "NONE" ? (
                <Field
                  label={
                    form.discountType === "FIXED"
                      ? "Discount amount (£)"
                      : "Discount percentage"
                  }
                  type="number"
                  value={form.discountValue}
                  onChange={(value) => update("discountValue", value)}
                />
              ) : null}
              {form.discountType !== "NONE" ? (
                <Field
                  label="Discount reason"
                  value={form.discountReason}
                  onChange={(value) => update("discountReason", value)}
                />
              ) : null}
            </div>
          </Section>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={
                Boolean(working) || customer?.accountStatus !== "ACTIVE"
              }
              className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-5 py-3 text-sm font-bold text-[#E55300] disabled:opacity-50"
            >
              {working === "calculate" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Calculator size={18} />
              )}{" "}
              Calculate journey and price
            </button>
            <button
              type="button"
              onClick={() => void createQuote(false)}
              disabled={
                Boolean(working) ||
                !calculation ||
                customer?.accountStatus !== "ACTIVE"
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {working === "save" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}{" "}
              Save quote
            </button>
            <button
              type="button"
              onClick={() => void createQuote(true)}
              disabled={
                Boolean(working) ||
                !calculation ||
                customer?.accountStatus !== "ACTIVE"
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {working === "send" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}{" "}
              Save and send
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Quote calculation
            </h2>
            {calculation ? (
              <div className="mt-5 space-y-3">
                <PriceRow
                  label="Distance"
                  value={`${calculation.distanceMiles.toFixed(1)} miles`}
                />
                <PriceRow
                  label="Journey time"
                  value={
                    calculation.durationMinutes
                      ? `${calculation.durationMinutes} minutes`
                      : "Not returned"
                  }
                />
                <PriceRow
                  label="Base fare"
                  value={formatMoney(calculation.basePrice)}
                />
                <PriceRow
                  label="Fuel surcharge"
                  value={formatMoney(calculation.fuelSurcharge)}
                />
                <PriceRow
                  label="Extra/admin charges"
                  value={formatMoney(calculation.adminPrice)}
                />
                <PriceRow
                  label="Discount"
                  value={`-${formatMoney(calculation.discountAmount)}`}
                />
                <PriceRow
                  label="VAT"
                  value={formatMoney(calculation.vatAmount)}
                />
                <div className="border-t border-slate-200 pt-4">
                  <PriceRow
                    label="Total"
                    value={formatMoney(calculation.totalPrice)}
                    strong
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Complete the form and calculate the journey before saving or
                sending.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Customer quote history
            </h2>
            <div className="mt-4 space-y-3">
              {quotes.slice(0, 8).map((quote) => (
                <div
                  key={quote.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {quote.id}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {quote.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {quote.collectionAddress} → {quote.deliveryAddress}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{formatDate(quote.collectionDate)}</span>
                    <span>{formatMoney(quote.totalPrice)}</span>
                  </div>
                </div>
              ))}
              {quotes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No quotes linked to this customer yet.
                </p>
              ) : null}
            </div>
            <Link
              href="/admin/quotes"
              className="mt-4 inline-flex text-sm font-bold text-[#E55300] hover:underline"
            >
              Open full quote management
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Truck;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={20} />
        </span>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
function PriceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 text-sm ${strong ? "text-base font-bold text-slate-950" : "text-slate-600"}`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
function LoadingBox({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
      <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      <CircleAlert size={18} />
      {message}
    </div>
  );
}
function SuccessBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      <CheckCircle2 size={18} />
      {message}
    </div>
  );
}
