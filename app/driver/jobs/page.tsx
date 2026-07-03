"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Calendar, Truck, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const API_BASE = "https://streamline-logistics-production.up.railway.app";

type Job = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
};

export default function DriverJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadJobs() {
    setLoading(true);
    const token = localStorage.getItem("driverToken");

    if (!token) {
      router.push("/driver/login");
      return;
    }

    const res = await fetch(`${API_BASE}/api/driver/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("driverToken");
      router.push("/driver/login");
      return;
    }

    const data = await res.json();
    setJobs(data.jobs || []);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.reference.toLowerCase().includes(query.toLowerCase()) ||
          j.collectionAddress.toLowerCase().includes(query.toLowerCase()) ||
          j.deliveryAddress.toLowerCase().includes(query.toLowerCase()),
      ),
    [jobs, query],
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Driver Jobs</h1>
            <p className="mt-2 text-slate-600">
              Assigned, active and completed jobs.
            </p>
          </div>
          <button
            onClick={loadJobs}
            className="flex items-center gap-2 rounded-full bg-[#07182f] px-5 py-3 text-white"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="relative mt-6">
          <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs..."
            className="w-full rounded-2xl border bg-white py-4 pl-12 pr-4"
          />
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            <p>Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-8">No jobs found.</div>
          ) : (
            filtered.map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/driver/jobs/${job.id}`)}
                className="w-full rounded-3xl bg-white p-6 text-left shadow-sm hover:ring-2 hover:ring-[#18a8ff]"
              >
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{job.reference}</h2>
                    <div className="mt-3 flex gap-6 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <Calendar size={16} />
                        {job.collectionWindow}
                      </span>
                      <span className="flex items-center gap-2">
                        <Truck size={16} />
                        {job.status}
                      </span>
                    </div>
                    <p className="mt-4">
                      <strong>Collection:</strong> {job.collectionAddress}
                    </p>
                    <p className="mt-2">
                      <strong>Delivery:</strong> {job.deliveryAddress}
                    </p>
                  </div>
                  <ChevronRight className="h-8 w-8 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
