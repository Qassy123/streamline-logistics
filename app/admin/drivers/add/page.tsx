"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Truck,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  active?: boolean;
  status?: string;
};

type FormState = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  vehicleId: string;
  availability: string;
  licenceNumber: string;
  licenceType: string;
  licenceExpiryDate: string;
  address: string;
  emergencyContact: string;
  notes: string;
  active: boolean;
};

const initialForm: FormState = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  vehicleId: "",
  availability: "AVAILABLE",
  licenceNumber: "",
  licenceType: "",
  licenceExpiryDate: "",
  address: "",
  emergencyContact: "",
  notes: "",
  active: true,
};

export default function AddDriverPage() {
  const router = useRouter();

  const [adminKey, setAdminKey] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const storedAdminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || "";

    setAdminKey(storedAdminKey);

    if (!storedAdminKey) {
      setError(
        "Admin key not found. Open the Drivers page and unlock admin access first.",
      );
    }

    void loadVehicles();
  }, []);

  async function loadVehicles() {
    setLoadingVehicles(true);

    try {
      const response = await fetch(`${API_BASE}/api/vehicles`, {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load vehicles.");
      }

      const list =
        payload?.vehicles ||
        payload?.data ||
        payload ||
        [];

      const safeList = Array.isArray(list) ? list : [];

      setVehicles(
        safeList.filter(
          (vehicle: Vehicle) =>
            vehicle.active !== false && vehicle.status !== "INACTIVE",
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load vehicles.",
      );
    } finally {
      setLoadingVehicles(false);
    }
  }

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const usernamePreview = useMemo(
    () => form.username.trim().toLowerCase(),
    [form.username],
  );

  function validateForm(): string | null {
    if (!adminKey) {
      return "Admin key is required.";
    }

    if (!form.name.trim()) {
      return "Full name is required.";
    }

    if (!form.username.trim()) {
      return "Username is required.";
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(form.username.trim())) {
      return "Username can only contain letters, numbers, dots, underscores and hyphens.";
    }

    if (!form.email.trim()) {
      return "Email address is required.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (form.password !== form.confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccessMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          vehicleId: form.vehicleId || undefined,
          availability: form.availability,
          licenceNumber: form.licenceNumber.trim() || undefined,
          licenceType: form.licenceType.trim() || undefined,
          licenceExpiryDate: form.licenceExpiryDate || undefined,
          address: form.address.trim() || undefined,
          emergencyContact: form.emergencyContact.trim() || undefined,
          notes: form.notes.trim() || undefined,
          active: form.active,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
          throw new Error(
            "Admin key rejected. Return to Drivers and unlock admin access again.",
          );
        }

        throw new Error(
          payload?.error ||
            payload?.message ||
            "Unable to create driver.",
        );
      }

      setSuccessMessage(
        `Driver created successfully. Login username: ${form.username.trim()}`,
      );

      setForm(initialForm);

      window.setTimeout(() => {
        router.push("/admin/drivers");
      }, 1200);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create driver.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Transport Operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Add Driver
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create a driver portal account, record licence details and assign a
            vehicle.
          </p>
        </div>

        <Link
          href="/admin/drivers"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
          Back to drivers
        </Link>
      </div>

      {!adminKey ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Admin access is locked. Open the Drivers page, enter the admin key,
          then return here.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <form onSubmit={createDriver} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Driver account</h2>
              <p className="text-sm text-slate-500">
                Login and contact details for the driver portal.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Full name">
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Username">
              <input
                value={form.username}
                onChange={(event) =>
                  updateField("username", event.target.value)
                }
                required
                className={inputClass}
              />
              {usernamePreview ? (
                <p className="mt-2 text-xs text-slate-500">
                  Driver login: {usernamePreview}
                </p>
              ) : null}
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  required
                  minLength={8}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm password">
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateField("confirmPassword", event.target.value)
                  }
                  required
                  minLength={8}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Truck size={20} />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Operational details</h2>
              <p className="text-sm text-slate-500">
                Vehicle assignment, availability and licence information.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Assigned vehicle">
              <select
                value={form.vehicleId}
                onChange={(event) =>
                  updateField("vehicleId", event.target.value)
                }
                disabled={loadingVehicles}
                className={inputClass}
              >
                <option value="">
                  {loadingVehicles
                    ? "Loading vehicles..."
                    : "No vehicle assigned"}
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                    {vehicle.registration
                      ? ` · ${vehicle.registration}`
                      : ""}
                    {vehicle.vehicleType
                      ? ` · ${vehicle.vehicleType}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Availability">
              <select
                value={form.availability}
                onChange={(event) =>
                  updateField("availability", event.target.value)
                }
                className={inputClass}
              >
                <option value="AVAILABLE">Available</option>
                <option value="BUSY">Busy</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </Field>

            <Field label="Licence number">
              <input
                value={form.licenceNumber}
                onChange={(event) =>
                  updateField("licenceNumber", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Licence type">
              <input
                value={form.licenceType}
                onChange={(event) =>
                  updateField("licenceType", event.target.value)
                }
                placeholder="Example: Full UK, Category B"
                className={inputClass}
              />
            </Field>

            <Field label="Licence expiry date">
              <input
                type="date"
                value={form.licenceExpiryDate}
                onChange={(event) =>
                  updateField("licenceExpiryDate", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Emergency contact">
              <input
                value={form.emergencyContact}
                onChange={(event) =>
                  updateField("emergencyContact", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Address">
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Internal notes">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    updateField("active", event.target.checked)
                  }
                  className="h-4 w-4 accent-[#FF6A00]"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Active driver account
                  </span>
                  <span className="block text-xs text-slate-500">
                    Active drivers can sign in to the driver portal.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-slate-500" />
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Secure account creation
                </p>
                <p className="text-xs text-slate-500">
                  The password is sent only to the backend for hashing.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/drivers"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving || !adminKey}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating driver
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create driver
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100 disabled:text-slate-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}