import PaymentSuccessAccountStatus from "@/components/account/PaymentSuccessAccountStatus";
import {
  Bell,
  Building2,
  CheckCircle,
  FileText,
  MapPin,
  ShieldCheck,
  Truck,
  User,
  Zap,
} from "lucide-react";

type QuoteDetails = {
  id: string;
  userId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  companyName?: string | null;
  legalEntity?: string | null;
};

type ConfirmedBookingDetails = {
  id: string;
  reference?: string | null;
  user?: {
    name?: string | null;
  } | null;
  quote?: {
    customerName?: string | null;
  } | null;
};

type ConfirmCheckoutResponse = {
  success?: boolean;
  booking?: ConfirmedBookingDetails | null;
  error?: string;
};

const BACKEND_API_URL =
  "https://streamline-logistics-production.up.railway.app/api";

async function confirmCheckout(
  quoteId?: string,
  sessionId?: string,
): Promise<ConfirmedBookingDetails | null> {
  if (!quoteId || !sessionId) return null;

  try {
    const response = await fetch(
      `${BACKEND_API_URL}/payments/confirm-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteId,
          sessionId,
        }),
        cache: "no-store",
      },
    );

    const data = (await response.json().catch(() => null)) as
      | ConfirmCheckoutResponse
      | null;

    if (!response.ok) {
      console.error(
        "Payment confirmation failed:",
        data?.error || "Unknown payment confirmation error",
      );
      return null;
    }

    return data?.booking || null;
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return null;
  }
}

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
  const { quoteId, session_id } = await searchParams;

  const confirmedBooking = await confirmCheckout(quoteId, session_id);
  const quote = await getQuote(quoteId);

  const bookingReference =
    confirmedBooking?.reference || "Booking reference unavailable";

  const customerName =
    confirmedBooking?.quote?.customerName ||
    quote?.customerName ||
    confirmedBooking?.user?.name ||
    "Customer name unavailable";

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
                <p className="text-sm font-bold text-white">Booking status</p>

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
            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 shadow-lg shadow-black/5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <FileText className="shrink-0 text-[#006CFF]" size={24} />
                <h2 className="text-xl font-bold">Booking Reference</h2>
              </div>

              <div className="grid gap-4 rounded-2xl border border-[#D7E6FF] bg-white p-5 sm:grid-cols-2">
                <ReferenceItem
                  label="Booking Reference"
                  value={bookingReference}
                />

                <ReferenceItem
                  label="Customer Name"
                  value={customerName}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-xl shadow-black/5">
              <div className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_58%,_#006CFF_100%)] p-6 text-white sm:p-8">
                <div className="flex items-start gap-5">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#2D8CFF]/40 bg-white/[0.06] text-[#2D8CFF]">
                    <User size={34} />
                  </span>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                      Account access
                    </p>

                    <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                      Track your deliveries in real time.
                    </h2>

                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                      Use your Streamline account to manage tracking, saved details, booking history, invoices and faster future checkout.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.75fr] lg:items-center">
                <div className="grid gap-5">
                  <FeatureItem
                    icon="tracking"
                    title="Live Shipment Tracking"
                    text="See your delivery in real time from pickup to destination."
                  />

                  <FeatureItem
                    icon="checkout"
                    title="One-Click Checkout"
                    text="Book again in seconds with your saved details and addresses."
                  />

                  <FeatureItem
                    icon="details"
                    title="Saved Addresses & Details"
                    text="Store your company and delivery addresses for faster bookings."
                  />

                  <FeatureItem
                    icon="history"
                    title="Booking History & Invoices"
                    text="Access past bookings, invoices and delivery documents anytime."
                  />

                  <FeatureItem
                    icon="monthly"
                    title="Invoice History"
                    text="View and download invoices generated from your completed bookings."
                  />

                  <FeatureItem
                    icon="notifications"
                    title="Delivery Notifications"
                    text="Get real-time updates so you always know where your delivery is."
                  />
                </div>

                <div className="hidden justify-center lg:flex">
                  <div className="relative">
                    <div className="absolute inset-0 translate-x-8 rounded-full bg-[#EAF2FF] blur-2xl" />

                    <div className="relative w-64 rounded-[2.5rem] border-[10px] border-[#020B1F] bg-white shadow-2xl shadow-[#071D49]/20">
                      <div className="mx-auto h-6 w-28 rounded-b-2xl bg-[#020B1F]" />

                      <div className="px-5 pb-6 pt-4">
                        <div className="mb-5 flex items-center justify-between text-xs font-bold text-[#071D49]">
                          <span>8:41</span>
                          <span>Shipment #SL123456</span>
                        </div>

                        <div className="rounded-3xl bg-[#F4F8FF] p-4">
                          <p className="text-sm font-bold text-[#071D49]">
                            Out for Delivery
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Estimated arrival
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#071D49]">
                            Today, 14:30 - 16:30
                          </p>
                        </div>

                        <div className="relative mt-6 h-36 rounded-3xl bg-[#F4F8FF]">
                          <div className="absolute left-8 top-24 h-3 w-3 rounded-full bg-[#006CFF]" />
                          <div className="absolute left-16 top-20 h-3 w-3 rounded-full bg-[#006CFF]" />
                          <div className="absolute left-24 top-16 h-3 w-3 rounded-full bg-[#006CFF]" />
                          <div className="absolute right-8 top-8 flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/30">
                            <Truck size={20} />
                          </div>
                          <div className="absolute left-10 top-[5.6rem] h-px w-16 rotate-[-18deg] bg-[#006CFF]" />
                          <div className="absolute left-[5.7rem] top-[4.55rem] h-px w-20 rotate-[-28deg] bg-[#006CFF]" />
                        </div>

                        <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
                          <span>Collection</span>
                          <span>In Transit</span>
                          <span className="text-[#006CFF]">Out For Delivery</span>
                          <span>Delivered</span>
                        </div>

                        <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#D7E6FF] p-3">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500">
                              Driver
                            </p>
                            <p className="text-xs font-bold text-[#071D49]">
                              Alex Thompson
                            </p>
                          </div>

                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#006CFF]/10 text-[#006CFF]">
                            <Truck size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <PaymentSuccessAccountStatus
                    quoteId={quoteId}
                    sessionId={session_id}
                  />
                </div>
              </div>

              <div className="border-t border-[#D7E6FF] px-6 py-5 sm:px-8">
                <p className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                  <ShieldCheck size={18} className="text-[#006CFF]" />
                  Your booking is secure. Your information is safe with us.
                </p>
              </div>
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

function FeatureItem({
  icon,
  title,
  text,
}: {
  icon: "tracking" | "checkout" | "details" | "history" | "monthly" | "notifications";
  title: string;
  text: string;
}) {
  const Icon =
    icon === "tracking"
      ? MapPin
      : icon === "checkout"
      ? Zap
      : icon === "details"
      ? Building2
      : icon === "monthly"
      ? FileText
      : icon === "notifications"
      ? Bell
      : FileText;

  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#006CFF]">
        <Icon size={24} />
      </span>

      <div>
        <h3 className="text-base font-bold text-[#071D49]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
