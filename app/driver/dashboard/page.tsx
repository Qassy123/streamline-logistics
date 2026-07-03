"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE = "https://streamline-logistics-production.up.railway.app";

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
  availability: string;
  vehicle?: Vehicle | null;
};

type Job = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: string | number;
  vehicle?: Vehicle | null;
};

type DashboardData = {
  driver: Driver;
  stats: {
    todayJobs: number;
    assignedJobs: number;
    activeJobs: number;
    completedJobs: number;
  };
  todayJobs: Job[];
  assignedJobs: Job[];
  activeJobs: Job[];
  completedJobs: Job[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function DriverDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const activeJob = useMemo(() => {
    if (!data) return null;
    return data.activeJobs[0] || data.assignedJobs[0] || data.todayJobs[0] || null;
  }, [data]);

  async function loadDashboard(isRefresh = false) {
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const savedToken = localStorage.getItem("driverToken");

      if (!savedToken) {
        router.push("/driver/login");
        return;
      }

      const response = await fetch(`${API_BASE}/api/driver/jobs/dashboard`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      const payload = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("driverToken");
        localStorage.removeItem("driver");
        router.push("/driver/login");
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load dashboard");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateAvailability(availability: string) {
    try {
      const savedToken = localStorage.getItem("driverToken");

      if (!savedToken) {
        router.push("/driver/login");
        return;
      }

      const response = await fetch(`${API_BASE}/api/driver/auth/availability`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({ availability }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update availability");
      }

      setData((current) =>
        current
          ? {
              ...current,
              driver: payload.driver,
            }
          : current
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update availability"
      );
    }
  }

  async function logout() {
    const savedToken = localStorage.getItem("driverToken");

    if (savedToken) {
      await fetch(`${API_BASE}/api/driver/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      }).catch(() => null);
    }

    localStorage.removeItem("driverToken");
    localStorage.removeItem("driver");
    router.push("/driver/login");
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07182f] text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4 text-sm text-blue-100">Loading driver dashboard</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-[#07182f] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18a8ff] text-white">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Streamline Logistics</p>
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">
                Driver Portal
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-10 pt-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-200">
                Driver Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Welcome back, {data?.driver.name || "Driver"}
              </h1>
              <p className="mt-4 max-w-2xl text-blue-100">
                Manage assigned work, live tracking, job progress and proof of
                delivery from one operational view.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="font-semibold">{data?.driver.username}</p>
                  <p className="text-sm text-blue-100">{data?.driver.email}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {["AVAILABLE", "BUSY", "OFFLINE"].map((value) => (
                  <button
                    key={value}
                    onClick={() => updateAvailability(value)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${
                      data?.driver.availability === value
                        ? "bg-[#18a8ff] text-white"
                        : "bg-white/10 text-blue-100 hover:bg-white/20"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-6 max-w-7xl px-5 pb-12">
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            title="Today's Jobs"
            value={data?.stats.todayJobs || 0}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <StatCard
            title="Assigned"
            value={data?.stats.assignedJobs || 0}
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <StatCard
            title="Active"
            value={data?.stats.activeJobs || 0}
            icon={<Navigation className="h-5 w-5" />}
          />
          <StatCard
            title="Completed"
            value={data?.stats.completedJobs || 0}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Current job</h2>
                <p className="text-sm text-slate-500">
                  Highest priority assigned or active booking.
                </p>
              </div>

              <button
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-full bg-[#07182f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b2445] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {activeJob ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {activeJob.reference}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold">
                      {formatDate(activeJob.collectionDate)} ·{" "}
                      {activeJob.collectionWindow}
                    </h3>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800">
                    {statusLabel(activeJob.status)}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AddressBlock
                    title="Collection"
                    address={activeJob.collectionAddress}
                  />
                  <AddressBlock
                    title="Delivery"
                    address={activeJob.deliveryAddress}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push(`/driver/jobs/${activeJob.id}`)}
                    className="rounded-full bg-[#18a8ff] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#008fe6]"
                  >
                    Open job
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      activeJob.collectionAddress
                    )}`}
                    target="_blank"
                    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-white"
                  >
                    Open navigation
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="font-semibold">No active job</p>
                <p className="mt-2 text-sm text-slate-500">
                  Assigned work will appear here.
                </p>
              </div>
            )}
          </section>

          <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Assigned vehicle</h2>

            {data?.driver.vehicle ? (
              <div className="mt-5 rounded-3xl bg-[#07182f] p-5 text-white">
                <Truck className="h-8 w-8 text-[#18a8ff]" />
                <p className="mt-4 text-2xl font-bold">
                  {data.driver.vehicle.name}
                </p>
                <p className="mt-1 text-sm text-blue-100">
                  {data.driver.vehicle.vehicleType}
                </p>
                {data.driver.vehicle.registration && (
                  <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
                    {data.driver.vehicle.registration}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No vehicle assigned.
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => router.push("/driver/jobs")}
                className="w-full rounded-full bg-[#07182f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b2445]"
              >
                View all jobs
              </button>
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Today&apos;s schedule</h2>

          <div className="mt-5 space-y-3">
            {(data?.todayJobs || []).length > 0 ? (
              data?.todayJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/driver/jobs/${job.id}`)}
                  className="grid w-full gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#18a8ff] hover:bg-blue-50 md:grid-cols-[160px_1fr_140px]"
                >
                  <div>
                    <p className="font-bold">{job.collectionWindow}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(job.collectionDate)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">{job.reference}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                      {job.collectionAddress} → {job.deliveryAddress}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                      {statusLabel(job.status)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No jobs scheduled for today.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <div className="rounded-xl bg-blue-50 p-2 text-[#18a8ff]">{icon}</div>
      </div>
      <p className="mt-4 text-4xl font-bold">{value}</p>
    </div>
  );
}

function AddressBlock({ title, address }: { title: string; address: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">
        <MapPin className="h-4 w-4" />
        {title}
      </div>
      <p className="font-semibold leading-6">{address}</p>
    </div>
  );
}
