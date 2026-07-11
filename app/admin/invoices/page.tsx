"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Loader2,
  Pencil,
  Plus,
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

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

type Invoice = {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  userId?: string | null;
  status: InvoiceStatus;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    accountNumber?: string | null;
    name: string;
    companyName?: string | null;
    email: string;
    phone?: string | null;
  } | null;
  booking: {
    id: string;
    reference: string;
    status: string;
    collectionDate: string;
    collectionAddress: string;
    deliveryAddress: string;
    totalPrice: string | number;
    quote?: {
      id: string;
      customerName: string;
      customerEmail: string;
      companyName?: string | null;
    } | null;
    payments?: {
      id: string;
      status: string;
      amount: string | number;
      currency: string;
      paidAt?: string | null;
    }[];
    vehicle?: {
      id: string;
      name: string;
      registration?: string | null;
    } | null;
    driver?: {
      id: string;
      name: string;
    } | null;
    pod?: {
      id: string;
      status: string;
      deliveredAt?: string | null;
      recipientName?: string | null;
    } | null;
  };
};

type Payload = {
  invoices?: Invoice[];
  invoice?: Invoice;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    byStatus?: Record<string, number>;
    totals?: {
      subtotal: string | number;
      vatAmount: string | number;
      total: string | number;
    };
  };
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

function dateInput(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function statusClass(status: InvoiceStatus) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "OVERDUE":
      return "bg-red-50 text-red-700 ring-red-200";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "ISSUED":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-amber-50 text-amber-700 ring-amber-200";
  }
}

export default function AdminInvoicesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState({
    subtotal: 0,
    vatAmount: 0,
    total: 0,
  });

  const [editStatus, setEditStatus] = useState<InvoiceStatus>("DRAFT");
  const [editSubtotal, setEditSubtotal] = useState("");
  const [editVatAmount, setEditVatAmount] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

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

  const loadInvoices = useCallback(
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
          overdueOnly: String(overdueOnly),
        });

        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(
          `${API_BASE}/api/invoices/admin/list?${params.toString()}`,
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

          throw new Error(payload.error || "Unable to load invoices.");
        }

        setInvoices(payload.invoices || []);
        setPagination(
          payload.pagination || {
            page,
            pageSize: PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setSummary(payload.summary?.byStatus || {});
        setTotals({
          subtotal: Number(payload.summary?.totals?.subtotal || 0),
          vatAmount: Number(payload.summary?.totals?.vatAmount || 0),
          total: Number(payload.summary?.totals?.total || 0),
        });
      } catch (requestError) {
        setInvoices([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load invoices.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, dateFrom, dateTo, overdueOnly, page, search, status],
  );

  useEffect(() => {
    if (adminKey) {
      void loadInvoices();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadInvoices]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    if (overdueOnly) count += 1;
    return count;
  }, [dateFrom, dateTo, overdueOnly, search, status]);

  function openInvoice(invoice: Invoice) {
    setSelected(invoice);
    setEditStatus(invoice.status);
    setEditSubtotal(String(invoice.subtotal ?? ""));
    setEditVatAmount(String(invoice.vatAmount ?? ""));
    setEditTotal(String(invoice.total ?? ""));
    setEditDueDate(dateInput(invoice.dueDate));
    setError("");
    setMessage("");
  }

  async function updateInvoice(nextStatus?: InvoiceStatus) {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/invoices/admin/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            status: nextStatus || editStatus,
            subtotal: editSubtotal,
            vatAmount: editVatAmount,
            total: editTotal,
            dueDate: editDueDate || null,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update invoice.");
      }

      if (payload.invoice) {
        setSelected(payload.invoice);
        setEditStatus(payload.invoice.status);
        setInvoices((current) =>
          current.map((invoice) =>
            invoice.id === payload.invoice?.id
              ? payload.invoice
              : invoice,
          ),
        );
      }

      setMessage("Invoice updated successfully.");
      await loadInvoices(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update invoice.",
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
            Invoice management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review invoice status, values, due dates, linked bookings,
            customers and payment activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadInvoices(true)}
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
        <SummaryCard
          label="All invoices"
          value={pagination.total}
          icon={FileText}
        />
        <SummaryCard
          label="Issued"
          value={summary.ISSUED || 0}
          icon={CalendarDays}
        />
        <SummaryCard
          label="Paid"
          value={summary.PAID || 0}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="Overdue"
          value={summary.OVERDUE || 0}
          icon={CircleAlert}
        />
        <SummaryCard
          label="Invoice value"
          value={money(totals.total)}
          icon={WalletCards}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <ValueCard label="Net subtotal" value={money(totals.subtotal)} />
        <ValueCard label="VAT total" value={money(totals.vatAmount)} />
        <ValueCard label="Gross total" value={money(totals.total)} />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search invoice number, booking, customer, company, email or account number"
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
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
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

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Overdue only
          </label>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setDateFrom("");
                setDateTo("");
                setOverdueOnly(false);
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
            <h2 className="text-lg font-bold text-slate-950">Invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching invoice
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
        ) : invoices.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No invoices found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or wait for new invoice activity.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_180px_180px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {invoice.invoiceNumber}
                    </h3>
                    <Badge className={statusClass(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {invoice.user?.companyName ||
                      invoice.user?.name ||
                      invoice.booking.quote?.companyName ||
                      invoice.booking.quote?.customerName ||
                      "Guest customer"}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Booking {invoice.booking.reference}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Amount
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {money(invoice.total)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    VAT {money(invoice.vatAmount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Due date
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {date(invoice.dueDate)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Payment
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {invoice.booking.payments?.[0]?.status || "No payment"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {invoice.booking.payments?.[0]
                      ? money(
                          invoice.booking.payments[0].amount,
                        )
                      : "Not recorded"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openInvoice(invoice)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && invoices.length > 0 ? (
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
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Manage invoice
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.invoiceNumber}
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
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <SelectField
                  label="Invoice status"
                  value={editStatus}
                  onChange={(value) =>
                    setEditStatus(value as InvoiceStatus)
                  }
                  options={[
                    "DRAFT",
                    "ISSUED",
                    "PAID",
                    "OVERDUE",
                    "CANCELLED",
                  ]}
                />

                <Field
                  label="Subtotal"
                  type="number"
                  value={editSubtotal}
                  onChange={setEditSubtotal}
                />

                <Field
                  label="VAT amount"
                  type="number"
                  value={editVatAmount}
                  onChange={setEditVatAmount}
                />

                <Field
                  label="Total"
                  type="number"
                  value={editTotal}
                  onChange={setEditTotal}
                />

                <Field
                  label="Due date"
                  type="date"
                  value={editDueDate}
                  onChange={setEditDueDate}
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void updateInvoice()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Pencil size={18} />
                Save invoice changes
              </button>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  label="Booking"
                  value={selected.booking.reference}
                />
                <InfoCard
                  label="Booking status"
                  value={selected.booking.status}
                />
                <InfoCard
                  label="Vehicle"
                  value={selected.booking.vehicle?.name || "Not assigned"}
                />
                <InfoCard
                  label="Driver"
                  value={selected.booking.driver?.name || "Not assigned"}
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
                  Quick status actions
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {(
                    [
                      "DRAFT",
                      "ISSUED",
                      "PAID",
                      "OVERDUE",
                      "CANCELLED",
                    ] as InvoiceStatus[]
                  ).map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      disabled={saving}
                      onClick={() => void updateInvoice(nextStatus)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {nextStatus}
                    </button>
                  ))}
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
  value: number | string;
  icon: typeof FileText;
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

function ValueCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}