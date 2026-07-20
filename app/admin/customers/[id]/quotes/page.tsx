"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleAlert,
  HelpCircle,
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
const VEHICLE_AVAILABILITY_API_URL = `${API_BASE_URL}/api/vehicles/availability`;
const ADDRESS_LOOKUP_API_URL = `${API_BASE_URL}/api/distance/address-lookup`;

const twoHourWindows = [
  "00:00-02:00",
  "02:00-04:00",
  "04:00-06:00",
  "06:00-08:00",
  "08:00-10:00",
  "10:00-12:00",
  "12:00-14:00",
  "14:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
  "20:00-22:00",
  "22:00-00:00",
];
const vehicleOptions = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
];
const capacityOptions = [
  { percent: 25, label: "0-25%", text: "Quarter load" },
  { percent: 50, label: "25-50%", text: "Half load" },
  { percent: 75, label: "50-75%", text: "Three quarter load" },
  { percent: 100, label: "75-100%", text: "Full load" },
];
const collectingOptions = [
  "Documents",
  "Small Item",
  "Medium Item",
  "Large Item",
  "Pallet",
];
const vehicleDetails: Record<
  string,
  {
    label: string;
    length: string;
    width: string;
    height: string;
    pallets: string;
    maxWeight: string;
    image: string;
  }
> = {
  "Small Van": {
    label: "Small Van",
    length: "1.5m",
    width: "1.2m",
    height: "1.1m",
    pallets: "1 pallet",
    maxWeight: "400kg",
    image: "/Vehicles/smallvan.jpg",
  },
  "SWB Van": {
    label: "SWB Van",
    length: "2.4m",
    width: "1.6m",
    height: "1.4m",
    pallets: "2 pallets",
    maxWeight: "900kg",
    image: "/Vehicles/swb.jpeg",
  },
  "LWB High Roof Van": {
    label: "LWB High Roof Van",
    length: "3.4m",
    width: "1.7m",
    height: "1.7m",
    pallets: "3 pallets",
    maxWeight: "1,200kg",
    image: "/Vehicles/lwb.jpg",
  },
  "XLWB High Roof Van": {
    label: "XLWB High Roof Van",
    length: "4.2m",
    width: "1.7m",
    height: "1.9m",
    pallets: "4 pallets",
    maxWeight: "1,400kg",
    image: "/Vehicles/XLWB High Roof.jpg",
  },
  "Luton Tail Lift Van": {
    label: "Luton Tail Lift Van",
    length: "4.0m",
    width: "2.0m",
    height: "2.0m",
    pallets: "6 pallets",
    maxWeight: "1,000kg",
    image: "/Vehicles/Luton Tail Lift.jpg",
  },
};

type AddressFields = {
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};
type ExtraStop = AddressFields & { order: number };
type AddressLookupTarget =
  "collection" | "delivery" | "return" | `stop-${number}`;
