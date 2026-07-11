"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type TrackingEvent = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  userVisible: boolean;
  createdAt: string;
};

type Location = {
  id?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  createdAt: string;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  trackingStartedAt?: string | null;
  trackingEndedAt?: string | null;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
  } | null;
  driver?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  vehicle?: {
    id: string;
    name: string;
    registration?: string | null;
  } | null;
  latestLocation?: Location | null;
  locationStale?: boolean;
  trackingEvents: TrackingEvent[];
};

type Payload = {
  bookings?: Booking[];
  booking?: Booking;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    activeTracking: number;
    staleLocations: number;
  };
  error?: string;
};

function dateTime(value?: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function AdminTrackingPage() {
  const [adminKey, setAdminKey] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    activeTracking: 0,
    staleLocations: 0,
  });
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventVisible, setEventVisible] = useState(true);
  const [eventStatus, setEventStatus] = useState("IN_PROGRESS");
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

  const loadTracking = useCallback(
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
          activeOnly: String(activeOnly),
        });

        if (search) params.set("search", search);

        const response = await fetch(
          `${API_BASE}/api/tracking/admin/list?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as Payload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load tracking.");
        }

        setBookings(payload.bookings || []);
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
            activeTracking: 0,
            staleLocations: 0,
          },
        );
      } catch (requestError) {
        setBookings([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load tracking.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeOnly, adminKey, page, search, status],
  );

  useEffect(() => {
    if (adminKey) {
      void loadTracking();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadTracking]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    if (activeOnly) count += 1;
    return count;
  }, [activeOnly, search, status]);

  async function createEvent() {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/tracking/admin/${selected.id}/event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            title: eventTitle,
            description: eventDescription,
            status: eventStatus,
            userVisible: eventVisible,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to create tracking event.");
      }

      setEventTitle("");
      setEventDescription("");
      setMessage("Tracking event created.");
      await loadTracking(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create tracking event.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTracking(action: "START" | "STOP" | "RESET") {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/tracking/admin/${selected.id}/tracking`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ action }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update tracking.");
      }

      setMessage(`Tracking ${action.toLowerCase()} completed.`);
      await loadTracking(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update tracking.",
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
            Live operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Tracking management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Monitor active journeys, location freshness, drivers, vehicles and
            customer-visible tracking events.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTracking(true)}
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

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Matching bookings"
          value={pagination.total}
          icon={Truck}
        />
        <SummaryCard
          label="Active tracking"
          value={summary.activeTracking}
          icon={MapPin}
        />
        <SummaryCard
          label="Stale locations"
          value={summary.staleLocations}
          icon={CircleAlert}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search booking, customer, driver, vehicle or registration"
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
            <option value="CONFIRMED">Confirmed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => {
                setActiveOnly(event.target.checked);
                setPage(1);
              }}
            />
            Active tracking only
          </label>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setActiveOnly(false);
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
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <MapPin className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No tracking records found
              </h3>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {booking.reference}
                    </h3>
                    {booking.locationStale ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                        STALE LOCATION
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {booking.user?.companyName ||
                      booking.user?.name ||
                      "Guest customer"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.collectionAddress} → {booking.deliveryAddress}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Driver / Vehicle
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {booking.driver?.name || "No driver"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.vehicle?.name || "No vehicle"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Latest location
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {booking.latestLocation
                      ? dateTime(booking.latestLocation.createdAt)
                      : "No location"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(booking)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Manage
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Tracking details
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selected.reference}
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
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Driver"
                  value={selected.driver?.name || "Not assigned"}
                  icon={UserRound}
                />
                <InfoCard
                  label="Vehicle"
                  value={selected.vehicle?.name || "Not assigned"}
                  icon={Truck}
                />
                <InfoCard
                  label="Last location"
                  value={
                    selected.latestLocation
                      ? dateTime(selected.latestLocation.createdAt)
                      : "No location"
                  }
                  icon={Clock3}
                />
              </div>

              {selected.latestLocation ? (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-bold text-slate-950">
                    Coordinates
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {selected.latestLocation.latitude},{" "}
                    {selected.latestLocation.longitude}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selected.latestLocation.latitude},${selected.latestLocation.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-bold text-[#E55300]"
                  >
                    Open in Google Maps
                  </a>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateTracking("START")}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
                >
                  Start tracking
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateTracking("STOP")}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700"
                >
                  Stop tracking
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateTracking("RESET")}
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
                >
                  Reset tracking
                </button>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-950">
                  Add tracking event
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    placeholder="Event title"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <select
                    value={eventStatus}
                    onChange={(event) => setEventStatus(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <textarea
                  rows={4}
                  value={eventDescription}
                  onChange={(event) =>
                    setEventDescription(event.target.value)
                  }
                  placeholder="Event description"
                  className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={eventVisible}
                    onChange={(event) =>
                      setEventVisible(event.target.checked)
                    }
                  />
                  Visible to customer
                </label>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createEvent()}
                  className="mt-4 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white"
                >
                  Add event
                </button>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-950">
                  Tracking timeline
                </h3>
                <div className="mt-4 space-y-3">
                  {selected.trackingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-slate-950">
                          {event.title}
                        </p>
                        <span className="text-xs font-semibold text-slate-400">
                          {dateTime(event.createdAt)}
                        </span>
                      </div>
                      {event.description ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {event.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">
                        {event.userVisible
                          ? "Customer visible"
                          : "Internal only"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selected.user?.id ? (
                <Link
                  href={`/admin/customers/${selected.user.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Open customer profile
                  <ArrowRight size={17} />
                </Link>
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
  icon: typeof Truck;
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

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Truck;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={19} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}