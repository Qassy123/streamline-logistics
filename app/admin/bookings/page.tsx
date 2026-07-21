"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  status: string;
};

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  availability: string;
  vehicleId?: string | null;
  vehicle?: Vehicle | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  estimatedStartTime?: string | null;
  estimatedEndTime?: string | null;
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress?: string | null;
  customerReference?: string | null;
  purchaseOrderNumber?: string | null;
  internalNotes?: string | null;
  dispatchNotes?: string | null;
  totalPrice: string | number;
  createdAt: string;
  updatedAt: string;
  trackingStartedAt?: string | null;
  trackingEndedAt?: string | null;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
    phone?: string | null;
    accountNumber?: string | null;
  } | null;
  quote?: {
    id: string;
    status: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    vehicleSize?: string | null;
  } | null;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  payments?: {
    id: string;
    status: string;
    amount: string | number;
    currency: string;
  }[];
  invoices?: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: string | number;
  }[];
  pod?: {
    id: string;
    status: string;
    recipientName?: string | null;
    deliveredAt?: string | null;
  } | null;
  reservation?: {
    id: string;
    status: string;
    reservedFrom: string;
    reservedUntil: string;
  } | null;
  trackingEvents?: {
    id: string;
    status: string;
    title: string;
    description?: string | null;
    createdAt: string;
  }[];
};

