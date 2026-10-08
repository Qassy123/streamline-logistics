"use client";

import { useEffect, useRef, useState } from "react";
import PostcodeAddressLookup, { formatPostcodeAddress } from "@/components/PostcodeAddressLookup";
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
  status?: string;
  onDuty?: boolean;
  activeJobCount?: number;
  licenceNumber?: string | null;
  licenceType?: string | null;
  licenceExpiryDate?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
};

export default function AdminDriversPage() {
  const [adminKey, setAdminKey] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [dispatchVersion, setDispatchVersion] = useState(0);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
      setDispatchVersion(value => value + 1);

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
          address: address.trim(),
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
      setAddress("");
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

      {adminKey ? <DriverDispatch adminKey={adminKey} drivers={drivers} version={dispatchVersion} onSaved={() => loadData(adminKey)} onRejected={clearRejectedAdminKey} /> : null}
      {editing && adminKey ? <DriverEditor key={editing.id} driver={editing} adminKey={adminKey} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await loadData(adminKey); }} onRejected={clearRejectedAdminKey} /> : null}

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

            <PostcodeAddressLookup
              apiBase={(API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE) + "/api"}
              accent="orange"
              label="Find driver address"
              disabled={saving}
              onSelect={selected => setAddress(formatPostcodeAddress(selected))}
            />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Driver address (optional)</span>
              <textarea value={address} onChange={event => setAddress(event.target.value)} rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950" />
            </label>

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
                            <span className="mt-1 block">{driver.activeJobCount || 0} open jobs</span>
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
                          <button type="button" onClick={() => setEditing(driver)} className="mb-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit details</button>
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


