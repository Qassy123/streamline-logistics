"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
} from "lucide-react";

const BOOKINGS_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/bookings/me/tracking";
const TRACKING_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/tracking/customer";

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

type LatestLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  createdAt: string;
};

type CustomerTrackingResponse = {
  booking: {
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
    trackingStartedAt?: string | null;
    trackingEndedAt?: string | null;
  };
  latestLocation: LatestLocation | null;
  trackingEvents: TrackingEvent[];
};

type EnrichedTrackingBooking = TrackingBooking & {
  latestLocation?: LatestLocation | null;
  trackingStartedAt?: string | null;
  trackingEndedAt?: string | null;
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function isActiveTracking(status: string, trackingStartedAt?: string | null, trackingEndedAt?: string | null) {
  if (trackingEndedAt) return false;
  if (trackingStartedAt) return true;

  return ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(status);
}

function googleMapsUrl(location: LatestLocation) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

function googleMapsEmbedUrl(location: LatestLocation) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`;
}

export default function TrackingPage() {
  const [bookings, setBookings] = useState<EnrichedTrackingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const hasActiveTracking = useMemo(
    () =>
      bookings.some((booking) =>
        isActiveTracking(
          booking.status,
          booking.trackingStartedAt,
          booking.trackingEndedAt,
        ),
      ),
    [bookings],
  );

  const orderedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aActive = isActiveTracking(
        a.status,
        a.trackingStartedAt,
        a.trackingEndedAt,
      );
      const bActive = isActiveTracking(
        b.status,
        b.trackingStartedAt,
        b.trackingEndedAt,
      );

      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }

      return (
        new Date(b.collectionDate).getTime() -
        new Date(a.collectionDate).getTime()
      );
    });
  }, [bookings]);

  const selectedBooking =
    orderedBookings.find((booking) => booking.id === selectedBookingId) ||
    orderedBookings[0] ||
    null;

  useEffect(() => {
    loadTracking();
  }, []);

  useEffect(() => {
    if (!hasActiveTracking) return;

    const interval = window.setInterval(() => {
      loadTracking({ silent: true });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [hasActiveTracking]);

  useEffect(() => {
    if (selectedBookingId && bookings.some((booking) => booking.id === selectedBookingId)) {
      return;
    }

    if (orderedBookings[0]) {
      setSelectedBookingId(orderedBookings[0].id);
    }
  }, [bookings, orderedBookings, selectedBookingId]);

  async function loadTracking(options?: { silent?: boolean }) {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!token) {
        throw new Error("Not authenticated.");
      }

      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(BOOKINGS_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load tracking.");
      }

      const baseBookings = Array.isArray(data.bookings)
        ? (data.bookings as TrackingBooking[])
        : [];

      const enrichedBookings = await Promise.all(
        baseBookings.map(async (booking) => {
          try {
            const trackingResponse = await fetch(
              `${TRACKING_API_URL}/${booking.id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            const trackingData =
              (await trackingResponse.json().catch(() => null)) as
                | CustomerTrackingResponse
                | { error?: string }
                | null;

            if (!trackingResponse.ok || !trackingData || !("booking" in trackingData)) {
              return booking;
            }

            return {
              ...booking,
              status: trackingData.booking.status,
              vehicle: trackingData.booking.vehicle || booking.vehicle,
              trackingEvents: trackingData.trackingEvents || booking.trackingEvents,
              latestLocation: trackingData.latestLocation,
              trackingStartedAt: trackingData.booking.trackingStartedAt || null,
              trackingEndedAt: trackingData.booking.trackingEndedAt || null,
            };
          } catch {
            return booking;
          }
        }),
      );

      setBookings(enrichedBookings);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load tracking.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Shipment Tracking
                </p>

                <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
                  Track your deliveries.
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  View live driver location, booking progress and shipment updates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadTracking()}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2D8CFF]/40 bg-white/[0.08] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.14]"
              >
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
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
                    <div className="grid gap-5">
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

                      <LiveLocationCard booking={booking} />
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

function LiveLocationCard({ booking }: { booking: EnrichedTrackingBooking }) {
  const location = booking.latestLocation;
  const trackingActive = isActiveTracking(
    booking.status,
    booking.trackingStartedAt,
    booking.trackingEndedAt,
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-lg shadow-black/5">
      <div className="flex items-start gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
          <Navigation size={24} />
        </span>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
            Live Driver Location
          </p>

          <h3 className="mt-2 text-xl font-bold text-[#071D49]">
            {trackingActive ? "Tracking active" : "Tracking inactive"}
          </h3>
        </div>
      </div>

      {!location && (
        <div className="mx-5 mb-5 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
          <p className="text-sm font-bold text-[#071D49]">
            Live map will appear once the driver starts sharing location.
          </p>
        </div>
      )}

      {location && (
        <div className="grid gap-5">
          <div className="relative h-[420px] w-full border-y border-[#D7E6FF] bg-[#F4F8FF]">
            <iframe
              title={`Live map for ${booking.reference}`}
              src={googleMapsEmbedUrl(location)}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            <div className="absolute left-4 top-4 rounded-2xl border border-[#D7E6FF] bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006CFF]">
                Driver En Route
              </p>
              <p className="mt-1 text-sm font-bold text-[#071D49]">
                Last updated: {formatTime(location.createdAt)}
              </p>
            </div>

            <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-3xl border border-[#D7E6FF] bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur sm:grid-cols-4">
              <MapStat label="Latitude" value={String(location.latitude)} />
              <MapStat label="Longitude" value={String(location.longitude)} />
              <MapStat
                label="Accuracy"
                value={
                  location.accuracy === null || location.accuracy === undefined
                    ? "Not provided"
                    : `${Math.round(location.accuracy)}m`
                }
              />
              <MapStat
                label="Status"
                value={trackingActive ? "Live" : "Inactive"}
                highlight={trackingActive}
              />
            </div>
          </div>

          <div className="grid gap-3 p-5 pt-0 sm:grid-cols-2">
            <a
              href={googleMapsUrl(location)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#006CFF] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
            >
              Open in Google Maps
              <ExternalLink size={17} />
            </a>

            <div className="flex items-center justify-center rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] px-5 py-4 text-sm font-bold text-[#071D49]">
              Updates every 15 seconds while active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-bold ${
          highlight ? "text-green-600" : "text-[#071D49]"
        }`}
      >
        {value}
      </p>
    </div>
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
