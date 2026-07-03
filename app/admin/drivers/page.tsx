"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Truck,
  UserPlus,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [driversResponse, vehiclesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/admin/drivers`),
        fetch(`${API_BASE}/api/vehicles`),
      ]);

      const driversPayload = await driversResponse.json();
      const vehiclesPayload = await vehiclesResponse.json();

      if (!driversResponse.ok) {
        throw new Error(driversPayload?.error || "Unable to load drivers");
      }

      if (!vehiclesResponse.ok) {
        throw new Error(vehiclesPayload?.error || "Unable to load vehicles");
      }

      setDrivers(driversPayload.drivers || []);

      const vehicleList =
        vehiclesPayload.vehicles ||
        vehiclesPayload.data ||
        vehiclesPayload ||
        [];

      setVehicles(Array.isArray(vehicleList) ? vehicleList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          email,
          phone,
          password,
          vehicleId: vehicleId || undefined,
          availability: "AVAILABLE",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create driver");
      }

      setMessage(
        `Driver created. Login: ${username} / Password: ${password}`
      );

      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
      setPassword("");
      setVehicleId("");

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create driver");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDriver(driverId: string) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/drivers/${driverId}`, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to deactivate driver");
      }

      setMessage("Driver deactivated");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to deactivate driver"
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-[#07182f] text-white">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#18a8ff]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-200">
                Admin
              </p>
              <h1 className="text-4xl font-bold tracking-tight">
                Driver Management
              </h1>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {message && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6 flex items-center gap-3">
              <UserPlus className="h-6 w-6 text-[#18a8ff]" />
              <div>
                <h2 className="text-xl font-bold">Create driver</h2>
                <p className="text-sm text-slate-500">
                  Creates a real login account for the driver portal.
                </p>
              </div>
            </div>

            <form onSubmit={createDriver} className="space-y-4">
              <Input label="Full name" value={name} onChange={setName} required />
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
              <Input label="Phone" value={phone} onChange={setPhone} />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                required
              />

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Assigned vehicle
                </span>
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#18a8ff] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">No vehicle assigned</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                      {vehicle.registration ? ` - ${vehicle.registration}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#07182f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0b2445] disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create driver
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Drivers</h2>
                <p className="text-sm text-slate-500">
                  Active and deactivated driver accounts.
                </p>
              </div>

              <button
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                No drivers created yet.
              </div>
            ) : (
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{driver.name}</h3>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              driver.active
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {driver.active ? "ACTIVE" : "INACTIVE"}
                          </span>
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            {driver.availability}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {driver.username} · {driver.email}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                          <Truck className="h-4 w-4" />
                          {driver.vehicle
                            ? `${driver.vehicle.name}${
                                driver.vehicle.registration
                                  ? ` - ${driver.vehicle.registration}`
                                  : ""
                              }`
                            : "No vehicle assigned"}
                        </div>
                      </div>

                      {driver.active && (
                        <button
                          onClick={() => deactivateDriver(driver.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
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
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#18a8ff] focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
