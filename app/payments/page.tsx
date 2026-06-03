import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Apple,
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Mail,
  ShieldCheck,
} from "lucide-react";

type QuoteDetails = {
  id: string;
  status: string;
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

  return (
    <main className="min-h-screen bg-[#070b12] px-3 py-6 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white shadow-2xl shadow-black/30 sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.24em]">
              Secure payment
            </p>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold md:text-6xl">
                  {formatMoney(quote.totalPrice)}
                </h1>

                <p className="mt-3 break-words text-xs text-slate-300 sm:text-sm">
                  Quote reference: {quote.id}
                </p>
              </div>

              <div className="w-fit rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-200 sm:px-5 sm:text-sm">
                Quote ready for payment
              </div>
            </div>
          </div>

          <div className="grid gap-5 bg-white p-4 text-slate-950 lg:grid-cols-[1fr_0.85fr] lg:gap-8 lg:p-8">
            <section className="grid gap-5 lg:gap-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                  <CreditCard className="shrink-0 text-[#ef1c24]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    Choose payment method
                  </h2>
                </div>

                <div className="grid gap-4">
                  <form action={createCheckoutSession}>
                    <input type="hidden" name="quoteId" value={quote.id} />

                    <button
                      type="submit"
                      className="flex w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-950 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <span className="flex items-start gap-3 sm:items-center">
                        <Apple className="shrink-0" size={24} />
                        <span>
                          <span className="block text-sm font-bold sm:text-base">
                            Apple Pay / Card
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-slate-500">
                            Pay securely by card. Apple Pay appears automatically on supported devices.
                          </span>
                        </span>
                      </span>

                      <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        Available
                      </span>
                    </button>
                  </form>

                  <button
                    type="button"
                    disabled
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left opacity-70 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <span>
                      <span className="block text-sm font-bold sm:text-base">
                        PayPal
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-500">
                        PayPal checkout connection coming after card payments.
                      </span>
                    </span>

                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Pending
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                  <Mail className="shrink-0 text-[#ef1c24]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    Notifications
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Payment confirmation"
                    text="After payment, the customer receives a confirmation email and receipt."
                  />
                  <InfoCard
                    title="Invoice generation"
                    text="A VAT invoice will be generated and linked to the booking."
                  />
                  <InfoCard
                    title="Checkout reminder"
                    text="If payment is not completed, a professional reminder email can be sent."
                  />
                  <InfoCard
                    title="Booking creation"
                    text="Once paid, the quote can be converted into a confirmed booking."
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
                  <Building2 className="shrink-0 text-[#ef1c24]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    After payment
                  </h2>
                </div>

                <p className="text-sm leading-7 text-slate-600">
                  After payment, customers will be redirected to an account choice page where they can continue as a guest, create a business account, or apply for a trade account.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <InfoCard
                    title="Continue as guest"
                    text="Fast checkout for one-off deliveries without creating an account."
                  />
                  <InfoCard
                    title="Business account"
                    text="Save details, view bookings, manage invoices and reuse delivery information."
                  />
                  <InfoCard
                    title="Trade account"
                    text="Apply for account terms, credit limits, recurring bookings and monthly invoicing."
                  />
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
              <h2 className="text-lg font-bold sm:text-xl">
                Payment summary
              </h2>

              <div className="mt-5 grid gap-3">
                <SummaryRow label="Customer" value={quote.customerName} />
                <SummaryRow label="Business" value={businessName} />
                <SummaryRow label="Email" value={quote.customerEmail} />
                <SummaryRow label="Delivery type" value={quote.deliveryType} />
                <SummaryRow label="Journey type" value={quote.journeyType} />
                <SummaryRow label="Subtotal" value={formatMoney(quote.adminPrice)} />
                <SummaryRow label="VAT" value={formatMoney(quote.vatAmount)} />

                <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-white sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold">Total due</p>
                    <p className="text-xl font-bold sm:text-2xl">
                      {formatMoney(quote.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <form action={createCheckoutSession}>
                <input type="hidden" name="quoteId" value={quote.id} />

                <button
                  type="submit"
                  className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#ff6a00]"
                >
                  <ShieldCheck size={20} />
                  Pay Securely Now
                </button>
              </form>

              <Link
                href={`/quote/${quote.id}`}
                className="mt-4 flex w-full items-center justify-center rounded-full border border-slate-300 px-6 py-4 text-sm font-bold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Back to quote breakdown
              </Link>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700 sm:p-5">
                <div className="mb-2 flex items-center gap-2 font-bold text-slate-950">
                  <FileText size={18} />
                  Invoice note
                </div>
                Invoice generation will be connected after the payment provider is wired in.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2 sm:items-center">
        <CheckCircle className="mt-0.5 shrink-0 text-[#ef1c24] sm:mt-0" size={18} />
        <h3 className="text-sm font-bold text-slate-950 sm:text-base">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-7 text-slate-600">{text}</p>
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
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="break-words text-left text-sm font-bold text-slate-950 sm:text-right">
        {formatValue(value)}
      </p>
    </div>
  );
}