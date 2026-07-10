import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  FileText,
  PackageSearch,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

const primaryActions = [
  {
    title: "Add New Customer Account",
    description:
      "Create a private, business or trade customer record for office-managed work.",
    href: "/admin/customers/new",
    icon: UserPlus,
  },
  {
    title: "Create New Booking",
    description:
      "Open the planning board to create, price and assign an operational booking.",
    href: "/admin/planning-board",
    icon: ClipboardList,
  },
  {
    title: "View Existing Bookings",
    description:
      "Open the booking calendar and review work by date, vehicle, driver and status.",
    href: "/admin/bookings",
    icon: CalendarDays,
  },
  {
    title: "Search Entire System",
    description:
      "Search customers, quotes, bookings, invoices, vehicles, drivers and payments.",
    href: "/admin/search",
    icon: Search,
  },
];

const modules = [
  {
    title: "Customer Accounts",
    description:
      "Search, filter, open and manage private, business and trade customer records.",
    href: "/admin/customers",
    icon: Users,
    group: "Customers",
  },
  {
    title: "Trade Accounts",
    description:
      "Review applications, approve terms, manage credit limits and suspend accounts.",
    href: "/admin/trade-accounts",
    icon: Building2,
    group: "Customers",
  },
  {
    title: "Quote Management",
    description:
      "Create, send, edit, accept, expire and convert customer quotes into bookings.",
    href: "/admin/quotes",
    icon: ReceiptText,
    group: "Operations",
  },
  {
    title: "Planning Board",
    description:
      "Plan work, calculate journey time, assign vehicles and dispatch drivers.",
    href: "/admin/planning-board",
    icon: ClipboardList,
    group: "Operations",
  },
  {
    title: "Fleet Management",
    description:
      "Maintain every vehicle, registration, compliance date and operational status.",
    href: "/admin/fleet",
    icon: Truck,
    group: "Operations",
  },
  {
    title: "Driver Management",
    description:
      "Create drivers, control availability, assign vehicles and review active jobs.",
    href: "/admin/drivers",
    icon: Users,
    group: "Operations",
  },
  {
    title: "Tracking",
    description:
      "Find a vehicle by registration and review its live or latest assigned job status.",
    href: "/admin/tracking",
    icon: PackageSearch,
    group: "Operations",
  },
  {
    title: "Invoices",
    description:
      "Review issued, paid, unpaid and overdue invoices linked to customer bookings.",
    href: "/admin/invoices",
    icon: FileText,
    group: "Finance",
  },
  {
    title: "Payments",
    description:
      "Manage card, bank transfer, cash, credit account, refund and credit activity.",
    href: "/admin/payments",
    icon: WalletCards,
    group: "Finance",
  },
  {
    title: "Pricing / Tariffs",
    description:
      "Control base fares, mileage bands, surcharges, discounts and VAT treatment.",
    href: "/admin/pricing",
    icon: CircleDollarSign,
    group: "Finance",
  },
  {
    title: "Reports",
    description:
      "Review booking volume, turnover, vehicle usage and customer revenue trends.",
    href: "/admin/reports",
    icon: BarChart3,
    group: "Finance",
  },
  {
    title: "Notifications",
    description:
      "Review customer and operational email activity, including failed delivery logs.",
    href: "/admin/notifications",
    icon: BellRing,
    group: "Governance",
  },
  {
    title: "Documents",
    description:
      "Manage customer, driver, vehicle, insurance, MOT and proof-of-delivery files.",
    href: "/admin/documents",
    icon: FileText,
    group: "Governance",
  },
  {
    title: "Audit Log",
    description:
      "Trace who changed each record, what changed, when it changed and why.",
    href: "/admin/audit-log",
    icon: FileClock,
    group: "Governance",
  },
  {
    title: "Permissions",
    description:
      "Control access for super admins, office managers, dispatchers and accounts staff.",
    href: "/admin/permissions",
    icon: ShieldCheck,
    group: "Governance",
  },
  {
    title: "Company Settings",
    description:
      "Maintain company, VAT, bank, invoice numbering and document template details.",
    href: "/admin/settings",
    icon: Settings,
    group: "Governance",
  },
];

const workflow = [
  "Create or select customer",
  "Create and send quote",
  "Record acceptance",
  "Create booking",
  "Assign vehicle",
  "Assign driver",
  "Complete collection and delivery",
  "Upload proof of delivery",
  "Generate invoice",
  "Record payment",
];

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FF6A00]/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />

          <div className="relative max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-400">
              Operations overview
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Streamline Logistics administration
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Manage customer accounts, quotes, bookings, dispatch, fleet,
              drivers, tracking, invoicing, payments, tariffs and company
              controls from one operational workspace.
            </p>
          </div>

          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/customers/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/20 transition hover:bg-[#E55300]"
            >
              <UserPlus size={18} />
              Add customer
            </Link>
            <Link
              href="/admin/planning-board"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <ClipboardList size={18} />
              Create booking
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Quick actions
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            Start an admin task
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#E55300]">
                    <Icon size={21} />
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#E55300]"
                  />
                </div>
                <h3 className="mt-5 text-base font-bold text-slate-950">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
                Admin modules
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                Complete control centre
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {modules.length} operational modules
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group flex gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover:bg-[#FF6A00]">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {module.group}
                    </span>
                    <span className="mt-1 block font-bold text-slate-950">
                      {module.title}
                    </span>
                    <span className="mt-1.5 block text-sm leading-6 text-slate-600">
                      {module.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                <ClipboardList size={21} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Required workflow
                </p>
                <h2 className="text-lg font-bold text-slate-950">
                  Booking lifecycle
                </h2>
              </div>
            </div>

            <ol className="mt-6 space-y-3">
              {workflow.map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[#E55300]">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-3xl bg-[#FF6A00] p-6 text-white shadow-lg shadow-orange-200/60">
            <Truck size={28} />
            <h2 className="mt-4 text-xl font-bold">
              Dispatch control remains manual
            </h2>
            <p className="mt-3 text-sm leading-6 text-orange-50">
              Vehicle and driver assignment should be completed through the
              planning workflow before automatic assignment is removed from the
              existing payment process.
            </p>
            <Link
              href="/admin/planning-board"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#E55300] transition hover:bg-orange-50"
            >
              Open planning board
              <ArrowRight size={17} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
