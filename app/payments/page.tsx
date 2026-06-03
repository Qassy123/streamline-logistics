import Link from "next/link";
import { notFound } from "next/navigation";
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

const API_URL = "https://streamline-logistics-production.up.railway.app/api/quotes";

async function getQuote(id: string): Promise<QuoteDetails | null> {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
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
    <main className="min-h-screen bg-[#070b12] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
              Secure payment
            </p>

            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold md:text-6xl">
                  {formatMoney(quote.totalPrice)}
                </h1>

                <p className="mt-4 text-sm text-slate-300">
                  Quote reference: {quote.id}
                </p>
              </div>

              <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-5 py-2 text-sm font-bold text-emerald-200">
                Quote ready for payment
              </div>
            </div>
          </div>

          <div className="grid gap-8 bg-white p-6 text-slate-950 lg:grid-cols-[1fr_0.85fr] lg:p-8">
            <section className="grid gap-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <CreditCard className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Choose payment method</h2>
                </div>

                <div className="grid gap-4">
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left opacity-70"
                  >
                    <span className="flex items-center gap-3">
                      <Apple size={26} />
                      <span>
                        <span className="block font-bold">Apple Pay / Card</span>
                        <span className="text-sm text-slate-500">
                          Stripe checkout connection coming next.
                        </span>
                      </span>
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Pending
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left opacity-70"
                  >
                    <span>
                      <span className="block font-bold">PayPal</span>
                      <span className="text-sm text-slate-500">
                        PayPal checkout connection coming after card payments.
                      </span>
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Pending
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <Mail className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">Notifications</h2>
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

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <Building2 className="text-[#ef1c24]" size={24} />
                  <h2 className="text-xl font-bold">After payment</h2>
                </div>

                <p className="text-sm leading-6 text-slate-600">
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

            <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-xl font-bold">Payment summary</h2>

              <div className="mt-5 grid gap-3">
                <SummaryRow label="Customer" value={quote.customerName} />
                <SummaryRow label="Business" value={businessName} />
                <SummaryRow label="Email" value={quote.customerEmail} />
                <SummaryRow label="Delivery type" value={quote.deliveryType} />
                <SummaryRow label="Journey type" value={quote.journeyType} />
                <SummaryRow label="Subtotal" value={formatMoney(quote.adminPrice)} />
                <SummaryRow label="VAT" value={formatMoney(quote.vatAmount)} />

                <div className="mt-3 rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold">Total due</p>
                    <p className="text-2xl font-bold">
                      {formatMoney(quote.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 text-sm font-bold text-white opacity-70"
              >
                <ShieldCheck size={20} />
                Payment Gateway Pending
              </button>

              <Link
                href={`/quote/${quote.id}`}
                className="mt-4 flex w-full items-center justify-center rounded-full border border-slate-300 px-8 py-4 text-sm font-bold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Back to quote breakdown
              </Link>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-slate-700">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle className="text-[#ef1c24]" size={18} />
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-slate-600">{text}</p>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-right text-sm font-bold text-slate-950">
        {formatValue(value)}
      </p>
    </div>
  );
}