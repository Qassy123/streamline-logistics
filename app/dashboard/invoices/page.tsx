"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Package,
  ReceiptText,
} from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/bookings/me/invoices";
const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type MoneyValue = string | number;

type SupportingDocument = {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  mimeType?: string | null;
};

type Pod = {
  id: string;
  status: string;
  recipientName?: string | null;
  signatureUrl?: string | null;
  photoUrl?: string | null;
  deliveredAt?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  purchaseOrderNumber?: string | null;
  customerReference?: string | null;
  quote?: {
    deliveryType?: string | null;
    journeyType?: string | null;
  } | null;
  pod?: Pod | null;
  documents?: SupportingDocument[];
};

type InvoiceBooking = {
  id: string;
  bookingReference: string;
  bookingDate: string;
  poReference?: string | null;
  routeDescription?: string | null;
  serviceDescription?: string | null;
  netAmount: MoneyValue;
  vatAmount: MoneyValue;
  grossAmount: MoneyValue;
  booking: Booking;
};

type InvoiceLine = {
  id: string;
  chargeType: string;
  description: string;
  quantity: MoneyValue;
  unitPrice: MoneyValue;
  netAmount: MoneyValue;
  vatRate: MoneyValue;
  vatAmount: MoneyValue;
  grossAmount: MoneyValue;
  bookingReference?: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  subtotal: MoneyValue;
  vatAmount: MoneyValue;
  total: MoneyValue;
  amountPaid: MoneyValue;
  creditedAmount: MoneyValue;
  outstanding: MoneyValue;
  dueDate?: string | null;
  issuedAt?: string | null;
  finalisedAt?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
  paymentTerms?: string | null;
  customerReference?: string | null;
  purchaseOrderNumber?: string | null;
  createdAt: string;
  booking?: Booking | null;
  invoiceBookings: InvoiceBooking[];
  lines: InvoiceLine[];
  documents: SupportingDocument[];
};

function formatMoney(value: MoneyValue | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatLabel(value?: string | null) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function statusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "OVERDUE":
      return "border-red-200 bg-red-50 text-red-700";
    case "PARTIALLY_PAID":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CREDITED":
    case "VOID":
    case "CANCELLED":
      return "border-slate-300 bg-slate-100 text-slate-600";
    default:
      return "border-blue-200 bg-blue-50 text-[#006CFF]";
  }
}

function invoiceBookings(invoice: Invoice) {
  if (invoice.invoiceBookings?.length) return invoice.invoiceBookings;

  if (!invoice.booking) return [];

  return [
    {
      id: invoice.booking.id,
      bookingReference: invoice.booking.reference,
      bookingDate: invoice.booking.collectionDate,
      poReference: invoice.booking.purchaseOrderNumber || null,
      routeDescription: `${invoice.booking.collectionAddress} → ${invoice.booking.deliveryAddress}`,
      serviceDescription: invoice.booking.quote?.deliveryType || "Courier delivery",
      netAmount: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      grossAmount: invoice.total,
      booking: invoice.booking,
    },
  ];
}

