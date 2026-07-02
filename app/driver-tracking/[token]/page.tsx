"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { MapPin, ShieldCheck, Square, Truck } from "lucide-react";

const TRACKING_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/tracking";

export default function DriverTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);

  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState("Tracking not started.");
  const [error, setError] = useState("");
  const [lastLocation, setLastLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    createdAt: string;
  } | null>(null);

  async function sendLocation(position: GeolocationPosition) {
    const now = Date.now();

    if (now - lastSentAtRef.current < 15000) {
      return;
    }

    lastSentAtRef.current = now;

    const payload = {
      token,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    };

    const response = await fetch(`${TRACKING_API_URL}/driver/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || "Failed to send location update.");
    }

    setLastLocation({
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      createdAt: new Date().toISOString(),
    });

    setStatus("Location shared successfully.");
  }

  function startTracking() {
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("Requesting location permission...");

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          setTracking(true);
          setStatus("Sharing live location...");
          await sendLocation(position);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Unable to send location update.",
          );
        }
      },
      (error) => {
        setTracking(false);
        setError(error.message || "Location permission denied.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    watchIdRef.current = watchId;
  }

  async function stopTracking() {
    setError("");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    try {
      const response = await fetch(`${TRACKING_API_URL}/driver/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to stop tracking.");
      }

      setTracking(false);
      setStatus("Tracking stopped.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to stop tracking.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-8 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2D8CFF]/40 bg-[#006CFF]/15 text-[#2D8CFF]">
                <Truck size={32} />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Driver live tracking
                </p>

                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Share delivery location
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Keep this page open while completing the delivery. Your
                  browser will ask for location permission.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-8">
            <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
              <div className="flex items-center gap-3">
                <MapPin className="text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Tracking status</h2>
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-600">
                {status}
              </p>

              {lastLocation && (
                <div className="mt-4 grid gap-2 rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm font-semibold text-[#071D49]">
                  <p>Latitude: {lastLocation.latitude}</p>
                  <p>Longitude: {lastLocation.longitude}</p>
                  <p>
                    Accuracy:{" "}
                    {lastLocation.accuracy
                      ? `${Math.round(lastLocation.accuracy)}m`
                      : "Not provided"}
                  </p>
                  <p>
                    Last update:{" "}
                    {new Date(lastLocation.createdAt).toLocaleTimeString(
                      "en-GB",
                    )}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startTracking}
                disabled={tracking}
                className="rounded-2xl bg-[#006CFF] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Tracking
              </button>

              <button
                type="button"
                onClick={stopTracking}
                disabled={!tracking}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D7E6FF] bg-white px-6 py-4 text-sm font-bold text-[#071D49] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Square size={16} />
                Stop Tracking
              </button>
            </div>

            <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
              <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-600">
                <ShieldCheck className="mt-0.5 shrink-0 text-[#006CFF]" size={18} />
                Location is only shared while this page is open and tracking is
                active.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}