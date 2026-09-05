"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Truck } from "lucide-react";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavigationItem = {
  label: string;
  href: string;
  exact?: boolean;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Add New Customer",
    href: "/admin/customers/new",
    exact: true,
  },
  {
    label: "Existing Customers",
    href: "/admin/customers",
    exact: true,
  },
  {
    label: "Existing Bookings",
    href: "/admin/bookings",
  },
  {
    label: "Planning / Create Booking",
    href: "/admin/planning-board",
  },
  {
    label: "Fleet",
    href: "/admin/fleet",
  },
  {
    label: "Drivers",
    href: "/admin/drivers",
  },
  {
    label: "Tracking",
    href: "/admin/tracking",
  },
  {
    label: "Invoices",
    href: "/admin/invoices",
  },
  {
    label: "Reports",
    href: "/admin/reports",
  },
  {
    label: "Pricing / Tariff",
    href: "/admin/pricing",
  },
  {
    label: "Company Info",
    href: "/admin/settings",
  },
];

function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
) {
  if (item.href === "/admin/customers/new") {
    return pathname === "/admin/customers/new";
  }

  if (item.href === "/admin/customers") {
    return (
      pathname === "/admin/customers" ||
      (pathname.startsWith("/admin/customers/") &&
        pathname !== "/admin/customers/new")
    );
  }

  if (item.exact) {
    return pathname === item.href;
  }

  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-50 shadow-sm">
        {/* Streamline header */}
        <div className="border-b border-slate-800 bg-slate-950">
          <div className="mx-auto flex min-h-16 w-full max-w-[1800px] items-center px-4 sm:px-6">
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF6A00] text-white shadow-sm">
                <Truck size={21} strokeWidth={2.2} />
              </span>

              <span>
                <span className="block text-sm font-bold uppercase tracking-[0.12em] text-white">
                  Streamline Logistics
                </span>

                <span className="block text-xs text-slate-400">
                  Transport Management System
                </span>
              </span>
            </Link>
          </div>
        </div>

        {/* Manual top navigation */}
        <nav className="border-b border-slate-200 bg-white">
          <div className="w-full overflow-x-auto">
            <div className="mx-auto flex min-w-max max-w-[1800px] gap-2 px-4 py-3 sm:px-6">
              {navigationItems.map((item) => {
                const active = isNavigationItemActive(
                  pathname,
                  item,
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex min-h-11 items-center whitespace-nowrap rounded-lg border px-4 text-center text-sm font-semibold transition",
                      active
                        ? "border-[#FF6A00] bg-[#FF6A00] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="px-4 py-7 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}