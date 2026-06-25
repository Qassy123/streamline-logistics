"use client";

import { useEffect, useState } from "react";
import { Download, FileText, ReceiptText } from "lucide-react";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/bookings/me/invoices";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  dueDate?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  booking?: {
    reference?: string;
    quote?: {
      deliveryType?: string | null;
      collectionAddress?: string | null;
      deliveryAddress?: string | null;
    } | null;
  } | null;
};

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export default function DashboardInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load invoices.");
      }

      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load invoices."
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
              Account Invoices
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Invoices
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              View invoice history, VAT breakdowns and payment status.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-8">
            {loading && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 font-bold">
                Loading invoices...
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && invoices.length === 0 && (
              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                <FileText className="text-[#006CFF]" size={30} />

                <h2 className="mt-4 text-xl font-bold">
                  No invoices yet
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Invoices will appear here once bookings are paid and issued.
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              invoices.map((invoice) => (
                <article
                  key={invoice.id}
                  className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6"
                >
                  <div className="grid gap-6 lg:grid-cols-[1fr_0.42fr]">
                    <div>
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                          <ReceiptText size={24} />
                        </span>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
                            {formatStatus(invoice.status)}
                          </p>

                          <h2 className="mt-2 text-2xl font-bold text-[#071D49]">
                            {invoice.invoiceNumber}
                          </h2>

                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            Booking: {invoice.booking?.reference || "Not provided"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <Info
                          label="Issued"
                          value={formatDate(invoice.createdAt)}
                        />

                        <Info
                          label="Due Date"
                          value={formatDate(invoice.dueDate)}
                        />

                        <Info
                          label="Paid"
                          value={invoice.paidAt ? formatDate(invoice.paidAt) : "Not paid"}
                        />

                        <Info
                          label="Delivery Type"
                          value={invoice.booking?.quote?.deliveryType || "Not provided"}
                        />

                        <Info
                          label="Collection"
                          value={invoice.booking?.quote?.collectionAddress || "Not provided"}
                        />

                        <Info
                          label="Delivery"
                          value={invoice.booking?.quote?.deliveryAddress || "Not provided"}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                      <p className="text-sm font-bold text-slate-500">
                        Invoice Total
                      </p>

                      <p className="mt-2 text-3xl font-bold text-[#071D49]">
                        {formatMoney(invoice.total)}
                      </p>

                      <div className="mt-5 grid gap-3">
                        <PriceRow
                          label="Subtotal"
                          value={formatMoney(invoice.subtotal)}
                        />
                        <PriceRow
                          label="VAT"
                          value={formatMoney(invoice.vatAmount)}
                        />
                        <PriceRow
                          label="Total"
                          value={formatMoney(invoice.total)}
                        />
                      </div>

                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#006CFF] px-5 py-3 text-sm font-bold text-white hover:bg-[#2D8CFF]"
                        >
                          <Download size={16} />
                          Download PDF
                        </a>
                      )}
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

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-sm font-bold text-[#071D49]">{value}</p>
    </div>
  );
}