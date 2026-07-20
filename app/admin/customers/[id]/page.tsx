"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

type TradeAccount = {
  id: string;
  status: string;
  creditLimit: string | number | null;
  currentBalance: string | number | null;
  paymentTermsDays: number;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  suspendedAt?: string | null;
  reactivatedAt?: string | null;
};

type Quote = {
  id: string;
  status: string;
  deliveryType: string;
  journeyType?: string | null;
  vehicleSize: string;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice?: string | number | null;
  createdAt: string;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: string | number;
  createdAt: string;
  vehicle?: {
    name: string;
    registration?: string | null;
  } | null;
  driver?: {
    name: string;
  } | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  provider: string;
  paymentMethod?: string;
  status: string;
  amount: string | number;
  currency: string;
  paidAt?: string | null;
  createdAt: string;
};

type SavedRoute = {
  id: string;
  name?: string | null;
  collectionAddress: string;
  deliveryAddress: string;
  vehicleSize?: string | null;
  createdAt: string;
};

type CustomerNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  fileUrl: string;
  createdAt: string;
};

type Customer = {
  id: string;
  accountNumber?: string | null;
  accountType: AccountType;
  accountStatus: AccountStatus;
  companyName?: string | null;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
  businessType?: string | null;
  industry?: string | null;
  companyWebsite?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  accountsEmail?: string | null;
  alternativeContactNumber?: string | null;
  mainContactName?: string | null;
  registeredAddressLine1?: string | null;
  registeredAddressLine2?: string | null;
  registeredTownCity?: string | null;
  registeredCounty?: string | null;
  registeredPostcode?: string | null;
  registeredCountry?: string | null;
  tradingAddressDifferent: boolean;
  tradingAddressLine1?: string | null;
  tradingAddressLine2?: string | null;
  tradingTownCity?: string | null;
  tradingCounty?: string | null;
  tradingPostcode?: string | null;
  tradingCountry?: string | null;
  estimatedShipmentsPerMonth?: string | null;
  typicalShipmentType?: string | null;
  internalNote?: string | null;
  adminCreated: boolean;
  createdAt: string;
  updatedAt: string;
  tradeAccount?: TradeAccount | null;
  quotes?: Quote[];
  bookings?: Booking[];
  invoices?: Invoice[];
  payments?: Payment[];
  savedRoutes?: SavedRoute[];
  notes?: CustomerNote[];
  documents?: DocumentRecord[];
  _count?: {
    quotes: number;
    bookings: number;
    invoices: number;
    payments: number;
    savedRoutes: number;
    notes: number;
    documents: number;
  };
};

type CustomerPayload = {
  customer?: Customer;
  error?: string;
};

type EditForm = {
  accountType: AccountType;
  accountStatus: AccountStatus;
  companyName: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  legalEntity: string;
  tradingName: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  businessType: string;
  industry: string;
  companyWebsite: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  accountsEmail: string;
  alternativeContactNumber: string;
  mainContactName: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredTownCity: string;
  registeredCounty: string;
  registeredPostcode: string;
  registeredCountry: string;
  tradingAddressDifferent: boolean;
  tradingAddressLine1: string;
  tradingAddressLine2: string;
  tradingTownCity: string;
  tradingCounty: string;
  tradingPostcode: string;
  tradingCountry: string;
  estimatedShipmentsPerMonth: string;
  typicalShipmentType: string;
  internalNote: string;
};

