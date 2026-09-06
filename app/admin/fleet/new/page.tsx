"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Truck,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
] as const;

const FUEL_TYPES = [
  "Diesel",
  "Petrol",
  "Electric",
  "Hybrid",
  "Plug-in Hybrid",
  "Other",
] as const;

const EURO_STATUSES = [
  "Euro 4",
  "Euro 5",
  "Euro 6",
  "Euro 6d",
  "Zero Emission",
  "Not recorded",
] as const;

type FormState = {
  registration: string;
  vehicleType: string;
  make: string;
  colour: string;
  fuelType: string;
  engineCapacity: string;
  co2Emissions: string;
  dateOfFirstRegistration: string;
  taxDueDate: string;
  motExpiry: string;
  euroEmissionsStatus: string;
};

type CreateVehiclePayload = {
  success?: boolean;
  vehicle?: {
    id: string;
    name: string;
  };
  error?: string;
};

const INITIAL_FORM: FormState = {
  registration: "",
  vehicleType: VEHICLE_TYPES[0],
  make: "",
  colour: "",
  fuelType: "",
  engineCapacity: "",
  co2Emissions: "",
  dateOfFirstRegistration: "",
  taxDueDate: "",
  motExpiry: "",
  euroEmissionsStatus: "",
};

export default function AddFleetVehiclePage() {
  const [adminKey, setAdminKey] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedKey);

    if (!storedKey) {
      setError(
        "Admin key is required. Unlock the admin area from Driver Management.",
      );
    }
  }, []);

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function normaliseRegistration(value: string) {
    return value.toUpperCase().replace(/\s+/g, " ");
  }

  function handleRegistrationLookup() {
    setError("");
    setLookupMessage("");

    if (!form.registration.trim()) {
      setError("Enter a registration number first.");
      return;
    }

    setLookupMessage(
      "Vehicle lookup is ready for DVLA integration. Enter the vehicle details manually for now.",
    );
  }

  async function createVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    const registration = form.registration.trim().toUpperCase();

    if (!registration) {
      setError("Registration is required.");
      return;
    }

    if (!form.vehicleType) {
      setError("Select a vehicle category.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const internalName = `${form.vehicleType} - ${registration}`;

      const response = await fetch(`${API_BASE}/api/vehicles/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          name: internalName,
          vehicleType: form.vehicleType,
          vehicleCategory: form.vehicleType,
          registration,
          make: form.make.trim() || null,
          colour: form.colour.trim() || null,
          fuelType: form.fuelType || null,
          engineCapacity: form.engineCapacity.trim() || null,
          co2Emissions: form.co2Emissions.trim() || null,
          dateOfFirstRegistration: form.dateOfFirstRegistration || null,
          taxDueDate: form.taxDueDate || null,
          motExpiry: form.motExpiry || null,
          euroEmissionsStatus: form.euroEmissionsStatus || null,
          status: "AVAILABLE",
          active: true,
        }),
      });

      const payload = (await response.json()) as CreateVehiclePayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to add vehicle to fleet.");
      }

      setMessage(
        payload.vehicle?.name
          ? `${payload.vehicle.name} was added to the fleet.`
          : "Vehicle was added to the fleet.",
      );
      setLookupMessage("");
      setForm(INITIAL_FORM);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add vehicle to fleet.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Tab 5
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Fleet / Add Vehicle to Fleet
          </h1>
        </div>

        <Link
          href="/admin/fleet"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={17} />
          All Vehicles
        </Link>
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
        className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8"
      >
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
              <Truck size={22} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Add Vehicle to Fleet</h2>
              <p className="mt-1 text-sm text-slate-500">Enter the vehicle details below.</p>
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-5">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
            <ManualLabel required>Registration</ManualLabel>
            <div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={form.registration}
                  onChange={(event) =>
                    updateForm("registration", normaliseRegistration(event.target.value))
                  }
                  placeholder="Example: AB12 CDE"
                  className="manual-input flex-1 uppercase"
                />
                <button
                  type="button"
                  onClick={handleRegistrationLookup}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-[#E55300]"
                >
                  <Search size={17} />
                  Lookup
                </button>
              </div>
              {lookupMessage ? (
                <p className="mt-2 text-xs font-semibold text-slate-500">{lookupMessage}</p>
              ) : null}
            </div>
          </div>

          <ManualRow label="Vehicle Category" required>
            <select
              value={form.vehicleType}
              onChange={(event) => updateForm("vehicleType", event.target.value)}
              className="manual-input"
            >
              {VEHICLE_TYPES.map((vehicleType) => (
                <option key={vehicleType} value={vehicleType}>{vehicleType}</option>
              ))}
            </select>
          </ManualRow>

          <ManualRow label="Make">
            <input value={form.make} onChange={(event) => updateForm("make", event.target.value)} className="manual-input" />
          </ManualRow>

          <ManualRow label="Colour">
            <input value={form.colour} onChange={(event) => updateForm("colour", event.target.value)} className="manual-input" />
          </ManualRow>

          <ManualRow label="Fuel Type">
            <select value={form.fuelType} onChange={(event) => updateForm("fuelType", event.target.value)} className="manual-input">
              <option value="">Select fuel type</option>
              {FUEL_TYPES.map((fuelType) => <option key={fuelType} value={fuelType}>{fuelType}</option>)}
            </select>
          </ManualRow>

          <ManualRow label="Engine Capacity">
            <input value={form.engineCapacity} onChange={(event) => updateForm("engineCapacity", event.target.value)} placeholder="Example: 1997 cc" className="manual-input" />
          </ManualRow>

          <ManualRow label="CO₂ Emissions">
            <input value={form.co2Emissions} onChange={(event) => updateForm("co2Emissions", event.target.value)} placeholder="Example: 186 g/km" className="manual-input" />
          </ManualRow>

          <ManualRow label="Date of First Registration">
            <input type="date" value={form.dateOfFirstRegistration} onChange={(event) => updateForm("dateOfFirstRegistration", event.target.value)} className="manual-input" />
          </ManualRow>

          <ManualRow label="Tax Due Date">
            <input type="date" value={form.taxDueDate} onChange={(event) => updateForm("taxDueDate", event.target.value)} className="manual-input" />
          </ManualRow>

          <ManualRow label="MOT Expiry Date">
            <input type="date" value={form.motExpiry} onChange={(event) => updateForm("motExpiry", event.target.value)} className="manual-input" />
          </ManualRow>

          <ManualRow label="Euro Emissions Status">
            <select value={form.euroEmissionsStatus} onChange={(event) => updateForm("euroEmissionsStatus", event.target.value)} className="manual-input">
              <option value="">Select emissions status</option>
              {EURO_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </ManualRow>
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
          <Link href="/admin/fleet" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </Link>
          <button type="submit" disabled={saving || !adminKey} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Add to Fleet
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.manual-input) {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        :global(.manual-input:focus) {
          border-color: #ff6a00;
          box-shadow: 0 0 0 4px rgb(255 237 213);
        }
      `}</style>
    </div>
  );
}

function ManualRow({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)] md:items-center md:gap-4">
      <ManualLabel required={required}>{label}</ManualLabel>
      <div>{children}</div>
    </div>
  );
}

function ManualLabel({ required = false, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <div className="pt-1 text-sm font-bold text-slate-700 md:pt-0">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </div>
  );
}
