"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, MapPin, Truck } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/bookings/me/tracking";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type TrackingEvent = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  createdAt: string;
};

type TrackingBooking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  vehicle?: {
    name?: string | null;
    vehicleType?: string | null;
    registration?: string | null;
  } | null;
  quote?: {
    deliveryType?: string | null;
    journeyType?: string | null;
    vehicleSize?: string | null;
  } | null;
  trackingEvents: TrackingEvent[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export default function TrackingPage() {
  const [bookings, setBookings] = useState<TrackingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTracking();
  }, []);

  async function loadTracking() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load tracking.");
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load tracking."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Shipment Tracking
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Track your deliveries.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              View live delivery status, booking progress and shipment updates.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-8">
            {loading && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 font-bold">
                Loading tracking...
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && bookings.length === 0 && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                <Truck className="text-[#006CFF]" size={30} />

                <h2 className="mt-4 text-xl font-bold">
                  No tracked deliveries yet
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Once a booking is confirmed, its tracking progress will appear here.
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              bookings.map((booking) => (
                <article
                  key={booking.id}
                  className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6"
                >
                  <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                          <Truck size={24} />
                        </span>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
                            Current Status
                          </p>

                          <h2 className="mt-2 text-2xl font-bold capitalize text-[#071D49]">
                            {formatStatus(booking.status)}
                          </h2>

                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            {booking.reference}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4">
                        <Info
                          icon={<MapPin size={18} />}
                          label="Collection"
                          value={booking.collectionAddress}
                        />

                        <Info
                          icon={<MapPin size={18} />}
                          label="Delivery"
                          value={booking.deliveryAddress}
                        />

                        <Info
                          icon={<Clock size={18} />}
                          label="Collection Window"
                          value={`${formatDate(booking.collectionDate)} · ${booking.collectionWindow}`}
                        />

                        <Info
                          icon={<Truck size={18} />}
                          label="Vehicle"
                          value={
                            booking.vehicle?.vehicleType ||
                            booking.quote?.vehicleSize ||
                            "Not assigned yet"
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                      <h3 className="text-xl font-bold text-[#071D49]">
                        Tracking Timeline
                      </h3>

                      <div className="mt-6 grid gap-4">
                        {booking.trackingEvents.length === 0 && (
                          <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                            <p className="text-sm font-bold text-[#071D49]">
                              Tracking will appear once the booking progresses.
                            </p>
                          </div>
                        )}

                        {booking.trackingEvents.map((event, index) => (
                          <div
                            key={event.id}
                            className="relative grid grid-cols-[auto_1fr] gap-4"
                          >
                            <div className="flex flex-col items-center">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-white">
                                <CheckCircle size={20} />
                              </span>

                              {index !== booking.trackingEvents.length - 1 && (
                                <span className="h-full min-h-8 w-px bg-[#D7E6FF]" />
                              )}
                            </div>

                            <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-bold text-[#071D49]">
                                    {event.title}
                                  </p>

                                  {event.description && (
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {event.description}
                                    </p>
                                  )}
                                </div>

                                <p className="shrink-0 text-xs font-bold text-slate-500">
                                  {formatDateTime(event.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
      <span className="mt-0.5 shrink-0 text-[#006CFF]">{icon}</span>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>

        <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#071D49]">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}