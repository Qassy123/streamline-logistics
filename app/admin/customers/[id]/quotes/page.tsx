"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type CustomerSummary = {
  id: string;
  name: string;
  companyName?: string | null;
  email: string;
  accountNumber?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: unknown, currency = "GBP") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

function getAdminKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || "";
}

async function fetchCustomer(customerId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/customers/${customerId}`,
    {
      headers: {
        "x-admin-key": getAdminKey(),
      },
      cache: "no-store",
    },
  );

  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        "Unable to load customer information.",
    );
  }

  return payload.customer || payload.data || payload;
}

function customerName(customer: CustomerSummary | null) {
  if (!customer) return "Customer";

  return customer.companyName || customer.name || customer.email;
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

type Quote = {
  id: string;
  status: string;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  vehicleSize: string;
  totalPrice?: string | number | null;
  customerReference?: string | null;
  createdAt: string;
};

export default function CustomerQuotesPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;

  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchCustomer(customerId);
      setCustomer(data);
      setQuotes(
        Array.isArray(data.quotes)
          ? data.quotes
          : Array.isArray(data.relatedQuotes)
            ? data.relatedQuotes
            : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer quotes.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <Header
        title="Customer Quotes"
        description={`Quote history for ${customerName(customer)}.`}
        customerId={customerId}
        onRefresh={() => void loadData()}
      />

      {error ? <ErrorBox message={error} /> : null}

      {loading ? (
        <LoadingBox label="Loading quotes" />
      ) : quotes.length === 0 ? (
        <EmptyState
          title="No quotes found"
          description="This customer has no linked quotes."
        />
      ) : (
        <div className="grid gap-4">
          {quotes.map((quote) => (
            <section
              key={quote.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/admin/quotes"
                      className="text-base font-bold text-[#E55300] hover:underline"
                    >
                      {quote.id}
                    </Link>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {quote.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {quote.collectionAddress}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    to {quote.deliveryAddress}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm lg:min-w-[320px]">
                  <Stat label="Collection" value={formatDate(quote.collectionDate)} />
                  <Stat label="Vehicle" value={quote.vehicleSize || "—"} />
                  <Stat
                    label="Total"
                    value={formatMoney(quote.totalPrice)}
                  />
                  <Stat
                    label="Created"
                    value={formatDate(quote.createdAt)}
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  title,
  description,
  customerId,
  onRefresh,
}: {
  title: string;
  description: string;
  customerId: string;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Customer Account
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
        <Link
          href={`/admin/customers/${customerId}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
        >
          <ArrowLeft size={18} />
          Back to customer
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function LoadingBox({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
      <Loader2 className="mx-auto animate-spin text-[#FF6A00]" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {message}
    </div>
  );
}