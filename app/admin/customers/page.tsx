"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type AccountType = "PRIVATE" | "BUSINESS" | "TRADE";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

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
  mainContactName?: string | null;
};

type CustomersResponse = {
  customers?: Customer[];
  error?: string;
};

function displayName(customer: Customer) {
  return (
    customer.companyName ||
    customer.legalEntity ||
    customer.tradingName ||
    customer.name
  );
}

function displayAccountType(type: AccountType) {
  if (type === "TRADE") {
    return "Trade Credit Account";
  }

  if (type === "BUSINESS") {
    return "Business Account";
  }

  return "Private Account";
}

function displayAccountStatus(status: AccountStatus) {
  if (status === "ACTIVE") {
    return "Live";
  }

  if (status === "INACTIVE") {
    return "Blocked";
  }

  return "Suspended";
}

function statusClasses(status: AccountStatus) {
  if (status === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "SUSPENDED") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

export default function ExistingCustomersPage() {
  const [adminKey, setAdminKey] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedKey =
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "";

    setAdminKey(storedKey);
  }, []);

  const loadCustomers = useCallback(
    async (refresh = false) => {
      if (!adminKey) {
        setLoading(false);
        setCustomers([]);
        setError("Admin key is required.");
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
        });

        if (search.trim()) {
          params.set("search", search.trim());
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
          }

          throw new Error(
            payload.error || "Unable to load customer accounts.",
          );
        }

        setCustomers(payload.customers || []);
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
    [adminKey, search],
  );

  useEffect(() => {
    if (!adminKey) {
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [adminKey, loadCustomers]);

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            Existing Customer Accounts
          </h1>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void loadCustomers(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/admin/customers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E85F00]"
          >
            <UserPlus size={17} />
            Add New Customer
          </Link>
        </div>
      </div>

      <div className="mt-7">
        <label className="relative block max-w-2xl">
          <span className="sr-only">Search customer accounts</span>

          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer accounts"
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#FF6A00]"
          />
        </label>
      </div>

      {error ? (
        <div className="mt-6 flex items-center gap-3 border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden border border-slate-300 bg-white">
        <div className="border-b border-slate-300 bg-slate-50 px-6 py-4">
          <h2 className="font-bold text-slate-950">
            Customer Accounts
          </h2>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FF6A00]" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                Loading customer accounts
              </p>
            </div>
          </div>
        ) : customers.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No customer accounts found.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Account Name
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Account Type
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Account Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Person to Contact
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Contact Number
                    </th>

                    <th className="px-6 py-4" />
                  </tr>
                </thead>

                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-200 transition last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="font-bold text-slate-950 hover:text-[#E55300]"
                        >
                          {displayName(customer)}
                        </Link>

                        {customer.accountNumber ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {customer.accountNumber}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-5 text-sm font-medium text-slate-700">
                        {displayAccountType(customer.accountType)}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                            customer.accountStatus,
                          )}`}
                        >
                          {displayAccountStatus(customer.accountStatus)}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-700">
                        {customer.mainContactName ||
                          customer.name ||
                          "Not provided"}
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-700">
                        {customer.phone || "Not provided"}
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          Open Account
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 md:hidden">
              {customers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/admin/customers/${customer.id}`}
                  className="block p-5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {displayName(customer)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {displayAccountType(customer.accountType)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                        customer.accountStatus,
                      )}`}
                    >
                      {displayAccountStatus(customer.accountStatus)}
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-slate-600">
                    <p>
                      Contact:{" "}
                      {customer.mainContactName ||
                        customer.name ||
                        "Not provided"}
                    </p>

                    <p className="mt-1">
                      {customer.phone || "Not provided"}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm font-bold text-[#E55300]">
                    Open Account
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}