"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PoundSterling,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

type ReportPayload = {
  range: {
    dateFrom: string;
    dateTo: string;
  };
  overview: {
    revenue: number;
    paidInvoiceTotal: number;
    outstandingInvoiceTotal: number;
    overdueInvoiceTotal: number;
    bookings: number;
    quotes: number;
    convertedQuotes: number;
    quoteConversionRate: number;
    newCustomers: number;
    newTradeAccounts: number;
    activeDrivers: number;
    activeVehicles: number;
  };
  daily: {
    date: string;
    revenue: number;
    bookings: number;
    quotes: number;
    customers: number;
  }[];
  monthly: {
    month: string;
    revenue: number;
    bookings: number;
    quotes: number;
    customers: number;
  }[];
  vehicleUtilisation: {
    vehicleId: string;
    name: string;
    vehicleType: string;
    active: boolean;
    bookings: number;
    reservations: number;
  }[];
  error?: string;
};

type WeeklyPoint = {
  key: string;
  label: string;
  bookings: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfCurrentYear() {
  const now = new Date();
  return dateInput(new Date(now.getFullYear(), 0, 1));
}

function monthLabel(value: string) {
  const parsed = new Date(`${value}-01T00:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function weeklyBookings(
  daily: ReportPayload["daily"],
): WeeklyPoint[] {
  const totals = new Map<string, number>();

  daily.forEach((item) => {
    const start = weekStart(item.date);
    const key = dateInput(start);
    totals.set(key, (totals.get(key) || 0) + item.bookings);
  });

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bookings]) => ({
      key,
      bookings,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
      }).format(new Date(`${key}T00:00:00`)),
    }));
}

function maxValue(values: number[]) {
  return Math.max(1, ...values);
}

export default function AdminReportsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [dateFrom, setDateFrom] = useState(startOfCurrentYear);
  const [dateTo, setDateTo] = useState(() => dateInput(new Date()));
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAdminKey(
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
    );
  }, []);

  const loadReport = useCallback(
    async (refresh = false) => {
      if (!adminKey) {
        setLoading(false);
        setError(
          "Admin key is missing. Unlock the admin area first, then return to Reports.",
        );
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
        });

        const response = await fetch(
          `${API_BASE}/api/admin/reports?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ReportPayload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load reports.");
        }

        setReport(payload);
      } catch (requestError) {
        setReport(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load reports.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adminKey, dateFrom, dateTo],
  );

  useEffect(() => {
    if (adminKey) {
      void loadReport();
    } else {
      setLoading(false);
    }
  }, [adminKey, loadReport]);

  const weekly = useMemo(
    () => (report ? weeklyBookings(report.daily) : []),
    [report],
  );

  const monthly = report?.monthly || [];

  const busiestMonth = useMemo(() => {
    if (!monthly.length) return null;
    return [...monthly].sort((a, b) => b.bookings - a.bookings)[0];
  }, [monthly]);

  const quietestMonth = useMemo(() => {
    const monthsWithActivity = monthly.filter((item) => item.bookings > 0);
    if (!monthsWithActivity.length) return null;

    return [...monthsWithActivity].sort(
      (a, b) => a.bookings - b.bookings,
    )[0];
  }, [monthly]);

  const vehicles = report?.vehicleUtilisation || [];
  const mostUsedVehicle = vehicles.length ? vehicles[0] : null;
  const leastUsedVehicle = vehicles.length
    ? [...vehicles].sort((a, b) => a.bookings - b.bookings)[0]
    : null;

  const maxMonthBookings = maxValue(
    monthly.map((item) => item.bookings),
  );
  const maxWeekBookings = maxValue(
    weekly.map((item) => item.bookings),
  );
  const maxMonthlyRevenue = maxValue(
    monthly.map((item) => item.revenue),
  );
  const maxVehicleBookings = maxValue(
    vehicles.map((item) => item.bookings),
  );

  return (
    <div className="mx-auto w-full max-w-[1700px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Tab 9
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Reports
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            See the busiest periods, vehicle usage, booking volume and turnover
            so you can decide what needs improving and where to invest.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReport(true)}
          disabled={refreshing || !adminKey}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[220px_220px_auto] xl:items-end">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Date from
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Date to
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={!adminKey}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50"
          >
            <CalendarDays size={17} />
            Apply Date Range
          </button>
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex min-h-[500px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
        </div>
      ) : report ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Busiest Month"
              value={
                busiestMonth
                  ? monthLabel(busiestMonth.month)
                  : "No bookings"
              }
              detail={
                busiestMonth
                  ? `${busiestMonth.bookings} bookings`
                  : "No activity in this range"
              }
              icon={TrendingUp}
            />
            <SummaryCard
              label="Quietest Month"
              value={
                quietestMonth
                  ? monthLabel(quietestMonth.month)
                  : "No bookings"
              }
              detail={
                quietestMonth
                  ? `${quietestMonth.bookings} bookings`
                  : "No activity in this range"
              }
              icon={TrendingDown}
            />
            <SummaryCard
              label="Monthly Turnover"
              value={money(
                monthly.length
                  ? monthly[monthly.length - 1].revenue
                  : 0,
              )}
              detail={
                monthly.length
                  ? monthLabel(monthly[monthly.length - 1].month)
                  : "No data"
              }
              icon={PoundSterling}
            />
            <SummaryCard
              label="Yearly Turnover"
              value={money(report.overview.revenue)}
              detail="Selected reporting period"
              icon={BarChart3}
            />
          </section>

          <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Busy Months"
              subtitle="Bookings by month"
            >
              <BarChart
                items={monthly.map((item) => ({
                  key: item.month,
                  label: monthLabel(item.month),
                  value: item.bookings,
                  display: `${item.bookings}`,
                }))}
                max={maxMonthBookings}
                empty="No monthly booking data in this range."
              />
            </ChartCard>

            <ChartCard
              title="Bookings Per Week"
              subtitle="Weekly booking volume"
            >
              <BarChart
                items={weekly.map((item) => ({
                  key: item.key,
                  label: item.label,
                  value: item.bookings,
                  display: `${item.bookings}`,
                }))}
                max={maxWeekBookings}
                empty="No weekly booking data in this range."
              />
            </ChartCard>
          </section>

          <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Bookings Per Month"
              subtitle="Monthly booking volume"
            >
              <BarChart
                items={monthly.map((item) => ({
                  key: item.month,
                  label: monthLabel(item.month),
                  value: item.bookings,
                  display: `${item.bookings}`,
                }))}
                max={maxMonthBookings}
                empty="No monthly booking data in this range."
              />
            </ChartCard>

            <ChartCard
              title="Monthly Turnover"
              subtitle="Revenue received by month"
            >
              <BarChart
                items={monthly.map((item) => ({
                  key: item.month,
                  label: monthLabel(item.month),
                  value: item.revenue,
                  display: money(item.revenue),
                }))}
                max={maxMonthlyRevenue}
                empty="No turnover data in this range."
              />
            </ChartCard>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Van Usage
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  See which vans are going out more and which are going out less.
                </p>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-6">
                <p className="text-slate-600">
                  <span className="font-bold text-slate-950">Most used:</span>{" "}
                  {mostUsedVehicle
                    ? `${mostUsedVehicle.name} (${mostUsedVehicle.bookings})`
                    : "No data"}
                </p>
                <p className="text-slate-600">
                  <span className="font-bold text-slate-950">Least used:</span>{" "}
                  {leastUsedVehicle
                    ? `${leastUsedVehicle.name} (${leastUsedVehicle.bookings})`
                    : "No data"}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <HorizontalBars
                items={vehicles.map((vehicle) => ({
                  key: vehicle.vehicleId,
                  label: vehicle.name,
                  detail: vehicle.vehicleType,
                  value: vehicle.bookings,
                }))}
                max={maxVehicleBookings}
              />
            </div>
          </section>

          <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
            <InsightCard
              title="What to Improve"
              body={
                leastUsedVehicle
                  ? `${leastUsedVehicle.name} has the lowest recorded usage. Review whether this vehicle needs more work allocated to it or whether its running costs are justified.`
                  : "More booking data is needed before the system can highlight a low-use vehicle."
              }
              icon={Truck}
            />
            <InsightCard
              title="What to Invest In"
              body={
                mostUsedVehicle
                  ? `${mostUsedVehicle.name} has the highest recorded usage. This is the first vehicle to review when deciding where extra fleet capacity may be useful.`
                  : "More booking data is needed before the system can highlight the most-used vehicle."
              }
              icon={TrendingUp}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}

