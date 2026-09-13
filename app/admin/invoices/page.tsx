"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
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

type InvoiceAdjustment = {
  id: string;
  sourceType: "CHARGE" | "DISCOUNT";
  sourceId?: string | null;
  name: string;
  calculation?: string | null;
  quantity: string | number;
  unitAmount: string | number;
  netAmount: string | number;
  vatApplicable: boolean;
  vatAmount: string | number;
  createdAt: string;
};

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
  adjustments?: InvoiceAdjustment[];
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

type DraftCandidate = {
  id: string;
  reference: string;
  status: string;
  totalPrice: string | number;
  collectionDate: string;
  collectionAddress: string;
  deliveryAddress: string;
  userId?: string | null;
  user?: {
    id: string;
    accountNumber?: string | null;
    accountType: string;
    name: string;
    companyName?: string | null;
    email: string;
  } | null;
};

type ChargeOption = {
  id: string;
  label: string;
  name: string;
  calculation: string;
  amount: string | number;
  vatApplicable: boolean;
  vehicleType: string;
};

type DiscountOption = {
  id: string;
  label: string;
  name: string;
  type: string;
  value: string | number;
  customerId?: string | null;
};

type Payload = {
  invoices?: Invoice[];
  invoice?: Invoice;
  bookings?: DraftCandidate[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  message?: string;
};

type OptionsPayload = {
  charges?: ChargeOption[];
  discounts?: DiscountOption[];
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
    .replace(/_/g, " ")
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

function candidateAccountLabel(booking: DraftCandidate) {
  if (!booking.user) return "Guest booking";

  return (
    booking.user.companyName ||
    booking.user.name ||
    booking.user.email ||
    "Customer"
  );
}

function requiresQuantity(calculation: string) {
  return ["PER_MILE", "PER_STOP", "PER_HOUR"].includes(calculation);
}

function AdminInvoicesContent() {
  const searchParams = useSearchParams();
  const invoiceFromQuery = searchParams.get("invoice")?.trim() || "";

  const [adminKey, setAdminKey] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("ALL");
  const [invoiceNumber, setInvoiceNumber] = useState(invoiceFromQuery);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [chargeOptions, setChargeOptions] = useState<ChargeOption[]>([]);
  const [discountOptions, setDiscountOptions] = useState<DiscountOption[]>([]);
  const [selectedChargeId, setSelectedChargeId] = useState("");
  const [selectedDiscountId, setSelectedDiscountId] = useState("");
  const [chargeQuantity, setChargeQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [invoiceWorking, setInvoiceWorking] = useState(false);
  const [error, setError] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");

  const [showCreateDraft, setShowCreateDraft] = useState(false);
  const [draftCandidates, setDraftCandidates] = useState<DraftCandidate[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCreating, setDraftCreating] = useState(false);

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
        setSelectedInvoice((current) => {
          if (!current) return current;
          return (
            allInvoices.find((invoice) => invoice.id === current.id) || current
          );
        });
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

  useEffect(() => {
    if (!invoiceFromQuery || invoices.length === 0 || selectedInvoice) {
      return;
    }

    const match = invoices.find(
      (invoice) =>
        invoice.invoiceNumber.toLowerCase() === invoiceFromQuery.toLowerCase(),
    );

    if (match) {
      setInvoiceNumber(invoiceFromQuery);
      setSelectedInvoice(match);
    }
  }, [invoiceFromQuery, invoices, selectedInvoice]);

  const loadOptions = useCallback(
    async (invoice: Invoice) => {
      if (!adminKey || invoice.status !== "DRAFT") {
        setChargeOptions([]);
        setDiscountOptions([]);
        return;
      }

      setOptionsLoading(true);

      try {
        const response = await fetch(
          `${API_BASE}/api/invoices/admin/${invoice.id}/options`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as OptionsPayload;

        if (!response.ok) {
          throw new Error(
            payload.error || "Unable to load invoice adjustment options.",
          );
        }

        setChargeOptions(payload.charges || []);
        setDiscountOptions(payload.discounts || []);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load invoice adjustment options.",
        );
      } finally {
        setOptionsLoading(false);
      }
    },
    [adminKey],
  );

  useEffect(() => {
    if (selectedInvoice) {
      void loadOptions(selectedInvoice);
    }
  }, [loadOptions, selectedInvoice]);

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
        selectedAccount === "ALL" || accountKey(invoice) === selectedAccount;

      const matchesInvoiceNumber =
        !invoiceSearch ||
        invoice.invoiceNumber.toLowerCase().includes(invoiceSearch);

      return matchesAccount && matchesInvoiceNumber;
    });
  }, [invoiceNumber, invoices, selectedAccount]);

  const selectedCharge = useMemo(
    () =>
      chargeOptions.find((charge) => charge.id === selectedChargeId) || null,
    [chargeOptions, selectedChargeId],
  );

  async function openCreateDraft() {
    if (!adminKey) return;

    setShowCreateDraft(true);
    setDraftLoading(true);
    setSelectedBookingId("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/invoices/admin/draft-candidates`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load uninvoiced bookings.");
      }

      setDraftCandidates(payload.bookings || []);
    } catch (requestError) {
      setDraftCandidates([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load uninvoiced bookings.",
      );
    } finally {
      setDraftLoading(false);
    }
  }

  async function createDraftInvoice() {
    if (!selectedBookingId || !adminKey) return;

    setDraftCreating(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/invoices/admin/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          bookingId: selectedBookingId,
        }),
      });

      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.invoice) {
        throw new Error(payload.error || "Unable to create draft invoice.");
      }

      const created = payload.invoice;
      setInvoices((current) => [created, ...current]);
      setSelectedInvoice(created);
      setInvoiceMessage(payload.message || "Draft invoice created.");
      setShowCreateDraft(false);
      setDraftCandidates([]);
      setSelectedBookingId("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create draft invoice.",
      );
    } finally {
      setDraftCreating(false);
    }
  }

  async function applyAdjustment(sourceType: "CHARGE" | "DISCOUNT") {
    if (!selectedInvoice) return;

    const sourceId =
      sourceType === "CHARGE" ? selectedChargeId : selectedDiscountId;

    if (!sourceId) {
      setError(
        sourceType === "CHARGE"
          ? "Select an additional charge."
          : "Select a discount.",
      );
      return;
    }

    setInvoiceWorking(true);
    setError("");
    setInvoiceMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/invoices/admin/${selectedInvoice.id}/adjustments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            sourceType,
            sourceId,
            quantity:
              sourceType === "CHARGE" ? Number(chargeQuantity || 1) : 1,
          }),
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.invoice) {
        throw new Error(payload.error || "Unable to update the invoice.");
      }

      const updated = payload.invoice;
      setSelectedInvoice(updated);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updated.id ? updated : invoice,
        ),
      );
      setSelectedChargeId("");
      setSelectedDiscountId("");
      setChargeQuantity("1");
      setInvoiceMessage(
        sourceType === "CHARGE"
          ? "Additional charge added."
          : "Discount applied.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the invoice.",
      );
    } finally {
      setInvoiceWorking(false);
    }
  }

  async function removeAdjustment(adjustmentId: string) {
    if (!selectedInvoice) return;

    setInvoiceWorking(true);
    setError("");
    setInvoiceMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/invoices/admin/${selectedInvoice.id}/adjustments/${adjustmentId}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.invoice) {
        throw new Error(
          payload.error || "Unable to remove invoice adjustment.",
        );
      }

      const updated = payload.invoice;
      setSelectedInvoice(updated);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updated.id ? updated : invoice,
        ),
      );
      setInvoiceMessage("Invoice adjustment removed.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove invoice adjustment.",
      );
    } finally {
      setInvoiceWorking(false);
    }
  }

  async function sendInvoice() {
    if (!selectedInvoice) return;

    if (!selectedInvoice.user?.email) {
      setError(
        "This invoice is not linked to a customer account with a primary email address.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Send ${selectedInvoice.invoiceNumber} to ${selectedInvoice.user.email}?`,
    );

    if (!confirmed) return;

    setInvoiceWorking(true);
    setError("");
    setInvoiceMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/invoices/admin/${selectedInvoice.id}/send`,
        {
          method: "POST",
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.invoice) {
        throw new Error(payload.error || "Unable to send the invoice.");
      }

      const updated = payload.invoice;
      setSelectedInvoice(updated);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updated.id ? updated : invoice,
        ),
      );
      setInvoiceMessage(
        payload.message || `Invoice sent to ${selectedInvoice.user.email}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send the invoice.",
      );
    } finally {
      setInvoiceWorking(false);
    }
  }

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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void openCreateDraft()}
            disabled={loading || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E55300] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={17} />
            Create Draft Invoice
          </button>

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
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setInvoiceMessage("");
                    setError("");
                  }}
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

      {showCreateDraft ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-3xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Pending Invoice
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Create Draft Invoice
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Only bookings without an existing invoice are available.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateDraft(false)}
                disabled={draftCreating}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close create draft invoice"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {draftLoading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#FF6A00]" />
                </div>
              ) : draftCandidates.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-950">
                    No uninvoiced bookings available
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    All eligible bookings already have an invoice.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Booking
                    </span>
                    <select
                      value={selectedBookingId}
                      onChange={(event) =>
                        setSelectedBookingId(event.target.value)
                      }
                      disabled={draftCreating}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                    >
                      <option value="">Select booking</option>
                      {draftCandidates.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.reference} · {candidateAccountLabel(booking)} ·{" "}
                          {formatStatus(booking.status)} ·{" "}
                          {money(booking.totalPrice)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedBookingId ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {(() => {
                        const booking = draftCandidates.find(
                          (item) => item.id === selectedBookingId,
                        );

                        if (!booking) return null;

                        return (
                          <>
                            <p className="font-bold text-slate-950">
                              {booking.reference}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {candidateAccountLabel(booking)}
                            </p>
                            <p className="mt-3 text-sm text-slate-700">
                              {booking.collectionAddress}
                            </p>
                            <p className="my-1 text-xs text-slate-400">to</p>
                            <p className="text-sm text-slate-700">
                              {booking.deliveryAddress}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                              <span className="font-bold text-slate-950">
                                {money(booking.totalPrice)}
                              </span>
                              <span className="text-slate-500">
                                {date(booking.collectionDate)}
                              </span>
                              <span className="text-slate-500">
                                {formatStatus(booking.status)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateDraft(false)}
                      disabled={draftCreating}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => void createDraftInvoice()}
                      disabled={draftCreating || !selectedBookingId}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {draftCreating ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Plus size={17} />
                      )}
                      Create Draft
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {selectedInvoice ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
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
                onClick={() => {
                  setSelectedInvoice(null);
                  setInvoiceMessage("");
                }}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Close invoice"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {invoiceMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {invoiceMessage}
                </div>
              ) : null}

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
                      ? formatStatus(selectedInvoice.booking.payments[0].status)
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

              {selectedInvoice.status === "DRAFT" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#E55300]">
                        Pending Invoice
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">
                        Additional Charges & Discounts
                      </h3>
                    </div>

                    {optionsLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#FF6A00]" />
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <select
                      value={selectedChargeId}
                      onChange={(event) =>
                        setSelectedChargeId(event.target.value)
                      }
                      disabled={invoiceWorking || optionsLoading}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                    >
                      <option value="">Select additional charge</option>
                      {chargeOptions.map((charge) => (
                        <option key={charge.id} value={charge.id}>
                          {charge.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={chargeQuantity}
                      onChange={(event) =>
                        setChargeQuantity(event.target.value)
                      }
                      disabled={
                        invoiceWorking ||
                        !selectedCharge ||
                        !requiresQuantity(selectedCharge.calculation)
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm disabled:bg-slate-100"
                      aria-label="Charge quantity"
                    />

                    <button
                      type="button"
                      onClick={() => void applyAdjustment("CHARGE")}
                      disabled={invoiceWorking || !selectedChargeId}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {invoiceWorking ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Plus size={17} />
                      )}
                      Add Charge
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      value={selectedDiscountId}
                      onChange={(event) =>
                        setSelectedDiscountId(event.target.value)
                      }
                      disabled={invoiceWorking || optionsLoading}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                    >
                      <option value="">Select discount</option>
                      {discountOptions.map((discount) => (
                        <option key={discount.id} value={discount.id}>
                          {discount.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void applyAdjustment("DISCOUNT")}
                      disabled={invoiceWorking || !selectedDiscountId}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-950 bg-white px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                    >
                      {invoiceWorking ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Plus size={17} />
                      )}
                      Apply Discount
                    </button>
                  </div>

                  {selectedInvoice.adjustments?.length ? (
                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="divide-y divide-slate-200">
                        {selectedInvoice.adjustments.map((adjustment) => (
                          <div
                            key={adjustment.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {adjustment.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {adjustment.sourceType === "DISCOUNT"
                                  ? "Discount"
                                  : "Additional charge"}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <p
                                className={`text-sm font-bold ${
                                  Number(adjustment.netAmount) < 0
                                    ? "text-emerald-700"
                                    : "text-slate-950"
                                }`}
                              >
                                {money(adjustment.netAmount)}
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  void removeAdjustment(adjustment.id)
                                }
                                disabled={invoiceWorking}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                aria-label={`Remove ${adjustment.name}`}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-slate-500">
                      No additional charges or discounts have been applied.
                    </p>
                  )}
                </div>
              ) : null}

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

              {selectedInvoice.status === "DRAFT" ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">
                      Send pending invoice
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedInvoice.user?.email
                        ? `This sends to the account primary email: ${selectedInvoice.user.email}`
                        : "This invoice is not linked to an account primary email."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void sendInvoice()}
                    disabled={
                      invoiceWorking || !selectedInvoice.user?.email
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {invoiceWorking ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                    Send Invoice
                  </button>
                </div>
              ) : null}
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

export default function AdminInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading invoices...
          </div>
        </div>
      }
    >
      <AdminInvoicesContent />
    </Suspense>
  );
}
