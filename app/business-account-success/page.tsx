import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle,
  FileText,
  Home,
  ShieldCheck,
  Truck,
} from "lucide-react";

export default function BusinessAccountSuccessPage({
  searchParams,
}: {
  searchParams: {
    quoteId?: string;
  };
}) {
  const quoteId = searchParams.quoteId;

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-8 text-[#071D49] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[1.5rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10 sm:rounded-[2rem]">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-6 text-white sm:p-10">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2D8CFF]/40 bg-[#006CFF]/15 text-[#2D8CFF]">
                <CheckCircle size={34} />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Business account created
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                  Welcome to Streamline Logistics.
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  Your business account has been created successfully. Your details are now saved for faster future bookings and account management.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            {quoteId && (
              <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <FileText className="shrink-0 text-[#006CFF]" size={24} />
                  <h2 className="text-xl font-bold">Booking Linked</h2>
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  Your account has been linked to quote reference:
                </p>

                <p className="mt-3 break-words rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm font-bold text-[#071D49]">
                  {quoteId}
                </p>
              </section>
            )}

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <BriefcaseBusiness className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Account Benefits</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <BenefitCard
                  icon="truck"
                  title="Faster Repeat Bookings"
                  text="Your business details are saved so future quote and booking flows are quicker."
                />

                <BenefitCard
                  icon="file"
                  title="Invoice Ready"
                  text="Your company details can be used for cleaner invoice and booking records."
                />

                <BenefitCard
                  icon="shield"
                  title="Business Profile"
                  text="Your business account prepares you for dashboard, booking history and account features."
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-xl shadow-black/5">
              <div className="bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_55%,_#006CFF_100%)] p-6 text-white">
                <h2 className="text-2xl font-bold">What happens next?</h2>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
                  Your booking will continue to be processed by our operations team. Confirmation and updates will be sent by email.
                </p>
              </div>

              <div className="grid gap-4 bg-[#F4F8FF] p-5 sm:p-6 md:grid-cols-2">
                <ActionCard
                  href="/"
                  icon="home"
                  title="Return Home"
                  text="Go back to the Streamline Logistics Group homepage."
                  action="Continue"
                />

                <ActionCard
                  href="/quote"
                  icon="truck"
                  title="Book Another Delivery"
                  text="Create another courier quote for your business."
                  action="Get Another Quote"
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function BenefitCard({
  icon,
  title,
  text,
}: {
  icon: "truck" | "file" | "shield";
  title: string;
  text: string;
}) {
  const Icon = icon === "truck" ? Truck : icon === "file" ? FileText : ShieldCheck;

  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-sm shadow-black/5">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
        <Icon size={24} />
      </span>

      <h3 className="font-bold text-[#071D49]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  text,
  action,
}: {
  href: string;
  icon: "home" | "truck";
  title: string;
  text: string;
  action: string;
}) {
  const Icon = icon === "home" ? Home : Truck;

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-[#006CFF] hover:shadow-xl"
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF] transition group-hover:bg-[#006CFF] group-hover:text-white">
        <Icon size={24} />
      </span>

      <h3 className="font-bold text-[#071D49]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>

      <div className="mt-4 flex items-center gap-2 text-sm font-bold text-[#006CFF]">
        {action}
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}