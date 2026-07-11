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
  FileClock,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type Quote = {
  id: string;
  status: string;
  deliveryType: string;
  journeyType?: string | null;
  collectionDate: string;
  collectionWindow: string;
  vehicleSize: string;
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string | null;
  customerReference?: string | null;
  purchaseOrderNumber?: string | null;
  distanceMiles?: string | number | null;
  basePrice?: string | number | null;
  fuelSurcharge?: string | number | null;
  adminPrice?: string | number | null;
  discountAmount?: string | number | null;
  discountReason?: string | null;
  vatAmount?: string | number | null;
  totalPrice?: string | number | null;
  specialInstructions?: string | null;
  handoverNotes?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  cancelledAt?: string | null;
  convertedAt?: string | null;
  expiresAt?: string | null;
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
  booking?: {
    id: string;
    reference: string;
    status: string;
  } | null;
};

type Payload = {
  quotes?: Quote[];
  quote?: Quote;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    byStatus?: Record<string, number>;
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

function statusClass(status: string) {
  const normalised = status.toLowerCase();

  if (["accepted", "paid", "converted to booking"].includes(normalised)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (["cancelled", "expired"].includes(normalised)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (["sent", "viewed"].includes(normalised)) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export default function AdminQuotesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editCollectionWindow, setEditCollectionWindow] = useState("");
  const [editVehicleSize, setEditVehicleSize] = useState("");
  const [editCollectionAddress, setEditCollectionAddress] = useState("");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");
  const [editCustomerReference, setEditCustomerReference] = useState("");
  const [editPurchaseOrderNumber, setEditPurchaseOrderNumber] = useState("");
  const [editAdminPrice, setEditAdminPrice] = useState("");
  const [editDiscountAmount, setEditDiscountAmount] = useState("");
  const [editDiscountReason, setEditDiscountReason] = useState("");
  const [editVatAmount, setEditVatAmount] = useState("");
  const [editTotalPrice, setEditTotalPrice] = useState("");
  const [editSpecialInstructions, setEditSpecialInstructions] = useState("");

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

  const loadQuotes = useCallback(
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

        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(
          `${API_BASE}/api/quotes/admin/list?${params.toString()}`,
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

          throw new Error(payload.error || "Unable to load quotes.");
        }

        setQuotes(payload.quotes || []);
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
        setQuotes([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load quotes.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, dateFrom, dateTo, page, search, status],
  );

  useEffect(() => {
    if (adminKey) {
      void loadQuotes();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadQuotes]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    return count;
  }, [dateFrom, dateTo, search, status]);

  function openQuote(quote: Quote) {
    setSelected(quote);
    setEditCollectionDate(
      new Date(quote.collectionDate).toISOString().slice(0, 10),
    );
    setEditCollectionWindow(quote.collectionWindow || "");
    setEditVehicleSize(quote.vehicleSize || "");
    setEditCollectionAddress(quote.collectionAddress || "");
    setEditDeliveryAddress(quote.deliveryAddress || "");
    setEditCustomerReference(quote.customerReference || "");
    setEditPurchaseOrderNumber(quote.purchaseOrderNumber || "");
    setEditAdminPrice(String(quote.adminPrice ?? ""));
    setEditDiscountAmount(String(quote.discountAmount ?? ""));
    setEditDiscountReason(quote.discountReason || "");
    setEditVatAmount(String(quote.vatAmount ?? ""));
    setEditTotalPrice(String(quote.totalPrice ?? ""));
    setEditSpecialInstructions(quote.specialInstructions || "");
    setError("");
    setMessage("");
  }

  async function updateQuote(nextStatus?: string) {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/admin/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            status: nextStatus,
            collectionDate: editCollectionDate,
            collectionWindow: editCollectionWindow,
            vehicleSize: editVehicleSize,
            collectionAddress: editCollectionAddress,
            deliveryAddress: editDeliveryAddress,
            customerReference: editCustomerReference,
            purchaseOrderNumber: editPurchaseOrderNumber,
            adminPrice: editAdminPrice || null,
            discountAmount: editDiscountAmount || null,
            discountReason: editDiscountReason,
            vatAmount: editVatAmount || null,
            totalPrice: editTotalPrice || null,
            specialInstructions: editSpecialInstructions,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update quote.");
      }

      if (payload.quote) {
        setSelected(payload.quote);
        setQuotes((current) =>
          current.map((quote) =>
            quote.id === payload.quote?.id ? payload.quote : quote,
          ),
        );
      }

      setMessage("Quote updated successfully.");
      await loadQuotes(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update quote.",
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
            Sales operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Quote management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Search, review, edit and progress quotes through the complete
            quotation lifecycle.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadQuotes(true)}
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
        <SummaryCard label="All quotes" value={pagination.total} icon={FileClock} />
        <SummaryCard label="Sent" value={summary.Sent || summary.sent || 0} icon={Send} />
        <SummaryCard label="Accepted" value={summary.Accepted || summary.accepted || 0} icon={CheckCircle2} />
        <SummaryCard label="Expired" value={summary.Expired || summary.expired || 0} icon={CircleAlert} />
        <SummaryCard label="Cancelled" value={summary.Cancelled || summary.cancelled || 0} icon={XCircle} />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_180px_180px_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, company, email, quote ID, reference or PO"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
          >
            <option value="ALL">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="priced">Priced</option>
            <option value="Sent">Sent</option>
            <option value="Viewed">Viewed</option>
            <option value="Accepted">Accepted</option>
            <option value="Paid">Paid</option>
            <option value="Expired">Expired</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Converted to Booking">Converted to Booking</option>
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
                setDateFrom("");
                setDateTo("");
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
            <h2 className="text-lg font-bold text-slate-950">Quotes</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching quote
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
        ) : quotes.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <FileClock className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No quotes found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or create a new quote from a customer account.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {quotes.map((quote) => (
              <article
                key={quote.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {quote.companyName || quote.customerName}
                    </h3>
                    <Badge className={statusClass(quote.status)}>
                      {quote.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {quote.collectionAddress} → {quote.deliveryAddress}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {quote.id} · {quote.customerEmail}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Collection
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {date(quote.collectionDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {quote.collectionWindow}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vehicle / Total
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {quote.vehicleSize}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {money(quote.totalPrice)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openQuote(quote)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && quotes.length > 0 ? (
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
                  Manage quote
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.companyName || selected.customerName}
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
                <Field label="Collection date" type="date" value={editCollectionDate} onChange={setEditCollectionDate} />
                <Field label="Collection window" value={editCollectionWindow} onChange={setEditCollectionWindow} />
                <Field label="Vehicle size" value={editVehicleSize} onChange={setEditVehicleSize} />
                <Field label="Collection address" value={editCollectionAddress} onChange={setEditCollectionAddress} />
                <Field label="Delivery address" value={editDeliveryAddress} onChange={setEditDeliveryAddress} />
                <Field label="Customer reference" value={editCustomerReference} onChange={setEditCustomerReference} />
                <Field label="Purchase order number" value={editPurchaseOrderNumber} onChange={setEditPurchaseOrderNumber} />
                <Field label="Admin price" type="number" value={editAdminPrice} onChange={setEditAdminPrice} />
                <Field label="Discount amount" type="number" value={editDiscountAmount} onChange={setEditDiscountAmount} />
                <Field label="Discount reason" value={editDiscountReason} onChange={setEditDiscountReason} />
                <Field label="VAT amount" type="number" value={editVatAmount} onChange={setEditVatAmount} />
                <Field label="Total price" type="number" value={editTotalPrice} onChange={setEditTotalPrice} />
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Special instructions
                </span>
                <textarea
                  rows={4}
                  value={editSpecialInstructions}
                  onChange={(event) =>
                    setEditSpecialInstructions(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateQuote()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Pencil size={18} />
                  Save quote changes
                </button>

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
                  Quote status
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ActionButton label="Mark sent" icon={Send} disabled={saving} onClick={() => void updateQuote("Sent")} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" />
                  <ActionButton label="Accept" icon={CheckCircle2} disabled={saving} onClick={() => void updateQuote("Accepted")} className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" />
                  <ActionButton label="Expire" icon={CircleAlert} disabled={saving} onClick={() => void updateQuote("Expired")} className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" />
                  <ActionButton label="Cancel" icon={XCircle} disabled={saving} onClick={() => void updateQuote("Cancelled")} className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100" />
                </div>
              </div>

              {selected.booking ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-900">
                    Converted booking: {selected.booking.reference}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Status: {selected.booking.status}
                  </p>
                </div>
              ) : null}
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
  icon: typeof FileClock;
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
  icon: typeof Send;
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