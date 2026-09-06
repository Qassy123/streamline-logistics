"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const PAGE_SIZE = 100;

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

type Invoice = {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  userId?: string | null;
  status: InvoiceStatus;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    accountNumber?: string | null;
    name: string;
    companyName?: string | null;
    email: string;
    phone?: string | null;
  } | null;
  booking: {
    id: string;
    reference: string;
    status: string;
    collectionDate: string;
    collectionAddress: string;
    deliveryAddress: string;
    totalPrice: string | number;
    quote?: {
      id: string;
      customerName: string;
      customerEmail: string;
      companyName?: string | null;
    } | null;
    payments?: {
      id: string;
      status: string;
      amount: string | number;
      currency: string;
      paidAt?: string | null;
    }[];
    vehicle?: {
      id: string;
      name: string;
      registration?: string | null;
    } | null;
    driver?: {
      id: string;
      name: string;
    } | null;
    pod?: {
      id: string;
      status: string;
      deliveredAt?: string | null;
      recipientName?: string | null;
    } | null;
  };
};

type Payload = {
  invoices?: Invoice[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

type AccountOption = {
  key: string;
  label: string;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value?: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function accountKey(invoice: Invoice) {
  return invoice.user?.id || "GUESTS";
}

function accountLabel(invoice: Invoice) {
  if (!invoice.user) return "Guests";

  return (
    invoice.user.companyName ||
    invoice.user.name ||
    invoice.user.email ||
    "Customer"
  );
}

export default function AdminInvoicesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("ALL");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedKey);

    if (!storedKey) {
      setLoading(false);
      setError(
        "Admin key is missing. Unlock the admin area first, then return to Invoices.",
      );
    }
  }, []);

  const loadInvoices = useCallback(
    async (refresh = false) => {
      if (!adminKey) return;

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const allInvoices: Invoice[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const params = new URLSearchParams({
            page: String(currentPage),
            pageSize: String(PAGE_SIZE),
            status: "ALL",
            overdueOnly: "false",
          });

          const response = await fetch(
            `${API_BASE}/api/invoices/admin/list?${params.toString()}`,
            {
              headers: {
                "x-admin-key": adminKey,
              },
              cache: "no-store",
            },
          );

          const payload = (await response.json()) as Payload;

          if (!response.ok) {
            if (response.status === 401) {
              window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
              setAdminKey("");
            }

            throw new Error(payload.error || "Unable to load invoices.");
          }

          allInvoices.push(...(payload.invoices || []));
          totalPages = payload.pagination?.totalPages || 1;
          currentPage += 1;
        } while (currentPage <= totalPages);

        setInvoices(allInvoices);
      } catch (requestError) {
        setInvoices([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load invoices.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey],
  );

  useEffect(() => {
    if (adminKey) {
      void loadInvoices();
    }
  }, [adminKey, loadInvoices]);

  const accountOptions = useMemo(() => {
    const accountMap = new Map<string, string>();

    for (const invoice of invoices) {
      const key = accountKey(invoice);
      const label = accountLabel(invoice);

      if (!accountMap.has(key)) {
        accountMap.set(key, label);
      }
    }

    const options: AccountOption[] = [];

    if (accountMap.has("GUESTS")) {
      options.push({
        key: "GUESTS",
        label: "Guests",
      });
    }

    const customerOptions = Array.from(accountMap.entries())
      .filter(([key]) => key !== "GUESTS")
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...options, ...customerOptions];
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const invoiceSearch = invoiceNumber.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesAccount =
        selectedAccount === "ALL" ||
        accountKey(invoice) === selectedAccount;

      const matchesInvoiceNumber =
        !invoiceSearch ||
        invoice.invoiceNumber.toLowerCase().includes(invoiceSearch);

      return matchesAccount && matchesInvoiceNumber;
    });
  }, [invoiceNumber, invoices, selectedAccount]);

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Tab 8
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Invoices
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void loadInvoices(true)}
          disabled={refreshing || loading || !adminKey}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-950">Select Account</h2>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Account
            </span>

            <select
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
            >
              <option value="ALL">All Accounts</option>

              {accountOptions.map((account) => (
                <option key={account.key} value={account.key}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Invoice No
            </span>

            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="12345"
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </label>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Matching Invoices
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {filteredInvoices.length}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-950">
              List of Invoices Generated
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Click an invoice to view its details.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
              <div>
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-bold text-slate-950">
                  No invoices found
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Choose another account or invoice number.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setSelectedInvoice(invoice)}
                  className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6 md:grid-cols-[minmax(0,1fr)_150px_140px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-950">
                      {invoice.invoiceNumber}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {accountLabel(invoice)}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Booking {invoice.booking.reference}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {formatStatus(invoice.status)}
                    </p>
                  </div>

                  <div className="md:text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Total
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {money(invoice.total)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedInvoice ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Invoice
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selectedInvoice.invoiceNumber}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Close invoice"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard
                  label="Account"
                  value={accountLabel(selectedInvoice)}
                />
                <InfoCard
                  label="Status"
                  value={formatStatus(selectedInvoice.status)}
                />
                <InfoCard
                  label="Invoice Date"
                  value={date(selectedInvoice.createdAt)}
                />
                <InfoCard
                  label="Due Date"
                  value={date(selectedInvoice.dueDate)}
                />
                <InfoCard
                  label="Booking"
                  value={selectedInvoice.booking.reference}
                />
                <InfoCard
                  label="Payment"
                  value={
                    selectedInvoice.booking.payments?.[0]?.status
                      ? formatStatus(
                          selectedInvoice.booking.payments[0].status,
                        )
                      : "Not recorded"
                  }
                />
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                  Journey
                </p>

                <p className="mt-3 font-bold text-slate-950">
                  {selectedInvoice.booking.collectionAddress}
                </p>
                <p className="my-2 text-sm text-slate-400">to</p>
                <p className="font-bold text-slate-950">
                  {selectedInvoice.booking.deliveryAddress}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <AmountCard
                  label="Subtotal"
                  value={money(selectedInvoice.subtotal)}
                />
                <AmountCard
                  label="VAT"
                  value={money(selectedInvoice.vatAmount)}
                />
                <AmountCard
                  label="Total"
                  value={money(selectedInvoice.total)}
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function AmountCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
