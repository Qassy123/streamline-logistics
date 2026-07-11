"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Truck,
  UserRound,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type Driver = {
  id: string;
  name: string;
  email: string;
  availability: string;
  vehicleId?: string | null;
};

type FleetListPayload = {
  drivers?: Driver[];
  error?: string;
};

type CreateVehiclePayload = {
  success?: boolean;
  vehicle?: {
    id: string;
    name: string;
  };
  error?: string;
};

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB Van",
  "LWB High Roof Van",
  "XLWB High Roof",
  "Luton Tail Lift",
  "Luton Tail Lift Curtainsider",
  "Curtainsider",
];

export default function AddFleetVehiclePage() {
  const [adminKey, setAdminKey] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0]);
  const [registration, setRegistration] = useState("");
  const [motExpiry, setMotExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [serviceDueDate, setServiceDueDate] = useState("");
  const [gpsDeviceId, setGpsDeviceId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [active, setActive] = useState(true);

  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedKey);

    if (!storedKey) {
      setLoadingDrivers(false);
      setError(
        "Admin key is required. Unlock the admin area from Driver Management.",
      );
      return;
    }

    void loadDrivers(storedKey);
  }, []);

  async function loadDrivers(key: string) {
    setLoadingDrivers(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/vehicles/admin/list?page=1&pageSize=100`,
        {
          headers: {
            "x-admin-key": key,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as FleetListPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load drivers.");
      }

      setDrivers(payload.drivers || []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load drivers.",
      );
    } finally {
      setLoadingDrivers(false);
    }
  }

  function resetForm() {
    setName("");
    setVehicleType(VEHICLE_TYPES[0]);
    setRegistration("");
    setMotExpiry("");
    setInsuranceExpiry("");
    setServiceDueDate("");
    setGpsDeviceId("");
    setDriverId("");
    setActive(true);
  }

  async function createVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    if (!name.trim() || !vehicleType.trim()) {
      setError("Vehicle name and vehicle type are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/vehicles/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          name: name.trim(),
          vehicleType,
          registration: registration.trim() || null,
          active,
          motExpiry: motExpiry || null,
          insuranceExpiry: insuranceExpiry || null,
          serviceDueDate: serviceDueDate || null,
          gpsDeviceId: gpsDeviceId.trim() || null,
          driverId: driverId || null,
        }),
      });

      const payload = (await response.json()) as CreateVehiclePayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to create vehicle.");
      }

      setMessage(
        payload.vehicle?.name
          ? `${payload.vehicle.name} was added to the fleet.`
          : "Vehicle was added to the fleet.",
      );
      resetForm();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create vehicle.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/admin/fleet"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft size={16} />
        Fleet management
      </Link>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Fleet administration
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Add fleet vehicle
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          Create a vehicle record, set compliance dates, assign its GPS device
          and optionally link an active driver.
        </p>
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

      <form
        onSubmit={createVehicle}
        className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
            <Truck size={21} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Vehicle details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Required fields are vehicle name and type.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field
            label="Vehicle name"
            value={name}
            onChange={setName}
            placeholder="Example: Van 12"
            required
          />

          <SelectField
            label="Vehicle type"
            value={vehicleType}
            onChange={setVehicleType}
            options={VEHICLE_TYPES.map((type) => ({
              value: type,
              label: type,
            }))}
          />

          <Field
            label="Registration"
            value={registration}
            onChange={(value) => setRegistration(value.toUpperCase())}
            placeholder="Example: AB12 CDE"
          />

          <Field
            label="GPS device ID"
            value={gpsDeviceId}
            onChange={setGpsDeviceId}
            placeholder="Optional device identifier"
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

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <UserRound size={16} />
              Assigned driver
            </span>

            <select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              disabled={loadingDrivers}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50"
            >
              <option value="">
                {loadingDrivers ? "Loading drivers..." : "Not assigned"}
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.availability}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-4">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>
            <span className="block text-sm font-bold text-slate-800">
              Active vehicle
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Active vehicles can be used for availability and booking
              allocation.
            </span>
          </span>
        </label>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/admin/fleet"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving || !adminKey}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Add vehicle
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="text-[#E55300]"> *</span> : null}
      </span>

      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}