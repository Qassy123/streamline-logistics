import { notFound, redirect } from "next/navigation";
import {
  CreditCard,
  MapPinned,
  MapPin,
  PoundSterling,
  ReceiptText,
  ShieldCheck,
  Truck,
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
  distanceMiles: string | number | null;
  basePrice: string | number | null;
  fuelSurcharge: string | number | null;
  adminPrice: string | number | null;
  vatAmount: string | number | null;
  totalPrice: string | number | null;
  extraDrops: unknown;
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

function formatExtraDrops(extraDrops: unknown) {
  if (!extraDrops) return [];

  if (Array.isArray(extraDrops)) {
    return extraDrops;
  }

  if (typeof extraDrops === "string") {
    try {
      const parsed = JSON.parse(extraDrops);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function calculateExtraStopsPrice(quote: QuoteDetails) {
  const subtotal = Number(quote.adminPrice || 0);
  const baseFare = Number(quote.basePrice || 0);
  const mileage = Number(quote.fuelSurcharge || 0);

  return Math.max(subtotal - baseFare - mileage, 0);
}

function calculateMileageRate(quote: QuoteDetails) {
  const distanceMiles = Number(quote.distanceMiles || 0);
  const mileagePrice = Number(quote.fuelSurcharge || 0);

  if (!distanceMiles) return 0;

  return mileagePrice / distanceMiles;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    quoteId?: string;
  }>;
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
  const extraDrops = formatExtraDrops(quote.extraDrops);
  const extraStopsPrice = calculateExtraStopsPrice(quote);
  const mileageRate = calculateMileageRate(quote);

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
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
                <div className="mb-5 flex items-center gap-3">
                  <CreditCard className="shrink-0 text-[#006CFF]" size={22} />
                  <h2 className="text-lg font-bold sm:text-xl">
                    Choose payment method
                  </h2>
                </div>

                <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-md shadow-black/5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006CFF]/10 text-[#006CFF]">
                      <CreditCard size={20} />
                    </span>

                    <div>
                      <h3 className="text-base font-bold text-[#071D49]">
                        Pay Now
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#006CFF]">
                        Guest Checkout
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Pay securely now without creating an account. After payment, you can create a business account or apply for a trade account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-lg shadow-black/5 sm:p-5">
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
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 shadow-2xl shadow-black/10 sm:p-6 lg:sticky lg:top-28">
              <div className="mb-5 flex items-center gap-3">
                <ReceiptText className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-lg font-bold sm:text-xl">
                  Price breakdown
                </h2>
              </div>

              <div className="grid gap-3">
                <PriceBreakdownRow
                  icon={<Truck size={22} />}
                  iconClassName="text-violet-600"
                  label="Base Fare"
                  detail={formatValue(quote.deliveryType)}
                  value={formatMoney(quote.basePrice)}
                />

                <PriceBreakdownRow
                  icon={<MapPinned size={22} />}
                  iconClassName="text-[#006CFF]"
                  label="Mileage"
                  detail={`(${formatValue(quote.distanceMiles)} mi × ${formatMoney(mileageRate)})`}
                  value={formatMoney(quote.fuelSurcharge)}
                />

                <PriceBreakdownRow
                  icon={<MapPin size={22} />}
                  iconClassName="text-orange-500"
                  label="Extra Stops"
                  detail={`(${extraDrops.length})`}
                  value={formatMoney(extraStopsPrice)}
                />

                <PriceBreakdownRow
                  icon={<ReceiptText size={22} />}
                  iconClassName="text-pink-600"
                  label="VAT"
                  detail="20%"
                  value={formatMoney(quote.vatAmount)}
                />

                <div className="mt-3 rounded-3xl bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-5 text-white shadow-xl shadow-[#071D49]/20">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-white">
                        <PoundSterling size={22} />
                      </span>
                      <p className="text-lg font-bold">Total Price</p>
                    </div>
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
                  Pay Securely Now - Guest Checkout
                </button>
              </form>

              <div className="mt-5 grid gap-3 rounded-3xl border border-[#D7E6FF] bg-white p-5">
                {[
                  "Secure online payment",
                  "VAT invoice provided",
                  "Business booking reference included",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm font-bold text-[#071D49]"
                  >
                    <ShieldCheck size={18} className="text-[#006CFF]" />
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
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

function PriceBreakdownRow({
  icon,
  iconClassName,
  label,
  detail,
  value,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D7E6FF] bg-white p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`shrink-0 ${iconClassName}`}>{icon}</span>
        <p className="min-w-0 text-sm font-bold text-[#071D49]">
          {label}
          {detail && (
            <span className="ml-1 font-semibold text-slate-600">
              {detail}
            </span>
          )}
        </p>
      </div>

      <p className="shrink-0 text-sm font-bold text-[#071D49]">{value}</p>
    </div>
  );
}