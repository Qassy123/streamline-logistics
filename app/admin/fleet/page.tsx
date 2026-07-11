"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 25;

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  availability: string;
  vehicleId?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
  } | null;
  driver?: Driver | null;
};

type Reservation = {
  id: string;
  status: string;
  reservedFrom: string;
  reservedUntil: string;
};

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  active: boolean;
  registration?: string | null;
  motExpiry?: string | null;
  insuranceExpiry?: string | null;
  serviceDueDate?: string | null;
  gpsDeviceId?: string | null;
  createdAt: string;
  updatedAt: string;
  operationalState: string;
  assignedDriver?: Driver | null;
  bookings: Booking[];
  reservations: Reservation[];
};

type Payload = {
  vehicles?: Vehicle[];
  vehicle?: Vehicle;
  drivers?: Driver[];
  vehicleTypes?: string[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    total: number;
    active: number;
    inactive: number;
    byState: Record<string, number>;
  };
  error?: string;
};

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

function stateClass(state: string) {
  switch (state) {
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "IN_USE":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "RESERVED":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "SERVICE_DUE":
    case "COMPLIANCE_EXPIRED":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function AdminFleetPage() {
  const [adminKey, setAdminKey] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [creating, setCreating] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("ALL");
  const [active, setActive] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byState: {} as Record<string, number>,
  });

  const [name, setName] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("");
  const [registration, setRegistration] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [motExpiry, setMotExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [serviceDueDate, setServiceDueDate] = useState("");
  const [gpsDeviceId, setGpsDeviceId] = useState("");
  const [driverId, setDriverId] = useState("");

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

  const loadFleet = useCallback(
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
          vehicleType,
          active,
          state,
        });

        if (search) params.set("search", search);

        const response = await fetch(
          `${API_BASE}/api/vehicles/admin/list?${params.toString()}`,
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

          throw new Error(payload.error || "Unable to load fleet.");
        }

        setVehicles(payload.vehicles || []);
        setDrivers(payload.drivers || []);
        setVehicleTypes(payload.vehicleTypes || []);
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
            total: 0,
            active: 0,
            inactive: 0,
            byState: {},
          },
        );
      } catch (requestError) {
        setVehicles([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load fleet.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [active, adminKey, page, search, state, vehicleType],
  );

  useEffect(() => {
    if (adminKey) {
      void loadFleet();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadFleet]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (search) count += 1;
    if (vehicleType !== "ALL") count += 1;
    if (active !== "ALL") count += 1;
    if (state !== "ALL") count += 1;
    return count;
  }, [active, search, state, vehicleType]);

  function resetForm() {
    setName("");
    setEditVehicleType("");
    setRegistration("");
    setIsActive(true);
    setMotExpiry("");
    setInsuranceExpiry("");
    setServiceDueDate("");
    setGpsDeviceId("");
    setDriverId("");
  }

  function openVehicle(vehicle: Vehicle) {
    setSelected(vehicle);
    setCreating(false);
    setName(vehicle.name);
    setEditVehicleType(vehicle.vehicleType);
    setRegistration(vehicle.registration || "");
    setIsActive(vehicle.active);
    setMotExpiry(dateInput(vehicle.motExpiry));
    setInsuranceExpiry(dateInput(vehicle.insuranceExpiry));
    setServiceDueDate(dateInput(vehicle.serviceDueDate));
    setGpsDeviceId(vehicle.gpsDeviceId || "");
    setDriverId(vehicle.assignedDriver?.id || "");
    setError("");
    setMessage("");
  }

  function openCreate() {
    setSelected(null);
    setCreating(true);
    resetForm();
    setError("");
    setMessage("");
  }

  async function saveVehicle() {
    if (!adminKey) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        selected
          ? `${API_BASE}/api/vehicles/admin/${selected.id}`
          : `${API_BASE}/api/vehicles/admin`,
        {
          method: selected ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            name,
            vehicleType: editVehicleType,
            registration: registration || null,
            active: isActive,
            motExpiry: motExpiry || null,
            insuranceExpiry: insuranceExpiry || null,
            serviceDueDate: serviceDueDate || null,
            gpsDeviceId: gpsDeviceId || null,
            driverId: driverId || null,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save vehicle.");
      }

      setMessage(
        selected
          ? "Vehicle updated successfully."
          : "Vehicle created successfully.",
      );
      setCreating(false);
      setSelected(null);
      resetForm();
      await loadFleet(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save vehicle.",
      );
    } finally {
      setSaving(false);
    }
  }

  const panelOpen = Boolean(selected) || creating;

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
            Fleet management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Manage vehicle records, availability, compliance dates, GPS
            identifiers, drivers, reservations and scheduled work.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadFleet(true)}
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300]"
          >
            <Plus size={18} />
            Add vehicle
          </button>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Fleet total" value={summary.total} icon={Truck} />
        <SummaryCard label="Available" value={summary.byState.AVAILABLE || 0} icon={CheckCircle2} />
        <SummaryCard label="In use" value={summary.byState.IN_USE || 0} icon={CalendarDays} />
        <SummaryCard label="Reserved" value={summary.byState.RESERVED || 0} icon={CalendarDays} />
        <SummaryCard
          label="Attention required"
          value={
            (summary.byState.SERVICE_DUE || 0) +
            (summary.byState.COMPLIANCE_EXPIRED || 0)
          }
          icon={CircleAlert}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_180px_220px_auto]">
          <label className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search vehicle name, registration, type or GPS device"
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={vehicleType}
            onChange={(event) => {
              setVehicleType(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All vehicle types</option>
            {vehicleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All records</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="ALL">All operational states</option>
            <option value="AVAILABLE">Available</option>
            <option value="IN_USE">In use</option>
            <option value="RESERVED">Reserved</option>
            <option value="SERVICE_DUE">Service due</option>
            <option value="COMPLIANCE_EXPIRED">Compliance expired</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setVehicleType("ALL");
                setActive("ALL");
                setState("ALL");
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
            <h2 className="text-lg font-bold text-slate-950">Vehicles</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching vehicle
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
        ) : vehicles.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
            <div>
              <Truck className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">
                No vehicles found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or add a new vehicle.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {vehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_220px_220px_180px_auto] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">
                      {vehicle.name}
                    </h3>
                    <Badge className={stateClass(vehicle.operationalState)}>
                      {vehicle.operationalState}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {vehicle.vehicleType}
                    {vehicle.registration
                      ? ` · ${vehicle.registration}`
                      : ""}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    GPS: {vehicle.gpsDeviceId || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Driver
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {vehicle.assignedDriver?.name || "Not assigned"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {vehicle.assignedDriver?.availability || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Compliance
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    MOT {date(vehicle.motExpiry)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Insurance {date(vehicle.insuranceExpiry)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Scheduled work
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {vehicle.bookings.length} bookings
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {vehicle.reservations.length} reservations
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openVehicle(vehicle)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Pencil size={17} />
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}

        {!loading && vehicles.length > 0 ? (
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

      {panelOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  {creating ? "Add vehicle" : "Manage vehicle"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {creating ? "New fleet vehicle" : selected?.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSelected(null);
                }}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Vehicle name" value={name} onChange={setName} />
                <Field
                  label="Vehicle type"
                  value={editVehicleType}
                  onChange={setEditVehicleType}
                />
                <Field
                  label="Registration"
                  value={registration}
                  onChange={setRegistration}
                />
                <Field
                  label="MOT expiry"
                  type="date"
                  value={motExpiry}
                  onChange={setMotExpiry}
                />
                <Field
                  label="Insurance expiry"
                  type="date"
                  value={insuranceExpiry}
                  onChange={setInsuranceExpiry}
                />
                <Field
                  label="Service due date"
                  type="date"
                  value={serviceDueDate}
                  onChange={setServiceDueDate}
                />
                <Field
                  label="GPS device ID"
                  value={gpsDeviceId}
                  onChange={setGpsDeviceId}
                />

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Assigned driver
                  </span>
                  <select
                    value={driverId}
                    onChange={(event) => setDriverId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="">Not assigned</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    Active vehicle
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveVehicle()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : creating ? (
                  <Plus size={18} />
                ) : (
                  <Pencil size={18} />
                )}
                {creating ? "Create vehicle" : "Save vehicle changes"}
              </button>

              {selected ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoCard
                      label="Operational state"
                      value={selected.operationalState}
                      icon={Truck}
                    />
                    <InfoCard
                      label="Assigned driver"
                      value={selected.assignedDriver?.name || "Not assigned"}
                      icon={UserRound}
                    />
                    <InfoCard
                      label="Service due"
                      value={date(selected.serviceDueDate)}
                      icon={Wrench}
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="font-bold text-slate-950">
                      Upcoming bookings
                    </h3>

                    <div className="mt-4 space-y-3">
                      {selected.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-bold text-slate-950">
                              {booking.reference}
                            </p>
                            <Badge className={stateClass(
                              booking.status === "IN_PROGRESS"
                                ? "IN_USE"
                                : "RESERVED",
                            )}>
                              {booking.status}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {booking.collectionAddress} →{" "}
                            {booking.deliveryAddress}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {date(booking.collectionDate)}
                          </p>
                        </div>
                      ))}

                      {selected.bookings.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No active bookings linked to this vehicle.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
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