"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Mail,
  MapPin,
  MinusCircle,
  PlusCircle,
  Save,
  Truck,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
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
  "08:00–10:00",
  "10:00–12:00",
  "12:00–14:00",
  "14:00–16:00",
  "16:00–18:00",
  "18:00–20:00",
  "Flexible / call customer",
];

type Customer = {
  id: string;
  name: string;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  email: string;
  phone?: string | null;
  accountNumber?: string | null;
  accountStatus: string;
  savedRoutes?: Array<{
    id: string;
    name?: string | null;
    collectionAddress: string;
    deliveryAddress: string;
    vehicleSize?: string | null;
  }>;
};

type Calculation = {
  distanceMiles: number;
  durationMinutes: number | null;
  basePrice: string | number;
  fuelSurcharge: string | number;
  adminPrice: string | number;
  discountAmount: string | number;
  vatAmount: string | number;
  totalPrice: string | number;
  extraDropCount: number;
  routeAddresses: string[];
};

type FormState = {
  journeyType: "One Way" | "Return";
  deliveryType: string;
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress: string;
  vehicleSize: string;
  collectionDate: string;
  collectionWindow: string;
  customerReference: string;
  purchaseOrderNumber: string;
  specialInstructions: string;
  discountType: "NONE" | "FIXED" | "PERCENTAGE";
  discountValue: string;
  discountReason: string;
};

const initialForm: FormState = {
  journeyType: "One Way",
  deliveryType: "Standard",
  collectionAddress: "",
  deliveryAddress: "",
  returnAddress: "",
  vehicleSize: "SWB Van",
  collectionDate: "",
  collectionWindow: "",
  customerReference: "",
  purchaseOrderNumber: "",
  specialInstructions: "",
  discountType: "NONE",
  discountValue: "",
  discountReason: "",
};

function adminKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function customerName(customer: Customer | null) {
  return (
    customer?.companyName ||
    customer?.legalEntity ||
    customer?.tradingName ||
    customer?.name ||
    "Customer"
  );
}

