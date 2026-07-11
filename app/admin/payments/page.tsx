"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type Payment = {
  id: string;
  bookingId: string;
  userId?: string | null;
  provider: string;
  providerPaymentId?: string | null;
  status: string;
  amount: string | number;
  currency: string;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
    phone?: string | null;
    accountNumber?: string | null;
  } | null;
  booking: {
    id: string;
    reference: string;
    status: string;
    totalPrice: string | number;
    collectionDate: string;
    collectionAddress: string;
    deliveryAddress: string;
    quote?: {
      id: string;
      customerName: string;
      customerEmail: string;
      companyName?: string | null;
    } | null;
    invoices?: {
      id: string;
      invoiceNumber: string;
      status: string;
      total: string | number;
    }[];
  };
};

type Payload = {
  payments?: Payment[];
  payment?: Payment;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    byStatus?: Record<string, number>;
    byProvider?: Record<string, number>;
  };
  error?: string;
};

function money(
  value: string | number | null | undefined,
  currency = "GBP",
) {
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
  const normalised = status.toUpperCase();

  if (normalised === "PAID") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalised === "FAILED") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (normalised === "REFUNDED") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export default function AdminPaymentsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [providers, setProviders] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const loadPayments = useCallback(
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
          provider,
        });

        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(
          `${API_BASE}/api/payments/admin/list?${params.toString()}`,
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

          throw new Error(payload.error || "Unable to load payments.");
        }

        setPayments(payload.payments || []);
        setPagination(
          payload.pagination || {
            page,
            pageSize: PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setSummary(payload.summary?.byStatus || {});
        setProviders(payload.summary?.byProvider || {});
      } catch (requestError) {
        setPayments([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load payments.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, dateFrom, dateTo, page, provider, search, status],
  );

  useEffect(() => {
    if (adminKey) {
      void loadPayments();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadPayments]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    if (provider !== "ALL") count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    return count;
  }, [dateFrom, dateTo, provider, search, status]);

  async function updateStatus(nextStatus: string) {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/payments/admin/${selected.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update payment.");
      }

      if (payload.payment) {
        setSelected(payload.payment);
        setPayments((current) =>
          current.map((payment) =>
            payment.id === payload.payment?.id
              ? payload.payment
              : payment,
          ),
        );
      }

      setMessage("Payment status updated successfully.");
      await loadPayments(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update payment.",
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
            Finance operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Payment management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review payment activity, linked bookings, customers, invoices and
            provider references.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPayments(true)}
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

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="All payments"
          value={pagination.total}
          icon={WalletCards}
        />
        <SummaryCard
          label="Paid"
          value={summary.PAID || 0}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="Pending"
          value={summary.PENDING || 0}
          icon={CreditCard}
        />
        <SummaryCard
          label="Failed / Refunded"
          value={(summary.FAILED || 0) + (summary.REFUNDED || 0)}
          icon={CircleAlert}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_180px_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search payment reference, booking, customer, company or email"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All providers</option>
            {Object.keys(providers).map((providerName) => (
              <option key={providerName} value={providerName}>
                {providerName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setProvider("ALL");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear
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
            <h2 className="text-lg font-bold text-slate-950">Payments</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching payment
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
        ) : payments.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <WalletCards className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No payments found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or wait for new payment activity.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {payments.map((payment) => (
              <article
                key={payment.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {payment.booking.reference}
                    </h3>
                    <Badge className={statusClass(payment.status)}>
                      {payment.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {payment.user?.companyName ||
                      payment.user?.name ||
                      payment.booking.quote?.companyName ||
                      payment.booking.quote?.customerName ||
                      "Guest customer"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {payment.providerPaymentId || payment.id}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Amount
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {money(payment.amount, payment.currency)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {payment.provider}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Date
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {date(payment.paidAt || payment.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelected(payment);
                    setError("");
                    setMessage("");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Manage
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && payments.length > 0 ? (
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
                  Payment details
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.booking.reference}
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
                <Info
                  label="Status"
                  value={selected.status}
                />
                <Info
                  label="Amount"
                  value={money(selected.amount, selected.currency)}
                />
                <Info
                  label="Provider"
                  value={selected.provider}
                />
                <Info
                  label="Provider reference"
                  value={selected.providerPaymentId || "Not recorded"}
                />
                <Info
                  label="Customer"
                  value={
                    selected.user?.companyName ||
                    selected.user?.name ||
                    selected.booking.quote?.customerName ||
                    "Guest customer"
                  }
                />
                <Info
                  label="Payment date"
                  value={date(selected.paidAt || selected.createdAt)}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="font-bold text-slate-950">
                  {selected.booking.collectionAddress}
                </p>
                <p className="my-2 text-sm text-slate-400">to</p>
                <p className="font-bold text-slate-950">
                  {selected.booking.deliveryAddress}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/admin/bookings"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Open booking management
                  <ArrowRight size={17} />
                </Link>

                {selected.user?.id ? (
                  <Link
                    href={`/admin/customers/${selected.user.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Open customer profile
                    <ArrowRight size={17} />
                  </Link>
                ) : null}
              </div>

              <div className="border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-950">
                  Payment status
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {["PENDING", "PAID", "FAILED", "REFUNDED"].map(
                    (nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        disabled={saving}
                        onClick={() => void updateStatus(nextStatus)}
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {nextStatus}
                      </button>
                    ),
                  )}
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
  icon: typeof WalletCards;
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