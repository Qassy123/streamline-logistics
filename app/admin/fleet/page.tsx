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
  ShieldCheck,
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

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
];

const VEHICLE_STATUSES = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "OUT_ON_JOB", label: "Out on job" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Inactive" },
];

const OPERATIONAL_STATES = [
  { value: "ALL", label: "All operational states" },
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "OUT_ON_JOB", label: "Out on job" },
  { value: "IN_USE", label: "In use" },
  { value: "RESERVED", label: "Reserved" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "SERVICE_DUE", label: "Service due" },
  { value: "COMPLIANCE_EXPIRED", label: "Compliance expired" },
  { value: "INACTIVE", label: "Inactive" },
];

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
  vehicleCategory?: string | null;
  status: string;
  active: boolean;
  registration?: string | null;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  fuelType?: string | null;
  engineCapacity?: string | null;
  co2Emissions?: string | null;
  dateOfFirstRegistration?: string | null;
  taxDueDate?: string | null;
  motExpiry?: string | null;
  euroEmissionsStatus?: string | null;
  mileage?: number | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiry?: string | null;
  serviceDueDate?: string | null;
  maintenanceNotes?: string | null;
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

type EditForm = {
  name: string;
  vehicleType: string;
  vehicleCategory: string;
  registration: string;
  make: string;
  model: string;
  colour: string;
  fuelType: string;
  engineCapacity: string;
  co2Emissions: string;
  dateOfFirstRegistration: string;
  taxDueDate: string;
  motExpiry: string;
  euroEmissionsStatus: string;
  mileage: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  serviceDueDate: string;
  maintenanceNotes: string;
  gpsDeviceId: string;
  driverId: string;
  status: string;
  active: boolean;
};

const EMPTY_EDIT_FORM: EditForm = {
  name: "",
  vehicleType: VEHICLE_TYPES[0],
  vehicleCategory: VEHICLE_TYPES[0],
  registration: "",
  make: "",
  model: "",
  colour: "",
  fuelType: "",
  engineCapacity: "",
  co2Emissions: "",
  dateOfFirstRegistration: "",
  taxDueDate: "",
  motExpiry: "",
  euroEmissionsStatus: "",
  mileage: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  insuranceExpiry: "",
  serviceDueDate: "",
  maintenanceNotes: "",
  gpsDeviceId: "",
  driverId: "",
  status: "AVAILABLE",
  active: true,
};