type Payload = {
  bookings?: Booking[];
  booking?: Booking;
  vehicles?: Vehicle[];
  drivers?: Driver[];
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


function dateInputValue(value = new Date()) {
  const copy = new Date(value);
  const offset = copy.getTimezoneOffset();
  const local = new Date(copy.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function displaySelectedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function time(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function bookingTimeSlot(booking: Booking) {
  const start = time(booking.estimatedStartTime);
  const end = time(booking.estimatedEndTime);

  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return booking.collectionWindow || "Time not set";
}

function bookingCustomerName(booking: Booking) {
  return (
    booking.user?.companyName ||
    booking.user?.name ||
    booking.quote?.customerName ||
    booking.user?.email ||
    "Guest customer"
  );
}

function requiredVehicleType(booking: Booking) {
  return (
    booking.quote?.vehicleSize ||
    booking.vehicle?.vehicleType ||
    "Not specified"
  );
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "CANCELLED":
    case "EXPIRED":
      return "bg-red-50 text-red-700 ring-red-200";
    case "IN_PROGRESS":
    case "ASSIGNED":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-amber-50 text-amber-700 ring-amber-200";
  }
}

export default function AdminBookingsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue());
  const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [driverFilter, setDriverFilter] = useState("ALL");
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

  const [editStatus, setEditStatus] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editDriverId, setEditDriverId] = useState("");
  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editCollectionWindow, setEditCollectionWindow] = useState("");
  const [editCollectionAddress, setEditCollectionAddress] = useState("");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");
  const [editReturnAddress, setEditReturnAddress] = useState("");
  const [editCustomerReference, setEditCustomerReference] = useState("");
  const [editPurchaseOrderNumber, setEditPurchaseOrderNumber] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editDispatchNotes, setEditDispatchNotes] = useState("");
  const [editTotalPrice, setEditTotalPrice] = useState("");

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

  const loadBookings = useCallback(
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
          vehicleId: vehicleFilter,
          driverId: driverFilter,
        });

        if (search) params.set("search", search);
        params.set("dateFrom", selectedDate);
        params.set("dateTo", selectedDate);

        const response = await fetch(
          `${API_BASE}/api/bookings/admin/list?${params.toString()}`,
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

          throw new Error(payload.error || "Unable to load bookings.");
        }

        setBookings(payload.bookings || []);
        setVehicles(payload.vehicles || []);
        setDrivers(payload.drivers || []);
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
        setBookings([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load bookings.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      adminKey,
      driverFilter,
      page,
      search,
      selectedDate,
      status,
      vehicleFilter,
    ],
  );

  useEffect(() => {
    if (adminKey) {
      void loadBookings();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadBookings]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (status !== "ALL") count += 1;
    if (vehicleFilter !== "ALL") count += 1;
    if (driverFilter !== "ALL") count += 1;
    return count;
  }, [driverFilter, search, status, vehicleFilter]);

  function moveSelectedDate(days: number) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + days);
    setSelectedDate(dateInputValue(next));
    setPage(1);
  }

  function selectToday() {
    setSelectedDate(dateInputValue());
    setPage(1);
  }

  function selectTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(dateInputValue(tomorrow));
    setPage(1);
  }

  function openBooking(booking: Booking) {
    setSelected(booking);
    setEditStatus(booking.status);
    setEditVehicleId(booking.vehicle?.id || "");
    setEditDriverId(booking.driver?.id || "");
    setEditCollectionDate(
      new Date(booking.collectionDate).toISOString().slice(0, 10),
    );
    setEditCollectionWindow(booking.collectionWindow || "");
    setEditCollectionAddress(booking.collectionAddress || "");
    setEditDeliveryAddress(booking.deliveryAddress || "");
    setEditReturnAddress(booking.returnAddress || "");
    setEditCustomerReference(booking.customerReference || "");
    setEditPurchaseOrderNumber(booking.purchaseOrderNumber || "");
    setEditInternalNotes(booking.internalNotes || "");
    setEditDispatchNotes(booking.dispatchNotes || "");
    setEditTotalPrice(String(booking.totalPrice ?? ""));
    setError("");
    setMessage("");
  }

  async function updateBooking() {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/admin/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            status: editStatus,
            vehicleId: editVehicleId || null,
            driverId: editDriverId || null,
            collectionDate: editCollectionDate,
            collectionWindow: editCollectionWindow,
            collectionAddress: editCollectionAddress,
            deliveryAddress: editDeliveryAddress,
            returnAddress: editReturnAddress,
            customerReference: editCustomerReference,
            purchaseOrderNumber: editPurchaseOrderNumber,
            internalNotes: editInternalNotes,
            dispatchNotes: editDispatchNotes,
            totalPrice: editTotalPrice || null,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update booking.");
      }

      if (payload.booking) {
        setSelected(payload.booking);
        setBookings((current) =>
          current.map((booking) =>
            booking.id === payload.booking?.id ? payload.booking : booking,
          ),
        );
      }

      setMessage("Booking updated successfully.");
      await loadBookings(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update booking.",
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
            Transport operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Existing Bookings Calendar
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Review scheduled work, assign vehicles and drivers, update booking
            status and manage operational notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBookings(true)}
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
          label="All bookings"
          value={pagination.total}
          icon={CalendarDays}
        />
        <SummaryCard
          label="Confirmed"
          value={summary.CONFIRMED || 0}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="Assigned"
          value={summary.ASSIGNED || 0}
          icon={Truck}
        />
        <SummaryCard
          label="In progress"
          value={summary.IN_PROGRESS || 0}
          icon={ClipboardList}
        />
        <SummaryCard
          label="Completed"
          value={summary.COMPLETED || 0}
          icon={CheckCircle2}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => moveSelectedDate(-1)}
              className="rounded-xl border border-slate-300 bg-white p-3 text-slate-700 hover:bg-slate-50"
              aria-label="Previous day"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={selectTomorrow}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => moveSelectedDate(1)}
              className="rounded-xl border border-slate-300 bg-white p-3 text-slate-700 hover:bg-slate-50"
              aria-label="Next day"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-bold text-slate-700">Choose date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Selected date
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {displaySelectedDate(selectedDate)}
          </h2>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_220px_220px_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search reference, customer, company, address, email, PO or customer reference"
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
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <select
            value={vehicleFilter}
            onChange={(event) => {
              setVehicleFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All vehicles</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
                {vehicle.registration ? ` - ${vehicle.registration}` : ""}
              </option>
            ))}
          </select>

          <select
            value={driverFilter}
            onChange={(event) => {
              setDriverFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("ALL");
                setVehicleFilter("ALL");
                setDriverFilter("ALL");
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
            <h2 className="text-lg font-bold text-slate-950">Bookings</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching booking
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
        ) : bookings.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <CalendarDays className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No bookings found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or create a new booking.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openBooking(booking)}
                      className="text-left text-lg font-bold text-[#E55300] hover:underline"
                    >
                      {booking.reference}
                    </button>
                    <Badge className={statusClass(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    {bookingCustomerName(booking)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.collectionAddress} → {booking.deliveryAddress}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Time slot
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-bold text-slate-950">
                    <Clock3 size={17} className="text-[#E55300]" />
                    {bookingTimeSlot(booking)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {date(booking.collectionDate)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vehicle and driver
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    Required: {requiredVehicleType(booking)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Assigned vehicle:{" "}
                    {booking.vehicle
                      ? `${booking.vehicle.name}${
                          booking.vehicle.registration
                            ? ` · ${booking.vehicle.registration}`
                            : ""
                        }`
                      : "Unassigned"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Driver: {booking.driver?.name || "Unassigned"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openBooking(booking)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && bookings.length > 0 ? (
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
          <section className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Manage booking
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
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <SelectField
                  label="Booking status"
                  value={editStatus}
                  onChange={setEditStatus}
                  options={[
                    "PENDING_PAYMENT",
                    "CONFIRMED",
                    "ASSIGNED",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "CANCELLED",
                    "EXPIRED",
                  ]}
                />
                <SelectField
                  label="Vehicle"
                  value={editVehicleId}
                  onChange={setEditVehicleId}
                  options={vehicles.map((vehicle) => ({
                    value: vehicle.id,
                    label: `${vehicle.name}${
                      vehicle.registration
                        ? ` - ${vehicle.registration}`
                        : ""
                    }`,
                  }))}
                  allowEmpty
                />
                <SelectField
                  label="Driver"
                  value={editDriverId}
                  onChange={setEditDriverId}
                  options={drivers.map((driver) => ({
                    value: driver.id,
                    label: driver.name,
                  }))}
                  allowEmpty
                />
                <Field
                  label="Collection date"
                  type="date"
                  value={editCollectionDate}
                  onChange={setEditCollectionDate}
                />
                <Field
                  label="Collection window"
                  value={editCollectionWindow}
                  onChange={setEditCollectionWindow}
                />
                <Field
                  label="Total price"
                  type="number"
                  value={editTotalPrice}
                  onChange={setEditTotalPrice}
                />
                <Field
                  label="Collection address"
                  value={editCollectionAddress}
                  onChange={setEditCollectionAddress}
                />
                <Field
                  label="Delivery address"
                  value={editDeliveryAddress}
                  onChange={setEditDeliveryAddress}
                />
                <Field
                  label="Return address"
                  value={editReturnAddress}
                  onChange={setEditReturnAddress}
                />
                <Field
                  label="Customer reference"
                  value={editCustomerReference}
                  onChange={setEditCustomerReference}
                />
                <Field
                  label="Purchase order number"
                  value={editPurchaseOrderNumber}
                  onChange={setEditPurchaseOrderNumber}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <TextArea
                  label="Internal notes"
                  value={editInternalNotes}
                  onChange={setEditInternalNotes}
                />
                <TextArea
                  label="Dispatch notes"
                  value={editDispatchNotes}
                  onChange={setEditDispatchNotes}
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void updateBooking()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Pencil size={18} />
                Save booking changes
              </button>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  label="Payment"
                  value={
                    selected.payments?.[0]
                      ? `${selected.payments[0].status} · ${money(
                          selected.payments[0].amount,
                        )}`
                      : "No payment"
                  }
                  icon={WalletCards}
                />
                <InfoCard
                  label="Invoice"
                  value={
                    selected.invoices?.[0]
                      ? `${selected.invoices[0].invoiceNumber} · ${selected.invoices[0].status}`
                      : "No invoice"
                  }
                  icon={ClipboardList}
                />
                <InfoCard
                  label="Proof of delivery"
                  value={selected.pod?.status || "Not uploaded"}
                  icon={CheckCircle2}
                />
                <InfoCard
                  label="Tracking"
                  value={
                    selected.trackingStartedAt
                      ? selected.trackingEndedAt
                        ? "Completed"
                        : "Active"
                      : "Not started"
                  }
                  icon={Truck}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {selected.user?.id ? (
                  <Link
                    href={`/admin/customers/${selected.user.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Open customer profile
                    <ArrowRight size={17} />
                  </Link>
                ) : null}

                {selected.quote?.id ? (
                  <Link
                    href="/admin/quotes"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Open quote management
                    <ArrowRight size={17} />
                  </Link>
                ) : null}
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-950">
                  Tracking timeline
                </h3>
                <div className="mt-4 space-y-3">
                  {(selected.trackingEvents || []).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-bold text-slate-950">
                          {event.title}
                        </p>
                        <Badge className={statusClass(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                      {event.description ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {event.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">
                        {date(event.createdAt)}
                      </p>
                    </div>
                  ))}
                  {(selected.trackingEvents || []).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No tracking events recorded.
                    </p>
                  ) : null}
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
  icon: typeof CalendarDays;
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

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <textarea
        rows={5}
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
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  allowEmpty?: boolean;
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
        {allowEmpty ? <option value="">Not assigned</option> : null}
        {options.map((option) =>
          typeof option === "string" ? (
            <option key={option} value={option}>
              {option}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
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