"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  CreditCard,
  FileText,
  Map,
  Package,
  ShieldCheck,
  TrendingUp,
  User,
} from "lucide-react";

const ACCOUNT_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type AccountUser = {
  name?: string | null;
  email?: string | null;
  accountType?: "BUSINESS" | "TRADE";
  companyName?: string | null;
  legalEntity?: string | null;
  tradeAccount?: {
    status?: string;
    creditLimit?: string | number;
    currentBalance?: string | number;
    paymentTermsDays?: number;
  } | null;
};

const baseCards = [
  {
    title: "Profile",
    text: "Edit your company, contact and billing details.",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Bookings",
    text: "View current and previous delivery bookings.",
    href: "/dashboard/bookings",
    icon: Package,
  },
  {
    title: "Tracking",
    text: "Track active deliveries and shipment progress.",
    href: "/dashboard/tracking",
    icon: Map,
  },
  {
    title: "Invoices",
    text: "View invoices, payment status and invoice history.",
    href: "/dashboard/invoices",
    icon: FileText,
  },
  {
    title: "Saved Routes",
    text: "Book again using saved collection and delivery details.",
    href: "/dashboard/saved-routes",
    icon: CreditCard,
  },
];

const upgradeCard = {
  title: "Upgrade Account",
  text: "Apply for trade terms, monthly invoicing and line of credit.",
  href: "/dashboard/upgrade-account",
  icon: TrendingUp,
};

function formatStatus(value?: string | null) {
  if (!value) return "Not applied";

  return value.replace(/_/g, " ").toLowerCase();
}

function formatMoney(value?: string | number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export default function DashboardPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    try {
      const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(ACCOUNT_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();

      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const isTradeAccount =
    user?.accountType === "TRADE" || user?.tradeAccount?.status === "APPROVED";

  const hasTradeApplication = Boolean(user?.tradeAccount);
  const showUpgrade = !isTradeAccount && !hasTradeApplication;

  const cards = useMemo(() => {
    if (!showUpgrade) return baseCards;

    return [...baseCards, upgradeCard];
  }, [showUpgrade]);

  const businessName =
    user?.legalEntity || user?.companyName || user?.name || "Your account";

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Customer Dashboard
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                    Manage your Streamline account.
                  </h1>

                  {!loading && (
                    <span className="rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
                      {isTradeAccount ? "Trade Account" : "Business Account"}
                    </span>
                  )}
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  Access bookings, tracking, invoices, saved routes and account settings.
                </p>
              </div>

              <div className="rounded-3xl border border-[#2D8CFF]/30 bg-white/[0.08] p-5">
                <p className="text-sm font-bold text-white">
                  {loading ? "Loading account..." : businessName}
                </p>

                <div className="mt-4 grid gap-3 text-sm text-white/75">
                  <StatusLine
                    icon={<BadgeCheck size={17} />}
                    label="Account type"
                    value={isTradeAccount ? "Trade Account" : "Business Account"}
                  />

                  <StatusLine
                    icon={<ShieldCheck size={17} />}
                    label="Trade status"
                    value={
                      isTradeAccount
                        ? "Approved"
                        : hasTradeApplication
                        ? formatStatus(user?.tradeAccount?.status)
                        : "Not applied"
                    }
                  />

                  {isTradeAccount && (
                    <StatusLine
                      icon={<Clock size={17} />}
                      label="Payment terms"
                      value={`${user?.tradeAccount?.paymentTermsDays || 30} days`}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            {hasTradeApplication && !isTradeAccount && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-lg shadow-black/5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Clock size={22} />
                  </span>

                  <div>
                    <h2 className="text-lg font-bold text-amber-950">
                      Trade application under review
                    </h2>

                    <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
                      Your trade account application has been received. The upgrade option is hidden while your application is being reviewed.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isTradeAccount && (
              <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5">
                <div className="grid gap-4 md:grid-cols-3">
                  <AccountMetric
                    label="Account Type"
                    value="Trade Account"
                  />

                  <AccountMetric
                    label="Credit Limit"
                    value={formatMoney(user?.tradeAccount?.creditLimit)}
                  />

                  <AccountMetric
                    label="Current Balance"
                    value={formatMoney(user?.tradeAccount?.currentBalance)}
                  />
                </div>
              </section>
            )}

            {showUpgrade && (
              <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#006CFF]">
                      Business Account
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-[#071D49]">
                      Upgrade available
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Apply for monthly invoicing, agreed credit terms and account-managed logistics.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/upgrade-account"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#006CFF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
                  >
                    Upgrade To Trade
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            )}

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[#006CFF] hover:bg-white hover:shadow-xl"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF] transition group-hover:bg-[#006CFF] group-hover:text-white">
                      <Icon size={24} />
                    </span>

                    <h2 className="mt-5 text-xl font-bold text-[#071D49]">
                      {card.title}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {card.text}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#006CFF]">
                      Open
                      <ArrowRight size={16} />
                    </div>
                  </Link>
                );
              })}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[#2D8CFF]">{icon}</span>
      <span>
        {label}: <span className="font-bold text-white capitalize">{value}</span>
      </span>
    </div>
  );
}

function AccountMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-[#071D49]">
        {value}
      </p>
    </div>
  );
}
