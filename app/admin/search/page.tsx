"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Loader2,
  PackageSearch,
  ReceiptText,
  Search,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE_URL =
  (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://streamline-logistics-production.up.railway.app"
  ).replace(/\/$/, "");

type SearchEntity =
  | ""
  | "CUSTOMERS"
  | "TRADE_ACCOUNTS"
  | "QUOTES"
  | "BOOKINGS"
  | "DRIVERS"
  | "VEHICLES"
  | "PAYMENTS"
  | "INVOICES"
  | "TRACKING"
  | "DOCUMENTS";

type SearchItem = {
  id: string;
  href: string;
  [key: string]: unknown;
};

type SearchResults = {
  customers: SearchItem[];
  tradeAccounts: SearchItem[];
  quotes: SearchItem[];
  bookings: SearchItem[];
  drivers: SearchItem[];
  vehicles: SearchItem[];
  payments: SearchItem[];
  invoices: SearchItem[];
  tracking: SearchItem[];
  documents: SearchItem[];
};

type SearchResponse = {
  success: boolean;
  query: string;
  entity: string;
  total: number;
  counts: Record<string, number>;
  results: SearchResults;
  message?: string;
};

const emptyResults: SearchResults = {
  customers: [],
  tradeAccounts: [],
  quotes: [],
  bookings: [],
  drivers: [],
  vehicles: [],
  payments: [],
  invoices: [],
  tracking: [],
  documents: [],
};

