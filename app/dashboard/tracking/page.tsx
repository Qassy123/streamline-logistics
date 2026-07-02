"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Info as InfoIcon,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Truck,
  User,
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

const progressSteps = [
  "Booking Created",
  "Payment Confirmed",
  "Live Tracking Started",
  "Driver En Route",
  "Collected",
  "Delivered",
  "Completed",
];

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

function isActiveTracking(
  status: string,
  trackingStartedAt?: string | null,
  trackingEndedAt?: string | null,
) {
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

function getEventByTitle(events: TrackingEvent[], title: string) {
  return events.find((event) =>
    event.title.toLowerCase().includes(title.toLowerCase()),
  );
}

function getCurrentStepIndex(booking: EnrichedTrackingBooking) {
  const titles = booking.trackingEvents.map((event) => event.title.toLowerCase());

  if (booking.status === "COMPLETED" || titles.some((title) => title.includes("completed"))) {
    return 6;
  }

  if (titles.some((title) => title.includes("delivered"))) {
    return 5;
  }

  if (titles.some((title) => title.includes("collected"))) {
    return 4;
  }

  if (titles.some((title) => title.includes("driver en route"))) {
    return 3;
  }

  if (titles.some((title) => title.includes("live tracking started"))) {
    return 2;
  }

  if (titles.some((title) => title.includes("payment confirmed"))) {
    return 1;
  }

  return 0;
}

function getSpeedLabel(location?: LatestLocation | null) {
  if (!location?.speed && location?.speed !== 0) return "—";

  const mph = location.speed * 2.23694;

  return `${Math.round(mph)} mph`;
}

function getHeadingLabel(location?: LatestLocation | null) {
  if (!location?.heading && location?.heading !== 0) return "—";

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(location.heading / 45) % 8;

  return directions[index];
}

export default function TrackingPage() {
  const [bookings, setBookings] = useState<EnrichedTrackingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  const selectedBooking = useMemo(() => {
    const orderedBookings = [...bookings].sort((a, b) => {
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

      const aLastEvent = a.trackingEvents[a.trackingEvents.length - 1]?.createdAt;
      const bLastEvent = b.trackingEvents[b.trackingEvents.length - 1]?.createdAt;

      return (
        new Date(bLastEvent || b.collectionDate).getTime() -
        new Date(aLastEvent || a.collectionDate).getTime()
      );
    });

    return orderedBookings[0] || null;
  }, [bookings]);

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

            if (
              !trackingResponse.ok ||
              !trackingData ||
              !("booking" in trackingData)
            ) {
              return booking;
            }

            return {
              ...booking,
              status: trackingData.booking.status,
              vehicle: trackingData.booking.vehicle || booking.vehicle,
              trackingEvents:
                trackingData.trackingEvents || booking.trackingEvents,
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
        error instanceof Error ? error.message : "Failed to load tracking.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] text-[#071D49]">
      <section className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Shipment Tracking
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
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
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          {loading && (
            <div className="rounded-3xl border border-[#D7E6FF] bg-white p-6 font-bold shadow-lg shadow-black/5">
              Loading tracking...
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700 shadow-lg shadow-black/5">
              {error}
            </div>
          )}

          {!loading && !error && bookings.length === 0 && (
            <div className="rounded-3xl border border-[#D7E6FF] bg-white p-6 shadow-lg shadow-black/5">
              <Truck className="text-[#006CFF]" size={30} />

              <h2 className="mt-4 text-xl font-bold">
                No tracked deliveries yet
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Once a booking is confirmed, its tracking progress will appear here.
              </p>
            </div>
          )}

          {!loading && !error && selectedBooking && (
            <TrackingExperience booking={selectedBooking} />
          )}
        </div>
      </section>
    </main>
  );
}

function TrackingExperience({ booking }: { booking: EnrichedTrackingBooking }) {
  const location = booking.latestLocation;
  const trackingActive = isActiveTracking(
    booking.status,
    booking.trackingStartedAt,
    booking.trackingEndedAt,
  );

  const currentStepIndex = getCurrentStepIndex(booking);

  return (
    <article className="grid gap-5 lg:grid-cols-[390px_1fr]">
      <aside className="grid h-fit gap-5 lg:sticky lg:top-6">
        <StatusCard
          booking={booking}
          trackingActive={trackingActive}
        />

        <LiveStatsPanel
          booking={booking}
          trackingActive={trackingActive}
        />
      </aside>

      <section className="grid gap-5">
        <ProgressRail
          events={booking.trackingEvents}
          currentStepIndex={currentStepIndex}
        />

        <MapPanel
          booking={booking}
          trackingActive={trackingActive}
        />
      </section>
    </article>
  );
}

function StatusCard({
  booking,
  trackingActive,
}: {
  booking: EnrichedTrackingBooking;
  trackingActive: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
          <Truck size={28} />
        </span>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
            Current Status
          </p>

          <h2 className="mt-2 text-2xl font-bold capitalize text-[#071D49]">
            {trackingActive ? "Driver En Route" : formatStatus(booking.status)}
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {booking.reference}
          </p>

          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              trackingActive
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {trackingActive ? "Tracking active" : "Tracking inactive"}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
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

        <Info icon={<User size={18} />} label="Driver" value="In-house driver" />
      </div>
    </div>
  );
}

function LiveStatsPanel({
  booking,
  trackingActive,
}: {
  booking: EnrichedTrackingBooking;
  trackingActive: boolean;
}) {
  const location = booking.latestLocation;

  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
            <Navigation size={24} />
          </span>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
              Live Driver Location
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#071D49]">
              {trackingActive ? "Live tracking active" : "Waiting for driver"}
            </h3>
          </div>
        </div>

        {trackingActive && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
            Live
          </span>
        )}
      </div>

      {!location && (
        <div className="mt-5 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
          <p className="text-sm font-bold text-[#071D49]">
            Live map will appear once the driver starts sharing location.
          </p>
        </div>
      )}

      {location && (
        <div className="mt-5 grid gap-3">
          <SmallStat label="Last updated" value={formatTime(location.createdAt)} />
          <div className="grid grid-cols-2 gap-3">
            <SmallStat label="Accuracy" value={`${Math.round(location.accuracy || 0)}m`} />
            <SmallStat label="Speed" value={getSpeedLabel(location)} />
            <SmallStat label="Heading" value={getHeadingLabel(location)} />
            <SmallStat label="Status" value={trackingActive ? "Moving" : "Inactive"} />
          </div>

          <a
            href={googleMapsUrl(location)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#006CFF] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
          >
            Open in Google Maps
            <ExternalLink size={17} />
          </a>

          <p className="flex items-center gap-2 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 text-xs font-semibold leading-5 text-slate-600">
            <InfoIcon size={17} className="shrink-0 text-[#006CFF]" />
            Updates every 15 seconds while tracking is active.
          </p>
        </div>
      )}
    </div>
  );
}