type DispatchVan = Vehicle & { active: boolean; status: string; drivers?: { id: string; name: string }[]; taxDueDate?: string | null; motExpiry?: string | null; insuranceExpiry?: string | null };
type DispatchJob = {
  id: string; reference: string; status: string; collectionDate: string; collectionWindow?: string | null;
  collectionAddress: string; deliveryAddress: string; driverId?: string | null; driver?: { id: string; name: string } | null;
  vehicleId?: string | null; vehicleType?: string | null; vehicle?: Vehicle | null; updatedAt: string;
  estimatedStartTime?: string | null; estimatedEndTime?: string | null; driverJourneyStartedAt?: string | null;
  driverAcknowledgedAt?: string | null; quote?: { vehicleSize?: string | null; customerName?: string | null; companyName?: string | null } | null;
};
type IncidentReview = { id: string; reason: string; notes: string; photoUrls: string[]; acknowledgedAt?: string | null; dispatchResponse?: string | null; driver: { name: string }; booking: { reference: string } };
type EvidenceReview = { id: string; stopId: string; outcome: string; exceptionReason?: string | null; notes?: string | null; recipientName?: string | null; photoUrls: string[]; signatureUrl?: string | null; stop: { address: string; booking: { reference: string } } };
type DefectReview = { id: string; notes?: string | null; unsafeToDrive: boolean; acknowledgedAt?: string | null; photoUrls: string[]; items: Record<string, unknown>; driver: { name: string }; vehicle: { name: string; registration?: string | null } };
type DispatchData = { jobs: DispatchJob[]; vehicles: DispatchVan[]; incidents: IncidentReview[]; evidenceReviews: EvidenceReview[]; defects: DefectReview[]; pagination: { page: number; total: number; totalPages: number } };
const control = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100";
const actionButton = "rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton = "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
function displayDate(value?: string | null) { return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "Not planned"; }
function dateInput(value?: string | null) { return value ? value.slice(0, 10) : ""; }
function localTimeInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value); if (!Number.isFinite(d.getTime())) return "";
  // datetime-local uses the dispatcher's device timezone; show that timezone beside the inputs.
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
async function driverAdminRequest(key: string, path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${API_BASE}/api/admin/drivers${path}`, { method, cache: "no-store", headers: { "x-admin-key": key, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Unable to confirm this operation. Refresh before retrying.") as Error & { status?: number };
    error.status = response.status; throw error;
  }
  return payload;
}
function safeProofLink(value: string) { try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "res.cloudinary.com" ? value : null; } catch { return null; } }
function ProofLinks({ photos, signature }: { photos?: string[]; signature?: string | null }) {
  return <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-orange-700">{(photos || []).map((url, i) => safeProofLink(url) ? <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline">Photo {i + 1}</a> : null)}{signature && safeProofLink(signature) ? <a href={signature} target="_blank" rel="noopener noreferrer" className="underline">Signature</a> : null}</div>;
}

function DriverDispatch({ adminKey, drivers, version, onSaved, onRejected }: { adminKey: string; drivers: Driver[]; version: number; onSaved: () => Promise<void>; onRejected: () => void }) {
  const [tab, setTab] = useState<"ASSIGN" | "REVIEW">("ASSIGN");
  const [data, setData] = useState<DispatchData | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [query, setQuery] = useState(""), [search, setSearch] = useState(""), [page, setPage] = useState(1), [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(""), [selectedVan, setSelectedVan] = useState("");
  const [job, setJob] = useState<DispatchJob | null>(null);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [reason, setReason] = useState("");
  const [override, setOverride] = useState(false), [overrideReason, setOverrideReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const generation = useRef(0), mounted = useRef(true);
  // Keep an ambiguous network retry's identifier until the exact operation succeeds.
  const pendingRequests = useRef(new Map<string, string>());
  const driver = drivers.find(d => d.id === selectedDriver);
  const vans = data?.vehicles || [];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  async function load() {
    const current = ++generation.current; setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", q: search, unassigned: String(onlyUnassigned) });
      const payload: DispatchData = await driverAdminRequest(adminKey, `/dispatch?${params}`);
      if (mounted.current && current === generation.current) setData(payload);
    } catch (e) { if (mounted.current && current === generation.current) fail(e); }
    finally { if (mounted.current && current === generation.current) setLoading(false); }
  }
  useEffect(() => { void load(); /* filters and refresh version trigger a fresh snapshot */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, page, search, onlyUnassigned, version]);
  function fail(e: unknown) {
    if ((e as { status?: number })?.status === 401) onRejected();
    setError(e instanceof Error ? e.message : "Unable to confirm the operation.");
  }
  function chooseDriver(id: string) {
    setSelectedDriver(id); setSelectedVan(drivers.find(d => d.id === id)?.vehicleId || ""); setReason(""); setOverride(false); setOverrideReason("");
  }
  function chooseJob(next: DispatchJob) {
    setJob(next); setStart(localTimeInput(next.estimatedStartTime)); setEnd(localTimeInput(next.estimatedEndTime)); setReason(""); setOverride(false); setOverrideReason(""); setMessage(""); setError("");
  }
  async function mutate(path: string, method: string, body: Record<string, unknown>, success: string, dedupe = false) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    const key = `${method}:${path}:${JSON.stringify(body)}`;
    try {
      let retryId = pendingRequests.current.get(key);
      if (dedupe && !retryId) { retryId = window.crypto.randomUUID(); pendingRequests.current.set(key, retryId); }
      await driverAdminRequest(adminKey, path, method, { ...body, ...(dedupe ? { requestId: retryId } : {}) });
      pendingRequests.current.delete(key); setMessage(success);
      if (path.endsWith("assign-job")) setJob(null);
      await onSaved(); await load();
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  }
  async function assign(event: React.FormEvent) {
    event.preventDefault(); if (!job || !driver) return;
    if (!selectedVan || driver.vehicleId !== selectedVan) { setError("Save this van to the selected driver before assigning the job."); return; }
    const startDate = new Date(start), endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) { setError("Enter a valid planned start and end time."); return; }
    await mutate(`/${driver.id}/assign-job`, "POST", { bookingId: job.id, vehicleId: selectedVan, expectedUpdatedAt: job.updatedAt, estimatedStartTime: startDate.toISOString(), estimatedEndTime: endDate.toISOString(), reason: reason.trim(), complianceOverride: override, complianceOverrideReason: overrideReason.trim() }, `${job.reference} assigned to ${driver.name}.`, true);
  }
  const vanLabel = (v: DispatchVan) => `${v.registration || v.name} — ${v.vehicleType}${v.drivers?.length ? ` (${v.drivers.map(d => d.name).join(", ")})` : ""}${!v.active || ["MAINTENANCE", "INACTIVE"].includes(v.status) ? ` — ${v.status}` : ""}`;
  const reviewCount = (data?.incidents.length || 0) + (data?.evidenceReviews.length || 0) + (data?.defects.length || 0);
  const note = (key: string) => <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Dispatch response / reason</span><textarea className={control} rows={2} maxLength={4000} value={reviewNotes[key] || ""} onChange={e => setReviewNotes(prev => ({ ...prev, [key]: e.target.value }))} /></label>;
  return <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">Driver dispatch</h2><p className="mt-1 text-sm text-slate-500">Choose the driver, save their van, then assign the job.</p></div><div className="flex gap-2"><button className={tab === "ASSIGN" ? actionButton : secondaryButton} onClick={() => setTab("ASSIGN")}>Assign vans & jobs</button><button className={tab === "REVIEW" ? actionButton : secondaryButton} onClick={() => setTab("REVIEW")}>Dispatch reviews ({reviewCount})</button></div></div>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
    {tab === "ASSIGN" ? <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(query.trim()); }}><input aria-label="Search released bookings" className={`${control} min-w-40 flex-1`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search booking reference or address" /><button disabled={busy} className={secondaryButton}>Search</button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyUnassigned} onChange={e => { setOnlyUnassigned(e.target.checked); setPage(1); }} />Unassigned only</label></form>
        <p className="my-3 text-xs text-slate-500">Released bookings only. Active journeys are shown for dispatch visibility and cannot be reassigned here.</p>
        {loading ? <p className="py-8 text-sm text-slate-500" role="status">Loading dispatch…</p> : !data ? <button className={secondaryButton} onClick={() => void load()}>Retry loading</button> : <>
          <div className="space-y-3">{data.jobs.map(item => {
            const started = item.status === "IN_PROGRESS" || !!item.driverJourneyStartedAt;
            return <article key={item.id} className={`rounded-2xl border p-4 ${job?.id === item.id ? "border-orange-400 bg-orange-50/40" : "border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-950">{item.reference} <span className="ml-2 text-xs font-medium text-slate-500">{formatAvailability(item.status)}</span></p><p className="mt-1 text-xs text-slate-500">Collection: {dateInput(item.collectionDate)} · {item.collectionWindow || "No window"}</p><p className="mt-2 break-words text-sm text-slate-700">{item.collectionAddress} → {item.deliveryAddress}</p><p className="mt-2 text-xs text-slate-500">{item.driver?.name || "No driver"} · {item.vehicle?.registration || item.vehicle?.name || "No van"} · Required: {item.vehicleType || item.quote?.vehicleSize || item.vehicle?.vehicleType || "Check booking"}</p><p className="mt-1 text-xs text-slate-500">{displayDate(item.estimatedStartTime)} → {displayDate(item.estimatedEndTime)}</p><p className="mt-1 text-xs text-slate-500">{item.driverAcknowledgedAt ? "Driver acknowledged" : "Awaiting driver acknowledgement"}</p></div><button disabled={busy || started} className={secondaryButton} onClick={() => chooseJob(item)}>{started ? "Journey active" : item.driverId ? "Review / reassign" : "Select job"}</button></div></article>;
          })}{!data.jobs.length ? <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No released bookings match these filters.</p> : null}</div>
          <div className="mt-4 flex items-center justify-between gap-2 text-sm"><button className={secondaryButton} disabled={page <= 1 || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>{data.pagination.total} jobs · Page {page} / {Math.max(1, data.pagination.totalPages)}</span><button className={secondaryButton} disabled={page >= data.pagination.totalPages || busy} onClick={() => setPage(p => p + 1)}>Next</button></div>
        </>}
      </div>
      <div className="h-fit rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">Manual assignment</h3>
        <label className="mt-4 block"><span className="mb-1 block text-sm font-semibold">Driver</span><select className={control} disabled={busy} value={selectedDriver} onChange={e => chooseDriver(e.target.value)}><option value="">Select a driver</option>{drivers.map(d => <option key={d.id} value={d.id} disabled={!d.active || d.status !== "ACTIVE"}>{d.name} — {d.active ? `${formatAvailability(d.availability)} (${d.activeJobCount || 0} jobs)` : "Inactive"}</option>)}</select></label>
        <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Van</span><select className={control} disabled={busy || !driver} value={selectedVan} onChange={e => { setSelectedVan(e.target.value); setOverride(false); setOverrideReason(""); }}><option value="">No van assigned</option>{vans.map(v => <option key={v.id} value={v.id} disabled={!v.active || ["INACTIVE", "MAINTENANCE"].includes(v.status) || !!v.drivers?.some(d => d.id !== selectedDriver)}>{vanLabel(v)}</option>)}</select></label>
        <button className={`${secondaryButton} mt-3 w-full`} disabled={busy || !driver || selectedVan === (driver.vehicleId || "")} onClick={() => driver && void mutate(`/${driver.id}/vehicle`, "PATCH", { vehicleId: selectedVan || null }, "Driver's van saved. Existing jobs retain their planned vans.")}>{busy ? "Saving…" : "Save van to driver"}</button>
        {driver ? <p className="mt-2 text-xs text-slate-500">Current van: {driver.vehicle?.registration || driver.vehicle?.name || "None"}. Changing it does not move existing jobs to another van.</p> : null}
        {!job ? <p className="mt-5 text-sm text-slate-500">Select a released job from the list.</p> : <form onSubmit={assign} className="mt-5 border-t border-slate-200 pt-4">
          <p className="font-bold text-slate-950">{job.reference}</p><p className="mt-1 text-xs text-slate-500">Times below use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
          <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Planned start</span><input required type="datetime-local" className={control} value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Planned end</span><input required type="datetime-local" className={control} value={end} onChange={e => setEnd(e.target.value)} /></label>
          <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Assignment / reassignment reason</span><textarea rows={2} className={control} value={reason} required={!!job.driverId && job.driverId !== selectedDriver} onChange={e => setReason(e.target.value)} /></label>
          {selectedVan ? <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">{[["Tax", vans.find(v => v.id === selectedVan)?.taxDueDate], ["MOT", vans.find(v => v.id === selectedVan)?.motExpiry], ["Insurance", vans.find(v => v.id === selectedVan)?.insuranceExpiry]].map(([label, due]) => <p key={label}>{label}: {due ? dateInput(due) : "Not recorded"}</p>)}</div> : null}
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" className="mt-0.5" checked={override} onChange={e => setOverride(e.target.checked)} />Record an authorised override for a tax, MOT or insurance warning</label>
          {override ? <label className="mt-2 block"><span className="mb-1 block text-sm font-semibold">Override reason</span><textarea className={control} required value={overrideReason} onChange={e => setOverrideReason(e.target.value)} /></label> : null}
          <button className={`${actionButton} mt-4 w-full`} disabled={busy || loading || !driver || !selectedVan || driver.vehicleId !== selectedVan}>{busy ? "Saving…" : "Assign job to driver"}</button>
          {job.driverId ? <button type="button" className={`${secondaryButton} mt-2 w-full`} disabled={busy || !reason.trim()} onClick={() => void mutate(`/${job.driverId}/unassign-job`, "POST", { bookingId: job.id, reason: reason.trim() }, `${job.reference}: driver unassigned; planned van retained.`, true)}>Unassign current driver</button> : null}
          <button type="button" className={`${secondaryButton} mt-2 w-full`} disabled={busy} onClick={() => setJob(null)}>Clear selected job</button>
        </form>}
      </div>
    </div> : <div className="mt-5 space-y-6">
      <p className="text-xs text-slate-500">Each section shows up to 100 outstanding records. Resolve older items and refresh to load the next records.</p>
      {loading ? <p role="status">Refreshing reviews…</p> : null}
      <div><h3 className="font-bold">Delivery exceptions ({data?.evidenceReviews.length || 0})</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{data?.evidenceReviews.map(item => <article key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"><p className="font-bold">{item.stop.booking.reference} · {formatAvailability(item.outcome)}</p><p className="mt-1 text-sm">{item.stop.address}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.exceptionReason || "No exception reason"}{item.notes ? `\n${item.notes}` : ""}</p><p className="mt-1 text-xs">Recipient: {item.recipientName || "Not recorded"}</p><ProofLinks photos={item.photoUrls} signature={item.signatureUrl} />{note(`e-${item.id}`)}<div className="mt-3 flex flex-wrap gap-2"><button className={actionButton} disabled={busy || loading || !reviewNotes[`e-${item.id}`]?.trim() || !["REFUSED_SIGNATURE", "AUTHORISED_UNATTENDED"].includes(item.outcome)} onClick={() => void mutate(`/evidence/${item.stopId}/review`, "PATCH", { decision: "APPROVE", notes: reviewNotes[`e-${item.id}`].trim() }, "Delivery exception approved.")}>Approve exception</button><button className={secondaryButton} disabled={busy || loading || !reviewNotes[`e-${item.id}`]?.trim()} onClick={() => void mutate(`/evidence/${item.stopId}/review`, "PATCH", { decision: "REJECT", notes: reviewNotes[`e-${item.id}`].trim() }, "Exception rejected. Driver must correct and resubmit the evidence.")}>Reject / request correction</button></div>{["FAILED_DELIVERY", "PARTIAL_DELIVERY"].includes(item.outcome) ? <p className="mt-2 text-xs text-amber-800">Failed and partial deliveries require dispatch resolution or another attempt; they cannot be approved as a completed delivery.</p> : null}</article>)}</div>{data && !data.evidenceReviews.length ? <p className="mt-2 text-sm text-slate-500">No delivery exceptions awaiting review.</p> : null}</div>
      <div><h3 className="font-bold">Driver problems ({data?.incidents.length || 0})</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{data?.incidents.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-bold">{item.booking.reference} · {item.driver.name}</p><p className="mt-1 text-sm">{formatAvailability(item.reason)}{item.acknowledgedAt ? " · Acknowledged" : " · New"}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</p>{item.dispatchResponse ? <p className="mt-2 text-xs text-slate-500">Previous response: {item.dispatchResponse}</p> : null}<ProofLinks photos={item.photoUrls} />{note(`i-${item.id}`)}<div className="mt-3 flex gap-2">{["ACKNOWLEDGE", "RESOLVE"].map(action => <button key={action} className={action === "RESOLVE" ? actionButton : secondaryButton} disabled={busy || loading || !reviewNotes[`i-${item.id}`]?.trim()} onClick={() => void mutate(`/incidents/${item.id}`, "PATCH", { action, response: reviewNotes[`i-${item.id}`].trim() }, "Driver report updated.")}>{action === "RESOLVE" ? "Resolve" : "Acknowledge"}</button>)}</div></article>)}</div>{data && !data.incidents.length ? <p className="mt-2 text-sm text-slate-500">No unresolved driver reports.</p> : null}</div>
      <div><h3 className="font-bold">Vehicle defects ({data?.defects.length || 0})</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{data?.defects.map(item => <article key={item.id} className={`rounded-2xl border p-4 ${item.unsafeToDrive ? "border-red-200 bg-red-50" : "border-slate-200"}`}><p className="font-bold">{item.vehicle.registration || item.vehicle.name} · {item.driver.name}</p><p className="mt-1 text-sm font-semibold">{item.unsafeToDrive ? "Unsafe to drive — work blocked until resolved" : "Defect reported"}{item.acknowledgedAt ? " · Acknowledged" : ""}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</p><p className="mt-2 text-xs">{Object.entries(item.items || {}).filter(([, value]) => value === "DEFECT").map(([key]) => formatAvailability(key)).join(", ")}</p><ProofLinks photos={item.photoUrls} />{note(`d-${item.id}`)}<div className="mt-3 flex gap-2">{["ACKNOWLEDGE", "RESOLVE"].map(action => <button key={action} className={action === "RESOLVE" ? actionButton : secondaryButton} disabled={busy || loading || !reviewNotes[`d-${item.id}`]?.trim()} onClick={() => void mutate(`/defects/${item.id}`, "PATCH", { action, response: reviewNotes[`d-${item.id}`].trim() }, "Vehicle defect updated.")}>{action === "RESOLVE" ? "Resolve defect" : "Acknowledge"}</button>)}</div></article>)}</div>{data && !data.defects.length ? <p className="mt-2 text-sm text-slate-500">No unresolved vehicle defects.</p> : null}</div>
      <button className={secondaryButton} disabled={busy || loading} onClick={() => void load()}>Refresh reviews</button>
    </div>}
  </section>;
}

function DriverEditor({ driver, adminKey, onClose, onSaved, onRejected }: { driver: Driver; adminKey: string; onClose: () => void; onSaved: () => Promise<void>; onRejected: () => void }) {
  const [form, setForm] = useState({ name: driver.name, username: driver.username, email: driver.email, phone: driver.phone || "", licenceNumber: driver.licenceNumber || "", licenceType: driver.licenceType || "", licenceExpiryDate: dateInput(driver.licenceExpiryDate), address: driver.address || "", emergencyContact: driver.emergencyContact || "", notes: driver.notes || "", password: "", active: driver.active });
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const { password, ...details } = form;
      await driverAdminRequest(adminKey, `/${driver.id}`, "PATCH", { ...details, status: form.active ? "ACTIVE" : "INACTIVE", licenceExpiryDate: form.licenceExpiryDate || null, ...(password ? { password } : {}) });
      await onSaved();
    } catch (e) { if ((e as { status?: number })?.status === 401) onRejected(); setError(e instanceof Error ? e.message : "Unable to save driver."); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialogRef} onCancel={e => { if (saving) e.preventDefault(); else onClose(); }} className="m-auto max-h-[90dvh] w-[min(680px,94vw)] overflow-y-auto rounded-3xl bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/60" aria-labelledby="driver-editor-title"><div className="flex items-center justify-between gap-4"><h2 id="driver-editor-title" className="text-xl font-bold">Edit {driver.name}</h2><button className={secondaryButton} disabled={saving} onClick={onClose}>Close</button></div>{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<form onSubmit={save} className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2">{([['name','Full name'],['username','Username'],['email','Email'],['phone','Phone'],['licenceNumber','Licence number'],['licenceType','Licence type'],['licenceExpiryDate','Licence expiry'],['emergencyContact','Emergency contact']] as const).map(([key, label]) => <Input key={key} label={label} value={form[key]} type={key === "email" ? "email" : key === "licenceExpiryDate" ? "date" : "text"} required={["name", "username", "email"].includes(key)} onChange={value => setForm(prev => ({ ...prev, [key]: value }))} />)}</div><PostcodeAddressLookup apiBase={(API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE) + "/api"} accent="orange" label="Find driver address" disabled={saving} onSelect={selected => setForm(prev => ({ ...prev, address: formatPostcodeAddress(selected) }))} />{([['address','Address'],['notes','Admin notes']] as const).map(([key, label]) => <label key={key} className="block"><span className="mb-1 block text-sm font-bold">{label}</span><textarea className={control} value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} rows={3} /></label>)}<Input label="New password (leave empty to keep current password)" type="password" value={form.password} onChange={value => setForm(prev => ({ ...prev, password: value }))} /><p className="text-xs text-slate-500">Resetting the password signs this driver out of every portal session.</p><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))} />Active account</label><button className={actionButton} disabled={saving}>{saving ? "Saving…" : "Save driver details"}</button></form></dialog>;
}