const groups = [
  {
    key: "customers",
    label: "Customers",
    entity: "CUSTOMERS",
    icon: Users,
  },
  {
    key: "tradeAccounts",
    label: "Trade accounts",
    entity: "TRADE_ACCOUNTS",
    icon: Building2,
  },
  {
    key: "quotes",
    label: "Quotes",
    entity: "QUOTES",
    icon: ReceiptText,
  },
  {
    key: "bookings",
    label: "Bookings",
    entity: "BOOKINGS",
    icon: CalendarDays,
  },
  {
    key: "drivers",
    label: "Drivers",
    entity: "DRIVERS",
    icon: UserRound,
  },
  {
    key: "vehicles",
    label: "Vehicles",
    entity: "VEHICLES",
    icon: Truck,
  },
  {
    key: "payments",
    label: "Payments",
    entity: "PAYMENTS",
    icon: WalletCards,
  },
  {
    key: "invoices",
    label: "Invoices",
    entity: "INVOICES",
    icon: CircleDollarSign,
  },
  {
    key: "tracking",
    label: "Tracking",
    entity: "TRACKING",
    icon: PackageSearch,
  },
  {
    key: "documents",
    label: "Documents",
    entity: "DOCUMENTS",
    icon: FileText,
  },
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function displayMoney(value: unknown, currency = "GBP"): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

function displayDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function primaryText(group: keyof SearchResults, item: SearchItem): string {
  switch (group) {
    case "customers":
      return text(item.companyName) || text(item.name) || text(item.email);
    case "tradeAccounts":
      return text(item.companyName) || text(item.tradingName);
    case "quotes":
      return `${text(item.customerName)} · ${text(item.id)}`;
    case "bookings":
      return text(item.reference);
    case "drivers":
      return text(item.name);
    case "vehicles":
      return text(item.registration) || text(item.name);
    case "payments":
      return text(item.reference) || text(item.id);
    case "invoices":
      return text(item.invoiceNumber);
    case "tracking":
      return text(item.reference);
    case "documents":
      return text(item.name);
  }
}

function secondaryText(group: keyof SearchResults, item: SearchItem): string {
  switch (group) {
    case "customers":
      return [text(item.accountNumber), text(item.email), text(item.phone)]
        .filter(Boolean)
        .join(" · ");
    case "tradeAccounts": {
      const user = item.user as Record<string, unknown> | null;
      return [
        text(item.status),
        user ? text(user.accountNumber) : "",
        text(item.accountsEmail),
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "quotes":
      return [
        text(item.status),
        text(item.companyName),
        displayMoney(item.totalPrice),
      ]
        .filter(Boolean)
        .join(" · ");
    case "bookings": {
      const user = item.user as Record<string, unknown> | null;
      return [
        text(item.status),
        user ? text(user.companyName) || text(user.name) : "",
        displayMoney(item.totalPrice),
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "drivers": {
      const vehicle = item.vehicle as Record<string, unknown> | null;
      return [
        text(item.status),
        text(item.availability),
        text(item.email),
        vehicle ? text(vehicle.registration) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "vehicles":
      return [
        text(item.name),
        text(item.vehicleType),
        text(item.status),
      ]
        .filter(Boolean)
        .join(" · ");
    case "payments": {
      const booking = item.booking as Record<string, unknown> | null;
      return [
        text(item.status),
        displayMoney(item.amount, text(item.currency) || "GBP"),
        booking ? text(booking.reference) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "invoices": {
      const booking = item.booking as Record<string, unknown> | null;
      return [
        text(item.status),
        displayMoney(item.total),
        booking ? text(booking.reference) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "tracking": {
      const driver = item.driver as Record<string, unknown> | null;
      const vehicle = item.vehicle as Record<string, unknown> | null;
      return [
        text(item.status),
        driver ? text(driver.name) : "",
        vehicle ? text(vehicle.registration) || text(vehicle.name) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "documents":
      return [text(item.type), text(item.mimeType), displayDate(item.updatedAt)]
        .filter(Boolean)
        .join(" · ");
  }
}

function AdminSearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [entity, setEntity] = useState<SearchEntity>("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getAdminKey = useCallback(() => {
    return window.localStorage.getItem("streamline_admin_key") || "";
  }, []);

  const executeSearch = useCallback(
    async (nextQuery: string, nextEntity: SearchEntity) => {
      const trimmed = nextQuery.trim();

      if (trimmed.length < 2) {
        setResponse(null);
        setError(
          trimmed.length === 0 ? "" : "Enter at least two characters.",
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        const parameters = new URLSearchParams({
          q: trimmed,
          limit: "10",
        });

        if (nextEntity) {
          parameters.set("entity", nextEntity);
        }

        const result = await fetch(
          `${API_BASE_URL}/api/admin/search?${parameters.toString()}`,
          {
            headers: {
              "x-admin-key": getAdminKey(),
            },
            cache: "no-store",
          },
        );

        const data = (await result.json()) as SearchResponse;

        if (!result.ok || !data.success) {
          throw new Error(data.message || "Search failed.");
        }

        setResponse(data);
      } catch (searchError) {
        setResponse(null);
        setError(
          searchError instanceof Error ? searchError.message : "Search failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [getAdminKey],
  );

  useEffect(() => {
    if (query.length >= 2) {
      void executeSearch(query, entity);
    }
  }, [entity]);

  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      void executeSearch(initialQuery, "");
    }
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    setQuery(nextQuery);
    void executeSearch(nextQuery, entity);
  }

  function clearSearch() {
    setSearchInput("");
    setQuery("");
    setResponse(null);
    setError("");
  }

  const visibleGroups = useMemo(() => {
    const results = response?.results || emptyResults;

    return groups.filter((group) => results[group.key].length > 0);
  }, [response]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Overview
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Global Search
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Search customer records, trade accounts, quotes, bookings, drivers,
          vehicles, payments, invoices, tracking activity and documents.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={21}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search names, emails, phone numbers, references, account numbers or registrations"
                className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-12 text-base outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                autoFocus
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <select
              value={entity}
              onChange={(event) =>
                setEntity(event.target.value as SearchEntity)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All modules</option>
              {groups.map((group) => (
                <option key={group.entity} value={group.entity}>
                  {group.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#E85F00] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Search size={19} />
              )}
              Search
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Search requires at least two characters. Each module returns up to
            ten matching records.
          </p>
        </form>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
          <Loader2
            size={30}
            className="mx-auto animate-spin text-[#FF6A00]"
          />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Searching the admin system
          </p>
        </div>
      ) : null}

      {!loading && response ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {groups.map((group) => {
              const Icon = group.icon;
              const count = response.results[group.key].length;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() =>
                    setEntity(
                      entity === group.entity
                        ? ""
                        : (group.entity as SearchEntity),
                    )
                  }
                  className={[
                    "rounded-2xl border p-4 text-left shadow-sm transition",
                    entity === group.entity
                      ? "border-[#FF6A00] bg-orange-50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon size={20} />
                    </span>
                    <span className="text-2xl font-bold text-slate-950">
                      {count}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {group.label}
                  </p>
                </button>
              );
            })}
          </div>

          {response.total === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
              <Search size={38} className="mx-auto text-slate-300" />
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                No matches found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                No records matched “{response.query}”.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  {response.total} result{response.total === 1 ? "" : "s"} for{" "}
                  <span className="font-bold text-slate-950">
                    “{response.query}”
                  </span>
                </p>
              </div>

              {visibleGroups.map((group) => {
                const Icon = group.icon;
                const items = response.results[group.key];

                return (
                  <section
                    key={group.key}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                          <Icon size={19} />
                        </span>
                        <div>
                          <h2 className="font-bold text-slate-950">
                            {group.label}
                          </h2>
                          <p className="text-xs text-slate-500">
                            {items.length} match
                            {items.length === 1 ? "" : "es"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">
                              {primaryText(group.key, item)}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {secondaryText(group.key, item)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-[#E55300]">
                            Open
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {!loading && !response && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
          <Search size={42} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Search the complete admin system
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Enter a customer name, company, email, telephone number, booking
            reference, invoice number, account number or vehicle registration.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SearchPageFallback() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        Loading admin search...
      </p>
    </div>
  );
}

export default function AdminSearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <AdminSearchContent />
    </Suspense>
  );
}