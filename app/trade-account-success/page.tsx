import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  FileText,
  Home,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";

export default function TradeAccountSuccessPage({
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
                  Trade account application submitted
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                  Application Received
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  Thank you for applying for a Streamline Trade Account. Your
                  application has been successfully received and is now under
                  review by our accounts team.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            {quoteId && (
              <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <FileText className="shrink-0 text-[#006CFF]" size={24} />
                  <h2 className="text-xl font-bold">Application Reference</h2>
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  Your trade account application has been linked to:
                </p>

                <p className="mt-3 break-words rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm font-bold text-[#071D49]">
                  {quoteId}
                </p>
              </section>
            )}

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <Clock3 className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Review Process</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <ProcessCard
                  number="1"
                  title="Application Received"
                  text="Your application has been submitted successfully."
                />

                <ProcessCard
                  number="2"
                  title="Company Verification"
                  text="Business information will be reviewed and verified."
                />

                <ProcessCard
                  number="3"
                  title="Credit Assessment"
                  text="Our accounts team will complete a credit review."
                />

                <ProcessCard
                  number="4"
                  title="Decision"
                  text="Approval or decline is typically within 48 hours."
                />
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <ShieldCheck className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Trade Account Benefits</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <BenefitCard
                  icon="invoice"
                  title="Monthly Invoicing"
                  text="Consolidated invoicing for approved trade customers."
                />

                <BenefitCard
                  icon="credit"
                  title="Agreed Credit Terms"
                  text="Access approved payment terms subject to assessment."
                />

                <BenefitCard
                  icon="manager"
                  title="Account Management"
                  text="Dedicated support for ongoing delivery requirements."
                />

                <BenefitCard
                  icon="discount"
                  title="Preferential Rates"
                  text="Potential volume-based discounts and pricing reviews."
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-xl shadow-black/5">
              <div className="bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_55%,_#006CFF_100%)] p-6 text-white">
                <h2 className="text-2xl font-bold">What Happens Next?</h2>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
                  Our accounts team will review your application. If additional
                  information is required, we will contact you using the details
                  supplied during registration. You will receive confirmation
                  once a decision has been made.
                </p>
              </div>

              <div className="grid gap-4 bg-[#F4F8FF] p-5 sm:p-6 md:grid-cols-2">
                <ActionCard
                  href="/"
                  icon="home"
                  title="Return Home"
                  text="Return to the Streamline Logistics Group homepage."
                  action="Continue"
                />

                <ActionCard
                  href="/quote"
                  icon="truck"
                  title="Get Another Quote"
                  text="Create another courier quote while your application is being reviewed."
                  action="Get Quote"
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProcessCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-sm shadow-black/5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-sm font-bold text-white">
        {number}
      </div>

      <h3 className="font-bold text-[#071D49]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  text,
}: {
  icon: "invoice" | "credit" | "manager" | "discount";
  title: string;
  text: string;
}) {
  const Icon =
    icon === "invoice"
      ? FileText
      : icon === "credit"
      ? ShieldCheck
      : icon === "manager"
      ? UserCheck
      : Truck;

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