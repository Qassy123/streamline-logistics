"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 100;

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_WIDTH = 100;
const VEHICLE_COLUMN_WIDTH = 220;
const ROW_HEIGHT = 88;

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  status: string;
  taxDueDate?: string | null;
  motExpiry?: string | null;
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
  vehicleType?: string | null;
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
};

type Payload = {
  bookings?: Booking[];
  vehicles?: Vehicle[];
  drivers?: Driver[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

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

function displayDate(value?: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function displayTime(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function bookingCustomerName(booking: Booking) {
  return (
    booking.user?.companyName ||
    booking.user?.name ||
    booking.quote?.customerName ||
    "Guest Customer"
  );
}

function bookingTimeText(booking: Booking) {
  const start = displayTime(booking.estimatedStartTime);
  const end = displayTime(booking.estimatedEndTime);

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return start;
  }

  return booking.collectionWindow || "Time not set";
}

function minutesFromStartOfDay(value?: string | null) {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getHours() * 60 + parsed.getMinutes();
}

function daysUntil(value?: string | null) {
  if (!value) return null;

  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

function vehicleComplianceWarnings(vehicle?: Vehicle | null) {
  if (!vehicle) return [];

  const warnings: string[] = [];
  const taxDays = daysUntil(vehicle.taxDueDate);
  const motDays = daysUntil(vehicle.motExpiry);

  if (taxDays !== null && taxDays <= 30) {
    warnings.push(
      taxDays < 0
        ? `Vehicle tax expired ${Math.abs(taxDays)} day${Math.abs(taxDays) === 1 ? "" : "s"} ago`
        : taxDays === 0
          ? "Vehicle tax is due today"
          : `Vehicle tax is due in ${taxDays} day${taxDays === 1 ? "" : "s"}`,
    );
  }

  if (motDays !== null && motDays <= 30) {
    warnings.push(
      motDays < 0
        ? `MOT expired ${Math.abs(motDays)} day${Math.abs(motDays) === 1 ? "" : "s"} ago`
        : motDays === 0
          ? "MOT expires today"
          : `MOT expires in ${motDays} day${motDays === 1 ? "" : "s"}`,
    );
  }

  return warnings;
}

function statusClasses(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-600 bg-emerald-50 text-emerald-950";

    case "IN_PROGRESS":
      return "border-blue-600 bg-blue-50 text-blue-950";

    case "ASSIGNED":
      return "border-indigo-600 bg-indigo-50 text-indigo-950";

    case "CONFIRMED":
      return "border-[#FF6A00] bg-orange-50 text-orange-950";

    case "PENDING_PAYMENT":
      return "border-amber-500 bg-amber-50 text-amber-950";

    case "CANCELLED":
    case "EXPIRED":
      return "border-red-500 bg-red-50 text-red-950";

    default:
      return "border-slate-500 bg-slate-50 text-slate-950";
  }
}

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminBookingsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAdminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedAdminKey);
  }, []);

  const loadBookings = useCallback(
    async (refresh = false) => {
      if (!adminKey) {
        setBookings([]);
        setVehicles([]);
        setDrivers([]);
        setLoading(false);
        setError(
          "Admin key is required. Unlock the admin area from Driver Management.",
        );
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: String(PAGE_SIZE),
          status: "ALL",
          vehicleId: "ALL",
          driverId: "ALL",
          dateFrom: selectedDate,
          dateTo: selectedDate,
        });

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
      } catch (requestError) {
        setBookings([]);
        setVehicles([]);
        setDrivers([]);

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
    [adminKey, selectedDate],
  );

  useEffect(() => {
    if (adminKey) {
      void loadBookings();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadBookings]);

  function moveSelectedDate(days: number) {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + days);

    setSelectedDate(dateInputValue(nextDate));
    setSelectedBooking(null);
  }

  function selectToday() {
    setSelectedDate(dateInputValue());
    setSelectedBooking(null);
  }

  const hours = useMemo(() => {
    return Array.from(
      { length: END_HOUR - START_HOUR + 1 },
      (_, index) => START_HOUR + index,
    );
  }, []);

  const timelineWidth = (END_HOUR - START_HOUR) * HOUR_WIDTH;

  const bookingsByVehicle = useMemo(() => {
    const map = new Map<string, Booking[]>();

    vehicles.forEach((vehicle) => {
      map.set(vehicle.id, []);
    });

    bookings.forEach((booking) => {
      if (["CANCELLED", "EXPIRED"].includes(booking.status)) {
        return;
      }

      if (!booking.vehicle?.id) {
        return;
      }

      const current = map.get(booking.vehicle.id) || [];
      current.push(booking);
      map.set(booking.vehicle.id, current);
    });

    return map;
  }, [bookings, vehicles]);

  const operationalBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => !["CANCELLED", "EXPIRED"].includes(booking.status),
      ),
    [bookings],
  );

  const unassignedBookings = useMemo(
    () => operationalBookings.filter((booking) => !booking.vehicle?.id),
    [operationalBookings],
  );

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Transport Operations
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Existing Bookings
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            View existing bookings against each vehicle and its occupied time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBookings(true)}
          disabled={refreshing || loading || !adminKey}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => moveSelectedDate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="Previous day"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={selectToday}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => moveSelectedDate(1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="Next day"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-bold text-slate-700">
              Select Date
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setSelectedBooking(null);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
              <CalendarDays size={21} />
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Selected Date
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {displaySelectedDate(selectedDate)}
              </h2>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Vehicle Booking Calendar
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {bookings.length} booking{bookings.length === 1 ? "" : "s"} on{" "}
              {displaySelectedDate(selectedDate)}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Clock3 size={17} />
            00:00 - 24:00
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FF6A00]" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                Loading booking calendar
              </p>
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <Truck className="mx-auto h-12 w-12 text-slate-300" />

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No active vehicles found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Active fleet vehicles will appear as rows on this calendar.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="min-w-max"
              style={{
                width: VEHICLE_COLUMN_WIDTH + timelineWidth,
              }}
            >
              <div className="flex border-b border-slate-300 bg-slate-50">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-5"
                  style={{
                    width: VEHICLE_COLUMN_WIDTH,
                    height: 58,
                  }}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Vehicle
                    </p>
                  </div>
                </div>

                <div
                  className="relative shrink-0"
                  style={{
                    width: timelineWidth,
                    height: 58,
                  }}
                >
                  {hours.map((hour, index) => {
                    const left = index * HOUR_WIDTH;

                    return (
                      <div
                        key={hour}
                        className="absolute top-0 h-full border-l border-slate-300"
                        style={{
                          left,
                        }}
                      >
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">
                          {String(hour).padStart(2, "0")}:00
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {vehicles.map((vehicle) => {
                const vehicleBookings =
                  bookingsByVehicle.get(vehicle.id) || [];

                return (
                  <div
                    key={vehicle.id}
                    className="flex border-b border-slate-200 last:border-b-0"
                    style={{
                      minHeight: ROW_HEIGHT,
                    }}
                  >
                    <div
                      className="sticky left-0 z-20 flex shrink-0 items-center border-r border-slate-300 bg-white px-5"
                      style={{
                        width: VEHICLE_COLUMN_WIDTH,
                        height: ROW_HEIGHT,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Truck
                            size={18}
                            className="shrink-0 text-[#E55300]"
                          />

                          <p className="truncate text-sm font-bold text-slate-950">
                            {vehicle.name}
                          </p>
                        </div>

                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {vehicle.registration || "No registration"}
                        </p>

                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {vehicle.vehicleType}
                        </p>

                        {vehicleComplianceWarnings(vehicle).length > 0 ? (
                          <p
                            className="mt-1 truncate text-[10px] font-bold text-amber-700"
                            title={vehicleComplianceWarnings(vehicle).join(" · ")}
                          >
                            Tax / MOT due within 30 days
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="relative shrink-0 bg-white"
                      style={{
                        width: timelineWidth,
                        height: ROW_HEIGHT,
                      }}
                    >
                      {hours.map((hour, index) => (
                        <div
                          key={`${vehicle.id}-${hour}`}
                          className="pointer-events-none absolute top-0 h-full border-l border-slate-200"
                          style={{
                            left: index * HOUR_WIDTH,
                          }}
                        />
                      ))}

                      {vehicleBookings.map((booking) => (
                        <BookingBlock
                          key={booking.id}
                          booking={booking}
                          onClick={() => setSelectedBooking(booking)}
                        />
                      ))}

                      {vehicleBookings.length === 0 ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-5">
                          <span className="text-xs font-medium text-slate-300">
                            Available
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {!loading && unassignedBookings.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Truck size={19} />
            </span>

            <div>
              <h2 className="font-bold text-amber-950">
                Unassigned Bookings
              </h2>

              <p className="mt-1 text-sm text-amber-800">
                These bookings do not currently have a vehicle assigned, so
                they cannot be placed on a vehicle row.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unassignedBookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => setSelectedBooking(booking)}
                className="rounded-2xl border border-amber-200 bg-white p-4 text-left transition hover:border-amber-300 hover:shadow-sm"
              >
                <p className="text-sm font-bold text-slate-950">
                  {bookingCustomerName(booking)}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {booking.reference}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {bookingTimeText(booking)}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedBooking ? (
        <BookingDetailsModal
          booking={selectedBooking}
          vehicles={vehicles}
          drivers={drivers}
          adminKey={adminKey}
          onAssigned={async () => {
            setSelectedBooking(null);
            await loadBookings(true);
          }}
          onCancelled={async () => {
            setSelectedBooking(null);
            await loadBookings(true);
          }}
          onClose={() => setSelectedBooking(null)}
        />
      ) : null}
    </div>
  );
}

function BookingBlock({
  booking,
  onClick,
}: {
  booking: Booking;
  onClick: () => void;
}) {
  const startMinutes = minutesFromStartOfDay(booking.estimatedStartTime);
  const endMinutes = minutesFromStartOfDay(booking.estimatedEndTime);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const timelineStartMinutes = START_HOUR * 60;
  const timelineEndMinutes = END_HOUR * 60;

  const visibleStart = Math.max(startMinutes, timelineStartMinutes);
  const visibleEnd = Math.min(endMinutes, timelineEndMinutes);

  if (visibleEnd <= timelineStartMinutes || visibleStart >= timelineEndMinutes) {
    return null;
  }

  if (visibleEnd <= visibleStart) {
    return null;
  }

  const left =
    ((visibleStart - timelineStartMinutes) / 60) * HOUR_WIDTH;

  const width =
    ((visibleEnd - visibleStart) / 60) * HOUR_WIDTH;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${bookingCustomerName(booking)} · ${bookingTimeText(booking)}`}
      className={`absolute top-3 z-10 overflow-hidden rounded-xl border-l-4 px-3 py-2 text-left shadow-sm transition hover:z-20 hover:-translate-y-0.5 hover:shadow-md ${statusClasses(
        booking.status,
      )}`}
      style={{
        left: left + 3,
        width: Math.max(width - 6, 46),
        height: ROW_HEIGHT - 24,
      }}
    >
      <p className="truncate text-sm font-extrabold">
        {bookingCustomerName(booking)}
      </p>

      <p className="mt-1 truncate text-[11px] font-bold opacity-75">
        {bookingTimeText(booking)}
      </p>

      {width >= 125 ? (
        <p className="mt-0.5 truncate text-[10px] font-semibold opacity-60">
          {booking.reference}
        </p>
      ) : null}
    </button>
  );
}

function BookingDetailsModal({
  booking,
  vehicles,
  drivers,
  adminKey,
  onAssigned,
  onCancelled,
  onClose,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
  adminKey: string;
  onAssigned: () => Promise<void>;
  onCancelled: () => Promise<void>;
  onClose: () => void;
}) {
  const requiredVehicleType =
    booking.vehicleType || booking.quote?.vehicleSize || booking.vehicle?.vehicleType || "";

  const eligibleVehicles = vehicles.filter(
    (vehicle) => !requiredVehicleType || vehicle.vehicleType === requiredVehicleType,
  );

  const [vehicleId, setVehicleId] = useState(booking.vehicle?.id || "");
  const [driverId, setDriverId] = useState(booking.driver?.id || "");
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState("");

  async function submitAssignment(complianceOverride = false) {
    if (!vehicleId || !driverId) {
      setAssignmentError("Select both a vehicle and a driver.");
      return;
    }

    setAssigning(true);
    setAssignmentError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/planning/bookings/${booking.id}/assignment`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            vehicleId,
            driverId,
            complianceOverride,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        code?: string;
        error?: string;
      };

      if (
        response.status === 409 &&
        payload.code === "VEHICLE_COMPLIANCE_WARNING" &&
        !complianceOverride
      ) {
        const continueAssignment = window.confirm(
          `${payload.error || "The selected vehicle has a compliance warning."}\n\nDo you want to override the warning and assign it anyway?`,
        );

        if (continueAssignment) {
          setAssigning(false);
          await submitAssignment(true);
          return;
        }

        throw new Error("Vehicle assignment cancelled because of the compliance warning.");
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to assign this booking.");
      }

      await onAssigned();
    } catch (requestError) {
      setAssignmentError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign this booking.",
      );
    } finally {
      setAssigning(false);
    }
  }

  async function cancelBooking() {
    const confirmed = window.confirm(
      `Cancel ${booking.reference}? This will release any reserved vehicle capacity and keep the booking as Cancelled for history.`,
    );

    if (!confirmed) return;

    setCancelling(true);
    setCancellationError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/admin/${booking.id}/cancel`,
        {
          method: "POST",
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to cancel this booking.");
      }

      await onCancelled();
    } catch (requestError) {
      setCancellationError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to cancel this booking.",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
              Existing Booking
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {bookingCustomerName(booking)}
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              {booking.reference}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close booking"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(
                booking.status,
              )}`}
            >
              {statusLabel(booking.status)}
            </span>

            <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
              <Clock3 size={16} className="text-[#E55300]" />
              {bookingTimeText(booking)}
            </span>
          </div>

          {vehicleComplianceWarnings(booking.vehicle).length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">
                Vehicle compliance warning
              </p>

              <div className="mt-2 space-y-1">
                {vehicleComplianceWarnings(booking.vehicle).map((warning) => (
                  <p key={warning} className="text-sm font-semibold text-amber-800">
                    {warning}
                  </p>
                ))}
              </div>

              <p className="mt-3 text-xs font-semibold text-amber-700">
                Admin can bypass this warning and continue with the booking.
              </p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailItem
              label="Date"
              value={displayDate(booking.collectionDate)}
            />

            <DetailItem
              label="Price"
              value={money(booking.totalPrice)}
            />

            <DetailItem
              label="Vehicle"
              value={
                booking.vehicle
                  ? `${booking.vehicle.name}${
                      booking.vehicle.registration
                        ? ` · ${booking.vehicle.registration}`
                        : ""
                    }`
                  : "Unassigned"
              }
            />

            <DetailItem
              label="Driver"
              value={booking.driver?.name || "Unassigned"}
            />

            <DetailItem
              label="Collection Address"
              value={booking.collectionAddress}
            />

            <DetailItem
              label="Delivery Address"
              value={booking.deliveryAddress}
            />

            {booking.returnAddress ? (
              <DetailItem
                label="Return Address"
                value={booking.returnAddress}
              />
            ) : null}

            {booking.customerReference ? (
              <DetailItem
                label="Customer Reference"
                value={booking.customerReference}
              />
            ) : null}

            {booking.purchaseOrderNumber ? (
              <DetailItem
                label="Purchase Order Number"
                value={booking.purchaseOrderNumber}
              />
            ) : null}
          </div>

          {!booking.vehicle?.id || !booking.driver?.id ? (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Planning Assignment
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Assign the exact fleet vehicle and driver for this booking.
                    {requiredVehicleType
                      ? ` Required vehicle category: ${requiredVehicleType}.`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vehicle
                  </span>

                  <select
                    value={vehicleId}
                    onChange={(event) => {
                      setVehicleId(event.target.value);
                      setAssignmentError("");
                    }}
                    disabled={assigning}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select vehicle</option>

                    {eligibleVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}
                        {vehicle.registration ? ` · ${vehicle.registration}` : " · No registration"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Driver
                  </span>

                  <select
                    value={driverId}
                    onChange={(event) => {
                      setDriverId(event.target.value);
                      setAssignmentError("");
                    }}
                    disabled={assigning}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select driver</option>

                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                        {driver.availability ? ` · ${statusLabel(driver.availability)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {eligibleVehicles.length === 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  No active {requiredVehicleType || "matching"} fleet vehicle is available to select.
                </div>
              ) : null}

              {assignmentError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {assignmentError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submitAssignment()}
                disabled={assigning || !vehicleId || !driverId}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assigning ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Assigning Booking
                  </>
                ) : (
                  <>
                    <Truck size={17} />
                    Assign Booking
                  </>
                )}
              </button>
            </div>
          ) : null}

          {!["CANCELLED", "COMPLETED", "EXPIRED"].includes(booking.status) ? (
            <div className="mt-6 border-t border-slate-200 pt-6">
              {cancellationError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {cancellationError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void cancelBooking()}
                disabled={cancelling || assigning}
                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelling ? "Cancelling Booking..." : "Cancel Booking"}
              </button>
            </div>
          ) : null}

          {booking.internalNotes || booking.dispatchNotes ? (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-950">
                Booking Notes
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {booking.internalNotes ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Internal Notes
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {booking.internalNotes}
                    </p>
                  </div>
                ) : null}

                {booking.dispatchNotes ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Dispatch Notes
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {booking.dispatchNotes}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DetailItem({
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

      <p className="mt-2 break-words text-sm font-bold leading-6 text-slate-800">
        {value}
      </p>
    </div>
  );
}