function money(value: string | number | null | undefined, currency = "GBP") {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value?: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();

  if (
    ["ACTIVE", "APPROVED", "PAID", "COMPLETED", "CONFIRMED"].includes(
      normalized,
    )
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (
    ["SUSPENDED", "FAILED", "CANCELLED", "OVERDUE", "REJECTED"].includes(
      normalized,
    )
  ) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (
    [
      "PENDING",
      "PENDING_PAYMENT",
      "UNDER_REVIEW",
      "ISSUED",
      "ASSIGNED",
    ].includes(normalized)
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function toEditForm(customer: Customer): EditForm {
  return {
    accountType: customer.accountType,
    accountStatus: customer.accountStatus,
    companyName: customer.companyName || "",
    name: customer.name || "",
    email: customer.email || "",
    username: customer.username || "",
    phone: customer.phone || "",
    legalEntity: customer.legalEntity || "",
    tradingName: customer.tradingName || "",
    companyRegistrationNumber: customer.companyRegistrationNumber || "",
    vatNumber: customer.vatNumber || "",
    businessType: customer.businessType || "",
    industry: customer.industry || "",
    companyWebsite: customer.companyWebsite || "",
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    jobTitle: customer.jobTitle || "",
    accountsEmail: customer.accountsEmail || "",
    alternativeContactNumber: customer.alternativeContactNumber || "",
    mainContactName: customer.mainContactName || "",
    registeredAddressLine1: customer.registeredAddressLine1 || "",
    registeredAddressLine2: customer.registeredAddressLine2 || "",
    registeredTownCity: customer.registeredTownCity || "",
    registeredCounty: customer.registeredCounty || "",
    registeredPostcode: customer.registeredPostcode || "",
    registeredCountry: customer.registeredCountry || "",
    tradingAddressDifferent: customer.tradingAddressDifferent,
    tradingAddressLine1: customer.tradingAddressLine1 || "",
    tradingAddressLine2: customer.tradingAddressLine2 || "",
    tradingTownCity: customer.tradingTownCity || "",
    tradingCounty: customer.tradingCounty || "",
    tradingPostcode: customer.tradingPostcode || "",
    tradingCountry: customer.tradingCountry || "",
    estimatedShipmentsPerMonth: customer.estimatedShipmentsPerMonth || "",
    typicalShipmentType: customer.typicalShipmentType || "",
    internalNote: customer.internalNote || "",
  };
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params?.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomer = useCallback(
    async (refresh = false) => {
      if (!customerId) return;

      const adminKey =
        window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

      if (!adminKey) {
        setLoading(false);
        setError(
          "Admin key is required. Unlock the admin area from Driver Management.",
        );
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/admin/customers/${customerId}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as CustomerPayload;

        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
          }

          throw new Error(payload.error || "Unable to load customer account.");
        }

        if (!payload.customer) {
          throw new Error("Customer account not found.");
        }

        setCustomer(payload.customer);
        setForm(toEditForm(payload.customer));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load customer account.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const displayName = useMemo(() => {
    if (!customer) return "Customer account";

    return (
      customer.companyName ||
      customer.legalEntity ||
      customer.tradingName ||
      customer.name
    );
  }, [customer]);

  function updateField<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !customerId) return;

    const adminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/customers/${customerId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify(form),
        },
      );

      const payload = (await response.json()) as CustomerPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update customer account.");
      }

      if (payload.customer) {
        setCustomer(payload.customer);
        setForm(toEditForm(payload.customer));
      }

      setEditing(false);
      setMessage("Customer account updated successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update customer account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: AccountStatus) {
    if (!form || !customerId) return;

    const reason =
      status === "ACTIVE"
        ? window.prompt("Optional reactivation note:", "") || ""
        : window.prompt(
            status === "SUSPENDED"
              ? "Enter the reason for suspending this account:"
              : "Enter the reason for marking this account inactive:",
            "",
          );

    const trimmedReason = reason?.trim() ?? "";

    if (status !== "ACTIVE" && trimmedReason.length < 5) {
      setError("A reason of at least five characters is required.");
      return;
    }

    const confirmed = window.confirm(
      status === "ACTIVE"
        ? "Reactivate this customer account?"
        : status === "SUSPENDED"
          ? "Suspend this account? The customer will be blocked from new quotes, bookings and checkout."
          : "Mark this account inactive?",
    );

    if (!confirmed) return;

    const adminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/customers/${customerId}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ status, reason: trimmedReason }),
        },
      );

      const payload = (await response.json()) as CustomerPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update account status.");
      }

      if (payload.customer) {
        setCustomer(payload.customer);
        setForm(toEditForm(payload.customer));
      }

      setMessage(
        status === "ACTIVE"
          ? "Customer account reactivated."
          : status === "SUSPENDED"
            ? "Customer account suspended."
            : "Customer account marked inactive.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update account status.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#FF6A00]" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Loading customer account
          </p>
        </div>
      </div>
    );
  }

  if (!customer || !form) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <CircleAlert className="mx-auto h-10 w-10 text-red-600" />
        <h1 className="mt-4 text-2xl font-bold text-red-950">
          Customer account unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-red-700">
          {error || "The requested customer could not be loaded."}
        </p>
        <Link
          href="/admin/customers"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-900 px-4 py-3 text-sm font-bold text-white"
        >
          <ArrowLeft size={17} />
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Customer accounts
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
              Customer profile
            </p>
            <Badge className={statusClass(customer.accountType)}>
              {customer.accountType}
            </Badge>
            <Badge className={statusClass(customer.accountStatus)}>
              {customer.accountStatus}
            </Badge>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {displayName}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {customer.accountNumber || "No account number"} · Created{" "}
            {date(customer.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadCustomer(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            {editing ? <X size={18} /> : <Pencil size={18} />}
            {editing ? "Close edit" : "Edit customer"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={19} />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} />
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Quotes"
          value={customer._count?.quotes ?? customer.quotes?.length ?? 0}
          icon={ReceiptText}
        />
        <Metric
          label="Bookings"
          value={customer._count?.bookings ?? customer.bookings?.length ?? 0}
          icon={CalendarDays}
        />
        <Metric
          label="Invoices"
          value={customer._count?.invoices ?? customer.invoices?.length ?? 0}
          icon={FileText}
        />
        <Metric
          label="Payments"
          value={customer._count?.payments ?? customer.payments?.length ?? 0}
          icon={WalletCards}
        />
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {editing ? (
            <form onSubmit={saveCustomer} className="space-y-6">
              <Section title="Account settings" icon={ShieldCheck}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <SelectField
                    label="Account type"
                    value={form.accountType}
                    onChange={(value) =>
                      updateField("accountType", value as AccountType)
                    }
                    options={["PRIVATE", "BUSINESS", "TRADE"]}
                  />
                  <SelectField
                    label="Account status"
                    value={form.accountStatus}
                    onChange={(value) =>
                      updateField("accountStatus", value as AccountStatus)
                    }
                    options={["ACTIVE", "SUSPENDED", "INACTIVE"]}
                  />
                  <Field
                    label="Customer name"
                    value={form.name}
                    onChange={(value) => updateField("name", value)}
                    required
                  />
                </div>
              </Section>

              <Section title="Customer and business details" icon={Building2}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Company name"
                    value={form.companyName}
                    onChange={(value) => updateField("companyName", value)}
                  />
                  <Field
                    label="Legal entity"
                    value={form.legalEntity}
                    onChange={(value) => updateField("legalEntity", value)}
                  />
                  <Field
                    label="Trading name"
                    value={form.tradingName}
                    onChange={(value) => updateField("tradingName", value)}
                  />
                  <Field
                    label="First name"
                    value={form.firstName}
                    onChange={(value) => updateField("firstName", value)}
                  />
                  <Field
                    label="Last name"
                    value={form.lastName}
                    onChange={(value) => updateField("lastName", value)}
                  />
                  <Field
                    label="Main contact"
                    value={form.mainContactName}
                    onChange={(value) => updateField("mainContactName", value)}
                  />
                  <Field
                    label="Job title"
                    value={form.jobTitle}
                    onChange={(value) => updateField("jobTitle", value)}
                  />
                  <Field
                    label="Companies House number"
                    value={form.companyRegistrationNumber}
                    onChange={(value) =>
                      updateField("companyRegistrationNumber", value)
                    }
                  />
                  <Field
                    label="VAT number"
                    value={form.vatNumber}
                    onChange={(value) => updateField("vatNumber", value)}
                  />
                  <Field
                    label="Business type"
                    value={form.businessType}
                    onChange={(value) => updateField("businessType", value)}
                  />
                  <Field
                    label="Industry"
                    value={form.industry}
                    onChange={(value) => updateField("industry", value)}
                  />
                  <Field
                    label="Company website"
                    value={form.companyWebsite}
                    onChange={(value) => updateField("companyWebsite", value)}
                  />
                </div>
              </Section>

              <Section title="Contact details" icon={UserRound}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) => updateField("email", value)}
                    required
                  />
                  <Field
                    label="Accounts email"
                    type="email"
                    value={form.accountsEmail}
                    onChange={(value) => updateField("accountsEmail", value)}
                  />
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={(value) => updateField("phone", value)}
                  />
                  <Field
                    label="Alternative phone"
                    value={form.alternativeContactNumber}
                    onChange={(value) =>
                      updateField("alternativeContactNumber", value)
                    }
                  />
                  <Field
                    label="Username"
                    value={form.username}
                    onChange={(value) => updateField("username", value)}
                  />
                </div>
              </Section>

              <Section title="Registered address" icon={MapPin}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Address line 1"
                    value={form.registeredAddressLine1}
                    onChange={(value) =>
                      updateField("registeredAddressLine1", value)
                    }
                  />
                  <Field
                    label="Address line 2"
                    value={form.registeredAddressLine2}
                    onChange={(value) =>
                      updateField("registeredAddressLine2", value)
                    }
                  />
                  <Field
                    label="Town / City"
                    value={form.registeredTownCity}
                    onChange={(value) =>
                      updateField("registeredTownCity", value)
                    }
                  />
                  <Field
                    label="County"
                    value={form.registeredCounty}
                    onChange={(value) => updateField("registeredCounty", value)}
                  />
                  <Field
                    label="Postcode"
                    value={form.registeredPostcode}
                    onChange={(value) =>
                      updateField("registeredPostcode", value)
                    }
                  />
                  <Field
                    label="Country"
                    value={form.registeredCountry}
                    onChange={(value) =>
                      updateField("registeredCountry", value)
                    }
                  />
                </div>
              </Section>

              <Section title="Trading address" icon={MapPin}>
                <label className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={form.tradingAddressDifferent}
                    onChange={(event) =>
                      updateField(
                        "tradingAddressDifferent",
                        event.target.checked,
                      )
                    }
                  />
                  <span className="font-semibold text-slate-700">
                    Trading address is different
                  </span>
                </label>

                {form.tradingAddressDifferent ? (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <Field
                      label="Address line 1"
                      value={form.tradingAddressLine1}
                      onChange={(value) =>
                        updateField("tradingAddressLine1", value)
                      }
                    />
                    <Field
                      label="Address line 2"
                      value={form.tradingAddressLine2}
                      onChange={(value) =>
                        updateField("tradingAddressLine2", value)
                      }
                    />
                    <Field
                      label="Town / City"
                      value={form.tradingTownCity}
                      onChange={(value) =>
                        updateField("tradingTownCity", value)
                      }
                    />
                    <Field
                      label="County"
                      value={form.tradingCounty}
                      onChange={(value) => updateField("tradingCounty", value)}
                    />
                    <Field
                      label="Postcode"
                      value={form.tradingPostcode}
                      onChange={(value) =>
                        updateField("tradingPostcode", value)
                      }
                    />
                    <Field
                      label="Country"
                      value={form.tradingCountry}
                      onChange={(value) => updateField("tradingCountry", value)}
                    />
                  </div>
                ) : null}
              </Section>

              <Section title="Operational details" icon={Truck}>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Estimated shipments per month"
                    value={form.estimatedShipmentsPerMonth}
                    onChange={(value) =>
                      updateField("estimatedShipmentsPerMonth", value)
                    }
                  />
                  <Field
                    label="Typical shipment type"
                    value={form.typicalShipmentType}
                    onChange={(value) =>
                      updateField("typicalShipmentType", value)
                    }
                  />
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Internal office note
                  </span>
                  <textarea
                    rows={5}
                    value={form.internalNote}
                    onChange={(event) =>
                      updateField("internalNote", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                  />
                </label>
              </Section>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Save customer changes
                </button>
              </div>
            </form>
          ) : (
            <>
              <Section title="Account overview" icon={UserRound}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Customer name" value={customer.name} />
                  <Info
                    label="Business name"
                    value={
                      customer.companyName ||
                      customer.legalEntity ||
                      "Not provided"
                    }
                  />
                  <Info
                    label="Main contact"
                    value={customer.mainContactName || customer.name}
                  />
                  <Info label="Email" value={customer.email} />
                  <Info
                    label="Accounts email"
                    value={customer.accountsEmail || "Not provided"}
                  />
                  <Info
                    label="Phone"
                    value={customer.phone || "Not provided"}
                  />
                  <Info
                    label="VAT number"
                    value={customer.vatNumber || "Not provided"}
                  />
                  <Info
                    label="Companies House number"
                    value={customer.companyRegistrationNumber || "Not provided"}
                  />
                  <Info label="Last updated" value={date(customer.updatedAt)} />
                </div>
              </Section>

              <Section title="Addresses" icon={MapPin}>
                <div className="grid gap-5 md:grid-cols-2">
                  <AddressCard
                    title="Registered address"
                    lines={[
                      customer.registeredAddressLine1,
                      customer.registeredAddressLine2,
                      customer.registeredTownCity,
                      customer.registeredCounty,
                      customer.registeredPostcode,
                      customer.registeredCountry,
                    ]}
                  />
                  <AddressCard
                    title="Trading address"
                    lines={
                      customer.tradingAddressDifferent
                        ? [
                            customer.tradingAddressLine1,
                            customer.tradingAddressLine2,
                            customer.tradingTownCity,
                            customer.tradingCounty,
                            customer.tradingPostcode,
                            customer.tradingCountry,
                          ]
                        : ["Same as registered address"]
                    }
                  />
                </div>
              </Section>

              <HistorySection
                title="Recent quotes"
                href={`/admin/customers/${customer.id}/quotes`}
                icon={ReceiptText}
                empty="No quotes linked to this customer."
              >
                {(customer.quotes || []).slice(0, 5).map((quote) => (
                  <HistoryRow
                    key={quote.id}
                    title={`${quote.deliveryType} · ${quote.vehicleSize}`}
                    subtitle={`${quote.collectionAddress} → ${quote.deliveryAddress}`}
                    meta={`${date(quote.collectionDate)} · ${money(quote.totalPrice)}`}
                    status={quote.status}
                  />
                ))}
              </HistorySection>

              <HistorySection
                title="Recent bookings"
                href={`/admin/customers/${customer.id}/bookings`}
                icon={CalendarDays}
                empty="No bookings linked to this customer."
              >
                {(customer.bookings || []).slice(0, 5).map((booking) => (
                  <HistoryRow
                    key={booking.id}
                    title={booking.reference}
                    subtitle={`${booking.collectionAddress} → ${booking.deliveryAddress}`}
                    meta={`${date(booking.collectionDate)} · ${money(booking.totalPrice)}`}
                    status={booking.status}
                  />
                ))}
              </HistorySection>

              <HistorySection
                title="Recent invoices"
                href={`/admin/customers/${customer.id}/invoices`}
                icon={FileText}
                empty="No invoices linked to this customer."
              >
                {(customer.invoices || []).slice(0, 5).map((invoice) => (
                  <HistoryRow
                    key={invoice.id}
                    title={invoice.invoiceNumber}
                    subtitle={`Created ${date(invoice.createdAt)}${invoice.dueDate ? ` · Due ${date(invoice.dueDate)}` : ""}`}
                    meta={money(invoice.total)}
                    status={invoice.status}
                  />
                ))}
              </HistorySection>

              <HistorySection
                title="Recent payments"
                href={`/admin/customers/${customer.id}/payments`}
                icon={CreditCard}
                empty="No payments linked to this customer."
              >
                {(customer.payments || []).slice(0, 5).map((payment) => (
                  <HistoryRow
                    key={payment.id}
                    title={`${payment.provider} · ${payment.paymentMethod || "Payment"}`}
                    subtitle={
                      payment.paidAt
                        ? `Paid ${date(payment.paidAt)}`
                        : `Created ${date(payment.createdAt)}`
                    }
                    meta={money(payment.amount, payment.currency)}
                    status={payment.status}
                  />
                ))}
              </HistorySection>
            </>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Quick actions</h2>
            <div className="mt-4 space-y-3">
              {customer.accountStatus === "ACTIVE" ? (
                <QuickLink
                  href={`/admin/customers/${customer.id}/quotes`}
                  label="Create quote"
                  icon={ReceiptText}
                />
              ) : null}
              {customer.accountStatus === "ACTIVE" ? (
                <QuickLink
                  href="/admin/planning-board"
                  label="Create booking"
                  icon={ClipboardList}
                />
              ) : null}
              <QuickLink
                href={`/admin/customers/${customer.id}/invoices`}
                label="View invoices"
                icon={FileText}
              />
              <QuickLink
                href={`/admin/customers/${customer.id}/payments`}
                label="View payments"
                icon={WalletCards}
              />
            </div>
          </section>

          {customer.tradeAccount ? (
            <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-700 text-white">
                  <CircleDollarSign size={21} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
                    Trade account
                  </p>
                  <h2 className="text-lg font-bold text-violet-950">
                    Credit control
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <Info label="Status" value={customer.tradeAccount.status} />
                <Info
                  label="Credit limit"
                  value={money(customer.tradeAccount.creditLimit)}
                />
                <Info
                  label="Current balance"
                  value={money(customer.tradeAccount.currentBalance)}
                />
                <Info
                  label="Payment terms"
                  value={`${customer.tradeAccount.paymentTermsDays} days`}
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Account control
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Change customer availability without deleting their history.
            </p>

            <div className="mt-5 space-y-3">
              {customer.accountStatus !== "ACTIVE" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void changeStatus("ACTIVE")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 size={18} />
                  Reactivate account
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void changeStatus("SUSPENDED")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Ban size={18} />
                  Suspend account
                </button>
              )}

              {customer.accountStatus !== "INACTIVE" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void changeStatus("INACTIVE")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Mark inactive
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Saved routes</h2>
            <div className="mt-4 space-y-3">
              {(customer.savedRoutes || []).slice(0, 5).map((route) => (
                <div
                  key={route.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <p className="font-bold text-slate-900">
                    {route.name || "Saved route"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {route.collectionAddress} → {route.deliveryAddress}
                  </p>
                </div>
              ))}
              {(customer.savedRoutes || []).length === 0 ? (
                <p className="text-sm text-slate-500">No saved routes.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Documents</h2>
            <div className="mt-4 space-y-3">
              {(customer.documents || []).slice(0, 5).map((document) => (
                <a
                  key={document.id}
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                >
                  <span className="truncate">{document.name}</span>
                  <ArrowRight size={16} />
                </a>
              ))}
              {(customer.documents || []).length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Internal notes</h2>
            <div className="mt-4 space-y-3">
              {customer.internalNote ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {customer.internalNote}
                </div>
              ) : null}
              {(customer.notes || []).slice(0, 5).map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <p className="text-sm leading-6 text-slate-700">
                    {note.body}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {date(note.createdAt)}
                  </p>
                </div>
              ))}
              {!customer.internalNote && (customer.notes || []).length === 0 ? (
                <p className="text-sm text-slate-500">No internal notes.</p>
              ) : null}
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
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ReceiptText;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function AddressCard({
  title,
  lines,
}: {
  title: string;
  lines: Array<string | null | undefined>;
}) {
  const visibleLines = lines.filter(Boolean);

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
        {visibleLines.length > 0 ? (
          visibleLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))
        ) : (
          <p>Not provided</p>
        )}
      </div>
    </div>
  );
}

function HistorySection({
  title,
  href,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  href: string;
  icon: typeof ReceiptText;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
            <Icon size={21} />
          </span>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#E55300] hover:text-[#C94A00]"
        >
          View all
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {hasChildren ? (
          children
        ) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </section>
  );
}

function HistoryRow({
  title,
  subtitle,
  meta,
  status,
}: {
  title: string;
  subtitle: string;
  meta: string;
  status: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-slate-950">{title}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">{meta}</span>
        <Badge className={statusClass(status)}>{status}</Badge>
      </div>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof ReceiptText;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#E55300]"
    >
      <span className="flex items-center gap-3">
        <Icon size={17} />
        {label}
      </span>
      <ArrowRight size={16} />
    </Link>
  );
}
