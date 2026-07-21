"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
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

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
] as const;

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  availability: string;
};

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
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
  dispatchNotes?: string | null;
  totalPrice: string | number;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
  } | null;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  driverId?: string | null;
  vehicleId?: string | null;
  warnings: {
    vehicleConflict: boolean;
    driverConflict: boolean;
    missingVehicle: boolean;
    missingDriver: boolean;
  };
};

type Payload = {
  range?: {
    startDate: string;
    endDate: string;
    days: number;
  };
  bookings?: Booking[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  summary?: {
    total: number;
    unassigned: number;
    conflicts: number;
    byStatus: Record<string, number>;
  };
  booking?: Booking;
  error?: string;
};

function localDateInput(value?: string | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function localDateTimeInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60 * 1000);

  return adjusted.toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function displayTime(value?: string | null) {
  if (!value) return "No time";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

export default function AdminPlanningBoardPage() {
  const [adminKey, setAdminKey] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date()),
  );
  const [days, setDays] = useState(7);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    unassigned: 0,
    conflicts: 0,
    byStatus: {} as Record<string, number>,
  });

  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("ALL");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const [selected, setSelected] = useState<Booking | null>(null);
  const [editDriverId, setEditDriverId] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("");
  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCollectionWindow, setEditCollectionWindow] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDispatchNotes, setEditDispatchNotes] = useState("");

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

  const loadPlanningBoard = useCallback(
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
          startDate: localDateInput(weekStart.toISOString()),
          days: String(days),
          status,
          driverId: driverFilter,
          vehicleType: vehicleFilter,
          unassignedOnly: String(unassignedOnly),
        });

        const response = await fetch(
          `${API_BASE}/api/admin/planning?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as Payload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load planning board.");
        }

        setBookings(payload.bookings || []);
        setDrivers(payload.drivers || []);
        setVehicles(payload.vehicles || []);
        setSummary(
          payload.summary || {
            total: 0,
            unassigned: 0,
            conflicts: 0,
            byStatus: {},
          },
        );
      } catch (requestError) {
        setBookings([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load planning board.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      adminKey,
      days,
      driverFilter,
      status,
      unassignedOnly,
      vehicleFilter,
      weekStart,
    ],
  );

  useEffect(() => {
    if (adminKey) {
      void loadPlanningBoard();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadPlanningBoard]);

  const filteredBookings = useMemo(() => {
    const search = searchInput.trim().toLowerCase();

    if (!search) return bookings;

    return bookings.filter((booking) =>
      [
        booking.reference,
        booking.user?.name,
        booking.user?.companyName,
        booking.driver?.name,
        booking.vehicle?.vehicleType,
        booking.vehicle?.name,
        booking.vehicle?.registration,
        booking.collectionAddress,
        booking.deliveryAddress,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [bookings, searchInput]);

  const dayColumns = useMemo(() => {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);

      const key = date.toISOString().slice(0, 10);

      return {
        key,
        date,
        bookings: filteredBookings.filter(
          (booking) =>
            new Date(booking.collectionDate).toISOString().slice(0, 10) === key,
        ),
      };
    });
  }, [days, filteredBookings, weekStart]);

  function shiftRange(direction: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + direction * days);
      return next;
    });
  }

  function openBooking(booking: Booking) {
    setSelected(booking);
    setEditDriverId(booking.driverId || "");
    setEditVehicleType(booking.vehicle?.vehicleType || "");
    setEditCollectionDate(localDateInput(booking.collectionDate));
    setEditStartTime(localDateTimeInput(booking.estimatedStartTime));
    setEditEndTime(localDateTimeInput(booking.estimatedEndTime));
    setEditCollectionWindow(booking.collectionWindow || "");
    setEditStatus(booking.status);
    setEditDispatchNotes(booking.dispatchNotes || "");
    setError("");
    setMessage("");
  }

  async function saveAssignment() {
    if (!selected || !adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const assignmentResponse = await fetch(
        `${API_BASE}/api/admin/planning/bookings/${selected.id}/assignment`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            driverId: editDriverId || null,
            vehicleType: editVehicleType || null,
          }),
        },
      );

      const assignmentPayload = (await assignmentResponse.json()) as Payload;

      if (!assignmentResponse.ok) {
        throw new Error(
          assignmentPayload.error || "Unable to update assignment.",
        );
      }

      const scheduleResponse = await fetch(
        `${API_BASE}/api/admin/planning/bookings/${selected.id}/schedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            collectionDate: editCollectionDate,
            estimatedStartTime: editStartTime,
            estimatedEndTime: editEndTime,
            collectionWindow: editCollectionWindow,
            status: editStatus,
            dispatchNotes: editDispatchNotes,
          }),
        },
      );

      const schedulePayload = (await scheduleResponse.json()) as Payload;

      if (!scheduleResponse.ok) {
        throw new Error(
          schedulePayload.error || "Unable to update booking schedule.",
        );
      }

      setMessage("Planning assignment updated successfully.");
      setSelected(null);
      await loadPlanningBoard(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update planning assignment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1800px]">
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
            Dispatch operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Planning board
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Plan bookings across drivers and vehicles, identify conflicts and
            resolve unassigned work.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPlanningBoard(true)}
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
          label="Scheduled work"
          value={summary.total}
          icon={CalendarDays}
        />
        <SummaryCard
          label="Unassigned"
          value={summary.unassigned}
          icon={UserRound}
        />
        <SummaryCard
          label="Conflicts"
          value={summary.conflicts}
          icon={AlertTriangle}
        />
        <SummaryCard
          label="In progress"
          value={summary.byStatus.IN_PROGRESS || 0}
          icon={Truck}
        />
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
              placeholder="Search booking, customer, driver, vehicle or route"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={driverFilter}
            onChange={(event) => setDriverFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>

          <select
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All vehicles</option>
            {VEHICLE_TYPES.map((vehicleType) => (
              <option key={vehicleType} value={vehicleType}>
                {vehicleType}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(event) => setUnassignedOnly(event.target.checked)}
            />
            Unassigned only
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-2 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftRange(-1)}
              className="rounded-xl border border-slate-300 p-2.5 text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => shiftRange(1)}
              className="rounded-xl border border-slate-300 p-2.5 text-slate-700 hover:bg-slate-50"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-700">
              {displayDate(weekStart.toISOString())}
            </p>

            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              <option value={1}>Day</option>
              <option value={7}>Week</option>
              <option value={14}>Two weeks</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[500px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div
              className="grid min-w-[1100px] gap-3"
              style={{
                gridTemplateColumns: `repeat(${days}, minmax(220px, 1fr))`,
              }}
            >
              {dayColumns.map((column) => (
                <div
                  key={column.key}
                  className="min-h-[520px] rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="border-b border-slate-200 pb-3">
                    <p className="text-sm font-bold text-slate-950">
                      {displayDate(column.date.toISOString())}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {column.bookings.length} booking
                      {column.bookings.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="mt-3 space-y-3">
                    {column.bookings.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => openBooking(booking)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-orange-300 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-950">
                              {booking.reference}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {displayTime(booking.estimatedStartTime)}
                            </p>
                          </div>

                          {booking.warnings.vehicleConflict ||
                          booking.warnings.driverConflict ? (
                            <AlertTriangle
                              size={18}
                              className="text-red-600"
                            />
                          ) : booking.warnings.missingDriver ||
                            booking.warnings.missingVehicle ? (
                            <Clock3 size={18} className="text-amber-600" />
                          ) : (
                            <CheckCircle2
                              size={18}
                              className="text-emerald-600"
                            />
                          )}
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                          {booking.collectionAddress}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          → {booking.deliveryAddress}
                        </p>

                        <div className="mt-4 space-y-1 text-xs text-slate-500">
                          <p>
                            Driver: {booking.driver?.name || "Unassigned"}
                          </p>
                          <p>
                            Vehicle: {booking.vehicle?.vehicleType || "Unassigned"}
                          </p>
                          <p>Status: {booking.status}</p>
                        </div>
                      </button>
                    ))}

                    {column.bookings.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                        No bookings
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Planning assignment
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
                  label="Driver"
                  value={editDriverId}
                  onChange={setEditDriverId}
                  options={drivers.map((driver) => ({
                    value: driver.id,
                    label: `${driver.name} · ${driver.availability}`,
                  }))}
                  allowEmpty
                />

                <SelectField
                  label="Vehicle"
                  value={editVehicleType}
                  onChange={setEditVehicleType}
                  options={VEHICLE_TYPES.map((vehicleType) => ({
                    value: vehicleType,
                    label: vehicleType,
                  }))}
                  allowEmpty
                />

                <SelectField
                  label="Status"
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
                  ].map((value) => ({
                    value,
                    label: value,
                  }))}
                />

                <Field
                  label="Collection date"
                  type="date"
                  value={editCollectionDate}
                  onChange={setEditCollectionDate}
                />

                <Field
                  label="Estimated start"
                  type="datetime-local"
                  value={editStartTime}
                  onChange={setEditStartTime}
                />

                <Field
                  label="Estimated end"
                  type="datetime-local"
                  value={editEndTime}
                  onChange={setEditEndTime}
                />

                <Field
                  label="Collection window"
                  value={editCollectionWindow}
                  onChange={setEditCollectionWindow}
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Dispatch notes
                </span>
                <textarea
                  rows={5}
                  value={editDispatchNotes}
                  onChange={(event) =>
                    setEditDispatchNotes(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="font-bold text-slate-950">
                  {selected.collectionAddress}
                </p>
                <p className="my-2 text-sm text-slate-400">to</p>
                <p className="font-bold text-slate-950">
                  {selected.deliveryAddress}
                </p>
              </div>

              {(selected.warnings.vehicleConflict ||
                selected.warnings.driverConflict) && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  This booking currently has an overlapping driver or vehicle
                  assignment.
                </div>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAssignment()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Save planning changes
              </button>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/admin/bookings"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Open booking management
                </Link>

                {selected.user?.id ? (
                  <Link
                    href={`/admin/customers/${selected.user.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
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
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}