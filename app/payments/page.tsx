import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

type QuoteDetails = {
  id: string;
  status: string;
  userId?: string | null;
  deliveryType: string | null;
  journeyType: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  legalEntity?: string | null;
  companyName?: string | null;
  totalPrice: string | number | null;
  vatAmount: string | number | null;
  adminPrice: string | number | null;
};

const BACKEND_API_URL = "https://streamline-logistics-production.up.railway.app/api";

async function getQuote(id: string): Promise<QuoteDetails | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/quotes/${id}`, {
      cache: "no-store",
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to fetch quote");

    return response.json();
  } catch (error) {
    console.error("Payment quote fetch error:", error);
    return null;
  }
}

async function createCheckoutSession(formData: FormData) {
  "use server";

  const quoteId = String(formData.get("quoteId") || "");

  if (!quoteId) {
    throw new Error("Missing quote ID");
  }

  const response = await fetch(`${BACKEND_API_URL}/payments/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quoteId }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to create Stripe checkout session");
  }

  const data = await response.json();

  if (!data.checkoutUrl) {
    throw new Error("Stripe checkout URL missing");
  }

  redirect(data.checkoutUrl);
}

function formatMoney(value: string | number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const { quoteId } = await searchParams;

  if (!quoteId) {
    notFound();
  }

  const quote = await getQuote(quoteId);

  if (!quote) {
    notFound();
  }

  const businessName = quote.legalEntity || quote.companyName || "Not provided";
  const hasLinkedAccount = Boolean(quote.userId);

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-3 py-6 text-[#071D49] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[1.5rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10 sm:rounded-[2rem]">
          <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-5 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D8CFF] sm:text-sm sm:tracking-[0.24em]">
              Secure payment
            </p>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold md:text-6xl">
                  {formatMoney(quote.totalPrice)}
                </h1>

                <p className="mt-3 break-words text-xs text-white/70 sm:text-sm">
                  Quote reference: {quote.id}
                </p>
              </div>

              <div className="w-fit rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/15 px-4 py-2 text-xs font-bold text-white sm:px-5 sm:text-sm">
                Quote ready for secure payment
              </div>
            </div>
          </div>

          <div className="grid gap-5 bg-white p-4 text-[#071D49] lg:grid-cols-[1fr_0.85fr] lg:gap-8 lg:p-8">
            <section className="grid gap-5 lg:gap-6">
              {hasLinkedAccount ? (
                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]/10 text-[#006CFF]">
                      <Building2 size={22} />
                    </span>

                    <div>
                      <h2 className="text-lg font-bold sm:text-xl">
                        Business account linked
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        This quote is attached to your business account. Continue to secure payment to complete the booking.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                    <CreditCard className="shrink-0 text-[#006CFF]" size={22} />
                    <h2 className="text-lg font-bold sm:text-xl">
                      Choose payment method
                    </h2>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3 xl:gap-3">
                    <PaymentMethodCard
                      icon="guest"
                      title="Guest Checkout"
                      subtitle="Pay now"
                      description="Pay securely by card and receive instant confirmation of your booking."
                      features={[
                        "Secure card payment",
                        "Instant booking confirmation",
                        "Automatic invoice email",
                        "No account required",
                        "Fast checkout flow",
                      ]}
                      quoteId={quote.id}
                    />

                    <PaymentMethodCard
                      icon="business"
                      title="Business Account"
                      subtitle="Create account + pay now"
                      description="Pay now and use a business account to manage bookings, invoices and delivery history."
                      features={[
                        "Secure card payment",
                        "Dashboard access",
                        "Booking history",
                        "Invoice history",
                        "Saved company details",
                        "Faster future bookings",
                      ]}
                      quoteId={quote.id}
                    />

                    <PaymentMethodCard
                      icon="trade"
                      title="Trade Account"
                      subtitle="Pay now + apply for trade account"
                      description="Pay for this booking now and apply for a trade account for future deliveries."
                      features={[
                        "Monthly invoicing after approval",
                        "Agreed credit limit",
                        "Dedicated account manager",
                        "Priority support",
                        "Volume discounts",
                        "Dashboard access",
                        "Invoice management",
                        "Business verification process",
                        "Credit check process",
                      ]}
                      quoteId={quote.id}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
                <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                  <ShieldCheck className="shrink-0 text-[#006CFF]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    Trust & reassurance
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Fully insured deliveries", "Goods are handled through insured business courier transport."],
                    ["Secure online payments", "Payments are processed through secure checkout infrastructure."],
                    ["VAT invoices provided", "A VAT invoice is available for business records."],
                    ["Business courier specialists", "Built around urgent and scheduled B2B deliveries."],
                    ["UK-wide coverage", "Designed for business deliveries throughout the United Kingdom."],
                    ["Dedicated customer support", "Support is available for vehicle, route and booking questions."],
                  ].map(([title, text]) => (
                    <InfoCard key={title} title={title} text={text} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
                <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                  <Building2 className="shrink-0 text-[#006CFF]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    Account comparison
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <ComparisonCard
                    title="Guest Checkout"
                    items={[
                      "Pay now",
                      "Email confirmation",
                      "Email invoice",
                      "No account features",
                    ]}
                  />

                  <ComparisonCard
                    title="Business Account"
                    items={[
                      "Dashboard access",
                      "Booking history",
                      "Invoice history",
                      "Saved business details",
                    ]}
                  />

                  <ComparisonCard
                    title="Trade Account"
                    items={[
                      "Apply for trade account",
                      "Monthly invoicing",
                      "Agreed credit facility",
                      "Dedicated account manager",
                      "Volume discounts",
                      "Priority support",
                    ]}
                  />
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-2xl shadow-black/10 sm:p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-bold sm:text-xl">
                Payment summary
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review the booking details before continuing to secure payment.
              </p>

              <div className="mt-5 grid gap-3">
                <SummaryRow label="Customer" value={quote.customerName} />
                <SummaryRow label="Business" value={businessName} />
                <SummaryRow label="Email" value={quote.customerEmail} />
                <SummaryRow label="Delivery type" value={quote.deliveryType} />
                <SummaryRow label="Journey type" value={quote.journeyType} />
                <SummaryRow label="Subtotal" value={formatMoney(quote.adminPrice)} />
                <SummaryRow label="VAT" value={formatMoney(quote.vatAmount)} />

                <div className="mt-3 rounded-3xl bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-5 text-white shadow-xl shadow-[#071D49]/20">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2D8CFF]">
                    Total due
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <p className="font-bold text-white/80">Payable now</p>
                    <p className="text-2xl font-bold sm:text-3xl">
                      {formatMoney(quote.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <form action={createCheckoutSession}>
                <input type="hidden" name="quoteId" value={quote.id} />

                <button
                  type="submit"
                  className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#006CFF] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
                >
                  <ShieldCheck size={20} />
                  Pay Securely Now
                </button>
              </form>

              <Link
                href={`/quote/${quote.id}`}
                className="mt-4 flex w-full items-center justify-center rounded-full border border-[#D7E6FF] bg-white px-6 py-4 text-sm font-bold text-[#071D49] transition hover:border-[#006CFF] hover:text-[#006CFF]"
              >
                Back to quote breakdown
              </Link>

              <div className="mt-6 rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm leading-6 text-slate-600 sm:p-5">
                <div className="mb-2 flex items-center gap-2 font-bold text-[#071D49]">
                  <FileText size={18} className="text-[#006CFF]" />
                  Invoice note
                </div>
                Invoice and booking confirmation are sent after successful payment.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function PaymentMethodCard({
  icon,
  title,
  subtitle,
  description,
  features,
  quoteId,
}: {
  icon: "guest" | "business" | "trade";
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  quoteId: string;
}) {
  const Icon =
    icon === "guest"
      ? CreditCard
      : icon === "business"
      ? Building2
      : FileText;

  const businessUrl = `/register-business?quoteId=${quoteId}`;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#D7E6FF] bg-white p-4 shadow-md shadow-black/5 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006CFF]/10 text-[#006CFF]">
          <Icon size={20} />
        </span>

        <div>
          <h3 className="text-base font-bold text-[#071D49]">{title}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#006CFF]">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

      <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#071D49]">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckCircle
              size={15}
              className="mt-0.5 shrink-0 text-[#006CFF]"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {icon === "business" ? (
        <Link
          href={businessUrl}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-[#006CFF] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
        >
          <Building2 size={16} />
          Create Account & Continue
        </Link>
      ) : (
        <form action={createCheckoutSession} className="mt-auto pt-5">
          <input type="hidden" name="quoteId" value={quoteId} />

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#006CFF] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
          >
            <ShieldCheck size={16} />
            Pay Securely Now
          </button>
        </form>
      )}
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2 sm:items-center">
        <CheckCircle className="mt-0.5 shrink-0 text-[#006CFF] sm:mt-0" size={18} />
        <h3 className="text-sm font-bold text-[#071D49] sm:text-base">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function ComparisonCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5">
      <h3 className="font-bold text-[#071D49]">{title}</h3>

      <ul className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle size={16} className="mt-0.5 shrink-0 text-[#006CFF]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-[#D7E6FF] bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="break-words text-left text-sm font-bold text-[#071D49] sm:text-right">
        {formatValue(value)}
      </p>
    </div>
  );
}