type AddressLookupResult = AddressFields & { label: string };
type LiveVehicleAvailability = {
  available: boolean;
  reason?: string | null;
  unavailableUntil?: string | null;
};
type CustomerSummary = {
  id: string;
  name: string;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
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
  journeyType: "One Way" | "Return" | "Multi Drop" | "";
  whatAreWeCollecting: string;
  capacityPercent: number | null;
  returnCapacityPercent: number | null;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: AddressFields;
  deliveryAddress: AddressFields;
  returnAddress: AddressFields;
  extraDrops: ExtraStop[];
  vehicleSize: string;
  loadDescription: string;
  specialInstructions: string;
  fragileGoods: boolean;
  contactPreference: string;
  accuracyConfirmed: boolean;
  customerReference: string;
  purchaseOrderNumber: string;
  notes: string;
  discountType: "NONE" | "FIXED" | "PERCENTAGE";
  discountValue: string;
  discountReason: string;
};
const emptyAddress: AddressFields = {
  addressLine1: "",
  addressLine2: "",
  townCity: "",
  county: "",
  postcode: "",
};
const EMPTY_FORM: FormState = {
  deliveryType: "",
  journeyType: "",
  whatAreWeCollecting: "",
  capacityPercent: null,
  returnCapacityPercent: null,
  collectionDate: "",
  collectionWindow: "",
  collectionAddress: { ...emptyAddress },
  deliveryAddress: { ...emptyAddress },
  returnAddress: { ...emptyAddress },
  extraDrops: [],
  vehicleSize: "",
  loadDescription: "",
  specialInstructions: "",
  fragileGoods: false,
  contactPreference: "",
  accuracyConfirmed: false,
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
function formatAddress(a: AddressFields) {
  return [a.addressLine1, a.addressLine2, a.townCity, a.county, a.postcode]
    .filter((v) => v.trim())
    .join(", ");
}
function isAddressComplete(a: AddressFields) {
  return Boolean(
    a.addressLine1.trim() &&
    a.townCity.trim() &&
    a.county.trim() &&
    a.postcode.trim(),
  );
}
function isValidUkPostcode(p: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(p.trim());
}
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatTimeFromMinutes(n: number) {
  const x = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}
function buildSameDayCollectionWindows() {
  const n = new Date();
  const earliest = n.getHours() * 60 + n.getMinutes() + 120;
  const first = Math.ceil(earliest / 60) * 60;
  return Array.from(
    { length: 12 },
    (_, i) =>
      `${formatTimeFromMinutes(first + i * 120)}-${formatTimeFromMinutes(first + (i + 1) * 120)}`,
  );
}
function formatUnavailableUntil(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
}
function formatDate(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
}
function formatMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(n)
    : "—";
}
async function parseResponse(r: Response) {
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p?.message || p?.error || "Request failed.");
  return p;
}

