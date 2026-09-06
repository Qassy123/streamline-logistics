"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
};

type Driver = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  active: boolean;
  availability: string;
  vehicleId?: string | null;
  vehicle?: Vehicle | null;
  createdAt: string;
};

export default function AdminDriversPage() {
  const [adminKey, setAdminKey] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function adminHeaders(key = adminKey) {
    return {
      "Content-Type": "application/json",
      "x-admin-key": key,
    };
  }

  function clearRejectedAdminKey() {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    setAdminKey("");
    setDrivers([]);
    setVehicles([]);
  }

  async function loadData(activeAdminKey = adminKey) {
    if (!activeAdminKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [driversResponse, vehiclesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/admin/drivers`, {
          headers: {
            "x-admin-key": activeAdminKey,
          },
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/vehicles`, {
          cache: "no-store",
        }),
      ]);

      const driversPayload = await driversResponse.json();
      const vehiclesPayload = await vehiclesResponse.json();

      if (!driversResponse.ok) {
        if (driversResponse.status === 401) {
          clearRejectedAdminKey();
          throw new Error(
            "Admin key rejected. Unlock the admin area from Driver Management.",
          );
        }

        throw new Error(driversPayload?.error || "Unable to load drivers.");
      }

      if (!vehiclesResponse.ok) {
        throw new Error(vehiclesPayload?.error || "Unable to load vehicles.");
      }

      setDrivers(driversPayload.drivers || []);

      const vehicleList =
        vehiclesPayload.vehicles ||
        vehiclesPayload.data ||
        vehiclesPayload ||
        [];

      setVehicles(Array.isArray(vehicleList) ? vehicleList : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load driver management.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey) {
      setError(
        "Admin key is missing. Unlock the admin area first, then return to Drivers.",
      );
      return;
    }

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setError("Full name, username, email and password are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/drivers`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          vehicleId: vehicleId || undefined,
          availability: "AVAILABLE",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearRejectedAdminKey();
          throw new Error("Admin key rejected.");
        }

        throw new Error(payload?.error || "Unable to create driver.");
      }

      setMessage(
        `Driver created. Login username: ${username.trim()}.`,
      );

      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
      setPassword("");
      setVehicleId("");

      await loadData(adminKey);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create driver.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDriver(driver: Driver) {
    if (!adminKey) {
      setError("Admin key is required.");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${driver.name}? They will no longer be able to receive jobs or use their current session.`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/drivers/${driver.id}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearRejectedAdminKey();
          throw new Error("Admin key rejected.");
        }

        throw new Error(payload?.error || "Unable to deactivate driver.");
      }

      setMessage(`${driver.name} was deactivated.`);
      await loadData(adminKey);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to deactivate driver.",
      );
    }
  }

  useEffect(() => {
    const storedAdminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedAdminKey);

    if (!storedAdminKey) {
      setLoading(false);
      setError(
        "Admin key is missing. Unlock the admin area from Driver Management before using this page.",
      );
      return;
    }

    void loadData(storedAdminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Tab 6
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Drivers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Add drivers for the driver portal and manage who can receive jobs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || !adminKey}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {message ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <ShieldAlert className="mt-0.5 shrink-0" size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
              <UserPlus size={21} />
            </span>

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Add Driver
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Create their driver portal login.
              </p>
            </div>
          </div>

          <form onSubmit={createDriver} className="space-y-4">
            <Input
              label="Full Name"
              value={name}
              onChange={setName}
              required
            />

            <Input
              label="Username"
              value={username}
              onChange={setUsername}
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              required
            />

            <Input
              label="Phone Number"
              value={phone}
              onChange={setPhone}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
            />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Assigned Vehicle
              </span>

              <select
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              >
                <option value="">No vehicle assigned</option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration
                      ? `${vehicle.registration} — ${vehicle.vehicleType}`
                      : `${vehicle.name} — ${vehicle.vehicleType}`}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={saving || !adminKey}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Adding Driver...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Add Driver
                </>
              )}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#006CFF]">
              <Users size={21} />
            </span>

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Existing Drivers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Driver portal accounts and current vehicle assignments.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                <Loader2 size={20} className="animate-spin" />
                Loading drivers...
              </div>
            </div>
          ) : drivers.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 text-center text-sm font-semibold text-slate-500">
              No drivers have been added yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Assigned Vehicle</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-950">
                            {driver.name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            @{driver.username}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-sm">
                          <p className="font-semibold text-slate-700">
                            {driver.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {driver.phone || "No phone number"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2 text-sm text-slate-700">
                            <Truck
                              size={16}
                              className="mt-0.5 shrink-0 text-slate-400"
                            />

                            <div>
                              {driver.vehicle ? (
                                <>
                                  <p className="font-bold">
                                    {driver.vehicle.registration ||
                                      driver.vehicle.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {driver.vehicle.vehicleType}
                                  </p>
                                </>
                              ) : (
                                <p className="font-semibold text-slate-500">
                                  Not assigned
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {formatAvailability(driver.availability)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              driver.active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {driver.active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {driver.active ? (
                            <button
                              type="button"
                              onClick={() => void deactivateDriver(driver)}
                              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              Deactivated
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Input({
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
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}

function formatAvailability(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
