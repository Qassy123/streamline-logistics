"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";
const DEFAULT_PAGE_SIZE = 25;

type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

type CustomerCounts = {
  quotes: number;
  bookings: number;
  invoices: number;
  payments: number;
  savedRoutes: number;
  notes: number;
  documents: number;
};

type TradeAccountSummary = {
  id: string;
  status: string;
  creditLimit: string | number | null;
  currentBalance: string | number | null;
  paymentTermsDays: number;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  suspendedAt?: string | null;
  reactivatedAt?: string | null;
};

type Customer = {
  id: string;
  accountNumber?: string | null;
  accountType: AccountType;
  accountStatus: AccountStatus;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  accountsEmail?: string | null;
  mainContactName?: string | null;
  vatNumber?: string | null;
  companyRegistrationNumber?: string | null;
  registeredTownCity?: string | null;
  registeredPostcode?: string | null;
  createdAt: string;
  updatedAt: string;
  adminCreated: boolean;
  tradeAccount?: TradeAccountSummary | null;
  _count: CustomerCounts;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Summary = {
  byAccountType?: Partial<Record<AccountType, number>>;
  byAccountStatus?: Partial<Record<AccountStatus, number>>;
};

type CustomersResponse = {
  customers?: Customer[];
  pagination?: Pagination;
  summary?: Summary;
  error?: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDisplayName(customer: Customer) {
  return (
    customer.companyName ||
    customer.legalEntity ||
    customer.tradingName ||
    customer.name
  );
}

function getContactName(customer: Customer) {
  return customer.mainContactName || customer.name;
}

function accountTypeClasses(accountType: AccountType) {
  switch (accountType) {
    case "PRIVATE":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "TRADE":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    default:
      return "bg-amber-50 text-amber-700 ring-amber-200";
  }
}

function accountStatusClasses(accountStatus: AccountStatus) {
  switch (accountStatus) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "SUSPENDED":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function CustomersPage() {
  const [adminKey, setAdminKey] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<Summary>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState("ALL");
  const [accountStatus, setAccountStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAdminKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || "";

    setAdminKey(storedAdminKey);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadCustomers = useCallback(
    async (showRefreshState = false) => {
      if (!adminKey) {
        setCustomers([]);
        setLoading(false);
        setError(
          "Admin access is locked. Open Driver Management and enter the admin key first.",
        );
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(DEFAULT_PAGE_SIZE),
          accountType,
          accountStatus,
        });

        if (search) {
          params.set("search", search);
        }

        const response = await fetch(
          `${API_BASE}/api/admin/customers?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as CustomersResponse;

        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
            setAdminKey("");
          }

          throw new Error(payload.error || "Unable to load customer accounts.");
        }

        setCustomers(payload.customers || []);
        setPagination(
          payload.pagination || {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setSummary(payload.summary || {});
      } catch (requestError) {
        setCustomers([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load customer accounts.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountStatus, accountType, adminKey, page, search],
  );

  useEffect(() => {
    if (adminKey) {
      void loadCustomers();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadCustomers]);

  const activeFilters = useMemo(() => {
    let count = 0;

    if (search) count += 1;
    if (accountType !== "ALL") count += 1;
    if (accountStatus !== "ALL") count += 1;

    return count;
  }, [accountStatus, accountType, search]);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setAccountType("ALL");
    setAccountStatus("ALL");
    setPage(1);
  }

  const privateCount = summary.byAccountType?.PRIVATE || 0;
  const businessCount = summary.byAccountType?.BUSINESS || 0;
  const tradeCount = summary.byAccountType?.TRADE || 0;
  const activeCount = summary.byAccountStatus?.ACTIVE || 0;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Admin dashboard
          </Link>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Customer database
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Existing customer accounts
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Search and manage private customers, business customers and trade
            accounts from one customer database.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadCustomers(true)}
            disabled={refreshing || loading || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/admin/customers/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#E55300]"
          >
            <UserPlus size={18} />
            Add new customer
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="All customers"
          value={pagination.total}
          icon={Users}
        />
        <SummaryCard
          label="Active accounts"
          value={activeCount}
          icon={ShieldCheck}
        />
        <SummaryCard
          label="Business accounts"
          value={businessCount}
          icon={Building2}
        />
        <SummaryCard
          label="Private / Trade"
          value={`${privateCount} / ${tradeCount}`}
          icon={Users}
        />
      </section>

      {!adminKey ? (
        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CircleAlert size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-amber-950">
                Admin key required
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Open Driver Management, unlock the admin area with the existing
                admin key, then return to this page.
              </p>
              <Link
                href="/admin/drivers"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-950"
              >
                Open Driver Management
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search customer accounts</span>
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, company, email, phone, account number, VAT or company number"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:flex">
            <label className="block">
              <span className="sr-only">Filter by account type</span>
              <select
                value={accountType}
                onChange={(event) => {
                  setAccountType(event.target.value);
                  setPage(1);
                }}
                className="w-full min-w-[185px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              >
                <option value="ALL">All account types</option>
                <option value="PRIVATE">Private</option>
                <option value="BUSINESS">Business</option>
                <option value="TRADE">Trade</option>
              </select>
            </label>

            <label className="block">
              <span className="sr-only">Filter by account status</span>
              <select
                value={accountStatus}
                onChange={(event) => {
                  setAccountStatus(event.target.value);
                  setPage(1);
                }}
                className="w-full min-w-[185px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
              >
                <option value="ALL">All account statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>

          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Filter size={17} />
              Clear {activeFilters}
            </button>
          ) : null}
        </div>
      </section>

      {error && adminKey ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Customer accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} matching account
              {pagination.total === 1 ? "" : "s"}
            </p>
          </div>

          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FF6A00]" />
              <p className="mt-3 text-sm font-semibold text-slate-600">
                Loading customer accounts
              </p>
            </div>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 py-12 text-center">
            <div className="max-w-md">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Users size={26} />
              </span>
              <h3 className="mt-5 text-lg font-bold text-slate-950">
                No customer accounts found
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Change the filters or create the first office-managed customer
                account.
              </p>
              <Link
                href="/admin/customers/new"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E55300]"
              >
                <UserPlus size={17} />
                Add customer
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Customer",
                      "Account",
                      "Contact",
                      "Status",
                      "Activity",
                      "Created",
                      "",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5 align-top">
                        <p className="font-bold text-slate-950">
                          {getDisplayName(customer)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Contact: {getContactName(customer)}
                        </p>
                        {customer.registeredPostcode ? (
                          <p className="mt-1 text-xs text-slate-400">
                            {customer.registeredTownCity
                              ? `${customer.registeredTownCity}, `
                              : ""}
                            {customer.registeredPostcode}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            className={accountTypeClasses(
                              customer.accountType,
                            )}
                          >
                            {customer.accountType}
                          </Badge>
                          {customer.adminCreated ? (
                            <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                              OFFICE CREATED
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {customer.accountNumber || "No account number"}
                        </p>
                      </td>

                      <td className="px-6 py-5 align-top">
                        <p className="text-sm font-semibold text-slate-800">
                          {customer.email}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {customer.phone || "No phone"}
                        </p>
                        {customer.accountsEmail ? (
                          <p className="mt-1 text-xs text-slate-400">
                            Accounts: {customer.accountsEmail}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-5 align-top">
                        <Badge
                          className={accountStatusClasses(
                            customer.accountStatus,
                          )}
                        >
                          {customer.accountStatus}
                        </Badge>
                        {customer.tradeAccount ? (
                          <p className="mt-2 text-xs font-semibold text-violet-600">
                            Trade: {customer.tradeAccount.status}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-5 align-top">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>{customer._count.quotes} quotes</span>
                          <span>{customer._count.bookings} bookings</span>
                          <span>{customer._count.invoices} invoices</span>
                          <span>{customer._count.payments} payments</span>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top text-sm text-slate-500">
                        {formatDate(customer.createdAt)}
                      </td>

                      <td className="px-6 py-5 text-right align-top">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#E55300]"
                        >
                          Open
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 lg:hidden">
              {customers.map((customer) => (
                <article key={customer.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">
                        {getDisplayName(customer)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Contact: {getContactName(customer)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={accountTypeClasses(customer.accountType)}
                      >
                        {customer.accountType}
                      </Badge>
                      <Badge
                        className={accountStatusClasses(
                          customer.accountStatus,
                        )}
                      >
                        {customer.accountStatus}
                      </Badge>
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <InfoItem
                      label="Account number"
                      value={customer.accountNumber || "Not assigned"}
                    />
                    <InfoItem label="Email" value={customer.email} />
                    <InfoItem
                      label="Phone"
                      value={customer.phone || "Not provided"}
                    />
                    <InfoItem
                      label="Activity"
                      value={`${customer._count.bookings} bookings · ${customer._count.invoices} invoices`}
                    />
                  </dl>

                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Open customer profile
                    <ArrowRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && customers.length > 0 ? (
          <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-500">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total,
              )}{" "}
              of {pagination.total}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={17} />
                Previous
              </button>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold text-slate-700">{value}</dd>
    </div>
  );
}