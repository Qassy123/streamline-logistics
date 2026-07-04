"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
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

type JourneyStage = {
  key: string;
  label: string;
  activeTitle: string;
  completeTitles: string[];
  description: string;
};

const journeyStages: JourneyStage[] = [
  {
    key: "confirmed",
    label: "Booking confirmed",
    activeTitle: "Booking confirmed",
    completeTitles: ["payment confirmed", "booking confirmed"],
    description: "Your booking is confirmed and ready for dispatch.",
  },
  {
    key: "assigned",
    label: "Driver assigned",
    activeTitle: "Driver assigned",
    completeTitles: ["driver assigned"],
    description: "A driver has been assigned to your booking.",
  },
  {
    key: "accepted",
    label: "Driver accepted",
    activeTitle: "Driver accepted",
    completeTitles: ["accepted", "driver accepted"],
    description: "Your driver has accepted the job.",
  },
  {
    key: "to-collection",
    label: "To collection",
    activeTitle: "Travelling to collection",
    completeTitles: ["en route", "driver en route", "tracking started", "live tracking started"],
    description: "Your driver is travelling to the collection address.",
  },
  {
    key: "arrived-collection",
    label: "At collection",
    activeTitle: "At collection",
    completeTitles: ["arrived collection", "arrived at collection"],
    description: "Your driver has arrived at the collection address.",
  },
  {
    key: "collected",
    label: "Goods collected",
    activeTitle: "Goods collected",
    completeTitles: ["goods collected", "collected"],
    description: "Your goods have been collected.",
  },
  {
    key: "to-delivery",
    label: "To delivery",
    activeTitle: "Travelling to delivery",
    completeTitles: ["en route delivery", "en route to delivery", "travelling to delivery"],
    description: "Your driver is travelling to the delivery address.",
  },
  {
    key: "arrived-delivery",
    label: "At delivery",
    activeTitle: "At delivery",
    completeTitles: ["arrived delivery", "arrived at delivery"],
    description: "Your driver has arrived at the delivery address.",
  },
  {
    key: "delivered",
    label: "Delivered",
    activeTitle: "Delivered",
    completeTitles: ["delivered", "completed"],
    description: "Your delivery has been completed.",
  },
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

function normalise(value: string) {
  return value.toLowerCase().replace(/_/g, " ").trim();
}

function googleMapsUrl(location: LatestLocation) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

function googleMapsEmbedUrl(location: LatestLocation) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`;
}

function eventMatches(event: TrackingEvent, matches: string[]) {
  const title = normalise(event.title);
  const status = normalise(event.status || "");
  const description = normalise(event.description || "");

  return matches.some((match) => {
    const target = normalise(match);

    return (
      title.includes(target) ||
      status.includes(target) ||
      description.includes(target)
    );
  });
}

function findStageEvent(events: TrackingEvent[], stage: JourneyStage) {
  return events
    .slice()
    .reverse()
    .find((event) => eventMatches(event, stage.completeTitles));
}

function isTrackingLive(booking: EnrichedTrackingBooking) {
  return Boolean(booking.trackingStartedAt && !booking.trackingEndedAt);
}

function isOperationalBooking(booking: EnrichedTrackingBooking) {
  return ["ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
}

function getLastEventTime(booking: EnrichedTrackingBooking) {
  const latestEvent = booking.trackingEvents[booking.trackingEvents.length - 1];

  return new Date(
    booking.latestLocation?.createdAt ||
      latestEvent?.createdAt ||
      booking.collectionDate,
  ).getTime();
}

function getCurrentStageIndex(booking: EnrichedTrackingBooking) {
  const events = booking.trackingEvents || [];

  if (booking.status === "COMPLETED") {
    return journeyStages.length - 1;
  }

  for (let index = journeyStages.length - 1; index >= 0; index -= 1) {
    if (findStageEvent(events, journeyStages[index])) {
      return index;
    }
  }

  if (booking.status === "IN_PROGRESS") return 3;
  if (booking.status === "ASSIGNED") return 1;
  if (booking.status === "CONFIRMED") return 0;

  return 0;
}

function getCurrentStage(booking: EnrichedTrackingBooking) {
  return journeyStages[getCurrentStageIndex(booking)];
}

function getCurrentStageEvent(booking: EnrichedTrackingBooking) {
  return findStageEvent(booking.trackingEvents, getCurrentStage(booking));
}

function getTrackingStateLabel(booking: EnrichedTrackingBooking) {
  if (booking.status === "COMPLETED") return "Delivery completed";
  if (booking.trackingEndedAt) return "Tracking ended";
  if (isTrackingLive(booking)) return "Live tracking active";
  if (booking.status === "ASSIGNED") return "Driver assigned";

  return formatStatus(booking.status);
}

function getSelectedBookingIdFromStorage() {
  if (typeof window === "undefined") return "";

  return window.localStorage.getItem("streamline_selected_tracking_booking_id") || "";
}

function setSelectedBookingIdInStorage(bookingId: string) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem("streamline_selected_tracking_booking_id", bookingId);
}

export default function TrackingPage() {
  const [bookings, setBookings] = useState<EnrichedTrackingBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aLive = isTrackingLive(a);
      const bLive = isTrackingLive(b);

      if (aLive !== bLive) return aLive ? -1 : 1;

      const aOperational = isOperationalBooking(a);
      const bOperational = isOperationalBooking(b);

      if (aOperational !== bOperational) return aOperational ? -1 : 1;

      return getLastEventTime(b) - getLastEventTime(a);
    });
  }, [bookings]);

  const selectedBooking = useMemo(() => {
    if (selectedBookingId) {
      const existing = bookings.find((booking) => booking.id === selectedBookingId);

      if (existing) return existing;
    }

    return sortedBookings[0] || null;
  }, [bookings, selectedBookingId, sortedBookings]);

  const shouldAutoRefresh = useMemo(() => {
    if (!selectedBooking) return false;

    return isTrackingLive(selectedBooking) || selectedBooking.status === "IN_PROGRESS";
  }, [selectedBooking]);

  useEffect(() => {
    const storedBookingId = getSelectedBookingIdFromStorage();

    if (storedBookingId) {
      setSelectedBookingId(storedBookingId);
    }

    loadTracking(storedBookingId);
  }, []);

  useEffect(() => {
    if (!shouldAutoRefresh) return;

    const interval = window.setInterval(() => {
      loadTracking(selectedBooking?.id, { silent: true });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [selectedBooking?.id, shouldAutoRefresh]);

  async function loadTracking(preferredBookingId?: string, options?: { silent?: boolean }) {
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

      const chosenBookingId =
        preferredBookingId ||
        selectedBookingId ||
        getSelectedBookingIdFromStorage();

      const chosenBookingStillExists = enrichedBookings.some(
        (booking) => booking.id === chosenBookingId,
      );

      if (chosenBookingId && chosenBookingStillExists) {
        setSelectedBookingId(chosenBookingId);
        setSelectedBookingIdInStorage(chosenBookingId);
      } else {
        const nextSelection = [...enrichedBookings].sort((a, b) => {
          const aLive = isTrackingLive(a);
          const bLive = isTrackingLive(b);

          if (aLive !== bLive) return aLive ? -1 : 1;

          const aOperational = isOperationalBooking(a);
          const bOperational = isOperationalBooking(b);

          if (aOperational !== bOperational) return aOperational ? -1 : 1;

          return getLastEventTime(b) - getLastEventTime(a);
        })[0];

        if (nextSelection) {
          setSelectedBookingId(nextSelection.id);
          setSelectedBookingIdInStorage(nextSelection.id);
        }
      }

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

  function handleSelectBooking(bookingId: string) {
    setSelectedBookingId(bookingId);
    setSelectedBookingIdInStorage(bookingId);
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
              Live location and delivery progress for your current booking.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadTracking(selectedBooking?.id)}
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
            <TrackingExperience
              booking={selectedBooking}
              bookings={sortedBookings}
              selectedBookingId={selectedBooking.id}
              onSelectBooking={handleSelectBooking}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function TrackingExperience({
  booking,
  bookings,
  selectedBookingId,
  onSelectBooking,
}: {
  booking: EnrichedTrackingBooking;
  bookings: EnrichedTrackingBooking[];
  selectedBookingId: string;
  onSelectBooking: (bookingId: string) => void;
}) {
  const currentStage = getCurrentStage(booking);
  const currentStageEvent = getCurrentStageEvent(booking);
  const trackingLive = isTrackingLive(booking);

  return (
    <article className="grid gap-5 xl:grid-cols-[390px_1fr_360px]">
      <aside className="grid h-fit gap-5 xl:sticky xl:top-6">
        <BookingSelector
          bookings={bookings}
          selectedBookingId={selectedBookingId}
          onSelectBooking={onSelectBooking}
        />

        <StatusCard booking={booking} trackingLive={trackingLive} />
      </aside>

      <section className="grid gap-5">
        <CurrentUpdateCard
          booking={booking}
          currentStage={currentStage}
          currentStageEvent={currentStageEvent}
        />

        <MapPanel booking={booking} trackingLive={trackingLive} />

        <ProgressRail booking={booking} />
      </section>

      <aside className="grid h-fit gap-5 xl:sticky xl:top-6">
        <LiveStatusPanel booking={booking} trackingLive={trackingLive} />
        <TimelinePanel events={booking.trackingEvents} />
      </aside>
    </article>
  );
}

function BookingSelector({
  bookings,
  selectedBookingId,
  onSelectBooking,
}: {
  bookings: EnrichedTrackingBooking[];
  selectedBookingId: string;
  onSelectBooking: (bookingId: string) => void;
}) {
  if (bookings.length <= 1) return null;

  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
        Selected booking
      </label>

      <div className="relative mt-3">
        <select
          value={selectedBookingId}
          onChange={(event) => onSelectBooking(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] px-4 py-4 pr-11 text-sm font-bold text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
        >
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.reference} · {getTrackingStateLabel(booking)}
            </option>
          ))}
        </select>

        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#006CFF]"
        />
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        The page stays locked to this booking until you choose another one.
      </p>
    </div>
  );
}

function CurrentUpdateCard({
  booking,
  currentStage,
  currentStageEvent,
}: {
  booking: EnrichedTrackingBooking;
  currentStage: JourneyStage;
  currentStageEvent?: TrackingEvent;
}) {
  const location = booking.latestLocation;

  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-6 shadow-xl shadow-black/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
            Current update
          </p>

          <h2 className="mt-3 text-3xl font-bold text-[#071D49]">
            {currentStage.activeTitle}
          </h2>

          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            {currentStageEvent?.description || currentStage.description}
          </p>
        </div>

        <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Last update
          </p>

          <p className="mt-2 text-lg font-bold text-[#071D49]">
            {location
              ? formatTime(location.createdAt)
              : currentStageEvent
                ? formatTime(currentStageEvent.createdAt)
                : "Pending"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  booking,
  trackingLive,
}: {
  booking: EnrichedTrackingBooking;
  trackingLive: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
          <Truck size={28} />
        </span>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
            Current status
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#071D49]">
            {getCurrentStage(booking).activeTitle}
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {booking.reference}
          </p>

          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              trackingLive
                ? "bg-green-100 text-green-700"
                : booking.status === "COMPLETED"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {getTrackingStateLabel(booking)}
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
          label="Collection window"
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

        <Info icon={<User size={18} />} label="Driver" value="Streamline driver" />
      </div>
    </div>
  );
}

function LiveStatusPanel({
  booking,
  trackingLive,
}: {
  booking: EnrichedTrackingBooking;
  trackingLive: boolean;
}) {
  const location = booking.latestLocation;

  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
          <Navigation size={24} />
        </span>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
            Location
          </p>
          <h3 className="mt-1 text-lg font-bold text-[#071D49]">
            {location
              ? trackingLive
                ? "Live location active"
                : "Last known location"
              : "Waiting for location"}
          </h3>
        </div>
      </div>

      {!location && (
        <div className="mt-5 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
          <p className="text-sm font-bold text-[#071D49]">
            The map will appear once your driver shares location.
          </p>
        </div>
      )}

      {location && (
        <div className="mt-5 grid gap-3">
          <SmallStat label="Last updated" value={formatTime(location.createdAt)} />
          <SmallStat
            label="Tracking"
            value={trackingLive ? "Live" : "Ended"}
          />
          <SmallStat
            label="Shipment stage"
            value={getCurrentStage(booking).activeTitle}
          />

          <a
            href={googleMapsUrl(location)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#006CFF] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
          >
            Open location in Google Maps
            <ExternalLink size={17} />
          </a>

          <p className="flex items-center gap-2 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 text-xs font-semibold leading-5 text-slate-600">
            <InfoIcon size={17} className="shrink-0 text-[#006CFF]" />
            Location updates while the driver keeps tracking active.
          </p>
        </div>
      )}
    </div>
  );
}

function ProgressRail({ booking }: { booking: EnrichedTrackingBooking }) {
  const currentStepIndex = getCurrentStageIndex(booking);

  return (
    <div className="overflow-x-auto rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <div className="min-w-[980px]">
        <div className="relative grid grid-cols-9 gap-3">
          <div className="absolute left-[5%] right-[5%] top-5 h-1 rounded-full bg-[#D7E6FF]" />
          <div
            className="absolute left-[5%] top-5 h-1 rounded-full bg-[#006CFF]"
            style={{
              width: `${Math.min((currentStepIndex / 8) * 90, 90)}%`,
            }}
          />

          {journeyStages.map((stage, index) => {
            const complete = index <= currentStepIndex;
            const event = findStageEvent(booking.trackingEvents, stage);

            return (
              <div
                key={stage.key}
                className="relative z-10 flex flex-col items-center text-center"
              >
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
                  {stage.label}
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
  trackingLive,
}: {
  booking: EnrichedTrackingBooking;
  trackingLive: boolean;
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
              The map will appear as soon as the driver starts sharing location.
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
                {trackingLive ? "Live driver location" : "Last known location"}
              </p>
              <p className="mt-1 text-sm font-bold text-[#071D49]">
                Updated: {formatTime(location.createdAt)}
              </p>
            </div>

            <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-3xl border border-[#D7E6FF] bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur sm:grid-cols-3">
              <MapStat
                icon={<Route size={18} />}
                label="Delivery progress"
                value={getCurrentStage(booking).activeTitle}
                highlight
              />
              <MapStat
                icon={<Clock size={18} />}
                label="Estimated arrival"
                value="Updating"
              />
              <MapStat
                icon={<Truck size={18} />}
                label="Tracking"
                value={trackingLive ? "Live" : "Ended"}
                highlight={trackingLive}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#D7E6FF] bg-[#F8FBFF] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs font-semibold leading-5 text-slate-600">
              <InfoIcon size={17} className="shrink-0 text-[#006CFF]" />
              The map stays locked to this booking and shows the latest known driver location.
            </p>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                trackingLive
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {trackingLive ? "Live" : "Last known"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function TimelinePanel({ events }: { events: TrackingEvent[] }) {
  const visibleEvents = events.slice().reverse();

  return (
    <div className="rounded-[2rem] border border-[#D7E6FF] bg-white p-5 shadow-xl shadow-black/5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
        Shipment updates
      </p>

      <div className="mt-5 grid gap-4">
        {visibleEvents.length === 0 && (
          <p className="text-sm font-semibold text-slate-600">
            No updates yet.
          </p>
        )}

        {visibleEvents.map((event) => (
          <div key={event.id} className="flex gap-3">
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#006CFF]/10 text-[#006CFF]">
              <CheckCircle size={16} />
            </span>

            <div>
              <p className="text-sm font-bold text-[#071D49]">
                {cleanEventTitle(event.title)}
              </p>

              {event.description && (
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                  {cleanEventDescription(event.description)}
                </p>
              )}

              <p className="mt-1 text-xs font-bold text-[#006CFF]">
                {formatDateTime(event.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cleanEventTitle(title: string) {
  const normalisedTitle = normalise(title);

  if (normalisedTitle.includes("payment confirmed")) return "Booking confirmed";
  if (normalisedTitle.includes("driver assigned")) return "Driver assigned";
  if (normalisedTitle.includes("accepted")) return "Driver accepted";
  if (normalisedTitle.includes("arrived collection")) return "Driver arrived at collection";
  if (normalisedTitle.includes("goods collected") || normalisedTitle === "collected") {
    return "Goods collected";
  }
  if (normalisedTitle.includes("en route delivery")) return "Driver travelling to delivery";
  if (normalisedTitle.includes("arrived delivery")) return "Driver arrived at delivery";
  if (normalisedTitle.includes("delivered")) return "Delivered";
  if (normalisedTitle.includes("tracking started") || normalisedTitle.includes("live tracking started")) {
    return "Live tracking started";
  }
  if (normalisedTitle.includes("tracking stopped") || normalisedTitle.includes("live tracking stopped")) {
    return "Live tracking ended";
  }
  if (normalisedTitle.includes("driver en route") || normalisedTitle === "en route") {
    return "Driver travelling to collection";
  }

  return title;
}

function cleanEventDescription(description: string) {
  if (!description) return "";

  return description
    .replace("The driver has started live tracking.", "The driver has started sharing live location.")
    .replace("The driver has stopped live tracking.", "The driver has stopped sharing live location.")
    .replace("The driver has stopped live location sharing.", "The driver has stopped sharing live location.");
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