function displayDate(value?: string | null) {
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

function stateLabel(state: string) {
  return (
    OPERATIONAL_STATES.find((item) => item.value === state)?.label ||
    state.replaceAll("_", " ")
  );
}

function stateClass(state: string) {
  switch (state) {
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "BOOKED":
    case "RESERVED":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "OUT_ON_JOB":
    case "IN_USE":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "MAINTENANCE":
    case "SERVICE_DUE":
      return "bg-orange-50 text-orange-700 ring-orange-200";
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
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);

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

  function openVehicle(vehicle: Vehicle) {
    setSelected(vehicle);
    setEditForm({
      name: vehicle.name,
      vehicleType: vehicle.vehicleType,
      vehicleCategory: vehicle.vehicleCategory || vehicle.vehicleType,
      registration: vehicle.registration || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      colour: vehicle.colour || "",
      fuelType: vehicle.fuelType || "",
      engineCapacity: vehicle.engineCapacity || "",
      co2Emissions: vehicle.co2Emissions || "",
      dateOfFirstRegistration: dateInput(vehicle.dateOfFirstRegistration),
      taxDueDate: dateInput(vehicle.taxDueDate),
      motExpiry: dateInput(vehicle.motExpiry),
      euroEmissionsStatus: vehicle.euroEmissionsStatus || "",
      mileage:
        vehicle.mileage === null || vehicle.mileage === undefined
          ? ""
          : String(vehicle.mileage),
      insuranceProvider: vehicle.insuranceProvider || "",
      insurancePolicyNumber: vehicle.insurancePolicyNumber || "",
      insuranceExpiry: dateInput(vehicle.insuranceExpiry),
      serviceDueDate: dateInput(vehicle.serviceDueDate),
      maintenanceNotes: vehicle.maintenanceNotes || "",
      gpsDeviceId: vehicle.gpsDeviceId || "",
      driverId: vehicle.assignedDriver?.id || "",
      status: vehicle.status || "AVAILABLE",
      active: vehicle.active,
    });
    setError("");
    setMessage("");
  }

  function updateEditForm<K extends keyof EditForm>(
    key: K,
    value: EditForm[K],
  ) {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveVehicle() {
    if (!adminKey || !selected) return;

    if (
      !editForm.name.trim() ||
      !editForm.vehicleType ||
      !editForm.registration.trim()
    ) {
      setError("Vehicle name, vehicle type and registration are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/vehicles/admin/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            ...editForm,
            name: editForm.name.trim(),
            registration: editForm.registration.trim().toUpperCase(),
            vehicleCategory:
              editForm.vehicleCategory.trim() || editForm.vehicleType,
            make: editForm.make.trim() || null,
            model: editForm.model.trim() || null,
            colour: editForm.colour.trim() || null,
            fuelType: editForm.fuelType || null,
            engineCapacity: editForm.engineCapacity.trim() || null,
            co2Emissions: editForm.co2Emissions.trim() || null,
            dateOfFirstRegistration:
              editForm.dateOfFirstRegistration || null,
            taxDueDate: editForm.taxDueDate || null,
            motExpiry: editForm.motExpiry || null,
            euroEmissionsStatus:
              editForm.euroEmissionsStatus.trim() || null,
            mileage: editForm.mileage || null,
            insuranceProvider:
              editForm.insuranceProvider.trim() || null,
            insurancePolicyNumber:
              editForm.insurancePolicyNumber.trim() || null,
            insuranceExpiry: editForm.insuranceExpiry || null,
            serviceDueDate: editForm.serviceDueDate || null,
            maintenanceNotes:
              editForm.maintenanceNotes.trim() || null,
            gpsDeviceId: editForm.gpsDeviceId.trim() || null,
            driverId: editForm.driverId || null,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save vehicle.");
      }

      setMessage("Vehicle updated successfully.");
      setSelected(null);
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

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setVehicleType("ALL");
    setActive("ALL");
    setState("ALL");
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
      >
        <ArrowLeft size={16} />
        Admin dashboard
      </Link>

      <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Fleet administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Fleet management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Manage every vehicle, registration, compliance date, insurance
            record, maintenance note, driver assignment and operational status.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadFleet(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/admin/fleet/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E55300]"
          >
            <Plus size={18} />
            Add vehicle
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total vehicles"
          value={summary.total}
          icon={<Truck size={20} />}
        />
        <SummaryCard
          title="Available"
          value={summary.byState.AVAILABLE || 0}
          icon={<CheckCircle2 size={20} />}
        />
        <SummaryCard
          title="Booked"
          value={
            (summary.byState.BOOKED || 0) +
            (summary.byState.RESERVED || 0)
          }
          icon={<CalendarDays size={20} />}
        />
        <SummaryCard
          title="Out on job"
          value={
            (summary.byState.OUT_ON_JOB || 0) +
            (summary.byState.IN_USE || 0)
          }
          icon={<Truck size={20} />}
        />
        <SummaryCard
          title="Maintenance / inactive"
          value={
            (summary.byState.MAINTENANCE || 0) +
            (summary.byState.SERVICE_DUE || 0) +
            summary.inactive
          }
          icon={<Wrench size={20} />}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(180px,1fr))_auto]">
          <label className="relative block">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, registration, type or GPS ID"
              className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <select
            value={vehicleType}
            onChange={(event) => {
              setVehicleType(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
          >
            <option value="ALL">All vehicle types</option>
            {VEHICLE_TYPES.map((type) => (
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
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
          >
            <option value="ALL">Active and inactive</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
          </select>

          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
          >
            {OPERATIONAL_STATES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilters === 0}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#E55300]" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CircleAlert className="mx-auto text-slate-300" size={42} />
            <h2 className="mt-4 text-xl font-bold text-slate-950">
              No vehicles found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Add a vehicle or adjust the current filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Vehicle</th>
                    <th className="px-5 py-4">Registration</th>
                    <th className="px-5 py-4">Make / model</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Mileage</th>
                    <th className="px-5 py-4">MOT</th>
                    <th className="px-5 py-4">Insurance</th>
                    <th className="px-5 py-4">Service</th>
                    <th className="px-5 py-4">Driver</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">
                          {vehicle.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {vehicle.vehicleType}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {vehicle.registration || "Not recorded"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {[vehicle.make, vehicle.model]
                          .filter(Boolean)
                          .join(" ") || "Not recorded"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${stateClass(
                            vehicle.operationalState,
                          )}`}
                        >
                          {stateLabel(vehicle.operationalState)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {vehicle.mileage === null ||
                        vehicle.mileage === undefined
                          ? "Not recorded"
                          : `${vehicle.mileage.toLocaleString("en-GB")} mi`}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {displayDate(vehicle.motExpiry)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {displayDate(vehicle.insuranceExpiry)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {displayDate(vehicle.serviceDueDate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {vehicle.assignedDriver?.name || "Not assigned"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openVehicle(vehicle)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-orange-300 hover:text-[#E55300]"
                        >
                          <Pencil size={15} />
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total} vehicles
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                  disabled={page >= pagination.totalPages}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close vehicle editor"
            onClick={() => setSelected(null)}
            className="absolute inset-0 cursor-default"
          />

          <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Fleet record
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Edit {selected.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-300 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <EditorSection
                title="Vehicle identity"
                icon={<Truck size={18} />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorField
                    label="Vehicle name"
                    value={editForm.name}
                    onChange={(value) => updateEditForm("name", value)}
                    required
                  />
                  <EditorSelect
                    label="Vehicle category"
                    value={editForm.vehicleCategory}
                    onChange={(value) => {
                      updateEditForm("vehicleCategory", value);
                      updateEditForm("vehicleType", value);
                    }}
                    options={VEHICLE_TYPES}
                  />
                  <EditorSelect
                    label="Vehicle type"
                    value={editForm.vehicleType}
                    onChange={(value) =>
                      updateEditForm("vehicleType", value)
                    }
                    options={VEHICLE_TYPES}
                  />
                  <EditorField
                    label="Registration"
                    value={editForm.registration}
                    onChange={(value) =>
                      updateEditForm("registration", value.toUpperCase())
                    }
                    required
                  />
                  <EditorField
                    label="Make"
                    value={editForm.make}
                    onChange={(value) => updateEditForm("make", value)}
                  />
                  <EditorField
                    label="Model"
                    value={editForm.model}
                    onChange={(value) => updateEditForm("model", value)}
                  />
                  <EditorField
                    label="Colour"
                    value={editForm.colour}
                    onChange={(value) => updateEditForm("colour", value)}
                  />
                  <EditorField
                    label="Fuel type"
                    value={editForm.fuelType}
                    onChange={(value) => updateEditForm("fuelType", value)}
                  />
                  <EditorField
                    label="Engine capacity"
                    value={editForm.engineCapacity}
                    onChange={(value) =>
                      updateEditForm("engineCapacity", value)
                    }
                  />
                  <EditorField
                    label="CO₂ emissions"
                    value={editForm.co2Emissions}
                    onChange={(value) =>
                      updateEditForm("co2Emissions", value)
                    }
                  />
                  <EditorField
                    label="First registration"
                    type="date"
                    value={editForm.dateOfFirstRegistration}
                    onChange={(value) =>
                      updateEditForm("dateOfFirstRegistration", value)
                    }
                  />
                  <EditorField
                    label="Euro emissions status"
                    value={editForm.euroEmissionsStatus}
                    onChange={(value) =>
                      updateEditForm("euroEmissionsStatus", value)
                    }
                  />
                  <EditorField
                    label="Mileage"
                    type="number"
                    value={editForm.mileage}
                    onChange={(value) => updateEditForm("mileage", value)}
                  />
                  <EditorField
                    label="GPS device ID"
                    value={editForm.gpsDeviceId}
                    onChange={(value) =>
                      updateEditForm("gpsDeviceId", value)
                    }
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Compliance and insurance"
                icon={<ShieldCheck size={18} />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorField
                    label="Tax due date"
                    type="date"
                    value={editForm.taxDueDate}
                    onChange={(value) =>
                      updateEditForm("taxDueDate", value)
                    }
                  />
                  <EditorField
                    label="MOT expiry"
                    type="date"
                    value={editForm.motExpiry}
                    onChange={(value) => updateEditForm("motExpiry", value)}
                  />
                  <EditorField
                    label="Insurance provider"
                    value={editForm.insuranceProvider}
                    onChange={(value) =>
                      updateEditForm("insuranceProvider", value)
                    }
                  />
                  <EditorField
                    label="Insurance policy number"
                    value={editForm.insurancePolicyNumber}
                    onChange={(value) =>
                      updateEditForm("insurancePolicyNumber", value)
                    }
                  />
                  <EditorField
                    label="Insurance expiry"
                    type="date"
                    value={editForm.insuranceExpiry}
                    onChange={(value) =>
                      updateEditForm("insuranceExpiry", value)
                    }
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Maintenance and operations"
                icon={<Wrench size={18} />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorField
                    label="Service due date"
                    type="date"
                    value={editForm.serviceDueDate}
                    onChange={(value) =>
                      updateEditForm("serviceDueDate", value)
                    }
                  />
                  <EditorSelect
                    label="Vehicle status"
                    value={editForm.status}
                    onChange={(value) => {
                      updateEditForm("status", value);
                      updateEditForm("active", value !== "INACTIVE");
                    }}
                    options={VEHICLE_STATUSES.map((item) => item.value)}
                    labels={Object.fromEntries(
                      VEHICLE_STATUSES.map((item) => [
                        item.value,
                        item.label,
                      ]),
                    )}
                  />
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Maintenance notes
                    </span>
                    <textarea
                      rows={4}
                      value={editForm.maintenanceNotes}
                      onChange={(event) =>
                        updateEditForm(
                          "maintenanceNotes",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                      <UserRound size={16} />
                      Assigned driver
                    </span>
                    <select
                      value={editForm.driverId}
                      onChange={(event) =>
                        updateEditForm("driverId", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                    >
                      <option value="">Not assigned</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} · {driver.availability}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(event) => {
                      const isActive = event.target.checked;
                      updateEditForm("active", isActive);

                      if (!isActive) {
                        updateEditForm("status", "INACTIVE");
                      } else if (editForm.status === "INACTIVE") {
                        updateEditForm("status", "AVAILABLE");
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">
                      Active vehicle
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Inactive vehicles are removed from normal booking
                      allocation.
                    </span>
                  </span>
                </label>
              </EditorSection>

              <EditorSection
                title="Recent operational activity"
                icon={<CalendarDays size={18} />}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <ActivityList
                    title="Bookings"
                    emptyText="No current booking records."
                    items={selected.bookings.map((booking) => ({
                      key: booking.id,
                      title: booking.reference,
                      description: `${displayDate(
                        booking.collectionDate,
                      )} · ${booking.status.replaceAll("_", " ")}`,
                    }))}
                  />
                  <ActivityList
                    title="Reservations"
                    emptyText="No current reservation records."
                    items={selected.reservations.map((reservation) => ({
                      key: reservation.id,
                      title: reservation.status.replaceAll("_", " "),
                      description: `${displayDate(
                        reservation.reservedFrom,
                      )} to ${displayDate(reservation.reservedUntil)}`,
                    }))}
                  />
                </div>
              </EditorSection>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveVehicle()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Save vehicle
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          {icon}
        </span>
      </div>
    </article>
  );
}

function EditorSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          {icon}
        </span>
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EditorField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}

function EditorSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
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
            {labels?.[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: { key: string; title: string; description: string }[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-950">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl bg-white p-3">
              <p className="text-sm font-bold text-slate-800">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}