import Link from "next/link";
import {
  ArrowRight,
  BadgePoundSterling,
  BarChart3,
  CheckCircle,
  CreditCard,
  Headphones,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const benefits = [
  {
    title: "Monthly Invoicing",
    text: "Consolidate approved deliveries into monthly invoice billing.",
    icon: BadgePoundSterling,
  },
  {
    title: "Agreed Credit Terms",
    text: "Apply for payment terms and a business line of credit.",
    icon: CreditCard,
  },
  {
    title: "Dedicated Account Support",
    text: "Get account support for repeat logistics requirements.",
    icon: Headphones,
  },
  {
    title: "Preferential Rates",
    text: "Access trade pricing for eligible repeat business bookings.",
    icon: TrendingUp,
  },
  {
    title: "Business Reporting",
    text: "Review invoice history, bookings and delivery activity.",
    icon: BarChart3,
  },
  {
    title: "Priority Service",
    text: "Support for frequent, time-sensitive business deliveries.",
    icon: ShieldCheck,
  },
];

export default function UpgradeAccountPage() {
  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#071D49] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Upgrade Account
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              Apply for a Trade Account.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              Upgrade your free account to a trade account for monthly invoicing,
              agreed credit terms and account-managed logistics support.
            </p>

            <Link
              href="/register-trade"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 text-sm font-bold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
            >
              Apply For Trade Account
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                  <CheckCircle size={24} />
                </span>

                <div>
                  <h2 className="text-2xl font-bold text-[#071D49]">
                    Trade account benefits
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Designed for businesses that book regular deliveries and need
                    consolidated billing, credit terms and stronger account support.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <div
                      key={benefit.title}
                      className="rounded-3xl border border-[#D7E6FF] bg-white p-5 shadow-lg shadow-black/5"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                        <Icon size={22} />
                      </span>

                      <h3 className="mt-4 text-lg font-bold text-[#071D49]">
                        {benefit.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {benefit.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-white p-6 shadow-lg shadow-black/5">
              <h2 className="text-2xl font-bold text-[#071D49]">
                What happens after you apply?
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Step
                  number="1"
                  title="Application Submitted"
                  text="Your company details and requested credit terms are sent for review."
                />

                <Step
                  number="2"
                  title="Company Verification"
                  text="Streamline reviews your company information and trade suitability."
                />

                <Step
                  number="3"
                  title="Credit Decision"
                  text="If approved, trade terms are enabled on your account."
                />
              </div>

              <Link
                href="/register-trade"
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 text-sm font-bold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
              >
                Start Upgrade Application
                <ArrowRight size={18} />
              </Link>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-sm font-bold text-white">
        {number}
      </div>

      <h3 className="mt-4 font-bold text-[#071D49]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}