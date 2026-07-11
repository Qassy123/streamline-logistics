"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Truck,
  WalletCards,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const READ_STORAGE_KEY = "streamline_admin_notifications_read";
const ARCHIVED_STORAGE_KEY = "streamline_admin_notifications_archived";
const PAGE_SIZE = 25;

type NotificationItem = {
  id: string;
  category:
    | "BOOKING"
    | "PAYMENT"
    | "INVOICE"
    | "TRACKING"
    | "COMPLIANCE"
    | "SYSTEM";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  title: string;
  message: string;
  createdAt: string;
  bookingId?: string | null;
  bookingReference?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  sourceType: string;
  sourceId: string;
};

type Payload = {
  notifications?: NotificationItem[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
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

function priorityClass(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "URGENT":
      return "bg-red-50 text-red-700 ring-red-200";
    case "HIGH":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "NORMAL":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function categoryIcon(category: NotificationItem["category"]) {
  switch (category) {
    case "PAYMENT":
      return WalletCards;
    case "INVOICE":
      return FileText;
    case "BOOKING":
    case "TRACKING":
      return Truck;
    case "COMPLIANCE":
      return CircleAlert;
    default:
      return Bell;
  }
}

function readStoredSet(key: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set<string>(Array.isArray(value) ? value : []);
  } catch {
    return new Set<string>();
  }
}

function saveStoredSet(key: string, value: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
}

export default function AdminNotificationsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] = useState({
    byCategory: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAdminKey(
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
    );
    setReadIds(readStoredSet(READ_STORAGE_KEY));
    setArchivedIds(readStoredSet(ARCHIVED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadNotifications = useCallback(
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
          category,
          priority,
        });

        if (search) params.set("search", search);

        const response = await fetch(
          `${API_BASE}/api/admin/notifications?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as Payload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load notifications.");
        }

        setNotifications(payload.notifications || []);
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
            byCategory: {},
            byPriority: {},
          },
        );
      } catch (requestError) {
        setNotifications([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, category, page, priority, search],
  );

  useEffect(() => {
    if (adminKey) {
      void loadNotifications();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadNotifications]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const archived = archivedIds.has(notification.id);
      const read = readIds.has(notification.id);

      if (!showArchived && archived) return false;
      if (showArchived && !archived) return false;
      if (unreadOnly && read) return false;

      return true;
    });
  }, [
    archivedIds,
    notifications,
    readIds,
    showArchived,
    unreadOnly,
  ]);

  const unreadCount = notifications.filter(
    (notification) =>
      !readIds.has(notification.id) &&
      !archivedIds.has(notification.id),
  ).length;

  function markRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveStoredSet(READ_STORAGE_KEY, next);
  }

  function markAllRead() {
    const next = new Set(readIds);

    notifications.forEach((notification) => {
      next.add(notification.id);
    });

    setReadIds(next);
    saveStoredSet(READ_STORAGE_KEY, next);
  }

  function toggleArchive(id: string) {
    const next = new Set(archivedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setArchivedIds(next);
    saveStoredSet(ARCHIVED_STORAGE_KEY, next);
  }

  function openNotification(notification: NotificationItem) {
    markRead(notification.id);
    setSelected(notification);
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
            Operational alerts
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Notifications
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review booking, payment, invoice, tracking and fleet-compliance
            activity from one operational feed.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <CheckCheck size={17} />
            Mark all read
          </button>

          <button
            type="button"
            onClick={() => void loadNotifications(true)}
            disabled={refreshing || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Matching alerts"
          value={pagination.total}
          icon={Bell}
        />
        <SummaryCard
          label="Unread"
          value={unreadCount}
          icon={Bell}
        />
        <SummaryCard
          label="Urgent"
          value={summary.byPriority.URGENT || 0}
          icon={CircleAlert}
        />
        <SummaryCard
          label="Compliance"
          value={summary.byCategory.COMPLIANCE || 0}
          icon={Truck}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search alerts, bookings, customers, drivers or vehicles"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All categories</option>
            <option value="BOOKING">Bookings</option>
            <option value="PAYMENT">Payments</option>
            <option value="INVOICE">Invoices</option>
            <option value="TRACKING">Tracking</option>
            <option value="COMPLIANCE">Compliance</option>
          </select>

          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            Unread only
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Archived
          </label>
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center px-6 text-center">
            <div>
              <Bell className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No notifications found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or refresh the operational feed.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleNotifications.map((notification) => {
              const Icon = categoryIcon(notification.category);
              const isRead = readIds.has(notification.id);

              return (
                <article
                  key={notification.id}
                  className={`grid gap-5 p-5 sm:p-6 xl:grid-cols-[auto_minmax(0,1fr)_180px_auto] xl:items-center ${
                    isRead ? "bg-white" : "bg-orange-50/40"
                  }`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
                    <Icon size={21} />
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-950">
                        {notification.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClass(
                          notification.priority,
                        )}`}
                      >
                        {notification.priority}
                      </span>
                      {!isRead ? (
                        <span className="rounded-full bg-[#FF6A00] px-2 py-0.5 text-[10px] font-bold text-white">
                          NEW
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {notification.message}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {notification.bookingReference || notification.category}
                      {notification.customerName
                        ? ` · ${notification.customerName}`
                        : ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {dateTime(notification.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Open
                    <ArrowRight size={17} />
                  </button>
                </article>
              );
            })}
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
                  {selected.category}
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
              <p className="leading-7 text-slate-700">
                {selected.message}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Priority" value={selected.priority} />
                <Info
                  label="Created"
                  value={dateTime(selected.createdAt)}
                />
                <Info
                  label="Booking"
                  value={selected.bookingReference || "Not linked"}
                />
                <Info
                  label="Customer"
                  value={selected.customerName || "Not linked"}
                />
                <Info
                  label="Driver"
                  value={selected.driverName || "Not linked"}
                />
                <Info
                  label="Vehicle"
                  value={selected.vehicleName || "Not linked"}
                />
              </div>

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

              <button
                type="button"
                onClick={() => {
                  toggleArchive(selected.id);
                  setSelected(null);
                }}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
              >
                {archivedIds.has(selected.id)
                  ? "Restore notification"
                  : "Archive notification"}
              </button>
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
  icon: typeof Bell;
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
      <p className="mt-2 font-semibold text-slate-800">{value}</p>
    </div>
  );
}