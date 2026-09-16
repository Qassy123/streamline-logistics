"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type GuestBooking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: string | number;
  customerReference?: string | null;
  purchaseOrderNumber?: string | null;
  createdAt: string;
  quote?: {
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    companyName?: string | null;
    vehicleSize?: string | null;
  } | null;
  vehicle?: {
    name?: string | null;
    registration?: string | null;
    vehicleType?: string | null;
  } | null;
  driver?: {
    name?: string | null;
  } | null;
  payments?: Array<{
    id: string;
    status: string;
    amount: string | number;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: string | number;
  }>;
};

type GuestPayload = {
  success?: boolean;
  bookings?: GuestBooking[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function GuestBookingsPage() {
  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    const adminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    if (!adminKey) {
      setError("Admin key is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
      });

      if (submittedSearch) {
        params.set("search", submittedSearch);
      }

      const response = await fetch(
        `${API_BASE}/api/admin/customers/guests?${params.toString()}`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as GuestPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load guest bookings.");
      }

      setBookings(payload.bookings || []);
      setPagination(
        payload.pagination || {
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 1,
        },
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load guest bookings.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, submittedSearch]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const guestCountText = useMemo(
    () =>
      `${pagination.total} guest booking${pagination.total === 1 ? "" : "s"}`,
    [pagination.total],
  );

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#FF6A00]">
                  <UserRound size={18} />
                  Customer Management
                </div>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Guest Bookings
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Bookings created without a customer account. When the guest
                  later creates a business account using the same email address,
                  unowned historical activity is linked to that account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadBookings()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:opacity-60"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <form
                onSubmit={submitSearch}
                className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
              >
                <label className="relative flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search guest, email, phone, booking, company or route"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Search
                </button>
              </form>

              <div className="text-sm font-semibold text-slate-600">
                {guestCountText}
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                  <Loader2 size={20} className="animate-spin" />
                  Loading guest bookings...
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                <UserRound size={34} className="mx-auto text-slate-400" />
                <h2 className="mt-3 text-lg font-bold">No guest bookings found</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Guest bookings with no linked customer account will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Booking</th>
                      <th className="px-4 py-3">Collection</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {bookings.map((booking) => {
                      const payment = booking.payments?.[0];
                      const invoice = booking.invoices?.[0];

                      return (
                        <tr key={booking.id} className="align-top hover:bg-slate-50/70">
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900">
                              {booking.quote?.customerName || "Guest customer"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {booking.quote?.companyName || "No company"}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              {booking.quote?.customerEmail || "No email"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {booking.quote?.customerPhone || "No phone"}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-bold">{booking.reference}</div>
                            <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">
                              {statusLabel(booking.status)}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 font-semibold">
                              <CalendarDays size={15} className="text-[#FF6A00]" />
                              {date(booking.collectionDate)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {booking.collectionWindow}
                            </div>
                          </td>

                          <td className="max-w-sm px-4 py-4">
                            <div className="font-medium text-slate-800">
                              {booking.collectionAddress}
                            </div>
                            <div className="my-1 text-xs font-bold text-[#FF6A00]">
                              to
                            </div>
                            <div className="font-medium text-slate-800">
                              {booking.deliveryAddress}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold">
                              {booking.vehicle?.registration ||
                                booking.vehicle?.name ||
                                booking.quote?.vehicleSize ||
                                "Unassigned"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {booking.vehicle?.vehicleType ||
                                booking.quote?.vehicleSize ||
                                "—"}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold">
                              {payment ? statusLabel(payment.status) : "No payment"}
                            </div>
                            {payment ? (
                              <div className="mt-1 text-xs text-slate-500">
                                {money(payment.amount)}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold">
                              {invoice?.invoiceNumber || "No invoice"}
                            </div>
                            {invoice ? (
                              <div className="mt-1 text-xs text-slate-500">
                                {statusLabel(invoice.status)}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-4 text-right text-base font-black">
                            {money(booking.totalPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && pagination.totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="text-sm font-semibold text-slate-600">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                  disabled={page >= pagination.totalPages}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
