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
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

type TradeAccount = {
  id: string;
  userId: string;
  status: TradeStatus;
  companyName: string;
  tradingName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
  accountsContactName?: string | null;
  accountsEmail?: string | null;
  accountsPhone?: string | null;
  primaryFirstName?: string | null;
  primaryLastName?: string | null;
  primaryEmail?: string | null;
  primaryMobile?: string | null;
  creditLimit: string | number;
  currentBalance: string | number;
  paymentTermsDays: number;
  rejectionReason?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    accountNumber?: string | null;
    accountType: string;
    accountStatus: string;
    name: string;
    email: string;
    phone?: string | null;
    accountsEmail?: string | null;
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
  summary?: {
    byStatus?: Partial<Record<TradeStatus, number>>;
  };
  account?: TradeAccount;
  error?: string;
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

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function statusClass(status: TradeStatus) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "REJECTED":
      return "bg-red-50 text-red-700 ring-red-200";
    case "SUSPENDED":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "UNDER_REVIEW":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-amber-50 text-amber-700 ring-amber-200";
  }
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
  const [summary, setSummary] = useState<
    Partial<Record<TradeStatus, number>>
  >({});
  const [selected, setSelected] = useState<TradeAccount | null>(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAdminKey(
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadAccounts = useCallback(
    async (refresh = false) => {
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
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          status,
        });

        if (search) {
          params.set("search", search);
        }

        const response = await fetch(
          `${API_BASE}/api/trade-accounts/admin?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
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
      } catch (requestError) {
        setAccounts([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load trade accounts.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, page, search, status],
  );

  useEffect(() => {
    if (adminKey) {
      void loadAccounts();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadAccounts]);

  const totalPending =
    (summary.PENDING || 0) + (summary.UNDER_REVIEW || 0);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    return count;
  }, [search, status]);

  function openAccount(account: TradeAccount) {
    setSelected(account);
    setCreditLimit(String(account.creditLimit ?? ""));
    setCurrentBalance(String(account.currentBalance ?? ""));
    setPaymentTermsDays(String(account.paymentTermsDays ?? 30));
    setReason(
      account.suspensionReason ||
        account.rejectionReason ||
        "",
    );
    setError("");
    setMessage("");
  }

  async function updateAccount(nextStatus?: TradeStatus) {
    if (!selected || !adminKey) return;

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
            status: nextStatus,
            creditLimit,
            currentBalance,
            paymentTermsDays,
            rejectionReason:
              nextStatus === "REJECTED" ? reason : undefined,
            suspensionReason:
              nextStatus === "SUSPENDED" ? reason : undefined,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update trade account.");
      }

      if (payload.account) {
        setSelected(payload.account);
        setAccounts((current) =>
          current.map((account) =>
            account.id === payload.account?.id
              ? payload.account
              : account,
          ),
        );
      }

      setMessage("Trade account updated successfully.");
      await loadAccounts(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update trade account.",
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
            Review applications, approve credit, set limits and terms, suspend
            accounts and reactivate approved customers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAccounts(true)}
          disabled={refreshing || !adminKey}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="All accounts" value={pagination.total} icon={Building2} />
        <SummaryCard label="Awaiting review" value={totalPending} icon={Clock3} />
        <SummaryCard label="Approved" value={summary.APPROVED || 0} icon={CheckCircle2} />
        <SummaryCard label="Suspended" value={summary.SUSPENDED || 0} icon={Ban} />
        <SummaryCard label="Rejected" value={summary.REJECTED || 0} icon={CircleAlert} />
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
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search company, contact, email, account number, VAT or company number"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="min-w-[220px] rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Trade accounts
            </h2>
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
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No trade accounts found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or wait for a new application.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {account.companyName}
                    </h3>
                    <Badge className={statusClass(account.status)}>
                      {account.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {account.accountsContactName ||
                      `${account.primaryFirstName || ""} ${account.primaryLastName || ""}`.trim() ||
                      account.user.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {account.accountsEmail ||
                      account.primaryEmail ||
                      account.user.email}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {account.user.accountNumber || "No account number"} · Applied{" "}
                    {date(account.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Credit
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {money(account.creditLimit)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Balance {money(account.currentBalance)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Terms and activity
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {account.paymentTermsDays} days
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {account.user._count.bookings} bookings ·{" "}
                    {account.user._count.invoices} invoices
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openAccount(account)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && accounts.length > 0 ? (
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
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={17} />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Manage trade account
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.companyName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Info label="Customer" value={selected.user.name} />
                <Info
                  label="Account number"
                  value={selected.user.accountNumber || "Not assigned"}
                />
                <Info
                  label="Accounts email"
                  value={
                    selected.accountsEmail ||
                    selected.user.accountsEmail ||
                    selected.user.email
                  }
                />
                <Info
                  label="Phone"
                  value={
                    selected.accountsPhone ||
                    selected.user.phone ||
                    "Not provided"
                  }
                />
                <Info
                  label="VAT number"
                  value={selected.vatNumber || "Not provided"}
                />
                <Info
                  label="Company number"
                  value={
                    selected.companyRegistrationNumber ||
                    "Not provided"
                  }
                />
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Field
                  label="Credit limit"
                  type="number"
                  value={creditLimit}
                  onChange={setCreditLimit}
                />
                <Field
                  label="Current balance"
                  type="number"
                  value={currentBalance}
                  onChange={setCurrentBalance}
                />
                <Field
                  label="Payment terms (days)"
                  type="number"
                  value={paymentTermsDays}
                  onChange={setPaymentTermsDays}
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Rejection or suspension reason
                </span>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateAccount()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <CircleDollarSign size={18} />
                  Save credit settings
                </button>

                <Link
                  href={`/admin/customers/${selected.userId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Open customer profile
                  <ArrowRight size={17} />
                </Link>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-950">
                  Account decision
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ActionButton
                    label="Under review"
                    icon={Clock3}
                    disabled={saving}
                    onClick={() => void updateAccount("UNDER_REVIEW")}
                    className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  />
                  <ActionButton
                    label="Approve"
                    icon={CheckCircle2}
                    disabled={saving}
                    onClick={() => void updateAccount("APPROVED")}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  />
                  <ActionButton
                    label="Suspend"
                    icon={Ban}
                    disabled={saving}
                    onClick={() => void updateAccount("SUSPENDED")}
                    className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  />
                  <ActionButton
                    label="Reject"
                    icon={CircleAlert}
                    disabled={saving}
                    onClick={() => void updateAccount("REJECTED")}
                    className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
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
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
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

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
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
        onChange={(event) => onChange(event.target.value)}
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-60 ${className}`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}