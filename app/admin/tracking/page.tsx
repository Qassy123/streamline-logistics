"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  UserRound,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

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

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  active?: boolean;
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
  vehicle?: Vehicle | null;
  latestLocation?: Location | null;
  locationStale?: boolean;
  trackingEvents: TrackingEvent[];
};

type TrackingPayload = {
  bookings?: Booking[];
  error?: string;
};

type VehiclePayload = {
  vehicles?: Vehicle[];
  data?: Vehicle[];
  error?: string;
};

function formatDateTime(value?: string | null) {
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

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isCurrentBooking(booking: Booking) {
  return ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(booking.status);
}

export default function AdminTrackingPage() {
  const [adminKey, setAdminKey] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAdminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedAdminKey);

    if (!storedAdminKey) {
      setLoadingVehicles(false);
      setError(
        "Admin key is missing. Unlock the admin area first, then return to Tracking.",
      );
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    if (!adminKey) return;

    setLoadingVehicles(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/vehicles`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | VehiclePayload
        | Vehicle[];

      if (!response.ok) {
        throw new Error(
          !Array.isArray(payload) && payload.error
            ? payload.error
            : "Unable to load vehicles.",
        );
      }

      const vehicleList = Array.isArray(payload)
        ? payload
        : payload.vehicles || payload.data || [];

      setVehicles(
        vehicleList
          .filter((vehicle) => vehicle.active !== false)
          .sort((a, b) =>
            (a.registration || a.name).localeCompare(
              b.registration || b.name,
            ),
          ),
      );
    } catch (requestError) {
      setVehicles([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load vehicles.",
      );
    } finally {
      setLoadingVehicles(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) {
      void loadVehicles();
    }
  }, [adminKey, loadVehicles]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicles],
  );

  const visibleVehicles = useMemo(() => {
    const query = registrationSearch.trim().toLowerCase();

    if (!query) return vehicles;

    return vehicles.filter((vehicle) => {
      const registration = vehicle.registration?.toLowerCase() || "";
      const name = vehicle.name.toLowerCase();
      const type = vehicle.vehicleType.toLowerCase();

      return (
        registration.includes(query) ||
        name.includes(query) ||
        type.includes(query)
      );
    });
  }, [registrationSearch, vehicles]);

  const currentBooking = useMemo(() => {
    const current =
      bookings.find(
        (booking) =>
          booking.status === "IN_PROGRESS" &&
          booking.trackingStartedAt &&
          !booking.trackingEndedAt,
      ) ||
      bookings.find(
        (booking) =>
          booking.status === "IN_PROGRESS" ||
          booking.status === "ASSIGNED",
      ) ||
      bookings.find((booking) => isCurrentBooking(booking));

    return current || bookings[0] || null;
  }, [bookings]);

  async function trackVehicle(vehicle: Vehicle) {
    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    const searchTerm = vehicle.registration || vehicle.name;

    setSelectedVehicleId(vehicle.id);
    setLoadingTracking(true);
    setBookings([]);
    setError("");

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        status: "ALL",
        activeOnly: "false",
        search: searchTerm,
      });

      const response = await fetch(
        `${API_BASE}/api/tracking/admin/list?${params.toString()}`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as TrackingPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load tracking.");
      }

      const matchingBookings = (payload.bookings || []).filter(
        (booking) => booking.vehicle?.id === vehicle.id,
      );

      setBookings(matchingBookings);
    } catch (requestError) {
      setBookings([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load tracking.",
      );
    } finally {
      setLoadingTracking(false);
    }
  }

  async function refreshTracking() {
    if (selectedVehicle) {
      await trackVehicle(selectedVehicle);
      return;
    }

    await loadVehicles();
  }

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Tab 7
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Tracking
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Choose a vehicle registration to view its current booking, driver,
            status, journey timeline and available live location.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshTracking()}
          disabled={loadingVehicles || loadingTracking || !adminKey}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              loadingVehicles || loadingTracking ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <div>
            <label
              htmlFor="registration-search"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Search Registration
            </label>

            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="registration-search"
                value={registrationSearch}
                onChange={(event) =>
                  setRegistrationSearch(event.target.value)
                }
                placeholder="e.g. ABC 123"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Choose Vehicle
            </span>

            {loadingVehicles ? (
              <div className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Loading vehicles...
              </div>
            ) : (
              <select
                value={selectedVehicleId}
                onChange={(event) => {
                  const vehicle = vehicles.find(
                    (item) => item.id === event.target.value,
                  );

                  if (vehicle) {
                    void trackVehicle(vehicle);
                  } else {
                    setSelectedVehicleId("");
                    setBookings([]);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              >
                <option value="">Select vehicle registration</option>

                {visibleVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration || vehicle.name} —{" "}
                    {vehicle.vehicleType}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {!selectedVehicle ? (
        <section className="mt-6 flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <div>
            <Truck className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-slate-950">
              Choose a vehicle to track
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Select a registration above to view its booking and tracking
              information.
            </p>
          </div>
        </section>
      ) : loadingTracking ? (
        <section className="mt-6 flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
            <Loader2 size={22} className="animate-spin text-[#FF6A00]" />
            Loading tracking information...
          </div>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Selected Vehicle
            </p>

            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
                <Truck size={21} />
              </span>

              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {selectedVehicle.registration || selectedVehicle.name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {selectedVehicle.vehicleType}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Current Status
              </p>

              <p className="mt-2 text-lg font-bold text-slate-950">
                {currentBooking
                  ? formatStatus(currentBooking.status)
                  : "No current booking"}
              </p>
            </div>

            {currentBooking ? (
              <>
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Driver
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <UserRound size={17} className="text-slate-400" />
                    <span className="font-bold text-slate-800">
                      {currentBooking.driver?.name || "Not assigned"}
                    </span>
                  </div>

                  {currentBooking.driver?.phone ? (
                    <p className="mt-1 pl-6 text-sm text-slate-500">
                      {currentBooking.driver.phone}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Booking
                  </p>
                  <p className="mt-2 font-bold text-slate-950">
                    {currentBooking.reference}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(currentBooking.collectionDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {currentBooking.collectionWindow}
                  </p>
                </div>
              </>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!currentBooking ? (
              <div className="flex min-h-[420px] items-center justify-center text-center">
                <div>
                  <Clock3 className="mx-auto h-11 w-11 text-slate-300" />
                  <h2 className="mt-4 text-lg font-bold text-slate-950">
                    No booking found for this vehicle
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    There is currently no booking or tracking record linked to
                    this vehicle.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E55300]">
                    Current Assigned Job
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {currentBooking.reference}
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <InfoBlock
                      label="Collection"
                      value={currentBooking.collectionAddress}
                    />
                    <InfoBlock
                      label="Delivery"
                      value={currentBooking.deliveryAddress}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        Live Location
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Latest location shared by the driver.
                      </p>
                    </div>

                    {currentBooking.locationStale ? (
                      <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                        Location may be stale
                      </span>
                    ) : null}
                  </div>

                  {currentBooking.latestLocation ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start gap-3">
                        <MapPin
                          size={20}
                          className="mt-0.5 shrink-0 text-[#E55300]"
                        />

                        <div>
                          <p className="font-bold text-slate-950">
                            {currentBooking.latestLocation.latitude},{" "}
                            {currentBooking.latestLocation.longitude}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Last updated{" "}
                            {formatDateTime(
                              currentBooking.latestLocation.createdAt,
                            )}
                          </p>

                          <a
                            href={`https://www.google.com/maps?q=${currentBooking.latestLocation.latitude},${currentBooking.latestLocation.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-sm font-bold text-[#E55300] hover:underline"
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                      No live location has been shared for this booking yet.
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-slate-950">
                    Job Timeline
                  </h3>

                  {currentBooking.trackingEvents.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                      No tracking events recorded yet.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-0">
                      {currentBooking.trackingEvents.map((event, index) => (
                        <div
                          key={event.id}
                          className="grid grid-cols-[24px_minmax(0,1fr)] gap-3"
                        >
                          <div className="flex flex-col items-center">
                            <span className="mt-1 h-3 w-3 rounded-full bg-[#FF6A00]" />
                            {index <
                            currentBooking.trackingEvents.length - 1 ? (
                              <span className="min-h-12 w-px flex-1 bg-slate-200" />
                            ) : null}
                          </div>

                          <div className="pb-5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-bold text-slate-950">
                                {event.title}
                              </p>
                              <span className="text-xs font-semibold text-slate-400">
                                {formatDateTime(event.createdAt)}
                              </span>
                            </div>

                            {event.description ? (
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {event.description}
                              </p>
                            ) : null}

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {formatStatus(event.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {bookings.length > 1 ? (
                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-bold text-slate-950">
                      Previous Bookings
                    </h3>
                    <div className="mt-4 space-y-2">
                      {bookings
                        .filter(
                          (booking) => booking.id !== currentBooking.id,
                        )
                        .slice(0, 10)
                        .map((booking) => (
                          <div
                            key={booking.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                          >
                            <div>
                              <p className="font-bold text-slate-800">
                                {booking.reference}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(booking.collectionDate)}
                              </p>
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                              {formatStatus(booking.status)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function InfoBlock({
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
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}
