"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  FileText,
  LayoutDashboard,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        label: "Global Search",
        href: "/admin/search",
        icon: Search,
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        label: "Add New Customer",
        href: "/admin/customers/new",
        icon: UserPlus,
      },
      {
        label: "Customer Accounts",
        href: "/admin/customers",
        icon: Users,
        exact: true,
      },
      {
        label: "Trade Accounts",
        href: "/admin/trade-accounts",
        icon: Building2,
      },
    ],
  },
  {
    label: "Transport Operations",
    items: [
      {
        label: "Quotes",
        href: "/admin/quotes",
        icon: ReceiptText,
      },
      {
        label: "Existing Bookings",
        href: "/admin/bookings",
        icon: CalendarDays,
      },
      {
        label: "Planning Board",
        href: "/admin/planning-board",
        icon: ClipboardList,
      },
      {
        label: "Fleet",
        href: "/admin/fleet",
        icon: Truck,
      },
      {
        label: "Drivers",
        href: "/admin/drivers",
        icon: Users,
      },
      {
        label: "Tracking",
        href: "/admin/tracking",
        icon: PackageSearch,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Invoices",
        href: "/admin/invoices",
        icon: FileText,
      },
      {
        label: "Payments",
        href: "/admin/payments",
        icon: WalletCards,
      },
      {
        label: "Pricing / Tariffs",
        href: "/admin/pricing",
        icon: CircleDollarSign,
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Notifications",
        href: "/admin/notifications",
        icon: Bell,
      },
      {
        label: "Documents",
        href: "/admin/documents",
        icon: Boxes,
      },
      {
        label: "Audit Log",
        href: "/admin/audit-log",
        icon: FileClock,
      },
      {
        label: "Permissions",
        href: "/admin/permissions",
        icon: ShieldCheck,
      },
      {
        label: "Company Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [pathname]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(
      "streamline_admin_sidebar_collapsed",
    );

    setSidebarCollapsed(storedValue === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem(
        "streamline_admin_sidebar_collapsed",
        String(nextValue),
      );

      return nextValue;
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {mobileNavigationOpen ? (
        <button
          type="button"
          aria-label="Close admin navigation"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-all duration-300",
          mobileNavigationOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "lg:w-20" : "w-[290px] lg:w-[290px]",
        ].join(" ")}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-3"
            aria-label="Streamline Logistics admin dashboard"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF6A00] shadow-lg shadow-orange-950/30">
              <Truck size={23} strokeWidth={2.2} />
            </span>

            {!sidebarCollapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold uppercase tracking-[0.12em]">
                  Streamline
                </span>
                <span className="block truncate text-xs text-slate-400">
                  Admin Control Centre
                </span>
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            aria-label="Close admin navigation"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <X size={21} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-6">
            {navigationGroups.map((group) => (
              <section key={group.label}>
                {!sidebarCollapsed ? (
                  <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {group.label}
                  </p>
                ) : null}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavigationItemActive(pathname, item);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={[
                          "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          sidebarCollapsed
                            ? "justify-center"
                            : "justify-between gap-3",
                          active
                            ? "bg-[#FF6A00] text-white shadow-lg shadow-orange-950/20"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex min-w-0 items-center",
                            sidebarCollapsed ? "justify-center" : "gap-3",
                          ].join(" ")}
                        >
                          <Icon
                            size={19}
                            strokeWidth={active ? 2.2 : 1.8}
                            className="shrink-0"
                          />
                          {!sidebarCollapsed ? (
                            <span className="truncate">{item.label}</span>
                          ) : null}
                        </span>

                        {!sidebarCollapsed && active ? (
                          <ChevronDown
                            size={15}
                            className="-rotate-90 opacity-80"
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden w-full items-center justify-center gap-2 rounded-xl border border-slate-800 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white lg:flex"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={18} />
                <span>Collapse navigation</span>
              </>
            )}
          </button>

          {!sidebarCollapsed ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs font-semibold text-white">Admin workspace</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Customer, dispatch, fleet and finance operations.
              </p>
            </div>
          ) : null}
        </div>
      </aside>

      <div
        className={[
          "min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-[290px]",
        ].join(" ")}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open admin navigation"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                Streamline Logistics Group
              </p>
              <p className="truncate text-lg font-bold text-slate-950">
                Administration Portal
              </p>
            </div>

            <Link
              href="/admin/search"
              className="hidden min-w-[250px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white md:flex"
            >
              <Search size={17} />
              <span>Search the admin system</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:px-4"
            >
              <BookOpenCheck size={17} />
              <span className="hidden sm:inline">Main website</span>
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Streamline Logistics Group admin control centre
        </footer>
      </div>
    </div>
  );
}