export default function CreateCustomerQuotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [extraStops, setExtraStops] = useState<string[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const key = adminKey();
      if (!key) throw new Error("Admin key is required.");

      const response = await fetch(`${API_BASE}/api/admin/customers/${customerId}`, {
        headers: { "x-admin-key": key },
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.customer) {
        throw new Error(payload?.error || "Unable to load customer account.");
      }

      setCustomer(payload.customer);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load customer account.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    setCalculation(null);
  }, [form, extraStops]);

  const payload = useMemo(
    () => ({
      ...form,
      discountValue: Number(form.discountValue || 0),
      extraDrops: extraStops
        .map((address, index) => ({ order: index + 1, address: address.trim() }))
        .filter((stop) => stop.address),
    }),
    [form, extraStops],
  );

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validate() {
    if (!customer || customer.accountStatus !== "ACTIVE") {
      return "Only active customer accounts can receive new quotes.";
    }
    if (!form.collectionAddress.trim()) return "Collection address is required.";
    if (!form.deliveryAddress.trim()) return "Delivery address is required.";
    if (form.journeyType === "Return" && !form.returnAddress.trim()) {
      return "Return address is required for a return journey.";
    }
    if (!form.vehicleSize) return "Vehicle type is required.";
    if (!form.collectionDate) return "Collection date is required.";
    if (!form.collectionWindow) return "Collection time window is required.";
    if (form.discountType !== "NONE" && Number(form.discountValue) <= 0) {
      return "Enter a valid discount value.";
    }
    if (form.discountType !== "NONE" && !form.discountReason.trim()) {
      return "A discount reason is required.";
    }
    return "";
  }

  async function calculate() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCalculating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/admin/customer/${customerId}/calculate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey(),
          },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();

      if (!response.ok || !result?.calculation) {
        throw new Error(result?.error || "Unable to calculate journey and price.");
      }

      setCalculation(result.calculation);
      setMessage("Journey time and price calculated successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to calculate journey and price.",
      );
    } finally {
      setCalculating(false);
    }
  }

  async function createQuote(sendToCustomer: boolean) {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!calculation) {
      setError("Calculate the journey and price before saving the quote.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/admin/customer/${customerId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey(),
          },
          body: JSON.stringify({ ...payload, sendToCustomer }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result?.quote) {
        throw new Error(result?.error || "Unable to save quote.");
      }

      const emailMessage = sendToCustomer
        ? result.email?.sent
          ? " Quote emailed to the customer."
          : ` ${result.email?.reason || "The quote was saved as Draft."}`
        : " Quote saved as Draft.";

      window.alert(`Quote ${result.quote.id} created.${emailMessage}`);
      router.push(`/admin/customers/${customerId}/quotes`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save quote.",
      );
    } finally {
      setSaving(false);
    }
  }

  function useSavedRoute(routeId: string) {
    const route = customer?.savedRoutes?.find((item) => item.id === routeId);
    if (!route) return;
    setForm((current) => ({
      ...current,
      collectionAddress: route.collectionAddress,
      deliveryAddress: route.deliveryAddress,
      vehicleSize: route.vehicleSize || current.vehicleSize,
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href={`/admin/customers/${customerId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={17} /> Back to customer
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Customer account quote
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Create Quote</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create, price and send a quote for {customerName(customer)}.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
          <p className="font-bold text-slate-950">{customerName(customer)}</p>
          <p className="mt-1 text-slate-500">{customer?.accountNumber || "No account number"}</p>
          <p className="text-slate-500">{customer?.email}</p>
        </div>
      </header>

      {message ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={19} /> {message}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} /> {error}
        </div>
      ) : null}

      {customer?.accountStatus !== "ACTIVE" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          This account is {customer?.accountStatus}. Reactivate it before creating a quote.
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Section title="Journey details" icon={MapPin}>
            {customer?.savedRoutes?.length ? (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Use a saved route</span>
                <select
                  defaultValue=""
                  onChange={(event) => useSavedRoute(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                >
                  <option value="">Choose saved route</option>
                  {customer.savedRoutes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name || `${route.collectionAddress} → ${route.deliveryAddress}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <SelectField
                label="Journey type"
                value={form.journeyType}
                onChange={(value) => update("journeyType", value as FormState["journeyType"])}
                options={["One Way", "Return"]}
              />
              <SelectField
                label="Delivery service"
                value={form.deliveryType}
                onChange={(value) => update("deliveryType", value)}
                options={["Standard", "Same Day", "Next Day", "Timed"]}
              />
              <Field
                label="Collection address"
                value={form.collectionAddress}
                onChange={(value) => update("collectionAddress", value)}
                required
              />
              <Field
                label="Delivery address"
                value={form.deliveryAddress}
                onChange={(value) => update("deliveryAddress", value)}
                required
              />
              {form.journeyType === "Return" ? (
                <Field
                  label="Return address"
                  value={form.returnAddress}
                  onChange={(value) => update("returnAddress", value)}
                  required
                />
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">Extra stops</p>
                <button
                  type="button"
                  onClick={() => setExtraStops((current) => [...current, ""])}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#E55300]"
                >
                  <PlusCircle size={17} /> Add stop
                </button>
              </div>
              {extraStops.map((stop, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    value={stop}
                    onChange={(event) =>
                      setExtraStops((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder={`Extra stop ${index + 1}`}
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExtraStops((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="rounded-xl border border-red-200 px-3 text-red-600"
                    aria-label={`Remove stop ${index + 1}`}
                  >
                    <MinusCircle size={19} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Vehicle, date and time" icon={Truck}>
            <div className="grid gap-5 md:grid-cols-3">
              <SelectField
                label="Vehicle type"
                value={form.vehicleSize}
                onChange={(value) => update("vehicleSize", value)}
                options={VEHICLES}
              />
              <Field
                label="Collection date"
                type="datetime-local"
                value={form.collectionDate}
                onChange={(value) => update("collectionDate", value)}
                required
              />
              <SelectField
                label="Time window"
                value={form.collectionWindow}
                onChange={(value) => update("collectionWindow", value)}
                options={WINDOWS}
                placeholder="Choose window"
              />
            </div>
          </Section>

          <Section title="Customer reference and notes" icon={Save}>
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
              <span className="mb-2 block text-sm font-bold text-slate-700">Quote notes / special instructions</span>
              <textarea
                rows={5}
                value={form.specialInstructions}
                onChange={(event) => update("specialInstructions", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          </Section>

          <Section title="Discount" icon={Calculator}>
            <div className="grid gap-5 md:grid-cols-3">
              <SelectField
                label="Discount type"
                value={form.discountType}
                onChange={(value) => update("discountType", value as FormState["discountType"])}
                options={["NONE", "FIXED", "PERCENTAGE"]}
              />
              <Field
                label={form.discountType === "PERCENTAGE" ? "Discount percentage" : "Discount amount"}
                type="number"
                value={form.discountValue}
                onChange={(value) => update("discountValue", value)}
                disabled={form.discountType === "NONE"}
              />
              <Field
                label="Discount reason"
                value={form.discountReason}
                onChange={(value) => update("discountReason", value)}
                disabled={form.discountType === "NONE"}
              />
            </div>
          </Section>
        </div>

        <aside className="space-y-6">
          <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Quote calculation</h2>
            <p className="mt-2 text-sm text-slate-500">
              Calculation uses the configured pricing engine and the routed journey distance.
            </p>

            <button
              type="button"
              onClick={() => void calculate()}
              disabled={calculating || saving || customer?.accountStatus !== "ACTIVE"}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {calculating ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
              Calculate journey and price
            </button>

            {calculation ? (
              <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                <PriceRow label="Journey distance" value={`${calculation.distanceMiles.toFixed(1)} miles`} />
                <PriceRow
                  label="Journey time"
                  value={
                    calculation.durationMinutes === null
                      ? "Not returned"
                      : `${Math.floor(calculation.durationMinutes / 60)}h ${calculation.durationMinutes % 60}m`
                  }
                />
                <PriceRow label="Extra stops" value={String(calculation.extraDropCount)} />
                <PriceRow label="Base price" value={money(calculation.basePrice)} />
                <PriceRow label="Fuel surcharge" value={money(calculation.fuelSurcharge)} />
                <PriceRow label="Admin price" value={money(calculation.adminPrice)} />
                <PriceRow label="Discount" value={`−${money(calculation.discountAmount)}`} />
                <PriceRow label="VAT" value={money(calculation.vatAmount)} />
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-950">
                  <span>Total</span>
                  <span>{money(calculation.totalPrice)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                Complete the form, then calculate the quote.
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void createQuote(false)}
                disabled={saving || !calculation}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save quote to account
              </button>
              <button
                type="button"
                onClick={() => void createQuote(true)}
                disabled={saving || !calculation}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                Save and send quote
              </button>
            </div>
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
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-orange-50 p-2.5 text-[#E55300]">
          <Icon size={20} />
        </div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
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
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:bg-slate-100"
      />
    </label>
  );
}

function SelectField({
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
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