export default function CustomerQuotesPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const formTopRef = useRef<HTMLDivElement | null>(null);
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
  const [liveVehicleAvailability, setLiveVehicleAvailability] = useState<
    Record<string, LiveVehicleAvailability>
  >({});
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleAvailabilityError, setVehicleAvailabilityError] = useState("");
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [addressLookupTarget, setAddressLookupTarget] =
    useState<AddressLookupTarget | null>(null);
  const [addressLookupResults, setAddressLookupResults] = useState<
    AddressLookupResult[]
  >([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/admin/customers/${customerId}`,
        { headers: { "x-admin-key": getAdminKey() }, cache: "no-store" },
      );
      const p = await parseResponse(r);
      const d = p.customer || p.data || p;
      setCustomer(d);
      setQuotes(
        Array.isArray(d.quotes)
          ? d.quotes
          : Array.isArray(d.relatedQuotes)
            ? d.relatedQuotes
            : [],
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load customer quotes.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);
  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableCollectionWindows = useMemo(
    () =>
      form.collectionDate === getTodayDateString()
        ? buildSameDayCollectionWindows()
        : twoHourWindows,
    [form.collectionDate],
  );
  const showExtraStops = form.journeyType === "Multi Drop";
  const showCollectionCapacity =
    form.journeyType === "One Way" || form.journeyType === "Return";
  const showReturnCapacity = form.journeyType === "Return";
  const showAddressFields = Boolean(
    form.collectionDate && form.collectionWindow,
  );
  const allVehiclesUnavailable =
    showAddressFields &&
    vehicleOptions.every(
      (v) => liveVehicleAvailability[v]?.available === false,
    );

  useEffect(() => {
    if (!form.collectionDate || !form.collectionWindow) {
      setLiveVehicleAvailability({});
      setVehicleAvailabilityError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVehicles(true);
      setVehicleAvailabilityError("");
      try {
        const q = new URLSearchParams({
          collectionDate: form.collectionDate,
          collectionWindow: form.collectionWindow,
        });
        const r = await fetch(`${VEHICLE_AVAILABILITY_API_URL}?${q}`, {
          cache: "no-store",
        });
        const d = await parseResponse(r);
        if (cancelled) return;
        const a: Record<string, LiveVehicleAvailability> = {};
        (d.vehicles || []).forEach((v: any) => {
          a[v.vehicleType] = {
            available: v.available,
            reason: v.reason || null,
            unavailableUntil: v.unavailableUntil || null,
          };
        });
        setLiveVehicleAvailability(a);
        if (
          form.vehicleSize &&
          a[form.vehicleSize] &&
          !a[form.vehicleSize].available
        ) {
          setForm((c) => ({ ...c, vehicleSize: "" }));
          setShowVehicleModal(false);
          setError(
            "The selected vehicle is no longer available. Choose another vehicle.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setLiveVehicleAvailability({});
          setVehicleAvailabilityError(
            e instanceof Error
              ? e.message
              : "Unable to check vehicle availability.",
          );
        }
      } finally {
        if (!cancelled) setLoadingVehicles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.collectionDate, form.collectionWindow, form.vehicleSize]);

  const payload = useMemo(
    () => ({
      deliveryType: form.deliveryType,
      journeyType: form.journeyType,
      whatAreWeCollecting: form.whatAreWeCollecting,
      capacityPercent: showCollectionCapacity ? form.capacityPercent : null,
      returnCapacityPercent: showReturnCapacity
        ? form.returnCapacityPercent
        : null,
      collectionDate: form.collectionDate
        ? new Date(`${form.collectionDate}T00:00:00.000Z`).toISOString()
        : "",
      collectionWindow: form.collectionWindow,
      vehicleSize: form.vehicleSize,
      collectionAddress: formatAddress(form.collectionAddress),
      collectionAddressDetails: form.collectionAddress,
      deliveryAddress: formatAddress(form.deliveryAddress),
      deliveryAddressDetails: form.deliveryAddress,
      returnAddress:
        form.journeyType === "Return"
          ? formatAddress(form.returnAddress)
          : null,
      returnAddressDetails:
        form.journeyType === "Return" ? form.returnAddress : null,
      extraDrops: showExtraStops
        ? form.extraDrops.map((s, i) => ({
            ...s,
            order: i + 2,
            address: formatAddress(s),
          }))
        : null,
      loadDescription: form.loadDescription,
      specialInstructions: form.specialInstructions,
      fragileGoods: form.fragileGoods,
      contactPreference: form.contactPreference,
      accuracyConfirmed: form.accuracyConfirmed,
      customerReference: form.customerReference,
      purchaseOrderNumber: form.purchaseOrderNumber,
      notes: form.notes,
      discountType: form.discountType,
      discountValue: Number(form.discountValue || 0),
      discountReason: form.discountReason,
    }),
    [form, showCollectionCapacity, showReturnCapacity, showExtraStops],
  );

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((c) => ({ ...c, [field]: value }));
    setCalculation(null);
    setMessage("");
    setError("");
  }
  function updateAddress(
    target: "collection" | "delivery" | "return",
    field: keyof AddressFields,
    value: string,
  ) {
    setForm((c) => ({
      ...c,
      [target === "collection"
        ? "collectionAddress"
        : target === "delivery"
          ? "deliveryAddress"
          : "returnAddress"]: {
        ...c[
          target === "collection"
            ? "collectionAddress"
            : target === "delivery"
              ? "deliveryAddress"
              : "returnAddress"
        ],
        [field]: value,
      },
    }));
    setCalculation(null);
  }
  function addStop() {
    update("extraDrops", [
      ...form.extraDrops,
      { order: form.extraDrops.length + 2, ...emptyAddress },
    ]);
  }
  function removeStop(i: number) {
    update(
      "extraDrops",
      form.extraDrops
        .filter((_, x) => x !== i)
        .map((s, x) => ({ ...s, order: x + 2 })),
    );
  }
  function updateStop(i: number, field: keyof AddressFields, value: string) {
    update(
      "extraDrops",
      form.extraDrops.map((s, x) => (x === i ? { ...s, [field]: value } : s)),
    );
  }

  function validate() {
    if (!form.deliveryType) return "Delivery type is required.";
    if (!form.journeyType) return "Select One Way, Return, or Multi Drop.";
    if (!form.whatAreWeCollecting) return "Select what is being collected.";
    if (!form.collectionDate) return "Collection date is required.";
    if (!form.collectionWindow) return "Collection window is required.";
    if (!form.vehicleSize) return "Vehicle type is required.";
    if (liveVehicleAvailability[form.vehicleSize]?.available === false)
      return "The selected vehicle is unavailable.";
    if (showCollectionCapacity && !form.capacityPercent)
      return "Select collection capacity.";
    if (showReturnCapacity && !form.returnCapacityPercent)
      return "Select return capacity.";
    if (
      !isAddressComplete(form.collectionAddress) ||
      !isValidUkPostcode(form.collectionAddress.postcode)
    )
      return "Enter a complete collection address with a valid UK postcode.";
    if (
      !isAddressComplete(form.deliveryAddress) ||
      !isValidUkPostcode(form.deliveryAddress.postcode)
    )
      return "Enter a complete delivery address with a valid UK postcode.";
    if (
      form.journeyType === "Return" &&
      (!isAddressComplete(form.returnAddress) ||
        !isValidUkPostcode(form.returnAddress.postcode))
    )
      return "Enter a complete return address with a valid UK postcode.";
    if (showExtraStops && form.extraDrops.length === 0)
      return "Add at least one extra stop for Multi Drop.";
    if (
      showExtraStops &&
      form.extraDrops.some(
        (s) => !isAddressComplete(s) || !isValidUkPostcode(s.postcode),
      )
    )
      return "Complete every extra stop with a valid UK postcode.";
    if (!form.loadDescription.trim()) return "Load description is required.";
    if (!form.contactPreference) return "Contact preference is required.";
    if (!form.accuracyConfirmed)
      return "Confirm that the quote details are accurate.";
    if (form.discountType !== "NONE" && Number(form.discountValue) <= 0)
      return "Enter a valid discount value.";
    if (form.discountType !== "NONE" && form.discountReason.trim().length < 3)
      return "Enter a discount reason.";
    return "";
  }
  function showIssue(issue: string) {
    setError(issue);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function calculate() {
    const issue = validate();
    if (issue) return showIssue(issue);
    setWorking("calculate");
    setError("");
    setMessage("");
    try {
      const r = await fetch(`${API_BASE_URL}/api/quotes/admin/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": getAdminKey(),
        },
        body: JSON.stringify(payload),
      });
      const d = await parseResponse(r);
      setCalculation(d.calculation);
      setMessage("Journey time and price calculated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to calculate quote.");
    } finally {
      setWorking("");
    }
  }
  async function createQuote(sendToCustomer: boolean) {
    const issue = validate();
    if (issue) return showIssue(issue);
    if (!calculation)
      return showIssue(
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
      const r = await fetch(
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
      const d = await parseResponse(r);
      setMessage(
        d.warning ||
          (sendToCustomer
            ? "Quote saved and sent to the customer."
            : "Quote saved to the customer account."),
      );
      setForm(EMPTY_FORM);
      setCalculation(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create quote.");
    } finally {
      setWorking("");
    }
  }

  async function findAddress(target: AddressLookupTarget, postcode: string) {
    setAddressLookupTarget(target);
    setAddressLookupResults([]);
    setAddressLookupError("");
    if (!isValidUkPostcode(postcode)) {
      setAddressLookupError("Enter a valid UK postcode before searching.");
      return;
    }
    setAddressLookupLoading(true);
    try {
      const r = await fetch(
        `${ADDRESS_LOOKUP_API_URL}?postcode=${encodeURIComponent(postcode.trim())}`,
        { cache: "no-store" },
      );
      const d = await parseResponse(r);
      if (!Array.isArray(d.addresses) || d.addresses.length === 0)
        throw new Error("No addresses were found for that postcode.");
      setAddressLookupResults(d.addresses);
    } catch (e) {
      setAddressLookupError(
        e instanceof Error ? e.message : "Unable to find addresses.",
      );
    } finally {
      setAddressLookupLoading(false);
    }
  }
  function applyAddressLookupResult(
    target: AddressLookupTarget,
    result: AddressLookupResult,
  ) {
    const a: AddressFields = {
      addressLine1: result.addressLine1,
      addressLine2: result.addressLine2,
      townCity: result.townCity,
      county: result.county,
      postcode: result.postcode,
    };
    if (target === "collection") {
      setForm((current) => ({ ...current, collectionAddress: a }));
    } else if (target === "delivery") {
      setForm((current) => ({ ...current, deliveryAddress: a }));
    } else if (target === "return") {
      setForm((current) => ({ ...current, returnAddress: a }));
    } else {
      const i = Number(target.replace("stop-", ""));
      setForm((c) => ({
        ...c,
        extraDrops: c.extraDrops.map((s, x) => (x === i ? { ...s, ...a } : s)),
      }));
    }
    setAddressLookupTarget(null);
    setAddressLookupResults([]);
    setAddressLookupError("");
    setCalculation(null);
  }
  function renderLookup(target: AddressLookupTarget) {
    if (addressLookupTarget !== target) return null;
    return (
      <div className="mt-3 md:col-span-2">
        {addressLookupLoading ? <Notice>Finding addresses...</Notice> : null}
        {addressLookupError ? <ErrorBox message={addressLookupError} /> : null}
        {!addressLookupLoading && addressLookupResults.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-xl border bg-white p-2">
            {addressLookupResults.map((r, i) => (
              <button
                key={`${r.label}-${i}`}
                type="button"
                onClick={() => applyAddressLookupResult(target, r)}
                className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold hover:bg-orange-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const displayName = customer?.companyName || customer?.name || "Customer";
  if (loading) return <LoadingBox label="Loading customer and quote history" />;
  return (
    <div ref={formTopRef} className="mx-auto w-full max-w-[1600px] space-y-6">
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
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"
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
          onSubmit={(e) => {
            e.preventDefault();
            void calculate();
          }}
        >
          <Section title="Service requirements" icon={MapPin}>
            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label="Delivery type"
                value={form.deliveryType}
                placeholder="Select delivery type"
                options={[
                  "Same Day Delivery",
                  "Next Day Delivery",
                  "Multi Drop Delivery",
                ]}
                onChange={(v) => {
                  update("deliveryType", v);
                  if (v === "Multi Drop Delivery")
                    update("journeyType", "Multi Drop");
                }}
              />
              <Select
                label="Journey type"
                value={form.journeyType}
                placeholder="Select journey type"
                options={["One Way", "Return", "Multi Drop"]}
                onChange={(v) => {
                  update("journeyType", v as FormState["journeyType"]);
                  if (v !== "Multi Drop") update("extraDrops", []);
                  if (v !== "Return") update("returnCapacityPercent", null);
                }}
              />
            </div>
            <ChoiceGrid
              label="What are we collecting?"
              options={collectingOptions}
              selected={form.whatAreWeCollecting}
              onSelect={(v) => update("whatAreWeCollecting", v)}
            />
            <label className="mt-4 flex gap-3 rounded-xl border bg-slate-50 p-4 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.fragileGoods}
                onChange={(e) => update("fragileGoods", e.target.checked)}
              />{" "}
              Fragile Item
            </label>
            <Notice tone="red">
              Our couriers work in 1 man teams; assistance may be required for
              heavy or fragile items.
            </Notice>
            <Notice tone="amber">
              Ensure suitable loading and unloading facilities are available at
              collection and delivery.
            </Notice>
            {showCollectionCapacity ? (
              <CapacityPicker
                label="Capacity Required On Collection"
                value={form.capacityPercent}
                onChange={(v) => update("capacityPercent", v)}
              />
            ) : null}
            {showReturnCapacity ? (
              <CapacityPicker
                label="Capacity Required On Return"
                value={form.returnCapacityPercent}
                onChange={(v) => update("returnCapacityPercent", v)}
              />
            ) : null}
          </Section>
          <Section title="Collection date & time" icon={Calculator}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Collection date"
                type="date"
                value={form.collectionDate}
                min={getTodayDateString()}
                onChange={(v) => {
                  update("collectionDate", v);
                  update("collectionWindow", "");
                }}
                required
              />
              <Select
                label="Collection window"
                value={form.collectionWindow}
                placeholder="Select collection window"
                options={availableCollectionWindows}
                onChange={(v) => update("collectionWindow", v)}
                disabled={!form.collectionDate}
              />
            </div>
          </Section>
          <Section title="Vehicle size" icon={Truck}>
            {loadingVehicles ? (
              <Notice>Checking live vehicle availability...</Notice>
            ) : null}
            {vehicleAvailabilityError ? (
              <Notice tone="amber">{vehicleAvailabilityError}</Notice>
            ) : null}
            {allVehiclesUnavailable ? (
              <Notice tone="red">
                No vehicles are available for the selected time. Choose another
                date or window.
              </Notice>
            ) : null}
            <Select
              label="Vehicle size"
              value={form.vehicleSize}
              placeholder="Select vehicle"
              options={vehicleOptions}
              optionLabel={(v) => {
                const a = liveVehicleAvailability[v];
                const t = formatUnavailableUntil(a?.unavailableUntil);
                return `${v} ${a?.available === false ? (t ? `(Unavailable until ${t})` : "(Unavailable)") : "(Available)"}`;
              }}
              optionDisabled={(v) =>
                liveVehicleAvailability[v]?.available === false
              }
              onChange={(v) => {
                update("vehicleSize", v);
                setShowVehicleModal(Boolean(v));
              }}
            />
          </Section>
          <Section title="Route information" icon={MapPin}>
            {!showAddressFields ? (
              <Notice>
                Select collection date and time before entering route
                information.
              </Notice>
            ) : (
              <div className="space-y-5">
                <AddressCard
                  title="Collection Address"
                  value={form.collectionAddress}
                  onChange={(f, v) => updateAddress("collection", f, v)}
                  onLookup={() =>
                    void findAddress(
                      "collection",
                      form.collectionAddress.postcode,
                    )
                  }
                  lookup={renderLookup("collection")}
                />
                <AddressCard
                  title={
                    showExtraStops
                      ? "Delivery Address (Stop 1)"
                      : "Delivery Address"
                  }
                  value={form.deliveryAddress}
                  onChange={(f, v) => updateAddress("delivery", f, v)}
                  onLookup={() =>
                    void findAddress("delivery", form.deliveryAddress.postcode)
                  }
                  lookup={renderLookup("delivery")}
                />
                {form.journeyType === "Return" ? (
                  <AddressCard
                    title="Return Address"
                    value={form.returnAddress}
                    onChange={(field, value) =>
                      updateAddress("return", field, value)
                    }
                    onLookup={() =>
                      void findAddress("return", form.returnAddress.postcode)
                    }
                    lookup={renderLookup("return")}
                  />
                ) : null}
                {showExtraStops ? (
                  <div className="rounded-xl border p-5">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-bold">Extra Stops</p>
                        <p className="text-sm text-slate-500">
                          Delivery address is Stop 1.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addStop}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-bold text-white"
                      >
                        <Plus size={16} /> Add stop
                      </button>
                    </div>
                    <div className="mt-4 space-y-4">
                      {form.extraDrops.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-xl border bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex justify-between">
                            <b>Stop {i + 2}</b>
                            <button
                              type="button"
                              onClick={() => removeStop(i)}
                              className="text-red-600"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                          <AddressFieldsGrid
                            value={s}
                            onChange={(f, v) => updateStop(i, f, v)}
                            onLookup={() =>
                              void findAddress(`stop-${i}`, s.postcode)
                            }
                          />
                          {renderLookup(`stop-${i}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Section>
          <Section title="Load & contact details" icon={Mail}>
            <div className="grid gap-5 md:grid-cols-2">
              <TextArea
                label="Load description"
                value={form.loadDescription}
                onChange={(v) => update("loadDescription", v)}
                required
              />
              <TextArea
                label="Special instructions"
                value={form.specialInstructions}
                onChange={(v) => update("specialInstructions", v)}
              />
              <Select
                label="Contact preference"
                value={form.contactPreference}
                placeholder="Select contact preference"
                options={["Phone", "Email", "WhatsApp"]}
                onChange={(v) => update("contactPreference", v)}
              />
              <ReadOnlySummary
                label="Customer"
                value={`${customer?.name || "—"} · ${customer?.phone || "No phone"}`}
              />
              <ReadOnlySummary
                label="Legal entity"
                value={customer?.legalEntity || customer?.companyName || "—"}
              />
              <ReadOnlySummary label="Email" value={customer?.email || "—"} />
            </div>
          </Section>
          <Section title="Reference and office notes" icon={Mail}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Customer reference"
                value={form.customerReference}
                onChange={(v) => update("customerReference", v)}
              />
              <Field
                label="Purchase order number"
                value={form.purchaseOrderNumber}
                onChange={(v) => update("purchaseOrderNumber", v)}
              />
            </div>
            <TextArea
              label="Internal office notes"
              value={form.notes}
              onChange={(v) => update("notes", v)}
            />
          </Section>
          <Section title="Discount" icon={Calculator}>
            <div className="grid gap-5 md:grid-cols-3">
              <Select
                label="Discount type"
                value={form.discountType}
                options={["NONE", "FIXED", "PERCENTAGE"]}
                onChange={(v) =>
                  update("discountType", v as FormState["discountType"])
                }
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
                  onChange={(v) => update("discountValue", v)}
                />
              ) : null}
              {form.discountType !== "NONE" ? (
                <Field
                  label="Discount reason"
                  value={form.discountReason}
                  onChange={(v) => update("discountReason", v)}
                />
              ) : null}
            </div>
          </Section>
          <label className="flex gap-3 rounded-xl border bg-slate-50 p-5 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.accuracyConfirmed}
              onChange={(e) => update("accuracyConfirmed", e.target.checked)}
            />{" "}
            I confirm that the collection, delivery, load, customer and contact
            details are accurate.
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              type="submit"
              busy={working === "calculate"}
              disabled={
                Boolean(working) ||
                loadingVehicles ||
                customer?.accountStatus !== "ACTIVE"
              }
              icon={Calculator}
            >
              Calculate journey and price
            </ActionButton>
            <ActionButton
              onClick={() => void createQuote(false)}
              busy={working === "save"}
              disabled={
                Boolean(working) ||
                !calculation ||
                customer?.accountStatus !== "ACTIVE"
              }
              icon={Save}
              dark
            >
              Save quote
            </ActionButton>
            <ActionButton
              onClick={() => void createQuote(true)}
              busy={working === "send"}
              disabled={
                Boolean(working) ||
                !calculation ||
                customer?.accountStatus !== "ACTIVE"
              }
              icon={Send}
              orange
            >
              Save and send
            </ActionButton>
          </div>
        </form>
        <aside className="space-y-6">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Quote calculation</h2>
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
                <div className="border-t pt-4">
                  <PriceRow
                    label="Total"
                    value={formatMoney(calculation.totalPrice)}
                    strong
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Complete the form and calculate before saving or sending.
              </p>
            )}
          </section>
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Customer quote history</h2>
            <div className="mt-4 space-y-3">
              {quotes.slice(0, 8).map((q) => (
                <div key={q.id} className="rounded-2xl border p-4">
                  <div className="flex justify-between gap-3">
                    <b className="truncate text-sm">{q.id}</b>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold">
                      {q.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {q.collectionAddress} → {q.deliveryAddress}
                  </p>
                  <div className="mt-3 flex justify-between text-xs font-semibold text-slate-500">
                    <span>{formatDate(q.collectionDate)}</span>
                    <span>{formatMoney(q.totalPrice)}</span>
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
      {showVehicleModal &&
      form.vehicleSize &&
      vehicleDetails[form.vehicleSize] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white">
            <div className="flex justify-between bg-slate-950 p-6 text-white">
              <div>
                <p className="text-xs uppercase tracking-widest text-orange-300">
                  Vehicle details
                </p>
                <h2 className="mt-2 text-3xl font-bold">
                  {vehicleDetails[form.vehicleSize].label}
                </h2>
              </div>
              <button type="button" onClick={() => setShowVehicleModal(false)}>
                Close
              </button>
            </div>
            <div className="p-6">
              <img
                src={vehicleDetails[form.vehicleSize].image}
                alt={vehicleDetails[form.vehicleSize].label}
                className="h-64 w-full rounded-2xl border object-contain"
              />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  ["Length", vehicleDetails[form.vehicleSize].length],
                  ["Width", vehicleDetails[form.vehicleSize].width],
                  ["Height", vehicleDetails[form.vehicleSize].height],
                  ["Pallets", vehicleDetails[form.vehicleSize].pallets],
                  ["Max weight", vehicleDetails[form.vehicleSize].maxWeight],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border bg-slate-50 p-4">
                    <b>{k}:</b> {v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={20} />
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
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
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
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
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min ?? (type === "number" ? "0" : undefined)}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
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
  disabled,
  optionLabel,
  optionDisabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  optionLabel?: (v: string) => string;
  optionDisabled?: (v: string) => boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-100 focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o} value={o} disabled={optionDisabled?.(o)}>
            {optionLabel ? optionLabel(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
function ChoiceGrid({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm font-bold text-slate-700">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            className={`rounded-xl border p-4 text-left text-sm font-bold ${selected === o ? "border-[#FF6A00] bg-[#FF6A00] text-white" : "bg-slate-50"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
function CapacityPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <b className="text-sm">{label}</b>
        <HelpCircle size={17} className="text-orange-500" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {capacityOptions.map((o) => (
          <button
            key={o.percent}
            type="button"
            onClick={() => onChange(o.percent)}
            className={`rounded-xl border p-4 text-left ${value === o.percent ? "border-[#FF6A00] bg-[#FF6A00] text-white" : "bg-slate-50"}`}
          >
            <b>{o.label}</b>
            <span className="block text-xs">{o.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function AddressFieldsGrid({
  value,
  onChange,
  onLookup,
}: {
  value: AddressFields;
  onChange: (f: keyof AddressFields, v: string) => void;
  onLookup: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label="Address line 1"
        value={value.addressLine1}
        onChange={(v) => onChange("addressLine1", v)}
        required
      />
      <Field
        label="Address line 2"
        value={value.addressLine2}
        onChange={(v) => onChange("addressLine2", v)}
      />
      <Field
        label="Town / City"
        value={value.townCity}
        onChange={(v) => onChange("townCity", v)}
        required
      />
      <Field
        label="County"
        value={value.county}
        onChange={(v) => onChange("county", v)}
        required
      />
      <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
        <Field
          label="Postcode"
          value={value.postcode}
          onChange={(v) => onChange("postcode", v)}
          required
        />
        <button
          type="button"
          onClick={onLookup}
          className="self-end rounded-xl border border-orange-400 px-5 py-3 text-sm font-bold text-orange-600"
        >
          Find Address
        </button>
      </div>
    </div>
  );
}
function AddressCard({
  title,
  value,
  onChange,
  onLookup,
  lookup,
}: {
  title: string;
  value: AddressFields;
  onChange: (f: keyof AddressFields, v: string) => void;
  onLookup: () => void;
  lookup: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-5">
      <h3 className="mb-4 font-bold">{title}</h3>
      <AddressFieldsGrid
        value={value}
        onChange={onChange}
        onLookup={onLookup}
      />
      {lookup}
    </div>
  );
}
function ReadOnlySummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm">
        {value}
      </div>
    </div>
  );
}
function Notice({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "amber" | "red";
}) {
  const c =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-blue-200 bg-blue-50 text-blue-900";
  return (
    <div className={`my-4 rounded-xl border p-4 text-sm font-semibold ${c}`}>
      {children}
    </div>
  );
}
function ActionButton({
  children,
  onClick,
  type = "button",
  busy,
  disabled,
  icon: Icon,
  dark,
  orange,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  busy: boolean;
  disabled: boolean;
  icon: typeof Save;
  dark?: boolean;
  orange?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50 ${dark ? "bg-slate-950 text-white" : orange ? "bg-[#FF6A00] text-white" : "border border-orange-300 bg-orange-50 text-[#E55300]"}`}
    >
      {busy ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Icon size={18} />
      )}{" "}
      {children}
    </button>
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
      className={`flex justify-between gap-4 text-sm ${strong ? "text-base font-bold" : "text-slate-600"}`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
function LoadingBox({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-white py-20 text-center">
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