function ProgressRail({
  events,
  currentStepIndex,
}: {
  events: TrackingEvent[];
  currentStepIndex: number;
}) {
  return (
    <div className="overflow-x-auto rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="min-w-[760px]">
        <div className="relative grid grid-cols-7 gap-3">
          <div className="absolute left-[7%] right-[7%] top-5 h-1 rounded-full bg-[#D7E6FF]" />
          <div
            className="absolute left-[7%] top-5 h-1 rounded-full bg-[#006CFF]"
            style={{
              width: `${Math.min((currentStepIndex / 6) * 86, 86)}%`,
            }}
          />

          {progressSteps.map((step, index) => {
            const complete = index <= currentStepIndex;
            const event = getEventByTitle(events, step);

            return (
              <div key={step} className="relative z-10 flex flex-col items-center text-center">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                    complete
                      ? "border-[#006CFF] bg-[#006CFF] text-white"
                      : "border-[#D7E6FF] bg-white text-slate-400"
                  }`}
                >
                  <CheckCircle size={20} />
                </span>

                <p
                  className={`mt-3 text-xs font-bold ${
                    complete ? "text-[#071D49]" : "text-slate-500"
                  }`}
                >
                  {step}
                </p>

                <p
                  className={`mt-1 text-xs font-semibold ${
                    complete ? "text-[#006CFF]" : "text-slate-400"
                  }`}
                >
                  {event ? formatDateTime(event.createdAt) : "Pending"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MapPanel({
  booking,
  trackingActive,
}: {
  booking: EnrichedTrackingBooking;
  trackingActive: boolean;
}) {
  const location = booking.latestLocation;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-xl shadow-black/5">
      {!location && (
        <div className="grid min-h-[420px] place-items-center bg-[#F4F8FF] p-8 text-center">
          <div>
            <Navigation className="mx-auto text-[#006CFF]" size={42} />
            <h3 className="mt-4 text-2xl font-bold text-[#071D49]">
              Waiting for live location
            </h3>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">
              The map will appear as soon as the driver opens their tracking link
              and starts sharing location.
            </p>
          </div>
        </div>
      )}

      {location && (
        <>
          <div className="relative h-[460px] w-full bg-[#F4F8FF] sm:h-[560px] lg:h-[690px]">
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
              <MapStat
                icon={<Route size={18} />}
                label="Distance Remaining"
                value="Live"
              />
              <MapStat
                icon={<Clock size={18} />}
                label="Estimated Arrival"
                value="Updating"
              />
              <MapStat
                icon={<Navigation size={18} />}
                label="Current Speed"
                value={getSpeedLabel(location)}
              />
              <MapStat
                icon={<Truck size={18} />}
                label="Status"
                value={trackingActive ? "En Route" : "Inactive"}
                highlight={trackingActive}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#D7E6FF] bg-[#F8FBFF] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs font-semibold leading-5 text-slate-600">
              <InfoIcon size={17} className="shrink-0 text-[#006CFF]" />
              Location updates every 15 seconds while tracking is active.
            </p>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                trackingActive
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {trackingActive ? "Live" : "Inactive"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-[#071D49]">
        {value}
      </p>
    </div>
  );
}

function MapStat({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/80 p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-slate-500">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]">
          {label}
        </p>
      </div>

      <p
        className={`mt-2 text-lg font-bold ${
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
