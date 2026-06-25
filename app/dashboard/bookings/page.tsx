"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Package, Truck } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/bookings/me";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: string | number;
  quote?: {
    id: string;
    deliveryType?: string | null;
    journeyType?: string | null;
    vehicleSize?: string | null;
    whatAreWeCollecting?: string | null;
    loadDescription?: string | null;
    specialInstructions?: string | null;
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export default function DashboardBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load bookings.");
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load bookings."
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
              Dashboard
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Bookings
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              View your current and previous delivery bookings.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-8">
            {loading && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 font-bold">
                Loading bookings...
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && bookings.length === 0 && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                <Package className="text-[#006CFF]" size={28} />

                <h2 className="mt-4 text-xl font-bold">
                  No bookings yet
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Once you book a delivery, it will appear here.
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
              bookings.map((booking) => (
                <article
                  key={booking.id}
                  className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                          <Truck size={22} />
                        </span>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
                            {booking.status.replace(/_/g, " ")}
                          </p>

                          <h2 className="mt-1 text-xl font-bold text-[#071D49]">
                            {booking.reference}
                          </h2>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                        <Info
                          label="Collection"
                          value={booking.collectionAddress}
                        />

                        <Info
                          label="Delivery"
                          value={booking.deliveryAddress}
                        />

                        <Info
                          label="Collection Date"
                          value={formatDate(booking.collectionDate)}
                        />

                        <Info
                          label="Collection Window"
                          value={booking.collectionWindow}
                        />

                        <Info
                          label="Vehicle"
                          value={booking.quote?.vehicleSize || "Not provided"}
                        />

                        <Info
                          label="Load"
                          value={
                            booking.quote?.whatAreWeCollecting ||
                            booking.quote?.loadDescription ||
                            "Not provided"
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5 lg:w-72">
                      <p className="text-sm font-bold text-slate-500">
                        Total
                      </p>

                      <p className="mt-2 text-3xl font-bold text-[#071D49]">
                        {formatMoney(booking.totalPrice)}
                      </p>

                      <div className="mt-5 grid gap-3">
                        <Link
                          href={`/dashboard/tracking`}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#006CFF] px-5 py-3 text-sm font-bold text-white hover:bg-[#2D8CFF]"
                        >
                          Track Booking
                          <ArrowRight size={16} />
                        </Link>

                        {booking.quote?.id && (
                          <Link
                            href={`/quote?bookAgain=${booking.quote.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#006CFF] bg-white px-5 py-3 text-sm font-bold text-[#006CFF] hover:bg-[#006CFF] hover:text-white"
                          >
                            Book Again
                            <CalendarDays size={16} />
                          </Link>
                        )}
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