"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";
const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type TradeStatus =
  "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

type TradeAccount = {
  id: string;
  userId: string;
  status: TradeStatus;
  companyName: string;
  tradingName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
  dateBusinessEstablished?: string | null;
  businessType?: string | null;
  companyWebsite?: string | null;
  annualTurnover?: string | null;
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
  accountsContactName?: string | null;
  accountsJobTitle?: string | null;
  accountsEmail?: string | null;
  accountsPhone?: string | null;
  invoiceDeliveryEmail?: string | null;
  primaryFirstName?: string | null;
  primaryLastName?: string | null;
  primaryPosition?: string | null;
  primaryEmail?: string | null;
  primaryMobile?: string | null;
  requestedCreditLimit?: string | number | null;
  expectedMonthlySpend?: string | null;
  estimatedShipmentsPerMonth?: string | null;
  preferredPaymentTerms?: string | null;
  serviceNextDayDelivery: boolean;
  serviceMultiDrop: boolean;
  serviceDedicatedVehicles: boolean;
  creditCheckConsent: boolean;
  authorisedToApply: boolean;
  creditSubjectToApproval: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  creditLimit: string | number;
  currentBalance: string | number;
  paymentTermsDays: number;
  billingContactName?: string | null;
  rejectionReason?: string | null;
  suspensionReason?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  suspendedAt?: string | null;
  reactivatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    accountNumber?: string | null;
    accountType: string;
    accountStatus: string;
    companyName?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    accountsEmail?: string | null;
    mainContactName?: string | null;
    companyRegistrationNumber?: string | null;
    vatNumber?: string | null;
    _count: {
      quotes: number;
      bookings: number;
      invoices: number;
      payments: number;
    };
  };
};

type Payload = {
  accounts?: TradeAccount[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: { byStatus?: Partial<Record<TradeStatus, number>> };
  account?: TradeAccount;
  error?: string;
};

type FormState = {
  companyName: string;
  tradingName: string;
  companyRegistrationNumber: string;
  vatNumber: string;
  billingContactName: string;
  accountsContactName: string;
  accountsJobTitle: string;
  accountsEmail: string;
  accountsPhone: string;
  invoiceDeliveryEmail: string;
  creditLimit: string;
  currentBalance: string;
  paymentTermsDays: string;
  reason: string;
};

const emptyForm: FormState = {
  companyName: "",
  tradingName: "",
  companyRegistrationNumber: "",
  vatNumber: "",
  billingContactName: "",
  accountsContactName: "",
  accountsJobTitle: "",
  accountsEmail: "",
  accountsPhone: "",
  invoiceDeliveryEmail: "",
  creditLimit: "",
  currentBalance: "",
  paymentTermsDays: "",
  reason: "",
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}
function date(value?: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
function statusClass(status: TradeStatus) {
  if (status === "APPROVED")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "SUSPENDED")
    return "bg-orange-50 text-orange-700 ring-orange-200";
  if (status === "UNDER_REVIEW")
    return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}
function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}
function address(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ") || "Not provided";
}

