"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  CornerDownLeft,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE = "https://streamline-logistics-production.up.railway.app";

type Stop = {
  sequence: number;
  type: "COLLECTION" | "DROP" | "DELIVERY" | "RETURN";
  label: string;
  address: string;
  notes?: string | null;
  navigationUrl: string;
};

type Job = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  stops?: Stop[];
  stopSummary?: {
    totalStops: number;
    extraDrops: number;
    hasReturn: boolean;
    description: string;
  };
  nextStop?: Stop | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function DriverJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");

  async function loadJobs(isRefresh = false) {
    setError("");

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const token = localStorage.getItem("driverToken");

    if (!token) {
      router.push("/driver/login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/driver/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.status === 401) {
        localStorage.removeItem("driverToken");
        localStorage.removeItem("driver");
        router.push("/driver/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load jobs");
      }

      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const searchTarget = [
          job.reference,
          job.collectionAddress,
          job.deliveryAddress,
          job.status,
          job.stopSummary?.description,
          ...(job.stops || []).map((stop) => `${stop.label} ${stop.address}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchTarget.includes(query.toLowerCase());
        const matchesStatus =
          statusFilter === "ALL" ||
          job.status.toUpperCase() === statusFilter;

        return matchesSearch && matchesStatus;
      }),
    [jobs, query, statusFilter],
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
              Driver Portal
            </p>
            <h1 className="mt-2 text-4xl font-bold text-[#071D49]">
              Driver Jobs
            </h1>
            <p className="mt-2 text-slate-600">
              Your assigned, active and completed jobs, including multi-drop and
              return routes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadJobs(true)}
            disabled={refreshing}
            className="flex w-fit items-center gap-2 rounded-full bg-[#071D49] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#020B1F] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs, stops, references or addresses..."
              className="w-full rounded-2xl border bg-white py-4 pl-12 pr-4 outline-none focus:border-[#006CFF] focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-[#006CFF] focus:ring-4 focus:ring-blue-100"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <span>
            Showing {filtered.length} of {jobs.length} job
            {jobs.length === 1 ? "" : "s"}
          </span>
          {statusFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#006CFF]"
            >
              Clear status filter
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="rounded-2xl bg-white p-8 text-sm font-semibold text-slate-500">
              Loading jobs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-8">
              <p className="font-bold text-[#071D49]">No jobs found.</p>
              <p className="mt-1 text-sm text-slate-500">
                Try changing the search or status filter.
              </p>
            </div>
          ) : (
            filtered.map((job) => {
              const stops = job.stops || [];
              const nextStop = job.nextStop || stops[0] || null;

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => router.push(`/driver/jobs/${job.id}`)}
                  className="w-full rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-2 hover:ring-[#006CFF] sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-[#071D49]">
                          {job.reference}
                        </h2>

                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-[#006CFF]">
                          {statusLabel(job.status)}
                        </span>

                        {job.stopSummary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            <Route size={13} />
                            {job.stopSummary.description}
                          </span>
                        )}

                        {job.stopSummary?.hasReturn && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                            <CornerDownLeft size={13} />
                            Return
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Calendar size={16} />
                          {formatDate(job.collectionDate)} ·{" "}
                          {job.collectionWindow}
                        </span>

                        <span className="flex items-center gap-2">
                          <Truck size={16} />
                          {stops.length || 2} stops
                        </span>
                      </div>

                      {nextStop && (
                        <div className="mt-5 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006CFF]">
                            Next stop
                          </p>
                          <p className="mt-2 flex items-start gap-2 text-sm font-bold text-[#071D49]">
                            <MapPin
                              size={17}
                              className="mt-0.5 shrink-0 text-[#006CFF]"
                            />
                            <span>
                              {nextStop.label}: {nextStop.address}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        <p>
                          <strong>Collection:</strong>{" "}
                          {job.collectionAddress}
                        </p>
                        <p>
                          <strong>Delivery:</strong> {job.deliveryAddress}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-8 w-8 shrink-0 text-slate-400" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
