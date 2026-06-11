import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle,
  FileText,
  Home,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";

type QuoteDetails = {
  id: string;
  userId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  companyName?: string | null;
  legalEntity?: string | null;
};

const BACKEND_API_URL =
  "https://streamline-logistics-production.up.railway.app/api";

async function getQuote(id?: string): Promise<QuoteDetails | null> {
  if (!id) return null;

  try {
    const response = await fetch(`${BACKEND_API_URL}/quotes/${id}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    return response.json();
  } catch (error) {
    console.error("Payment success quote fetch error:", error);
    return null;
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    quoteId?: string;
    session_id?: string;
    businessAccount?: string;
    businessAccountCreated?: string;
    tradeAccountApplication?: string;
  }>;
}) {
  const {
    quoteId,
    businessAccount,
    businessAccountCreated,
    tradeAccountApplication,
  } = await searchParams;

  const quote = await getQuote(quoteId);
  const hasLinkedAccount = Boolean(quote?.userId);
  const businessName =
    quote?.legalEntity || quote?.companyName || quote?.customerName || null;

  const showBusinessAccountMessage =
    hasLinkedAccount ||
    businessAccount === "created" ||
    businessAccountCreated === "true";

  const showTradeAccountMessage =
    tradeAccountApplication === "received";

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-8 text-[#071D49] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[1.5rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10 sm:rounded-[2rem]">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-6 text-white sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-center">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2D8CFF]/40 bg-[#006CFF]/15 text-[#2D8CFF]">
                  <CheckCircle size={34} />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                    Payment confirmed
                  </p>

                  <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                    Payment Successful
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                    Thank you. Your payment has been received and your booking request is now being processed.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#2D8CFF]/30 bg-white/[0.08] p-5 shadow-xl shadow-black/10">
                <p className="text-sm font-bold text-white">
                  Booking status
                </p>

                <div className="mt-4 grid gap-3 text-sm text-white/75">
                  {[
                    "Payment received securely",
                    "Booking request sent to operations",
                    "Confirmation will be sent by email",
                    "VAT invoice will be provided",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle size={17} className="shrink-0 text-[#2D8CFF]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            {(showBusinessAccountMessage || showTradeAccountMessage) && (
              <section className="grid gap-4 md:grid-cols-2">
                {showBusinessAccountMessage && (
                  <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <BriefcaseBusiness className="shrink-0 text-[#006CFF]" size={24} />
                      <h2 className="text-xl font-bold">
                        Business Account Created
                      </h2>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                      Your business account has been linked to this booking. Future account features, booking history and invoice management will be available from your dashboard when launched.
                    </p>
                  </div>
                )}

                {showTradeAccountMessage && (
                  <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <FileText className="shrink-0 text-[#006CFF]" size={24} />
                      <h2 className="text-xl font-bold">
                        Trade Account Application Received
                      </h2>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                      Your monthly invoicing business credit account application has been received. Company verification and credit assessment will be reviewed, with approval typically within 48 hours.
                    </p>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <FileText className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Booking Reference</h2>
              </div>

              <div className="grid gap-4 rounded-2xl border border-[#D7E6FF] bg-white p-5 sm:grid-cols-2">
                <ReferenceItem
                  label="Quote Reference"
                  value={quoteId || "Reference unavailable"}
                />

                <ReferenceItem
                  label="Account"
                  value={
                    hasLinkedAccount
                      ? businessName || "Business account linked"
                      : "Guest checkout"
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <Truck className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">What Happens Next</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <StepCard
                  number="1"
                  title="Booking Review"
                  text="Our operations team will review your delivery details and prepare the booking."
                />

                <StepCard
                  number="2"
                  title="Confirmation"
                  text="You will receive booking confirmation and delivery updates by email."
                />

                <StepCard
                  number="3"
                  title="Delivery"
                  text="Your shipment will be assigned and moved through our delivery network."
                />
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <ShieldCheck className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Continue With Streamline</h2>
              </div>

              {hasLinkedAccount ? (
                <div className="grid gap-4 md:grid-cols-2">
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
                    text="Create another business courier quote using the quote form."
                    action="Get Another Quote"
                  />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <ActionCard
                    href="/"
                    icon="user"
                    title="Continue as Guest"
                    text="Continue without creating an account."
                    action="Continue"
                  />

                  <ActionCard
                    href={quoteId ? `/register-business?quoteId=${quoteId}` : "/register-business"}
                    icon="business"
                    title="Business Account"
                    text="Save company details and manage future bookings and invoices."
                    action="Create Account"
                  />

                  <ActionCard
                    href={quoteId ? `/register-trade?quoteId=${quoteId}` : "/register-trade"}
                    icon="file"
                    title="Trade Account"
                    text="Apply for recurring bookings, monthly invoicing and credit terms."
                    action="Apply Now"
                  />
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReferenceItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-base font-bold text-[#071D49]">
        {value}
      </p>
    </div>
  );
}

function StepCard({
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

function ActionCard({
  href,
  icon,
  title,
  text,
  action,
}: {
  href: string;
  icon: "home" | "user" | "business" | "file" | "truck";
  title: string;
  text: string;
  action: string;
}) {
  const Icon =
    icon === "home"
      ? Home
      : icon === "user"
      ? User
      : icon === "business"
      ? BriefcaseBusiness
      : icon === "truck"
      ? Truck
      : FileText;

  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-[#006CFF] hover:shadow-xl"
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
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