export default function TradeAccountsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [accounts, setAccounts] = useState<TradeAccount[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<Partial<Record<TradeStatus, number>>>(
    {},
  );
  const [selected, setSelected] = useState<TradeAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(
    () =>
      setAdminKey(
        window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
      ),
    [],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAccounts = useCallback(
    async (refresh = false) => {
      if (!adminKey) {
        setLoading(false);
        setError("Admin key is required. Unlock the admin area first.");
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          status,
        });
        if (search) params.set("search", search);
        const response = await fetch(
          `${API_BASE}/api/trade-accounts/admin?${params}`,
          { headers: { "x-admin-key": adminKey }, cache: "no-store" },
        );
        const payload = (await response.json()) as Payload;
        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
            setAdminKey("");
          }
          throw new Error(payload.error || "Unable to load trade accounts.");
        }
        setAccounts(payload.accounts || []);
        setPagination(
          payload.pagination || {
            page,
            pageSize: PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setSummary(payload.summary?.byStatus || {});
      } catch (e) {
        setAccounts([]);
        setError(
          e instanceof Error ? e.message : "Unable to load trade accounts.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, page, search, status],
  );
  useEffect(() => {
    if (adminKey) void loadAccounts();
    else setLoading(false);
  }, [adminKey, loadAccounts]);

  const totalPending = (summary.PENDING || 0) + (summary.UNDER_REVIEW || 0);
  const activeFilters = useMemo(
    () => Number(Boolean(search)) + Number(status !== "ALL"),
    [search, status],
  );

  function openAccount(account: TradeAccount) {
    setSelected(account);
    setForm({
      companyName: account.companyName || "",
      tradingName: account.tradingName || "",
      companyRegistrationNumber: account.companyRegistrationNumber || "",
      vatNumber: account.vatNumber || "",
      billingContactName:
        account.billingContactName || account.accountsContactName || "",
      accountsContactName: account.accountsContactName || "",
      accountsJobTitle: account.accountsJobTitle || "",
      accountsEmail: account.accountsEmail || account.user.accountsEmail || "",
      accountsPhone: account.accountsPhone || account.user.phone || "",
      invoiceDeliveryEmail:
        account.invoiceDeliveryEmail || account.accountsEmail || "",
      creditLimit: String(account.creditLimit ?? ""),
      currentBalance: String(account.currentBalance ?? ""),
      paymentTermsDays: String(account.paymentTermsDays ?? 30),
      reason: account.suspensionReason || account.rejectionReason || "",
    });
    setError("");
    setMessage("");
  }

  async function updateAccount(nextStatus?: TradeStatus) {
    if (!selected || !adminKey) return;
    const reason = form.reason.trim();
    if (
      (nextStatus === "REJECTED" || nextStatus === "SUSPENDED") &&
      reason.length < 5
    ) {
      setError(
        "Enter a reason of at least 5 characters before rejecting or suspending.",
      );
      return;
    }
    const action =
      nextStatus === "APPROVED" && selected.status === "SUSPENDED"
        ? "reactivate"
        : nextStatus?.toLowerCase();
    if (
      nextStatus &&
      !window.confirm(
        `Confirm you want to ${action || "update"} ${selected.companyName}?`,
      )
    )
      return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/api/trade-accounts/admin/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            ...form,
            status: nextStatus,
            rejectionReason: nextStatus === "REJECTED" ? reason : undefined,
            suspensionReason: nextStatus === "SUSPENDED" ? reason : undefined,
          }),
        },
      );
      const payload = (await response.json()) as Payload;
      if (!response.ok)
        throw new Error(payload.error || "Unable to update trade account.");
      if (payload.account) {
        setSelected(payload.account);
        setAccounts((items) =>
          items.map((item) =>
            item.id === payload.account?.id ? payload.account : item,
          ),
        );
        openAccount(payload.account);
      }
      setMessage(
        nextStatus
          ? `Trade account ${action}d successfully.`
          : "Trade account details saved successfully.",
      );
      await loadAccounts(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update trade account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Admin dashboard
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Credit control
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Trade account management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review every application, approve or reject credit, manage payment
            terms and limits, suspend or reactivate accounts, and keep company
            and billing details linked to the customer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAccounts(true)}
          disabled={refreshing || !adminKey}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="All accounts"
          value={pagination.total}
          icon={Building2}
        />
        <SummaryCard
          label="Awaiting review"
          value={totalPending}
          icon={Clock3}
        />
        <SummaryCard
          label="Approved"
          value={summary.APPROVED || 0}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="Suspended"
          value={summary.SUSPENDED || 0}
          icon={Ban}
        />
        <SummaryCard
          label="Rejected"
          value={summary.REJECTED || 0}
          icon={CircleAlert}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row">
          <label className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search company, contact, email, account number, VAT or company number"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="min-w-[220px] rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Trade accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching account
              {pagination.total === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <Building2 className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold">
                No trade accounts found
              </h3>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {accounts.map((a) => (
              <article
                key={a.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {a.companyName}
                    </h3>
                    <Badge className={statusClass(a.status)}>
                      {a.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {a.accountsContactName ||
                      `${a.primaryFirstName || ""} ${a.primaryLastName || ""}`.trim() ||
                      a.user.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {a.accountsEmail || a.primaryEmail || a.user.email}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {a.user.accountNumber || "Pending account number"} · Applied{" "}
                    {date(a.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Credit
                  </p>
                  <p className="mt-1 font-bold">{money(a.creditLimit)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Balance {money(a.currentBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Terms and activity
                  </p>
                  <p className="mt-1 font-bold">{a.paymentTermsDays} days</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {a.user._count.bookings} bookings · {a.user._count.invoices}{" "}
                    invoices
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAccount(a)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}
        {!loading && accounts.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-500">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total,
              )}{" "}
              of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft size={17} />
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Manage trade account
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold">{selected.companyName}</h2>
                  <Badge className={statusClass(selected.status)}>
                    {selected.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 p-2"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-8 p-5 sm:p-6">
              <Section title="Application and customer record">
                <div className="grid gap-4 md:grid-cols-3">
                  <Info label="Customer" value={selected.user.name} />
                  <Info
                    label="Account number"
                    value={
                      selected.user.accountNumber || "Assigned on approval"
                    }
                  />
                  <Info
                    label="Customer status"
                    value={`${selected.user.accountType} · ${selected.user.accountStatus}`}
                  />
                  <Info label="Applied" value={date(selected.createdAt)} />
                  <Info label="Last updated" value={date(selected.updatedAt)} />
                  <Info
                    label="Preferred terms"
                    value={selected.preferredPaymentTerms || "Not provided"}
                  />
                </div>
              </Section>
              <Section title="Company details">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Legal company name"
                    value={form.companyName}
                    onChange={(v) => setForm({ ...form, companyName: v })}
                  />
                  <Field
                    label="Trading name"
                    value={form.tradingName}
                    onChange={(v) => setForm({ ...form, tradingName: v })}
                  />
                  <Field
                    label="Companies House number"
                    value={form.companyRegistrationNumber}
                    onChange={(v) =>
                      setForm({ ...form, companyRegistrationNumber: v })
                    }
                  />
                  <Field
                    label="VAT number"
                    value={form.vatNumber}
                    onChange={(v) => setForm({ ...form, vatNumber: v })}
                  />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Info
                    label="Business type"
                    value={selected.businessType || "Not provided"}
                  />
                  <Info
                    label="Established"
                    value={selected.dateBusinessEstablished || "Not provided"}
                  />
                  <Info
                    label="Annual turnover"
                    value={selected.annualTurnover || "Not provided"}
                  />
                  <Info
                    label="Website"
                    value={selected.companyWebsite || "Not provided"}
                  />
                  <Info
                    label="Expected monthly spend"
                    value={selected.expectedMonthlySpend || "Not provided"}
                  />
                  <Info
                    label="Shipments per month"
                    value={
                      selected.estimatedShipmentsPerMonth || "Not provided"
                    }
                  />
                </div>
              </Section>
              <Section title="Registered and trading addresses">
                <div className="grid gap-5 md:grid-cols-2">
                  <Info
                    label="Registered office"
                    value={address([
                      selected.registeredAddressLine1,
                      selected.registeredAddressLine2,
                      selected.registeredTownCity,
                      selected.registeredCounty,
                      selected.registeredPostcode,
                      selected.registeredCountry,
                    ])}
                  />
                  <Info
                    label="Trading address"
                    value={
                      selected.tradingAddressDifferent
                        ? address([
                            selected.tradingAddressLine1,
                            selected.tradingAddressLine2,
                            selected.tradingTownCity,
                            selected.tradingCounty,
                            selected.tradingPostcode,
                            selected.tradingCountry,
                          ])
                        : "Same as registered office"
                    }
                  />
                </div>
              </Section>
              <Section title="Billing and account contacts">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="Billing contact"
                    value={form.billingContactName}
                    onChange={(v) =>
                      setForm({ ...form, billingContactName: v })
                    }
                  />
                  <Field
                    label="Accounts contact"
                    value={form.accountsContactName}
                    onChange={(v) =>
                      setForm({ ...form, accountsContactName: v })
                    }
                  />
                  <Field
                    label="Accounts job title"
                    value={form.accountsJobTitle}
                    onChange={(v) => setForm({ ...form, accountsJobTitle: v })}
                  />
                  <Field
                    label="Accounts email"
                    type="email"
                    value={form.accountsEmail}
                    onChange={(v) => setForm({ ...form, accountsEmail: v })}
                  />
                  <Field
                    label="Accounts phone"
                    value={form.accountsPhone}
                    onChange={(v) => setForm({ ...form, accountsPhone: v })}
                  />
                  <Field
                    label="Invoice delivery email"
                    type="email"
                    value={form.invoiceDeliveryEmail}
                    onChange={(v) =>
                      setForm({ ...form, invoiceDeliveryEmail: v })
                    }
                  />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Info
                    label="Primary contact"
                    value={
                      `${selected.primaryFirstName || ""} ${selected.primaryLastName || ""}`.trim() ||
                      selected.user.name
                    }
                  />
                  <Info
                    label="Primary email"
                    value={selected.primaryEmail || selected.user.email}
                  />
                  <Info
                    label="Primary mobile"
                    value={
                      selected.primaryMobile ||
                      selected.user.phone ||
                      "Not provided"
                    }
                  />
                </div>
              </Section>
              <Section title="Credit control and payment terms">
                <div className="grid gap-5 md:grid-cols-3">
                  <Field
                    label="Approved credit limit"
                    type="number"
                    value={form.creditLimit}
                    onChange={(v) => setForm({ ...form, creditLimit: v })}
                  />
                  <Field
                    label="Current balance"
                    type="number"
                    value={form.currentBalance}
                    onChange={(v) => setForm({ ...form, currentBalance: v })}
                  />
                  <Field
                    label="Payment terms (days)"
                    type="number"
                    value={form.paymentTermsDays}
                    onChange={(v) => setForm({ ...form, paymentTermsDays: v })}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Requested credit limit: {money(selected.requestedCreditLimit)}
                  . Approved trade accounts are activated for credit-account
                  invoicing under these terms.
                </p>
              </Section>
              <Section title="Services and declarations">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Check
                    label="Next-day delivery"
                    value={selected.serviceNextDayDelivery}
                  />
                  <Check label="Multi-drop" value={selected.serviceMultiDrop} />
                  <Check
                    label="Dedicated vehicles"
                    value={selected.serviceDedicatedVehicles}
                  />
                  <Check
                    label="Credit-check consent"
                    value={selected.creditCheckConsent}
                  />
                  <Check
                    label="Authorised to apply"
                    value={selected.authorisedToApply}
                  />
                  <Check
                    label="Credit subject to approval"
                    value={selected.creditSubjectToApproval}
                  />
                  <Check
                    label="Terms accepted"
                    value={selected.termsAccepted}
                  />
                  <Check
                    label="Privacy accepted"
                    value={selected.privacyAccepted}
                  />
                </div>
              </Section>
              <Section title="Decision history">
                <div className="grid gap-4 md:grid-cols-4">
                  <Info label="Approved" value={date(selected.approvedAt)} />
                  <Info label="Rejected" value={date(selected.rejectedAt)} />
                  <Info label="Suspended" value={date(selected.suspendedAt)} />
                  <Info
                    label="Reactivated"
                    value={date(selected.reactivatedAt)}
                  />
                </div>
                {(selected.rejectionReason || selected.suspensionReason) && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    {selected.rejectionReason || selected.suspensionReason}
                  </div>
                )}
              </Section>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Reason required for rejection or suspension
                </span>
                <textarea
                  rows={4}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  disabled={saving}
                  onClick={() => void updateAccount()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  <CircleDollarSign size={18} />
                  Save all account settings
                </button>
                <Link
                  href={`/admin/customers/${selected.userId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Open customer profile
                  <ArrowRight size={17} />
                </Link>
              </div>
              <div className="border-t border-slate-200 pt-6">
                <p className="text-sm font-bold">Account decision</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ActionButton
                    label="Under review"
                    icon={Clock3}
                    disabled={saving}
                    onClick={() => void updateAccount("UNDER_REVIEW")}
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  />
                  <ActionButton
                    label={
                      selected.status === "SUSPENDED" ? "Reactivate" : "Approve"
                    }
                    icon={CheckCircle2}
                    disabled={saving}
                    onClick={() => void updateAccount("APPROVED")}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />
                  <ActionButton
                    label="Suspend"
                    icon={Ban}
                    disabled={saving || selected.status === "SUSPENDED"}
                    onClick={() => void updateAccount("SUSPENDED")}
                    className="border-orange-200 bg-orange-50 text-orange-700"
                  />
                  <ActionButton
                    label="Reject"
                    icon={CircleAlert}
                    disabled={saving}
                    onClick={() => void updateAccount("REJECTED")}
                    className="border-red-200 bg-red-50 text-red-700"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
      </div>
    </article>
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
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h3 className="mb-5 text-base font-bold text-slate-950">{title}</h3>
      {children}
    </section>
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
function Check({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
    >
      {label}: {yesNo(value)}
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}
function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  className,
}: {
  label: string;
  icon: typeof ShieldCheck;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50 ${className}`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}
