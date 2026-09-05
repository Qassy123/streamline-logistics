"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
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

  invoices?: Invoice[];

  createdAt: string;
  updatedAt: string;
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
  };
}

export default function CustomerAccountPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const issuedInvoices = useMemo(() => {
    if (!customer?.invoices) {
      return [];
    }

    return customer.invoices.filter((invoice) =>
      ["ISSUED", "PAID", "FINALISED", "FINALIZED"].includes(
        invoice.status.toUpperCase(),
      ),
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
            "Unable to update customer account.",
        );
      }

      setCustomer(payload.customer);
      setForm(toEditForm(payload.customer));

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
            {editing ? (
              <X size={17} />
            ) : (
              <Pencil size={17} />
            )}

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
                onChange={(value) =>
                  update("companyName", value)
                }
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
                <option value="SUSPENDED">
                  Suspended
                </option>
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
                <option value="BUSINESS">
                  Business Account
                </option>

                <option value="TRADE">
                  Trade Credit Account
                </option>

                {form.accountType === "PRIVATE" ? (
                  <option value="PRIVATE">
                    Private Account
                  </option>
                ) : null}
              </select>
            </EditRow>

            <EditRow label="VAT No">
              <TextInput
                value={form.vatNumber}
                onChange={(value) =>
                  update("vatNumber", value)
                }
              />
            </EditRow>

            <EditRow label="Companies House Number">
              <TextInput
                value={form.companyRegistrationNumber}
                onChange={(value) =>
                  update(
                    "companyRegistrationNumber",
                    value,
                  )
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
                onLine1={(value) =>
                  update(
                    "registeredAddressLine1",
                    value,
                  )
                }
                onLine2={(value) =>
                  update(
                    "registeredAddressLine2",
                    value,
                  )
                }
                onTownCity={(value) =>
                  update("registeredTownCity", value)
                }
                onCounty={(value) =>
                  update("registeredCounty", value)
                }
                onPostcode={(value) =>
                  update("registeredPostcode", value)
                }
                onCountry={(value) =>
                  update("registeredCountry", value)
                }
              />
            </EditRow>

            <EditRow label="Trading Address if different">
              <div>
                <label className="mb-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      form.tradingAddressDifferent
                    }
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
                    onLine1={(value) =>
                      update(
                        "tradingAddressLine1",
                        value,
                      )
                    }
                    onLine2={(value) =>
                      update(
                        "tradingAddressLine2",
                        value,
                      )
                    }
                    onTownCity={(value) =>
                      update(
                        "tradingTownCity",
                        value,
                      )
                    }
                    onCounty={(value) =>
                      update(
                        "tradingCounty",
                        value,
                      )
                    }
                    onPostcode={(value) =>
                      update(
                        "tradingPostcode",
                        value,
                      )
                    }
                    onCountry={(value) =>
                      update(
                        "tradingCountry",
                        value,
                      )
                    }
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
                onChange={(value) =>
                  update("email", value)
                }
              />
            </EditRow>

            <EditRow label="Accounts Email">
              <TextInput
                type="email"
                value={form.accountsEmail}
                onChange={(value) =>
                  update("accountsEmail", value)
                }
              />
            </EditRow>

            <EditRow label="Contact Number 1">
              <TextInput
                value={form.phone}
                onChange={(value) =>
                  update("phone", value)
                }
              />
            </EditRow>

            <EditRow label="Contact Number 2">
              <TextInput
                value={
                  form.alternativeContactNumber
                }
                onChange={(value) =>
                  update(
                    "alternativeContactNumber",
                    value,
                  )
                }
              />
            </EditRow>

            <EditRow label="Person to Contact">
              <TextInput
                value={form.mainContactName}
                onChange={(value) =>
                  update("mainContactName", value)
                }
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
                <Loader2
                  size={17}
                  className="animate-spin"
                />
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
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                    customer.accountStatus,
                  )}`}
                >
                  {displayAccountStatus(
                    customer.accountStatus,
                  )}
                </span>
              }
            />

            <DetailRow
              label="Account Type"
              value={displayAccountType(
                customer.accountType,
              )}
            />

            <DetailRow
              label="VAT No"
              value={
                customer.vatNumber ||
                "Not provided"
              }
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

            <DetailRow
              label="Email"
              value={customer.email}
            />

            <DetailRow
              label="Accounts Email"
              value={
                customer.accountsEmail ||
                "Not provided"
              }
            />

            <DetailRow
              label="Contact Number 1"
              value={
                customer.phone || "Not provided"
              }
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
              title="All Finalized + Issued Invoices"
              invoices={issuedInvoices}
              customerId={customer.id}
              emptyMessage="No finalized or issued invoices."
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
        last
          ? ""
          : "border-b border-slate-300",
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
              href={`/admin/customers/${customerId}/invoices`}
              className="block px-5 py-5 transition hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-950">
                    {invoice.invoiceNumber}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Created{" "}
                    {formatDate(invoice.createdAt)}
                  </p>

                  {invoice.dueDate ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Due{" "}
                      {formatDate(invoice.dueDate)}
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
                    {invoice.status.replace(
                      /_/g,
                      " ",
                    )}
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