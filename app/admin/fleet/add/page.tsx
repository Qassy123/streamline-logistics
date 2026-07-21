"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
  Wrench,
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
];

const VEHICLE_STATUSES = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "OUT_ON_JOB", label: "Out on job" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Inactive" },
];

const FUEL_TYPES = [
  "Diesel",
  "Petrol",
  "Electric",
  "Hybrid",
  "Plug-in Hybrid",
  "Other",
];

const EURO_STATUSES = [
  "Euro 4",
  "Euro 5",
  "Euro 6",
  "Euro 6d",
  "Zero Emission",
  "Not recorded",
];

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

type FormState = {
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

const INITIAL_FORM: FormState = {
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

export default function AddFleetVehiclePage() {
  const [adminKey, setAdminKey] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
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

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function createVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    if (
      !form.name.trim() ||
      !form.vehicleType.trim() ||
      !form.registration.trim()
    ) {
      setError("Vehicle name, vehicle type and registration are required.");
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
          ...form,
          name: form.name.trim(),
          vehicleCategory: form.vehicleCategory.trim() || form.vehicleType,
          registration: form.registration.trim().toUpperCase(),
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          colour: form.colour.trim() || null,
          fuelType: form.fuelType || null,
          engineCapacity: form.engineCapacity.trim() || null,
          co2Emissions: form.co2Emissions.trim() || null,
          dateOfFirstRegistration: form.dateOfFirstRegistration || null,
          taxDueDate: form.taxDueDate || null,
          motExpiry: form.motExpiry || null,
          euroEmissionsStatus: form.euroEmissionsStatus || null,
          mileage: form.mileage || null,
          insuranceProvider: form.insuranceProvider.trim() || null,
          insurancePolicyNumber:
            form.insurancePolicyNumber.trim() || null,
          insuranceExpiry: form.insuranceExpiry || null,
          serviceDueDate: form.serviceDueDate || null,
          maintenanceNotes: form.maintenanceNotes.trim() || null,
          gpsDeviceId: form.gpsDeviceId.trim() || null,
          driverId: form.driverId || null,
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
      setForm(INITIAL_FORM);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create vehicle.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <Link
        href="/admin/fleet"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
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
          Create the full vehicle, compliance, insurance, maintenance and
          operational record required by the fleet plan.
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

      <form onSubmit={createVehicle} className="mt-6 space-y-6">
        <Section
          icon={<Truck size={21} />}
          title="Vehicle identity"
          description="Core fleet identity, category and registration details."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Vehicle name"
              value={form.name}
              onChange={(value) => updateForm("name", value)}
              placeholder="Example: Birmingham Van 01"
              required
            />

            <SelectField
              label="Vehicle category"
              value={form.vehicleCategory}
              onChange={(value) => {
                updateForm("vehicleCategory", value);
                updateForm("vehicleType", value);
              }}
              options={VEHICLE_TYPES}
              required
            />

            <SelectField
              label="Vehicle type"
              value={form.vehicleType}
              onChange={(value) => updateForm("vehicleType", value)}
              options={VEHICLE_TYPES}
              required
            />

            <Field
              label="Registration number"
              value={form.registration}
              onChange={(value) =>
                updateForm("registration", value.toUpperCase())
              }
              placeholder="Example: AB12 CDE"
              required
            />

            <Field
              label="Make"
              value={form.make}
              onChange={(value) => updateForm("make", value)}
              placeholder="Example: Ford"
            />

            <Field
              label="Model"
              value={form.model}
              onChange={(value) => updateForm("model", value)}
              placeholder="Example: Transit"
            />

            <Field
              label="Colour"
              value={form.colour}
              onChange={(value) => updateForm("colour", value)}
              placeholder="Example: White"
            />

            <SelectField
              label="Fuel type"
              value={form.fuelType}
              onChange={(value) => updateForm("fuelType", value)}
              options={FUEL_TYPES}
              allowBlank
            />

            <Field
              label="Engine capacity"
              value={form.engineCapacity}
              onChange={(value) => updateForm("engineCapacity", value)}
              placeholder="Example: 1997 cc"
            />

            <Field
              label="CO₂ emissions"
              value={form.co2Emissions}
              onChange={(value) => updateForm("co2Emissions", value)}
              placeholder="Example: 186 g/km"
            />

            <Field
              label="Date of first registration"
              type="date"
              value={form.dateOfFirstRegistration}
              onChange={(value) =>
                updateForm("dateOfFirstRegistration", value)
              }
            />

            <SelectField
              label="Euro emissions status"
              value={form.euroEmissionsStatus}
              onChange={(value) =>
                updateForm("euroEmissionsStatus", value)
              }
              options={EURO_STATUSES}
              allowBlank
            />

            <Field
              label="Current mileage"
              type="number"
              min="0"
              value={form.mileage}
              onChange={(value) => updateForm("mileage", value)}
              placeholder="Example: 48250"
            />

            <Field
              label="GPS device ID"
              value={form.gpsDeviceId}
              onChange={(value) => updateForm("gpsDeviceId", value)}
              placeholder="Optional tracking device identifier"
            />
          </div>
        </Section>

        <Section
          icon={<ShieldCheck size={21} />}
          title="Compliance and insurance"
          description="Tax, MOT, emissions and insurance information."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Tax due date"
              type="date"
              value={form.taxDueDate}
              onChange={(value) => updateForm("taxDueDate", value)}
            />

            <Field
              label="MOT expiry date"
              type="date"
              value={form.motExpiry}
              onChange={(value) => updateForm("motExpiry", value)}
            />

            <Field
              label="Insurance provider"
              value={form.insuranceProvider}
              onChange={(value) =>
                updateForm("insuranceProvider", value)
              }
              placeholder="Example: Aviva"
            />

            <Field
              label="Insurance policy number"
              value={form.insurancePolicyNumber}
              onChange={(value) =>
                updateForm("insurancePolicyNumber", value)
              }
              placeholder="Enter policy reference"
            />

            <Field
              label="Insurance expiry date"
              type="date"
              value={form.insuranceExpiry}
              onChange={(value) =>
                updateForm("insuranceExpiry", value)
              }
            />
          </div>
        </Section>

        <Section
          icon={<Wrench size={21} />}
          title="Maintenance"
          description="Service due date and operational maintenance notes."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Service due date"
              type="date"
              value={form.serviceDueDate}
              onChange={(value) =>
                updateForm("serviceDueDate", value)
              }
            />

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Maintenance notes
              </span>
              <textarea
                value={form.maintenanceNotes}
                onChange={(event) =>
                  updateForm("maintenanceNotes", event.target.value)
                }
                rows={5}
                placeholder="Record known faults, planned work, service details or operational restrictions."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              />
            </label>
          </div>
        </Section>

        <Section
          icon={<ClipboardCheck size={21} />}
          title="Operational assignment"
          description="Set status, availability and optional driver assignment."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Vehicle status"
              value={form.status}
              onChange={(value) => {
                updateForm("status", value);
                updateForm("active", value !== "INACTIVE");
              }}
              options={VEHICLE_STATUSES.map((item) => item.value)}
              labels={Object.fromEntries(
                VEHICLE_STATUSES.map((item) => [item.value, item.label]),
              )}
              required
            />

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <UserRound size={16} />
                Assigned driver
              </span>
              <select
                value={form.driverId}
                onChange={(event) =>
                  updateForm("driverId", event.target.value)
                }
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

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-4">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => {
                const active = event.target.checked;
                updateForm("active", active);

                if (!active) {
                  updateForm("status", "INACTIVE");
                } else if (form.status === "INACTIVE") {
                  updateForm("status", "AVAILABLE");
                }
              }}
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
        </Section>

        <div className="flex flex-col-reverse gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:justify-end">
          <Link
            href="/admin/fleet"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving || !adminKey}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Add to fleet
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3 border-b border-slate-200 pb-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        type={type}
        min={min}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
  required = false,
  allowBlank = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  required?: boolean;
  allowBlank?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      >
        {allowBlank ? <option value="">Not recorded</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}