"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileClock,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type AuditEntry = {
  id: string;
  entity: string;
  action: string;
  entityId: string;
  reference: string;
  title: string;
  description: string;
  createdAt: string;
  actor: string;
  customerId?: string | null;
  bookingId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  metadata?: Record<string, unknown>;
};

type Payload = {
  entries?: AuditEntry[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    byEntity: Record<string, number>;
    byAction: Record<string, number>;
  };
  error?: string;
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function entityClass(entity: string) {
  const classes: Record<string, string> = {
    BOOKING: "bg-blue-50 text-blue-700 ring-blue-200",
    CUSTOMER: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    DRIVER: "bg-violet-50 text-violet-700 ring-violet-200",
    VEHICLE: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    PAYMENT: "bg-amber-50 text-amber-700 ring-amber-200",
    INVOICE: "bg-orange-50 text-orange-700 ring-orange-200",
    QUOTE: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    TRADE_ACCOUNT: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    TRACKING: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return classes[entity] || "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function AdminAuditLogPage() {
  const [adminKey, setAdminKey] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] = useState({
    byEntity: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  const loadAuditLog = useCallback(
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
          entity,
          action,
        });

        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(
          `${API_BASE}/api/admin/audit?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as Payload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load audit log.");
        }

        setEntries(payload.entries || []);
        setPagination(
          payload.pagination || {
            page,
            pageSize: PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setSummary(
          payload.summary || {
            byEntity: {},
            byAction: {},
          },
        );
      } catch (requestError) {
        setEntries([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load audit log.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [action, adminKey, dateFrom, dateTo, entity, page, search],
  );

  useEffect(() => {
    if (adminKey) {
      void loadAuditLog();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadAuditLog]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (entity !== "ALL") count += 1;
    if (action !== "ALL") count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    return count;
  }, [action, dateFrom, dateTo, entity, search]);

  async function exportCsv() {
    if (!adminKey) return;

    setError("");

    try {
      const params = new URLSearchParams({
        entity,
        action,
      });

      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(
        `${API_BASE}/api/admin/audit/export.csv?${params.toString()}`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as Payload;
        throw new Error(payload.error || "Unable to export audit log.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "streamline-audit-log.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to export audit log.",
      );
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
            Governance and controls
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Audit log
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review operational changes across bookings, customers, drivers,
            vehicles, payments, invoices, quotes and tracking events.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadAuditLog(true)}
            disabled={refreshing || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={!adminKey}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Matching entries"
          value={pagination.total}
        />
        <SummaryCard
          label="Booking changes"
          value={summary.byEntity.BOOKING || 0}
        />
        <SummaryCard
          label="Financial changes"
          value={
            (summary.byEntity.PAYMENT || 0) +
            (summary.byEntity.INVOICE || 0)
          }
        />
        <SummaryCard
          label="Tracking events"
          value={summary.byEntity.TRACKING || 0}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_190px_190px_170px_170px_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search reference, title, description or actor"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All entities</option>
            <option value="BOOKING">Bookings</option>
            <option value="CUSTOMER">Customers</option>
            <option value="DRIVER">Drivers</option>
            <option value="VEHICLE">Vehicles</option>
            <option value="PAYMENT">Payments</option>
            <option value="INVOICE">Invoices</option>
            <option value="QUOTE">Quotes</option>
            <option value="TRADE_ACCOUNT">Trade accounts</option>
            <option value="TRACKING">Tracking</option>
          </select>

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All actions</option>
            <option value="CREATED">Created</option>
            <option value="UPDATED">Updated</option>
            <option value="STATUS_CHANGED">Status changed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="PAYMENT_EVENT">Payment event</option>
            <option value="TRACKING_EVENT">Tracking event</option>
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
                setEntity("ALL");
                setAction("ALL");
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

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
            <div>
              <FileClock className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No audit entries found
              </h3>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_180px_220px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-950">
                      {entry.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${entityClass(
                        entry.entity,
                      )}`}
                    >
                      {entry.entity}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    {entry.description}
                  </p>

                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {entry.reference}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Action
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {entry.action}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Timestamp
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {dateTime(entry.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {entry.actor}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Details
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-300 p-2.5 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>

            <p className="px-3 text-sm font-semibold text-slate-600">
              Page {pagination.page} of {pagination.totalPages}
            </p>

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1),
                )
              }
              className="rounded-xl border border-slate-300 p-2.5 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Audit entry
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Entity" value={selected.entity} />
                <Info label="Action" value={selected.action} />
                <Info label="Reference" value={selected.reference} />
                <Info label="Actor" value={selected.actor} />
                <Info
                  label="Timestamp"
                  value={dateTime(selected.createdAt)}
                />
                <Info label="Entity ID" value={selected.entityId} />
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-bold text-slate-950">
                  Description
                </p>
                <p className="mt-2 leading-7 text-slate-600">
                  {selected.description}
                </p>
              </div>

              {selected.metadata ? (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-bold text-slate-950">
                    Metadata
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-600">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {selected.bookingId ? (
                  <Link
                    href="/admin/bookings"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
                  >
                    Open booking management
                  </Link>
                ) : null}

                {selected.customerId ? (
                  <Link
                    href={`/admin/customers/${selected.customerId}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
                  >
                    Open customer profile
                  </Link>
                ) : null}
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
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Clock3 size={21} />
        </span>
      </div>
    </article>
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
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}