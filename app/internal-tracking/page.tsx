"use client";

import { useState } from "react";
import { Copy, Link2, Truck } from "lucide-react";

const TRACKING_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/tracking/driver/start";

const FRONTEND_URL = "https://streamline-logistics.vercel.app";

export default function InternalTrackingPage() {
  const [bookingId, setBookingId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateTrackingLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setTrackingUrl("");
    setCopied(false);

    try {
      const response = await fetch(TRACKING_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId,
          driverName,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate tracking link.");
      }

      setTrackingUrl(`${FRONTEND_URL}${data.driverUrl}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate tracking link.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyTrackingLink() {
    if (!trackingUrl) return;

    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2D8CFF]/40 bg-[#006CFF]/15 text-[#2D8CFF]">
                <Truck size={32} />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Internal Tracking
                </p>

                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Generate driver tracking link
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Use this page for in-house drivers. Enter a booking ID and
                  generate a secure live tracking link.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={generateTrackingLink} className="grid gap-6 p-6 sm:p-8">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <label className="block text-sm font-semibold text-[#071D49]">
              Booking ID
              <input
                required
                value={bookingId}
                onChange={(event) => setBookingId(event.target.value)}
                placeholder="Example: clx..."
                className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
              />
            </label>

            <label className="block text-sm font-semibold text-[#071D49]">
              Driver Name
              <input
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                placeholder="Example: Ahmed"
                className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#006CFF] px-8 py-5 text-sm font-bold text-white transition hover:bg-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 size={20} />
              {loading ? "Generating..." : "Generate Tracking Link"}
            </button>

            {trackingUrl && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                <p className="text-sm font-bold text-[#071D49]">
                  Driver Tracking Link
                </p>

                <p className="mt-3 break-all rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm font-semibold text-slate-700">
                  {trackingUrl}
                </p>

                <button
                  type="button"
                  onClick={copyTrackingLink}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#071D49] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#006CFF]"
                >
                  <Copy size={17} />
                  {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}