function BarChart({
  items,
  max,
  empty,
}: {
  items: {
    key: string;
    label: string;
    value: number;
    display: string;
  }[];
  max: number;
  empty: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function scrollChart(direction: "left" | "right") {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction === "right" ? 420 : -420,
      behavior: "smooth",
    });
  }

  if (items.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full">
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollChart("left")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          aria-label="Scroll chart left"
          title="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={() => scrollChart("right")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          aria-label="Scroll chart right"
          title="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-w-full overflow-x-auto overflow-y-hidden scroll-smooth"
      >
        <div className="flex w-max min-w-full items-end gap-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex w-[96px] shrink-0 flex-col items-center"
            >
              <p className="mb-2 text-center text-xs font-bold text-slate-700">
                {item.display}
              </p>

              <div className="flex h-52 w-full items-end rounded-t-xl bg-slate-100 px-2">
                <div
                  className="w-full rounded-t-lg bg-[#FF6A00]"
                  style={{
                    height: `${Math.max(
                      item.value > 0 ? 5 : 0,
                      (item.value / max) * 100,
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  max,
}: {
  items: {
    key: string;
    label: string;
    detail: string;
    value: number;
  }[];
  max: number;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No vehicle usage data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.key}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-950">
                {item.label}
              </p>
              <p className="text-xs text-slate-400">{item.detail}</p>
            </div>
            <p className="text-sm font-bold text-slate-700">
              {item.value} bookings
            </p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#FF6A00]"
              style={{
                width: `${Math.max(
                  item.value > 0 ? 2 : 0,
                  (item.value / max) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof Truck;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        </div>
      </div>
    </section>
  );
}
