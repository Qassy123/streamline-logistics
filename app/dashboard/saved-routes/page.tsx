"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Route, Trash2 } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/saved-routes/me";

const DELETE_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/saved-routes";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";
const SAVED_ROUTE_STORAGE_KEY = "streamline_saved_route_prefill";

type SavedRoute = {
  id: string;
  name?: string | null;
  deliveryType?: string | null;
  journeyType?: string | null;
  capacityPercent?: number | null;
  vehicleSize?: string | null;
  collectionAddress: string;
  collectionAddressDetails?: unknown;
  deliveryAddress: string;
  deliveryAddressDetails?: unknown;
  returnAddress?: string | null;
  extraDrops?: unknown;
  whatAreWeCollecting?: string | null;
  loadDescription?: string | null;
  specialInstructions?: string | null;
  contactPreference?: string | null;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function SavedRoutesPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load saved routes.");
      }

      setRoutes(Array.isArray(data.savedRoutes) ? data.savedRoutes : []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load saved routes."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteRoute(id: string) {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    await fetch(`${DELETE_API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setRoutes((current) => current.filter((route) => route.id !== id));
  }

  function bookAgain(route: SavedRoute) {
    localStorage.setItem(SAVED_ROUTE_STORAGE_KEY, JSON.stringify(route));
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Saved Routes
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Book again faster.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              Save repeat routes and reload booking details into the quote form.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-8">
            {loading && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 font-bold">
                Loading saved routes...
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && routes.length === 0 && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                <Route className="text-[#006CFF]" size={30} />

                <h2 className="mt-4 text-xl font-bold">
                  No saved routes yet
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Save repeat routes from previous bookings to use one-click booking later.
                </p>

                <Link
                  href="/quote"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#006CFF] px-6 py-3 text-sm font-bold text-white hover:bg-[#2D8CFF]"
                >
                  Get A Quote
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}

            {!loading &&
              !error &&
              routes.map((route) => (
                <article
                  key={route.id}
                  className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                          <Route size={24} />
                        </span>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
                            Saved Route
                          </p>

                          <h2 className="mt-2 text-2xl font-bold text-[#071D49]">
                            {route.name || "Repeat delivery route"}
                          </h2>

                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            Updated {formatDate(route.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <Info
                          label="Collection"
                          value={route.collectionAddress}
                        />

                        <Info
                          label="Delivery"
                          value={route.deliveryAddress}
                        />

                        <Info
                          label="Delivery Type"
                          value={route.deliveryType || "Not provided"}
                        />

                        <Info
                          label="Journey Type"
                          value={route.journeyType || "Not provided"}
                        />

                        <Info
                          label="Vehicle"
                          value={route.vehicleSize || "Not provided"}
                        />

                        <Info
                          label="Load"
                          value={
                            route.whatAreWeCollecting ||
                            route.loadDescription ||
                            "Not provided"
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 lg:w-64">
                      <Link
                        href="/quote?savedRoute=true"
                        onClick={() => bookAgain(route)}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#006CFF] px-6 py-3 text-sm font-bold text-white hover:bg-[#2D8CFF]"
                      >
                        Book Again
                        <ArrowRight size={16} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteRoute(route.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                        Delete
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#071D49]">
        {value || "Not provided"}
      </p>
    </div>
  );
}