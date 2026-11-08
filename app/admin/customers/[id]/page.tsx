"use client";
import {adminFetch} from "@/lib/adminFetch";

import Link from "next/link";
import CustomerCompletedJobs from "@/components/admin/CustomerCompletedJobs";
import { invoiceDisplayStatus } from "@/lib/billingPolicy";
import PostcodeAddressLookup from "@/components/PostcodeAddressLookup";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";



type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

type Invoice = {
  invoiceType?: string;
  consolidatedMonth?: string;
  billingAccountType?: string | null;
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  dueDate?: string | null;
  issuedAt?: string | null;
  finalisedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

type BillingPaymentMode = "PAY_NOW" | "PAY_LATER";
type BillingInvoiceMode = "PER_BOOKING" | "CONSOLIDATED";
type BillingFrequency = "PER_BOOKING" | "WEEKLY" | "MONTHLY";

type BillingProfile = {
  id: string;
  paymentMode: BillingPaymentMode;
  invoiceMode: BillingInvoiceMode;
  billingFrequency: BillingFrequency;
  invoiceDayOfWeek?: number | null;
  invoiceDayOfMonth?: number | null;
  paymentTermsDays: number;
  accountsEmail?: string | null;
  poRequired: boolean;
  creditLimit?: string | number | null;
  creditFacilityOnHold: boolean;
  holdReason?: string | null;
};

type Customer = {
  id: string;
  accountNumber?: string | null;
  commercialTariffAssignment?: { tariffId?: string; tariff: { name: string } } | null;
  accountType: AccountType;
  accountStatus: AccountStatus;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  accountsEmail?: string | null;
  alternativeContactNumber?: string | null;
  mainContactName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
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
  billingProfile?: BillingProfile | null;
  invoices?: Invoice[];
  createdAt: string;
  updatedAt: string;
};

type CustomerPayload = {
  success?: boolean;
  customer?: Customer;
  error?: string;
  message?: string;
};

type EditForm = {
  commercialTariffId: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
  companyName: string;
  name: string;
  email: string;
  accountsEmail: string;
  phone: string;
  alternativeContactNumber: string;
  mainContactName: string;
  companyRegistrationNumber: string;
  vatNumber: string;
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
  billingPaymentMode: BillingPaymentMode;
  billingInvoiceMode: BillingInvoiceMode;
  billingFrequency: BillingFrequency;
  invoiceDayOfWeek: string;
  invoiceDayOfMonth: string;
  paymentTermsDays: string;
  billingAccountsEmail: string;
  poRequired: boolean;
  creditLimit: string;
  creditFacilityOnHold: boolean;
  holdReason: string;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function displayAccountType(type: AccountType) {
  if (type === "TRADE") {
    return "Trade Credit Account";
  }

  if (type === "BUSINESS") {
    return "Business Account";
  }

  return "Private Account";
}

function displayAccountStatus(status: AccountStatus) {
  if (status === "ACTIVE") {
    return "Live";
  }

  if (status === "INACTIVE") {
    return "Blocked";
  }

  return "Suspended";
}

function statusClasses(status: AccountStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "SUSPENDED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function invoiceStatusClasses(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "OVERDUE") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function customerDisplayName(customer: Customer) {
  return (
    customer.companyName ||
    customer.legalEntity ||
    customer.tradingName ||
    customer.name
  );
}

function toEditForm(customer: Customer): EditForm {
  return {
    commercialTariffId: customer.commercialTariffAssignment?.tariffId ?? "",
    accountType: customer.accountType,
    accountStatus: customer.accountStatus,
    companyName:
      customer.companyName ||
      customer.legalEntity ||
      customer.name ||
      "",
    name: customer.name || "",
    email: customer.email || "",
    accountsEmail: customer.accountsEmail || "",
    phone: customer.phone || "",
    alternativeContactNumber:
      customer.alternativeContactNumber || "",
    mainContactName: customer.mainContactName || "",
    companyRegistrationNumber:
      customer.companyRegistrationNumber || "",
    vatNumber: customer.vatNumber || "",
    registeredAddressLine1:
      customer.registeredAddressLine1 || "",
    registeredAddressLine2:
      customer.registeredAddressLine2 || "",
    registeredTownCity:
      customer.registeredTownCity || "",
    registeredCounty:
      customer.registeredCounty || "",
    registeredPostcode:
      customer.registeredPostcode || "",
    registeredCountry:
      customer.registeredCountry || "United Kingdom",
    tradingAddressDifferent:
      customer.tradingAddressDifferent,
    tradingAddressLine1:
      customer.tradingAddressLine1 || "",
    tradingAddressLine2:
      customer.tradingAddressLine2 || "",
    tradingTownCity:
      customer.tradingTownCity || "",
    tradingCounty:
      customer.tradingCounty || "",
    tradingPostcode:
      customer.tradingPostcode || "",
    tradingCountry:
      customer.tradingCountry || "United Kingdom",
    billingPaymentMode:
      customer.billingProfile?.paymentMode ||
      (customer.accountType === "TRADE" ? "PAY_LATER" : "PAY_NOW"),
    billingInvoiceMode: "PER_BOOKING",
    billingFrequency:
      customer.billingProfile?.billingFrequency || "PER_BOOKING",
    invoiceDayOfWeek:
      customer.billingProfile?.invoiceDayOfWeek?.toString() || "1",
    invoiceDayOfMonth:
      customer.billingProfile?.invoiceDayOfMonth?.toString() || "1",
    paymentTermsDays:
      customer.accountType === "TRADE" ? "14" : "0",
    billingAccountsEmail:
      customer.billingProfile?.accountsEmail || customer.accountsEmail || "",
    poRequired: customer.billingProfile?.poRequired || false,
    creditLimit:
      customer.billingProfile?.creditLimit !== null &&
      customer.billingProfile?.creditLimit !== undefined
        ? String(customer.billingProfile.creditLimit)
        : customer.accountType === "TRADE"
          ? "2500"
          : "",
    creditFacilityOnHold:
      customer.billingProfile?.creditFacilityOnHold || false,
    holdReason: customer.billingProfile?.holdReason || "",
  };
}

export default function CustomerAccountPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;

  const [invitationBusy,setInvitationBusy]=useState(false);
  const [invitationResult,setInvitationResult]=useState("");
  useEffect(()=>{const status=new URLSearchParams(window.location.search).get("passwordInvitation");if(status)setInvitationResult(status==="sent"?"Password setup link emailed to the customer.":"Customer created, but the password setup email was not sent. Use Send password setup link to retry.");},[]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountAction, setAccountAction] = useState<
    "SUSPEND" | "LIVE" | "DELETE" | null
  >(null);
  const [editing, setEditing] = useState(false);
  const [tariffOptions, setTariffOptions] = useState<{ id: string; name: string }[] | null>(null);
  const [tariffOptionsError, setTariffOptionsError] = useState("");
  const [tariffOptionsAttempt, setTariffOptionsAttempt] = useState(0);

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();

    async function loadTariffs() {
      try {
        const response = await adminFetch("/api/admin/commercial-tariffs/options", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.tariffs)) throw new Error("Unable to load commercial tariffs.");
        if (!controller.signal.aborted) setTariffOptions(data.tariffs);
      } catch {
        if (!controller.signal.aborted) setTariffOptionsError("Unable to load commercial tariffs.");
      }
    }

    void loadTariffs();
    return () => controller.abort();
  }, [customerId, editing, tariffOptionsAttempt]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomer = useCallback(
    async (refresh = false) => {
      if (!customerId) {
        return;
      }

      const adminKey =
        String("session")
          ?.trim() || "";

      if (!adminKey) {
        setLoading(false);
        setError("Your admin session has expired. Sign in again.");
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await adminFetch(
          `${API_BASE}/api/admin/customers/${customerId}`,
          {
            headers: {},
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as CustomerPayload;

        if (!response.ok || !payload.customer) {
          if (response.status === 401) {
            undefined;
          }

          throw new Error(
            payload.error ||
              payload.message ||
              "Unable to load customer account.",
          );
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

  const pendingInvoices = useMemo(() => {
    if (!customer?.invoices) {
      return [];
    }

    return customer.invoices.filter((invoice) =>
      ["DRAFT", "PENDING"].includes(
        invoice.status.toUpperCase(),
      ),
    );
  }, [customer]);

  const finalisedIssuedInvoices = useMemo(() => {
    if (!customer?.invoices) {
      return [];
    }

    return customer.invoices.filter((invoice) =>
      ["FINALISED", "SENT", "ISSUED", "OVERDUE", "PARTIALLY_PAID"].includes(
        invoice.status.toUpperCase(),
      ),
    );
  }, [customer]);

  const paidClearedInvoices = useMemo(() => {
    if (!customer?.invoices) {
      return [];
    }

    return customer.invoices.filter(
      (invoice) => invoice.status.toUpperCase() === "PAID",
    );
  }, [customer]);

  function update<K extends keyof EditForm>(
    field: K,
    value: EditForm[K],
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function saveCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!customerId || !form) {
      return;
    }

    const adminKey =
      String("session")
        ?.trim() || "";

    if (!adminKey) {
      setError("Your admin session has expired. Sign in again.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await adminFetch(
        `${API_BASE}/api/admin/customers/${customerId}`,
        {
          method: "PATCH",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            ...form,
            commercialTariffId: form.commercialTariffId !== (customer?.commercialTariffAssignment?.tariffId ?? "")
              ? form.commercialTariffId || null
              : undefined,
            companyName: form.companyName,
            legalEntity: form.companyName,
            tradingName: form.companyName,
            accountsEmail: form.accountsEmail,
            alternativeContactNumber:
              form.alternativeContactNumber,
            mainContactName: form.mainContactName,
          }),
        },
      );

      const payload =
        (await response.json()) as CustomerPayload;

      if (!response.ok || !payload.customer) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Unable to update customer account.",
        );
      }

      // Account settings edits do not change invoices. Preserve the invoices
      // already loaded on this page because the PATCH response may not include
      // the invoice relation. This keeps Pending Invoices visible immediately
      // after saving without requiring a manual refresh.
      const updatedCustomer: Customer = {
        ...payload.customer,
        invoices: customer?.invoices ?? payload.customer.invoices ?? [],
      };

      setCustomer(updatedCustomer);
      setForm(toEditForm(updatedCustomer));
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

  async function suspendAccount() {
    if (!customerId || !customer || customer.accountStatus === "SUSPENDED") {
      return;
    }

    const reason = window.prompt(
      "Enter the reason for suspending this account:",
    );

    if (reason === null) {
      return;
    }

    const cleanReason = reason.trim();

    if (cleanReason.length < 5) {
      setError("Enter a suspension reason of at least five characters.");
      return;
    }

    const adminKey =
      String("session")
        ?.trim() || "";

    if (!adminKey) {
      setError("Your admin session has expired. Sign in again.");
      return;
    }

    setAccountAction("SUSPEND");
    setError("");
    setMessage("");

    try {
      const response = await adminFetch(
        `${API_BASE}/api/admin/customers/${customerId}/status`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            status: "SUSPENDED",
            reason: cleanReason,
          }),
        },
      );

      const payload =
        (await response.json()) as CustomerPayload;

      if (!response.ok || !payload.customer) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Unable to suspend customer account.",
        );
      }

      setCustomer(payload.customer);
      setForm(toEditForm(payload.customer));
      setMessage("Customer account suspended successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to suspend customer account.",
      );
    } finally {
      setAccountAction(null);
    }
  }

  async function makeAccountLive() {
    if (!customerId || !customer || customer.accountStatus === "ACTIVE") {
      return;
    }

    const adminKey =
      String("session")
        ?.trim() || "";

    if (!adminKey) {
      setError("Your admin session has expired. Sign in again.");
      return;
    }

    setAccountAction("LIVE");
    setError("");
    setMessage("");

    try {
      const response = await adminFetch(
        `${API_BASE}/api/admin/customers/${customerId}/status`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            status: "ACTIVE",
          }),
        },
      );

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as CustomerPayload)
        : ({
            error: `Unable to make customer account live. Server returned ${response.status}.`,
          } as CustomerPayload);

      if (!response.ok || !payload.customer) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Unable to make customer account live.",
        );
      }

      setCustomer(payload.customer);
      setForm(toEditForm(payload.customer));
      setMessage("Customer account is now live.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to make customer account live.",
      );
    } finally {
      setAccountAction(null);
    }
  }

  async function deleteAccount() {
    if (!customerId || !customer) {
      return;
    }

    const firstConfirmation = window.confirm(
      `Delete ${customerDisplayName(customer)}? This removes the live customer account and keeps its historical records in an isolated archive for five years. A new account with the same email starts fresh.`,
    );

    if (!firstConfirmation) {
      return;
    }

    const finalConfirmation = window.confirm(
      "This action cannot be undone. Delete this customer account?",
    );

    if (!finalConfirmation) {
      return;
    }

    const adminKey =
      String("session")
        ?.trim() || "";

    if (!adminKey) {
      setError("Your admin session has expired. Sign in again.");
      return;
    }

    setAccountAction("DELETE");
    setError("");
    setMessage("");

    try {
      const response = await adminFetch(
        `${API_BASE}/api/admin/customers/${customerId}`,
        {
          method: "DELETE",
          headers: {},
        },
      );

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as CustomerPayload)
        : ({
            error: `Unable to delete customer account. Server returned ${response.status}.`,
          } as CustomerPayload);

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Unable to delete customer account.",
        );
      }

      router.push("/admin/customers");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete customer account.",
      );
      setAccountAction(null);
    }
  }

    async function sendPasswordSetupLink(){
    if(!customer)return;const adminKey=String("session")?.trim()||"";setInvitationBusy(true);setInvitationResult("");
    try{const response=await adminFetch(`${API_BASE}/api/admin/customers/${customer.id}/password-invitation`,{method:"POST",headers:{}});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to send password setup link.");setInvitationResult("Password setup link emailed to the customer's account email.");}catch(error){setInvitationResult(error instanceof Error?error.message:"Unable to send password setup link.");}finally{setInvitationBusy(false);}
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
      <div className="mx-auto max-w-xl border border-red-200 bg-red-50 p-8 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-red-600" />
        <h1 className="mt-4 text-2xl font-bold text-red-950">
          Customer account unavailable
        </h1>
        <p className="mt-3 text-sm text-red-700">
          {error ||
            "The requested customer account could not be loaded."}
        </p>
        <Link
          href="/admin/customers"
          className="mt-6 inline-flex items-center gap-2 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
        >
          <ArrowLeft size={17} />
          Existing Customers
        </Link>
      </div>
    );
  }

  const commercialTariffName = customer.commercialTariffAssignment?.tariff.name ?? "Standard Pricing / Tariff";

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Existing Customers
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-950">
            {customerDisplayName(customer)}
          </h1>

          {customer.accountNumber ? (
            <p className="mt-2 text-sm text-slate-500">
              {customer.accountNumber}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={invitationBusy} onClick={sendPasswordSetupLink} className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold disabled:opacity-50">{invitationBusy?"Sending…":"Send password setup link"}</button>
          <button
            type="button"
            onClick={() => void loadCustomer(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              update("commercialTariffId", customer.commercialTariffAssignment?.tariffId ?? "");
              setTariffOptions(null);
              setTariffOptionsError("");
              setEditing((current) => !current);
              setError("");
              setMessage("");
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            {editing ? <X size={17} /> : <Pencil size={17} />}
            {editing ? "Cancel Edit" : "Edit Account"}
          </button>
        </div>
      </div>

      {invitationResult && <p role="status" className="mb-5 rounded border border-blue-200 bg-blue-50 p-4">{invitationResult}</p>}
      {message ? (
        <div className="mt-6 flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 flex items-center gap-3 border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <CustomerCompletedJobs key={customer.id} customerId={customer.id} apiBase={API_BASE} />

      {editing ? (
        <form
          onSubmit={saveCustomer}
          className="mt-7 border border-slate-300 bg-white"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
            <EditRow label="Account/business name">
              <TextInput
                value={form.companyName}
                onChange={(value) => update("companyName", value)}
              />
            </EditRow>

            <EditRow label="Account Status">
              <select
                value={form.accountStatus}
                onChange={(event) =>
                  update(
                    "accountStatus",
                    event.target.value as AccountStatus,
                  )
                }
                className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
              >
                <option value="ACTIVE">Live</option>
                <option value="INACTIVE">Blocked</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </EditRow>

            <EditRow label="Account Type">
              <select
                value={form.accountType}
                onChange={(event) =>
                  update(
                    "accountType",
                    event.target.value as AccountType,
                  )
                }
                className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
              >
                <option value="BUSINESS">Business Account</option>
                <option value="TRADE">Trade Credit Account</option>
                {form.accountType === "PRIVATE" ? (
                  <option value="PRIVATE">Private Account</option>
                ) : null}
              </select>
            </EditRow>

            <EditRow label="Commercial Tariff">
              {tariffOptions ? (
                <select
                  aria-label="Commercial tariff"
                  value={form.commercialTariffId}
                  onChange={(event) => update("commercialTariffId", event.target.value)}
                  disabled={saving}
                  className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
                >
                  <option value="">Standard Pricing / Tariff</option>
                  {tariffOptions.map((tariff) => (
                    <option key={tariff.id} value={tariff.id}>{tariff.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-700">
                  {commercialTariffName} · {tariffOptionsError ? (
                    <>
                      {tariffOptionsError}{" "}
                      <button type="button" className="font-semibold underline" onClick={() => {
                        setTariffOptionsError("");
                        setTariffOptionsAttempt((attempt) => attempt + 1);
                      }}>Retry</button>
                    </>
                  ) : "Loading tariffs…"}
                </p>
              )}
            </EditRow>

            <EditRow label="VAT No">
              <TextInput
                value={form.vatNumber}
                onChange={(value) => update("vatNumber", value)}
              />
            </EditRow>

            <EditRow label="Companies House Number">
              <TextInput
                value={form.companyRegistrationNumber}
                onChange={(value) =>
                  update("companyRegistrationNumber", value)
                }
              />
            </EditRow>

            <EditRow label="Registered Office Address">
              <AddressInputs
                line1={form.registeredAddressLine1}
                line2={form.registeredAddressLine2}
                townCity={form.registeredTownCity}
                county={form.registeredCounty}
                postcode={form.registeredPostcode}
                country={form.registeredCountry}
                onLine1={(value) => update("registeredAddressLine1", value)}
                onLine2={(value) => update("registeredAddressLine2", value)}
                onTownCity={(value) => update("registeredTownCity", value)}
                onCounty={(value) => update("registeredCounty", value)}
                onPostcode={(value) => update("registeredPostcode", value)}
                onCountry={(value) => update("registeredCountry", value)}
              />
            </EditRow>

            <EditRow label="Trading Address if different">
              <div>
                <label className="mb-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.tradingAddressDifferent}
                    onChange={(event) =>
                      update(
                        "tradingAddressDifferent",
                        event.target.checked,
                      )
                    }
                  />
                  Trading address is different
                </label>

                {form.tradingAddressDifferent ? (
                  <AddressInputs
                    line1={form.tradingAddressLine1}
                    line2={form.tradingAddressLine2}
                    townCity={form.tradingTownCity}
                    county={form.tradingCounty}
                    postcode={form.tradingPostcode}
                    country={form.tradingCountry}
                    onLine1={(value) => update("tradingAddressLine1", value)}
                    onLine2={(value) => update("tradingAddressLine2", value)}
                    onTownCity={(value) => update("tradingTownCity", value)}
                    onCounty={(value) => update("tradingCounty", value)}
                    onPostcode={(value) => update("tradingPostcode", value)}
                    onCountry={(value) => update("tradingCountry", value)}
                  />
                ) : (
                  <p className="text-sm text-slate-500">
                    Same as Registered Office Address
                  </p>
                )}
              </div>
            </EditRow>

            <EditRow label="Email">
              <TextInput
                type="email"
                value={form.email}
                onChange={(value) => update("email", value)}
              />
            </EditRow>

            <EditRow label="Accounts Email">
              <TextInput
                type="email"
                value={form.accountsEmail}
                onChange={(value) => update("accountsEmail", value)}
              />
            </EditRow>

            <EditRow label="Billing Payment Mode">
              <select
                value={form.billingPaymentMode}
                onChange={(event) =>
                  update(
                    "billingPaymentMode",
                    event.target.value as BillingPaymentMode,
                  )
                }
                className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
              >
                <option value="PAY_NOW">Pay Now</option>
                <option value="PAY_LATER">Pay Later / Trade Credit</option>
              </select>
            </EditRow>

            <EditRow label="Invoice Mode">
              <select
                value={form.billingInvoiceMode}
                onChange={(event) =>
                  update(
                    "billingInvoiceMode",
                    event.target.value as BillingInvoiceMode,
                  )
                }
                className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
              >
                <option value="PER_BOOKING">Invoice Per Booking</option>
              </select>
            </EditRow>

            <EditRow label="Billing Frequency">
              <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                <select
                  value={form.billingFrequency}
                  onChange={(event) =>
                    update(
                      "billingFrequency",
                      event.target.value as BillingFrequency,
                    )
                  }
                  className="border border-slate-300 px-3 py-3 text-sm"
                >
                  <option value="PER_BOOKING">Per Booking</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>

                {form.billingFrequency === "WEEKLY" ? (
                  <select
                    value={form.invoiceDayOfWeek}
                    onChange={(event) =>
                      update("invoiceDayOfWeek", event.target.value)
                    }
                    className="border border-slate-300 px-3 py-3 text-sm"
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="7">Sunday</option>
                  </select>
                ) : null}

                {form.billingFrequency === "MONTHLY" ? (
                  <select
                    value={form.invoiceDayOfMonth}
                    onChange={(event) =>
                      update("invoiceDayOfMonth", event.target.value)
                    }
                    className="border border-slate-300 px-3 py-3 text-sm"
                  >
                    {Array.from({ length: 28 }, (_, index) => index + 1).map(
                      (day) => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ),
                    )}
                  </select>
                ) : null}
              </div>
            </EditRow>

            <EditRow label="Payment Terms"><p className="py-3 font-semibold">{form.accountType === "TRADE" ? "Monthly: issued on the 1st, payable by the 15th" : form.accountType === "BUSINESS" ? "Due immediately" : `${form.paymentTermsDays} days`}</p></EditRow>

            <EditRow label="Billing Accounts Email">
              <TextInput
                type="email"
                value={form.billingAccountsEmail}
                onChange={(value) => update("billingAccountsEmail", value)}
              />
            </EditRow>

            <EditRow label="PO Required">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.poRequired}
                  onChange={(event) =>
                    update("poRequired", event.target.checked)
                  }
                />
                Require a PO / order reference before pay-later bookings
              </label>
            </EditRow>

            <EditRow label="Credit Limit">
              <div className="max-w-xl">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.creditLimit}
                  onChange={(event) =>
                    update("creditLimit", event.target.value)
                  }
                  className="w-full border border-slate-300 px-3 py-3 text-sm"
                  placeholder="2500.00"
                />
              </div>
            </EditRow>

            <EditRow label="Credit Facility">
              <div className="max-w-xl space-y-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.creditFacilityOnHold}
                    onChange={(event) =>
                      update("creditFacilityOnHold", event.target.checked)
                    }
                  />
                  Put credit facility on hold
                </label>

                {form.creditFacilityOnHold ? (
                  <textarea
                    value={form.holdReason}
                    onChange={(event) =>
                      update("holdReason", event.target.value)
                    }
                    placeholder="Reason for credit hold"
                    className="min-h-24 w-full border border-slate-300 px-3 py-3 text-sm"
                  />
                ) : null}
              </div>
            </EditRow>

            <EditRow label="Contact Number 1">
              <TextInput
                value={form.phone}
                onChange={(value) => update("phone", value)}
              />
            </EditRow>

            <EditRow label="Contact Number 2">
              <TextInput
                value={form.alternativeContactNumber}
                onChange={(value) =>
                  update("alternativeContactNumber", value)
                }
              />
            </EditRow>

            <EditRow label="Person to Contact">
              <TextInput
                value={form.mainContactName}
                onChange={(value) => update("mainContactName", value)}
              />
            </EditRow>
          </div>

          <div className="flex justify-end border-t border-slate-300 px-6 py-5">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF6A00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#E85F00] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <section className="overflow-hidden border border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-6 py-4">
              <h2 className="font-bold text-slate-950">
                Customer Account
              </h2>
            </div>

            <DetailRow
              label="Account/business name"
              value={customerDisplayName(customer)}
            />

            <DetailRow
              label="Account Status"
              value={
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                      customer.accountStatus,
                    )}`}
                  >
                    {displayAccountStatus(customer.accountStatus)}
                  </span>

                  {customer.accountStatus === "SUSPENDED" ? (
                    <button
                      type="button"
                      onClick={() => void makeAccountLive()}
                      disabled={accountAction !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {accountAction === "LIVE" ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      Live
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void suspendAccount()}
                      disabled={accountAction !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {accountAction === "SUSPEND" ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Ban size={15} />
                      )}
                      Suspend Account
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void deleteAccount()}
                    disabled={accountAction !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {accountAction === "DELETE" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Delete Account
                  </button>
                </div>
              }
            />

            <DetailRow
              label="Account Type"
              value={displayAccountType(customer.accountType)}
            />

            <DetailRow
              label="Commercial Tariff"
              value={commercialTariffName}
            />

            <DetailRow
              label="VAT No"
              value={customer.vatNumber || "Not provided"}
            />

            <DetailRow
              label="Companies House Number"
              value={
                customer.companyRegistrationNumber ||
                "Not provided"
              }
            />

            <DetailRow
              label="Registered Office Address"
              value={
                <AddressDisplay
                  lines={[
                    customer.registeredAddressLine1,
                    customer.registeredAddressLine2,
                    customer.registeredTownCity,
                    customer.registeredCounty,
                    customer.registeredPostcode,
                    customer.registeredCountry,
                  ]}
                />
              }
            />

            <DetailRow
              label="Trading Address if different"
              value={
                customer.tradingAddressDifferent ? (
                  <AddressDisplay
                    lines={[
                      customer.tradingAddressLine1,
                      customer.tradingAddressLine2,
                      customer.tradingTownCity,
                      customer.tradingCounty,
                      customer.tradingPostcode,
                      customer.tradingCountry,
                    ]}
                  />
                ) : (
                  "Same as Registered Office Address"
                )
              }
            />

            <DetailRow label="Email" value={customer.email} />

            <DetailRow
              label="Accounts Email"
              value={customer.accountsEmail || "Not provided"}
            />

            <DetailRow
              label="Billing Payment Mode"
              value={
                customer.billingProfile?.paymentMode === "PAY_LATER"
                  ? "Pay Later / Trade Credit"
                  : "Pay Now"
              }
            />

            <DetailRow
              label="Invoice Mode"
              value={
                "Invoice Per Booking"
              }
            />

            <DetailRow
              label="Billing Frequency"
              value={
                customer.billingProfile?.billingFrequency === "WEEKLY"
                  ? `Weekly${
                      customer.billingProfile.invoiceDayOfWeek
                        ? ` - day ${customer.billingProfile.invoiceDayOfWeek}`
                        : ""
                    }`
                  : customer.billingProfile?.billingFrequency === "MONTHLY"
                    ? `Monthly${
                        customer.billingProfile.invoiceDayOfMonth
                          ? ` - day ${customer.billingProfile.invoiceDayOfMonth}`
                          : ""
                      }`
                    : "Per Booking"
              }
            />

            <DetailRow
              label="Payment Terms"
              value={customer.accountType === "TRADE" ? "Monthly: issued 1st, due 15th" : "Due immediately"}
            />

            <DetailRow
              label="PO Required"
              value={customer.billingProfile?.poRequired ? "Yes" : "No"}
            />

            <DetailRow
              label="Credit Limit"
              value={
                customer.billingProfile?.creditLimit !== null &&
                customer.billingProfile?.creditLimit !== undefined
                  ? money(customer.billingProfile.creditLimit)
                  : "Not set"
              }
            />

            <DetailRow
              label="Credit Facility"
              value={
                customer.billingProfile?.creditFacilityOnHold
                  ? `On hold${
                      customer.billingProfile.holdReason
                        ? ` - ${customer.billingProfile.holdReason}`
                        : ""
                    }`
                  : "Available"
              }
            />

            <DetailRow
              label="Contact Number 1"
              value={customer.phone || "Not provided"}
            />

            <DetailRow
              label="Contact Number 2"
              value={
                customer.alternativeContactNumber ||
                "Not provided"
              }
            />

            <DetailRow
              label="Person to Contact"
              value={
                customer.mainContactName ||
                customer.name ||
                "Not provided"
              }
              last
            />
          </section>

          <CustomerInvoiceBoxes
            key={customer.id}
            customer={customer}
            pending={pendingInvoices}
            issued={finalisedIssuedInvoices}
            paid={paidClearedInvoices}
            onPayment={() => loadCustomer(true)}
            onUnfinalise={async (invoice) => {
              const response = await adminFetch(`${API_BASE}/api/invoices/admin/${invoice.id}/unfinalise`, { method: "POST" });
              const payload = await response.json();
              if (!response.ok) { setError(payload.error || "Unable to unfinalise invoice."); return; }
              window.location.reload();
            }}
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={[
        "grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]",
        last ? "" : "border-b border-slate-300",
      ].join(" ")}
    >
      <div className="border-b border-slate-300 bg-slate-50 px-5 py-5 text-sm font-bold text-slate-800 lg:border-b-0 lg:border-r">
        {label}
      </div>

      <div className="px-5 py-5 text-sm font-medium leading-6 text-slate-700">
        {value}
      </div>
    </div>
  );
}

type MonthlySummary = {
  id: string;
  month: string;
  number: string;
  status: "DRAFT" | "FINALISED" | "PAID";
  total: string;
  dueDate: string;
  createdAt: string;
  issuedAt: string | null;
};

function monthLabel(value: string) {
  return new Date(`${value}-01T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "long", year: "numeric", timeZone: "Europe/London",
  });
}

function CustomerInvoiceBoxes({
  customer, pending, issued, paid, onPayment, onUnfinalise,
}: {
  customer: Customer;
  pending: Invoice[];
  issued: Invoice[];
  paid: Invoice[];
  onPayment: () => Promise<void>;
  onUnfinalise: (invoice: Invoice) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isTrade = customer.accountType === "TRADE";
  const endpoint = `${API_BASE}/api/invoices/admin/monthly-summary/${encodeURIComponent(customer.id)}`;

  const request = useCallback(async (path = "", body?: object, signal?: AbortSignal) => {
    const response = await adminFetch(endpoint + path, {
      cache: "no-store", signal,
      ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to manage the consolidated invoice.");
    return data;
  }, [endpoint]);

  useEffect(() => {
    if (!isTrade) return;
    const controller = new AbortController();
    void request("", undefined, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setSummaries(data.summaries);
      setMonths(data.months);
      setMonth(value => data.months.includes(value) ? value : data.months[0] || "");
      setError("");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load consolidated invoices.");
    });
    return () => controller.abort();
  }, [isTrade, request, customer]);

  function saveSummary(summary: MonthlySummary) {
    setSummaries(rows => [summary, ...rows.filter(row => row.id !== summary.id)]);
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const { summary } = await request("", { month });
      saveSummary(summary);
      setSelectedId(summary.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to generate the consolidated invoice.");
    } finally {
      setBusy(false);
    }
  }

  const selected = isTrade ? summaries.find(summary => summary.id === selectedId) : undefined;
  const summaryRows = (status: MonthlySummary["status"]): Invoice[] => isTrade ? summaries.filter(row => row.status === status).map(row => ({
    ...row, invoiceNumber: row.number, invoiceType: "CONSOLIDATED",
    subtotal: 0, vatAmount: 0, consolidatedMonth: row.month,
  })) : [];
  const pendingRows = [...summaryRows("DRAFT"), ...pending];
  const issuedRows = [...summaryRows("FINALISED"), ...issued];
  const paidRows = [...summaryRows("PAID"), ...paid];

  return (
    <aside className="space-y-6">
      {isTrade && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <button type="button" className="font-semibold text-orange-700" aria-expanded={open} disabled={busy}
            onClick={() => setOpen(value => !value)}>
            Consolidated invoices
          </button>
          {open && <>
            <label className="block text-sm font-semibold">
              Invoice month
              <select className="mt-1 block w-full rounded-lg border border-slate-300 p-2" value={month}
                onChange={event => setMonth(event.target.value)} disabled={busy || !months.length}>
                {!months.length && <option value="">No invoices with a balance due</option>}
                {months.map(value => <option value={value} key={value}>{monthLabel(value)}</option>)}
              </select>
            </label>
            <button type="button" disabled={!month || busy} className="rounded-lg bg-[#FF6A00] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void generate()}>
              {busy ? "Generating…" : "Generate consolidated invoice"}
            </button>
          </>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </section>
      )}
      {(customer.accountType !== "BUSINESS" || pendingRows.length > 0 || issuedRows.length > 0) && <>
        <InvoiceSection title="Pending Invoices" invoices={pendingRows} customerId={customer.id}
          emptyMessage="No pending invoices." onOpenSummary={setSelectedId} />
        <InvoiceSection title="Finalised & Issued Invoices" collapsible invoices={issuedRows} customerId={customer.id}
          emptyMessage="No finalised or issued invoices." onOpenSummary={setSelectedId} onUnfinalise={onUnfinalise} />
      </>}
      <InvoiceSection title={customer.accountType === "BUSINESS" ? "Paid Invoices" : "Paid/Cleared Invoices"}
        collapsible invoices={paidRows} customerId={customer.id} emptyMessage="No paid or cleared invoices."
        onOpenSummary={setSelectedId} />
      {selected && (
        <MonthlySummaryPreview
          key={selected.id}
          summary={selected}
          pdfUrl={`${endpoint}/${encodeURIComponent(selected.id)}/pdf`}
          onAction={async (action, body = {}) => {
            const data = await request(`/${encodeURIComponent(selected.id)}/${action}`, body);
            if (data.summary) saveSummary(data.summary);
            if (action === "record-payment") await onPayment();
            return data.message || (action === "finalise" ? "Invoice finalised." : "Full payment recorded.");
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </aside>
  );
}

function MonthlySummaryPreview({
  summary, pdfUrl, onAction, onClose,
}: {
  summary: MonthlySummary;
  pdfUrl: string;
  onAction: (action: "send" | "finalise" | "record-payment", body?: object) => Promise<string>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [working, setWorking] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    const controller = new AbortController();
    let objectUrl = "";
    async function loadPreview() {
      try {
        const response = await adminFetch(pdfUrl, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Unable to open the invoice PDF.");
        }
        const pdf = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(pdf);
        setPreviewError("");
        setPreviewUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewUrl("");
          setPreviewError(error instanceof Error ? error.message : "Unable to open the invoice PDF.");
        }
      }
    }
    void loadPreview();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl, summary.status]);

  async function runAction(action: "send" | "finalise" | "record-payment") {
    setWorking(true);
    setActionError("");
    setMessage("");
    try {
      setMessage(await onAction(action, action === "record-payment" ? { amount, paidAt } : {}));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update the consolidated invoice.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="consolidated-preview-title"
      className="m-auto max-h-[92dvh] w-[min(96vw,900px)] rounded-2xl bg-white text-slate-950 shadow-xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Consolidated invoice</p>
          <h2 id="consolidated-preview-title" className="mt-1 text-xl font-bold">{summary.number}</h2>
          <p className="text-sm text-slate-600">
            {monthLabel(summary.month)} · {invoiceDisplayStatus(summary.status)} · {money(summary.total)}
          </p>
          <p className="text-sm text-slate-600">Due {formatDate(summary.dueDate)} · BACS reference {summary.number}</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close invoice"
          className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
          <X size={20} />
        </button>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {previewUrl ? (
          <iframe className="h-[57dvh] min-h-52 w-full rounded-xl border border-slate-200 bg-slate-50"
            title={`PDF preview of ${summary.number}`} src={`${previewUrl}#toolbar=0`} />
        ) : previewError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{previewError}</p>
        ) : (
          <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading invoice PDF…</p>
        )}
        {summary.status === "FINALISED" && (
          <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3"
            onSubmit={event => { event.preventDefault(); void runAction("record-payment"); }}>
            <label className="text-sm font-semibold">
              Full transfer amount (£)
              <input className="mt-1 block w-full rounded-lg border border-slate-300 p-2" type="number" min="0.01"
                step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Payment date
              <input className="mt-1 block w-full rounded-lg border border-slate-300 p-2" type="date"
                value={paidAt} onChange={event => setPaidAt(event.target.value)} />
            </label>
            <button type="submit" disabled={working || !previewUrl}
              className="rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              Record full payment
            </button>
          </form>
        )}
        {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          {previewUrl && (
            <a href={previewUrl} download={`${summary.number}.pdf`}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
              Download PDF
            </a>
          )}
          <button type="button" disabled={!previewUrl || working}
            onClick={() => void runAction(summary.status === "DRAFT" ? "finalise" : "send")}
            className="rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {working ? "Working…" : summary.status === "DRAFT" ? "Finalise" : "Email customer"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function InvoiceSection({
  collapsible = false,
  title,
  invoices,
  customerId,
  emptyMessage,
  onUnfinalise,
  onOpenSummary,
}: {
  onOpenSummary: (id: string) => void;
  onUnfinalise?: (invoice: Invoice) => Promise<void>;
  collapsible?: boolean;
  title: string;
  invoices: Invoice[];
  customerId: string;
  emptyMessage: string;
}) {
  const Container = collapsible ? "details" : "section";
  const Heading = collapsible ? "summary" : "div";
  return (
    <Container className="border border-slate-300 bg-white">
      <Heading className="flex cursor-pointer items-center justify-between gap-4 border-b border-slate-300 bg-slate-50 px-5 py-4">
        <h2 className="font-bold text-slate-950">
          {title}{collapsible ? ` (${invoices.length}) ▾` : ""}
        </h2>

        <Link
          href={`/admin/customers/${customerId}/invoices`}
          className="text-sm font-bold text-[#E55300] hover:text-[#C94A00]"
        >
          View All
        </Link>
      </Heading>

      {invoices.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {invoices.map((invoice) => {
            const cardClass = "block w-full px-5 py-5 text-left transition hover:bg-slate-50";
            const contents = <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-950">
                    {invoice.invoiceNumber}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {invoice.consolidatedMonth && !invoice.issuedAt ? "Created" : "Issued"} {formatDate(invoice.issuedAt || invoice.finalisedAt || invoice.createdAt)}
                    {invoice.consolidatedMonth && ` · ${monthLabel(invoice.consolidatedMonth)}`}
                  </p>

                  {invoice.dueDate ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Due {formatDate(invoice.dueDate)}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="font-bold text-slate-950">
                    {money(invoice.total)}
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${invoiceStatusClasses(
                      invoice.status,
                    )}`}
                  >
                    {invoiceDisplayStatus(invoice.status)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm font-bold text-[#E55300]">
                Open Invoice
                <ArrowRight size={15} />
              </div>
            </>;
            return (
              <div key={invoice.id}>
                {invoice.consolidatedMonth ? (
                  <button type="button" className={cardClass} onClick={() => onOpenSummary(invoice.id)}>{contents}</button>
                ) : (
                  <Link href={`/admin/invoices?invoice=${encodeURIComponent(invoice.invoiceNumber)}`} className={cardClass}>{contents}</Link>
                )}
            {invoice.invoiceType !== "CONSOLIDATED" && onUnfinalise && ["FINALISED", "SENT", "ISSUED", "OVERDUE"].includes(invoice.status) && <button type="button" className="mx-5 mb-4 min-h-11 rounded-xl border px-4 font-semibold text-[#071D49]" onClick={() => { if (window.confirm(`Unfinalise ${invoice.invoiceNumber} and return it to Pending?`)) void onUnfinalise(invoice); }}>Unfinalise</button>}
            </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}

function AddressDisplay({
  lines,
}: {
  lines: Array<string | null | undefined>;
}) {
  const visibleLines = lines.filter(
    (line): line is string =>
      Boolean(line?.trim()),
  );

  if (visibleLines.length === 0) {
    return <>Not provided</>;
  }

  return (
    <div className="space-y-1">
      {visibleLines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

function EditRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-r border-slate-300 bg-slate-50 px-5 py-5 text-sm font-bold text-slate-800">
        {label}
      </div>

      <div className="border-b border-slate-300 px-5 py-5">
        {children}
      </div>
    </>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-[#FF6A00]"
    />
  );
}

function AddressInputs({
  line1,
  line2,
  townCity,
  county,
  postcode,
  country,
  onLine1,
  onLine2,
  onTownCity,
  onCounty,
  onPostcode,
  onCountry,
}: {
  line1: string;
  line2: string;
  townCity: string;
  county: string;
  postcode: string;
  country: string;
  onLine1: (value: string) => void;
  onLine2: (value: string) => void;
  onTownCity: (value: string) => void;
  onCounty: (value: string) => void;
  onPostcode: (value: string) => void;
  onCountry: (value: string) => void;
}) {
  return (
    <div className="grid max-w-3xl gap-3 md:grid-cols-2">
      <PostcodeAddressLookup
        className="md:col-span-2"
        apiBase={(API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE) + "/api"}
        postcode={postcode}
        accent="orange"
        onSelect={address => {
          onLine1(address.addressLine1);
          onLine2(address.addressLine2);
          onTownCity(address.townCity);
          onCounty(address.county);
          onPostcode(address.postcode);
          onCountry("United Kingdom");
        }}
      />
      <input
        value={line1}
        onChange={(event) =>
          onLine1(event.target.value)
        }
        placeholder="Address Line 1"
        className="border border-slate-300 px-3 py-3 text-sm md:col-span-2"
      />

      <input
        value={line2}
        onChange={(event) =>
          onLine2(event.target.value)
        }
        placeholder="Address Line 2"
        className="border border-slate-300 px-3 py-3 text-sm md:col-span-2"
      />

      <input
        value={townCity}
        onChange={(event) =>
          onTownCity(event.target.value)
        }
        placeholder="Town / City"
        className="border border-slate-300 px-3 py-3 text-sm"
      />

      <input
        value={county}
        onChange={(event) =>
          onCounty(event.target.value)
        }
        placeholder="County"
        className="border border-slate-300 px-3 py-3 text-sm"
      />

      <input
        value={postcode}
        onChange={(event) =>
          onPostcode(event.target.value)
        }
        placeholder="Postcode"
        className="border border-slate-300 px-3 py-3 text-sm uppercase"
      />

      <input
        value={country}
        onChange={(event) =>
          onCountry(event.target.value)
        }
        placeholder="Country"
        className="border border-slate-300 px-3 py-3 text-sm"
      />
    </div>
  );
}
