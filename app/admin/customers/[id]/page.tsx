"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
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

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

type Invoice = {
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
    billingInvoiceMode:
      customer.billingProfile?.invoiceMode || "PER_BOOKING",
    billingFrequency:
      customer.billingProfile?.billingFrequency || "PER_BOOKING",
    invoiceDayOfWeek:
      customer.billingProfile?.invoiceDayOfWeek?.toString() || "1",
    invoiceDayOfMonth:
      customer.billingProfile?.invoiceDayOfMonth?.toString() || "1",
    paymentTermsDays:
      customer.billingProfile?.paymentTermsDays?.toString() || "30",
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

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountAction, setAccountAction] = useState<
    "SUSPEND" | "LIVE" | "DELETE" | null
  >(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomer = useCallback(
    async (refresh = false) => {
      if (!customerId) {
        return;
      }

      const adminKey =
        window.localStorage
          .getItem(ADMIN_KEY_STORAGE_KEY)
          ?.trim() || "";

      if (!adminKey) {
        setLoading(false);
        setError("Admin key is required.");
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

        const payload =
          (await response.json()) as CustomerPayload;

        if (!response.ok || !payload.customer) {
          if (response.status === 401) {
            window.localStorage.removeItem(
              ADMIN_KEY_STORAGE_KEY,
            );
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
      ["DRAFT", "OVERDUE", "PENDING"].includes(
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
      window.localStorage
        .getItem(ADMIN_KEY_STORAGE_KEY)
        ?.trim() || "";

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
          body: JSON.stringify({
            ...form,
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
      window.localStorage
        .getItem(ADMIN_KEY_STORAGE_KEY)
        ?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    setAccountAction("SUSPEND");
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
      window.localStorage
        .getItem(ADMIN_KEY_STORAGE_KEY)
        ?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    setAccountAction("LIVE");
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
      `Delete ${customerDisplayName(customer)}? This removes the customer account while keeping linked historical bookings, invoices, payments and quotes.`,
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
      window.localStorage
        .getItem(ADMIN_KEY_STORAGE_KEY)
        ?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    setAccountAction("DELETE");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/customers/${customerId}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey,
          },
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

        <div className="flex gap-3">
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

      {editing ? (
        <form
          onSubmit={saveCustomer}
          className="mt-7 border border-slate-300 bg-white"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
            <EditRow label="Account Name">
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
                <option value="CONSOLIDATED">Consolidated Invoice</option>
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

            <EditRow label="Payment Terms">
              <select
                value={form.paymentTermsDays}
                onChange={(event) =>
                  update("paymentTermsDays", event.target.value)
                }
                className="w-full max-w-xl border border-slate-300 px-3 py-3 text-sm"
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
            </EditRow>

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
              label="Account Name"
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
                customer.billingProfile?.invoiceMode === "CONSOLIDATED"
                  ? "Consolidated Invoice"
                  : "Invoice Per Booking"
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
              value={`${customer.billingProfile?.paymentTermsDays || 30} days`}
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

          <aside className="space-y-6">
            <InvoiceSection
              title="Pending Invoices"
              invoices={pendingInvoices}
              customerId={customer.id}
              emptyMessage="No pending invoices."
            />

            <InvoiceSection
              title="Paid/Cleared Invoices"
              invoices={paidClearedInvoices}
              customerId={customer.id}
              emptyMessage="No paid or cleared invoices."
            />
          </aside>
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

function InvoiceSection({
  title,
  invoices,
  customerId,
  emptyMessage,
}: {
  title: string;
  invoices: Invoice[];
  customerId: string;
  emptyMessage: string;
}) {
  return (
    <section className="border border-slate-300 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-slate-50 px-5 py-4">
        <h2 className="font-bold text-slate-950">
          {title}
        </h2>

        <Link
          href={`/admin/customers/${customerId}/invoices`}
          className="text-sm font-bold text-[#E55300] hover:text-[#C94A00]"
        >
          View All
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/admin/invoices?invoice=${encodeURIComponent(
                invoice.invoiceNumber,
              )}`}
              className="block px-5 py-5 transition hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-950">
                    {invoice.invoiceNumber}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Created {formatDate(invoice.createdAt)}
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
                    {invoice.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm font-bold text-[#E55300]">
                Open Invoice
                <ArrowRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
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
