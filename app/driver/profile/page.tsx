"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  Truck,
  User,
  Shield,
  LogOut,
  RefreshCw,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

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
  active: boolean;
  vehicle?: Vehicle | null;
};

type DriverPayload = {
  driver?: Driver;
  error?: string;
};

export default function DriverProfilePage() {
  const router = useRouter();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile(isRefresh = false) {
    const token = localStorage.getItem("driverToken");

    if (!token) {
      router.push("/driver/login");
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/driver/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as DriverPayload;

      if (response.status === 401) {
        localStorage.removeItem("driverToken");
        localStorage.removeItem("driver");
        router.push("/driver/login");
        return;
      }

      if (!response.ok || !data.driver) {
        throw new Error(
          data.error || "Unable to load driver profile.",
        );
      }

      setDriver(data.driver);

      localStorage.setItem("driver", JSON.stringify(data.driver));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load driver profile.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function logout() {
    const token = localStorage.getItem("driverToken");

    if (token) {
      await fetch(`${API_BASE}/api/driver/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);
    }

    localStorage.removeItem("driverToken");
    localStorage.removeItem("driver");

    router.push("/driver/login");
  }

  function availabilityLabel(value?: string) {
    if (!value) {
      return "Not set";
    }

    return value.replaceAll("_", " ");
  }

  function availabilityClasses(value?: string) {
    if (value === "AVAILABLE") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (value === "BUSY") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#18a8ff]" />
          <p className="mt-4 text-sm font-semibold text-slate-600">
            Loading driver profile...
          </p>
        </div>
      </main>
    );
  }

  if (!driver) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <CircleAlert className="mx-auto h-10 w-10 text-red-600" />

          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            Unable to load profile
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            {error || "The driver profile could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() => void loadProfile(true)}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#07182f] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <div className="rounded-3xl bg-[#07182f] p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                Driver Portal
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Driver Profile
              </h1>

              <p className="mt-2 text-blue-100">
                View your account, assigned vehicle and availability.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadProfile(true)}
              disabled={refreshing}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            <CircleAlert size={18} />
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card
            icon={<User size={20} />}
            title="Name"
            value={driver.name || "Not set"}
          />

          <Card
            icon={<User size={20} />}
            title="Username"
            value={driver.username || "Not set"}
          />

          <Card
            icon={<Mail size={20} />}
            title="Email"
            value={driver.email || "Not set"}
          />

          <Card
            icon={<Phone size={20} />}
            title="Phone"
            value={driver.phone || "Not set"}
          />

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-[#18a8ff]">
              <Shield size={20} />
              <h2 className="font-semibold">Availability</h2>
            </div>

            <div className="mt-4">
              <span
                className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${availabilityClasses(
                  driver.availability,
                )}`}
              >
                {availabilityLabel(driver.availability)}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-[#18a8ff]">
              <CheckCircle2 size={20} />
              <h2 className="font-semibold">Driver Account</h2>
            </div>

            <div className="mt-4">
              <span
                className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${
                  driver.active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {driver.active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:col-span-2">
            <div className="flex items-center gap-3 text-[#18a8ff]">
              <Truck size={20} />
              <h2 className="font-semibold">Assigned Vehicle</h2>
            </div>

            {driver.vehicle ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vehicle
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {driver.vehicle.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vehicle Type
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {driver.vehicle.vehicleType}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Registration
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {driver.vehicle.registration || "No registration"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                No vehicle assigned.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3 text-[#18a8ff]">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>

      <p className="mt-4 break-words text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}