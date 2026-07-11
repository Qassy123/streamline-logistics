"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  PoundSterling,
  RefreshCw,
  TrendingUp,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
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
  statusBreakdowns: {
    bookings: Record<string, number>;
    invoices: Record<string, number>;
    quotes: Record<string, number>;
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
  topCustomers: {
    customerId: string;
    customerName: string;
    email: string;
    revenue: number;
    payments: number;
  }[];
  revenueByVehicleType: {
    vehicleType: string;
    revenue: number;
    bookings: number;
  }[];
  driverUtilisation: {
    driverId: string;
    name: string;
    active: boolean;
    availability: string;
    bookings: number;
  }[];
  vehicleUtilisation: {
    vehicleId: string;
    name: string;
    vehicleType: string;
    active: boolean;
    bookings: number;
    reservations: number;
  }[];
  tradeAccounts: {
    total: number;
    totalCreditLimit: number;
    totalCurrentBalance: number;
    byStatus: Record<string, number>;
  };
  error?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function monthLabel(value: string) {
  const parsed = new Date(`${value}-01T00:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function AdminReportsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 29);
    return dateInput(value);
  });
  const [dateTo, setDateTo] = useState(() => dateInput(new Date()));
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [view, setView] = useState<"daily" | "monthly">("daily");
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
          "Admin key is required. Unlock the admin area from Driver Management.",
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

  const chartData = useMemo(() => {
    if (!report) return [];

    return view === "daily"
      ? report.daily.map((item) => ({
          label: dateLabel(item.date),
          revenue: item.revenue,
          bookings: item.bookings,
        }))
      : report.monthly.map((item) => ({
          label: monthLabel(item.month),
          revenue: item.revenue,
          bookings: item.bookings,
        }));
  }, [report, view]);

  const maxRevenue = Math.max(
    1,
    ...chartData.map((item) => item.revenue),
  );

  async function exportCsv() {
    if (!adminKey) return;

    setError("");

    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      });

      const response = await fetch(
        `${API_BASE}/api/admin/reports/export.csv?${params.toString()}`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
        };

        throw new Error(payload.error || "Unable to export report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `streamline-report-${dateFrom}-to-${dateTo}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to export report.",
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1700px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Admin dashboard
          </Link>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Business intelligence
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Reports and analytics
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Monitor revenue, bookings, quotes, customers, trade accounts,
            drivers and fleet utilisation.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={refreshing || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={!report || !adminKey}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
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
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300]"
          >
            <CalendarDays size={17} />
            Apply date range
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
            <MetricCard
              label="Revenue"
              value={money(report.overview.revenue)}
              icon={PoundSterling}
            />
            <MetricCard
              label="Bookings"
              value={String(report.overview.bookings)}
              icon={Truck}
            />
            <MetricCard
              label="Quote conversion"
              value={percent(report.overview.quoteConversionRate)}
              icon={TrendingUp}
            />
            <MetricCard
              label="New customers"
              value={String(report.overview.newCustomers)}
              icon={UsersRound}
            />
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Paid invoices"
              value={money(report.overview.paidInvoiceTotal)}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Outstanding"
              value={money(report.overview.outstandingInvoiceTotal)}
              icon={CircleAlert}
            />
            <MetricCard
              label="Overdue"
              value={money(report.overview.overdueInvoiceTotal)}
              icon={CircleAlert}
            />
            <MetricCard
              label="Trade accounts"
              value={String(report.overview.newTradeAccounts)}
              icon={UserRound}
            />
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Revenue trend
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revenue and booking volume across the selected period.
                </p>
              </div>

              <div className="flex rounded-xl border border-slate-300 p-1">
                <button
                  type="button"
                  onClick={() => setView("daily")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    view === "daily"
                      ? "bg-slate-950 text-white"
                      : "text-slate-600"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setView("monthly")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    view === "monthly"
                      ? "bg-slate-950 text-white"
                      : "text-slate-600"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="mt-8 overflow-x-auto">
              <div className="flex min-w-[900px] items-end gap-3">
                {chartData.map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-[48px] flex-1 flex-col items-center"
                  >
                    <div className="flex h-64 w-full items-end rounded-t-xl bg-slate-100 px-2">
                      <div
                        className="w-full rounded-t-lg bg-[#FF6A00]"
                        style={{
                          height: `${Math.max(
                            4,
                            (item.revenue / maxRevenue) * 100,
                          )}%`,
                        }}
                        title={`${item.label}: ${money(item.revenue)}`}
                      />
                    </div>
                    <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.bookings} bookings
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <DataCard title="Top customers">
              <Table
                headers={["Customer", "Payments", "Revenue"]}
                rows={report.topCustomers.map((customer) => [
                  <div key={customer.customerId}>
                    <p className="font-bold text-slate-950">
                      {customer.customerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {customer.email || "No email"}
                    </p>
                  </div>,
                  customer.payments,
                  money(customer.revenue),
                ])}
                empty="No customer revenue in this range."
              />
            </DataCard>

            <DataCard title="Revenue by vehicle type">
              <Table
                headers={["Vehicle type", "Bookings", "Revenue"]}
                rows={report.revenueByVehicleType.map((item) => [
                  item.vehicleType,
                  item.bookings,
                  money(item.revenue),
                ])}
                empty="No vehicle revenue in this range."
              />
            </DataCard>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <DataCard title="Driver utilisation">
              <Table
                headers={["Driver", "Availability", "Bookings"]}
                rows={report.driverUtilisation.slice(0, 15).map((driver) => [
                  driver.name,
                  driver.availability,
                  driver.bookings,
                ])}
                empty="No driver records found."
              />
            </DataCard>

            <DataCard title="Vehicle utilisation">
              <Table
                headers={["Vehicle", "Type", "Bookings", "Reservations"]}
                rows={report.vehicleUtilisation.slice(0, 15).map((vehicle) => [
                  vehicle.name,
                  vehicle.vehicleType,
                  vehicle.bookings,
                  vehicle.reservations,
                ])}
                empty="No vehicle records found."
              />
            </DataCard>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <BreakdownCard
              title="Booking statuses"
              values={report.statusBreakdowns.bookings}
            />
            <BreakdownCard
              title="Invoice statuses"
              values={report.statusBreakdowns.invoices}
            />
            <BreakdownCard
              title="Quote statuses"
              values={report.statusBreakdowns.quotes}
            />
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Trade account exposure
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ValueCard
                label="Accounts"
                value={String(report.tradeAccounts.total)}
              />
              <ValueCard
                label="Credit limits"
                value={money(report.tradeAccounts.totalCreditLimit)}
              />
              <ValueCard
                label="Current balances"
                value={money(report.tradeAccounts.totalCurrentBalance)}
              />
              <ValueCard
                label="Available credit"
                value={money(
                  Math.max(
                    0,
                    report.tradeAccounts.totalCreditLimit -
                      report.tradeAccounts.totalCurrentBalance,
                  ),
                )}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
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

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function ValueCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function DataCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-5 py-4 text-sm text-slate-700"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownCard({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>

      <div className="mt-5 space-y-4">
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-600">{label}</p>
              <p className="text-sm font-bold text-slate-950">{value}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-[#FF6A00]"
                style={{
                  width: `${total > 0 ? (value / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No data in this range.</p>
        ) : null}
      </div>
    </section>
  );
}