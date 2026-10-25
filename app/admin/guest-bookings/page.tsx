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


function GuestTable({ bookings }: { bookings: GuestBooking[] }) {
  return (              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
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
              </div>);
}
function GuestList({ period, search, refresh, enabled = true }: { period: "CURRENT" | "PREVIOUS"; search: string; refresh: number; enabled?: boolean }) {
  const [bookings, setBookings] = useState<GuestBooking[]>([]), [page, setPage] = useState(1), [pages, setPages] = useState(1), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const key = localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim();
    if (!key) { setBookings([]); setError("Sign in to the admin area before loading guest bookings."); setLoading(false); return; }
    const query = new URLSearchParams({ period, page: String(page), pageSize: "25", search });
    void fetch(`${API_BASE}/api/admin/customers/guests?${query}`, { cache: "no-store", signal: controller.signal, headers: { "x-admin-key": key } })
      .then(async response => { const data = await response.json() as GuestPayload; if (!response.ok) throw new Error(data.error || "Unable to load guest bookings."); if (!controller.signal.aborted) { setBookings(data.bookings || []); const count = data.pagination?.totalPages || 1; setPages(count); setTotal(data.pagination?.total || 0); if (page > count) setPage(count); } })
      .catch(failure => { if (!controller.signal.aborted) { setBookings([]); setError(failure instanceof Error ? failure.message : "Unable to load guest bookings."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, search, page, refresh, enabled]);
  if (!enabled) return null;
  return <div aria-busy={loading}>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status" className="p-6 text-slate-600">Loading guest bookings…</p> : !error && <>
      <p className="mt-4 text-sm text-slate-600">{total} {period === "CURRENT" ? "current / future" : "previous"} guest bookings</p>
      {bookings.length ? <GuestTable bookings={bookings} /> : <p className="mt-4 rounded-xl border border-dashed p-6 text-slate-600">No {period === "CURRENT" ? "current or future" : "previous"} guest bookings match. {period === "CURRENT" && "Older bookings are in Previous bookings below."}</p>}
      {pages > 1 && <div className="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" aria-label={`Previous page of ${period.toLowerCase()} guest bookings`} disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-xl border px-4 py-3 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button type="button" aria-label={`Next page of ${period.toLowerCase()} guest bookings`} disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded-xl border px-4 py-3 disabled:opacity-40">Next</button></div>}
    </>}
  </div>;
}
export default function GuestBookingsPage() {
  const [search, setSearch] = useState(""), [submitted, setSubmitted] = useState(""), [refresh, setRefresh] = useState(0), [historyOpen, setHistoryOpen] = useState(false);
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"><section className="mx-auto max-w-[1800px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 px-6 py-6 text-white"><div><p className="text-sm font-semibold text-[#FF6A00]">Customer Management</p><h1 className="mt-1 text-3xl font-bold">Guest Bookings</h1><p className="mt-2 text-sm text-white/80">Bookings created without a customer account. When the guest later creates a business account using the same email address, unowned historical activity is linked to that account. Current and future bookings are shown here; expand Previous bookings for older work.</p></div><button type="button" onClick={() => setRefresh(value => value + 1)} className="min-h-11 rounded-xl bg-[#FF6A00] px-5 py-3 font-bold">Refresh</button></header>
    <div className="p-5 sm:p-6"><form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSubmitted(search.trim()); if (search.trim()) setHistoryOpen(true); }}><input aria-label="Search guest bookings" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search guest, email, phone, booking, company or route" className="min-h-11 min-w-48 flex-1 rounded-xl border px-4 py-3"/><button className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Search</button></form>
      <h2 className="mt-6 text-lg font-bold">Current and future bookings</h2><GuestList period="CURRENT" search={submitted} refresh={refresh}/>
      <details open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)} className="mt-6 rounded-xl border border-slate-200 p-4"><summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">Previous bookings</summary><GuestList period="PREVIOUS" search={submitted} refresh={refresh} enabled={historyOpen}/></details>
    </div></section></main>;
}