function PodLinks({ booking }: { booking: Booking }) {
  const pod = booking.pod;
  const documents = booking.documents || [];
  const hasPodFiles = Boolean(pod?.signatureUrl || pod?.photoUrl);

  if (!hasPodFiles && documents.length === 0) {
    return <span className="text-sm text-slate-400">No supporting documents yet.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pod?.signatureUrl ? (
        <a
          href={pod.signatureUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#D7E6FF] bg-white px-3 py-2 text-xs font-bold text-[#006CFF] hover:border-[#006CFF]"
        >
          <FileCheck2 size={14} />
          POD Signature
        </a>
      ) : null}
      {pod?.photoUrl ? (
        <a
          href={pod.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#D7E6FF] bg-white px-3 py-2 text-xs font-bold text-[#006CFF] hover:border-[#006CFF]"
        >
          <ImageIcon size={14} />
          Delivery Photo
        </a>
      ) : null}
      {documents.map((document) => (
        <a
          key={document.id}
          href={document.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#D7E6FF] bg-white px-3 py-2 text-xs font-bold text-[#006CFF] hover:border-[#006CFF]"
        >
          <FileText size={14} />
          {document.name}
        </a>
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function downloadInvoicePdf(invoice: Invoice) {
    if (!invoice.pdfUrl) return;

    try {
      const response = await fetch(invoice.pdfUrl);

      if (!response.ok) {
        throw new Error("Failed to download invoice PDF.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error("Invoice PDF download error:", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download invoice PDF.",
      );
    }
  }

  async function loadInvoices() {
    setLoading(true);
    setError("");

    try {
      const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!token) {
        throw new Error("Please log in to view your invoices.");
      }

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load invoices.");
      }

      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load invoices.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return invoices.reduce(
      (summary, invoice) => {
        summary.invoiced += Number(invoice.total || 0);
        summary.paid += Number(invoice.amountPaid || 0);
        summary.outstanding += Number(invoice.outstanding || 0);
        return summary;
      },
      { invoiced: 0, paid: 0, outstanding: 0 },
    );
  }, [invoices]);

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </Link>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Customer Invoices
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Invoices & supporting documents.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              View invoice dates, related bookings, PO references, payment status, outstanding balances and delivery evidence.
            </p>
          </div>

          <div className="grid gap-8 p-5 sm:p-8">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#006CFF]" />
                  <p className="mt-3 text-sm font-semibold text-slate-500">Loading invoices</p>
                </div>
              </div>
            ) : (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Invoices" value={String(invoices.length)} />
                  <SummaryCard label="Total invoiced" value={formatMoney(totals.invoiced)} />
                  <SummaryCard label="Paid" value={formatMoney(totals.paid)} />
                  <SummaryCard label="Outstanding" value={formatMoney(totals.outstanding)} />
                </section>

                {invoices.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#D7E6FF] bg-[#F4F8FF] px-6 py-16 text-center">
                    <ReceiptText className="mx-auto text-[#006CFF]" size={34} />
                    <h2 className="mt-4 text-xl font-bold">No invoices available</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Your invoice history will appear here when invoices are created for your account.
                    </p>
                  </div>
                ) : (
                  <section className="grid gap-5">
                    {invoices.map((invoice) => {
                      const bookings = invoiceBookings(invoice);

                      return (
                        <article
                          key={invoice.id}
                          className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-lg shadow-black/5"
                        >
                          <div className="flex flex-col gap-5 border-b border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-2xl font-bold text-[#071D49]">
                                  {invoice.invoiceNumber}
                                </h2>
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(invoice.status)}`}
                                >
                                  {formatLabel(invoice.status)}
                                </span>
                                <span className="rounded-full border border-[#D7E6FF] bg-white px-3 py-1 text-xs font-bold text-slate-600">
                                  {formatLabel(invoice.invoiceType)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">
                                Issued {formatDate(invoice.issuedAt || invoice.finalisedAt || invoice.createdAt)} · Due {formatDate(invoice.dueDate)}
                              </p>
                            </div>

                            {invoice.pdfUrl ? (
                              <button
                                type="button"
                                onClick={() => void downloadInvoicePdf(invoice)}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#006CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
                              >
                                <Download size={17} />
                                Invoice PDF
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center rounded-full border border-[#D7E6FF] bg-white px-5 py-3 text-sm font-bold text-slate-400">
                                PDF not available yet
                              </span>
                            )}
                          </div>

                          <div className="grid gap-6 p-5 sm:p-6">
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                              <DetailCard label="Net" value={formatMoney(invoice.subtotal)} />
                              <DetailCard label="VAT" value={formatMoney(invoice.vatAmount)} />
                              <DetailCard label="Total" value={formatMoney(invoice.total)} />
                              <DetailCard label="Outstanding" value={formatMoney(invoice.outstanding)} strong />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <DetailCard label="Amount paid" value={formatMoney(invoice.amountPaid)} />
                              <DetailCard label="PO reference" value={invoice.purchaseOrderNumber || bookings.find((item) => item.poReference)?.poReference || "—"} />
                              <DetailCard label="Payment terms" value={invoice.paymentTerms || "—"} />
                            </div>

                            <section>
                              <div className="mb-3 flex items-center gap-2">
                                <Package size={18} className="text-[#006CFF]" />
                                <h3 className="font-bold">Related bookings</h3>
                              </div>
                              <div className="grid gap-3">
                                {bookings.length === 0 ? (
                                  <p className="text-sm text-slate-400">No booking details linked.</p>
                                ) : (
                                  bookings.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <p className="font-bold text-[#071D49]">{item.bookingReference}</p>
                                          <p className="mt-1 text-sm text-slate-600">{item.routeDescription || `${item.booking.collectionAddress} → ${item.booking.deliveryAddress}`}</p>
                                          <p className="mt-1 text-xs font-semibold text-slate-500">
                                            {formatDate(item.bookingDate)} · {item.serviceDescription || "Courier delivery"}
                                          </p>
                                        </div>
                                        <p className="text-sm font-bold text-[#071D49]">{formatMoney(item.grossAmount)}</p>
                                      </div>
                                      <div className="mt-3 text-xs font-semibold text-slate-500">
                                        PO: {item.poReference || item.booking.purchaseOrderNumber || "—"}
                                      </div>
                                      <div className="mt-4">
                                        <PodLinks booking={item.booking} />
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </section>

                            {invoice.lines?.length ? (
                              <section>
                                <h3 className="mb-3 font-bold">Invoice charges</h3>
                                <div className="overflow-x-auto rounded-2xl border border-[#D7E6FF]">
                                  <table className="min-w-full divide-y divide-[#D7E6FF] text-sm">
                                    <thead className="bg-[#F4F8FF] text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                                      <tr>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3">Booking</th>
                                        <th className="px-4 py-3">Net</th>
                                        <th className="px-4 py-3">VAT</th>
                                        <th className="px-4 py-3">Gross</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#D7E6FF] bg-white">
                                      {invoice.lines.map((line) => (
                                        <tr key={line.id}>
                                          <td className="px-4 py-3 font-semibold text-[#071D49]">{line.description}</td>
                                          <td className="px-4 py-3 text-slate-600">{line.bookingReference || "—"}</td>
                                          <td className="px-4 py-3 text-slate-600">{formatMoney(line.netAmount)}</td>
                                          <td className="px-4 py-3 text-slate-600">{formatMoney(line.vatAmount)}</td>
                                          <td className="px-4 py-3 font-bold text-[#071D49]">{formatMoney(line.grossAmount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </section>
                            ) : null}

                            {invoice.documents?.length ? (
                              <section>
                                <h3 className="mb-3 font-bold">Invoice supporting documents</h3>
                                <div className="flex flex-wrap gap-2">
                                  {invoice.documents.map((document) => (
                                    <a
                                      key={document.id}
                                      href={document.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-full border border-[#D7E6FF] bg-[#F4F8FF] px-4 py-2 text-sm font-bold text-[#006CFF] hover:border-[#006CFF]"
                                    >
                                      <FileText size={15} />
                                      {document.name}
                                    </a>
                                  ))}
                                </div>
                              </section>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#071D49]">{value}</p>
    </div>
  );
}

function DetailCard({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${strong ? "border-[#006CFF] bg-[#EAF2FF]" : "border-[#D7E6FF] bg-white"}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 font-bold text-[#071D49]">{value}</p>
    </div>
  );
}
