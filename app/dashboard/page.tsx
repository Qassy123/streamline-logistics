import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileText,
  Map,
  Package,
  TrendingUp,
  User,
} from "lucide-react";

const cards = [
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
  {
    title: "Upgrade Account",
    text: "Apply for trade terms, monthly invoicing and line of credit.",
    href: "/dashboard/upgrade-account",
    icon: TrendingUp,
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Customer Dashboard
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Manage your Streamline account.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              Access bookings, tracking, invoices, saved routes and account upgrade options.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        </section>
      </div>
    </main>
  );
}