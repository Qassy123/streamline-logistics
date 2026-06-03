import Link from "next/link";
import { CheckCircle, ArrowRight, BriefcaseBusiness, FileText, User } from "lucide-react";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    quoteId?: string;
    session_id?: string;
  }>;
}) {
  const { quoteId } = await searchParams;

  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-green-900 via-green-800 to-emerald-700 p-10 text-white">
            <div className="flex items-center gap-4">
              <CheckCircle size={50} />
              <div>
                <h1 className="text-4xl font-bold">
                  Payment Successful
                </h1>

                <p className="mt-2 text-green-100">
                  Thank you. Your payment has been received and your booking request is now being processed.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-xl font-bold text-slate-900">
                Booking Reference
              </h2>

              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm text-slate-500">
                  Quote Reference
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {quoteId || "Reference unavailable"}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-6 text-xl font-bold text-slate-900">
                What Happens Next
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1c24] text-white">
                    1
                  </div>

                  <h3 className="font-bold text-slate-900">
                    Booking Review
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Our operations team will review your delivery details and prepare the booking.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1c24] text-white">
                    2
                  </div>

                  <h3 className="font-bold text-slate-900">
                    Confirmation
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    You will receive confirmation and tracking updates by email.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1c24] text-white">
                    3
                  </div>

                  <h3 className="font-bold text-slate-900">
                    Delivery
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Your shipment will be assigned and moved through our delivery network.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-6 text-xl font-bold text-slate-900">
                Continue With Streamline
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <Link
                  href="/"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-lg"
                >
                  <User className="mb-4 text-[#ef1c24]" size={28} />

                  <h3 className="font-bold text-slate-900">
                    Continue as Guest
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Manage this delivery without creating an account.
                  </p>

                  <div className="mt-4 flex items-center gap-2 font-semibold text-[#ef1c24]">
                    Continue
                    <ArrowRight size={16} />
                  </div>
                </Link>

                <Link
                  href="/register-business"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-lg"
                >
                  <BriefcaseBusiness
                    className="mb-4 text-[#ef1c24]"
                    size={28}
                  />

                  <h3 className="font-bold text-slate-900">
                    Business Account
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Save delivery details, manage bookings, invoices and payment history.
                  </p>

                  <div className="mt-4 flex items-center gap-2 font-semibold text-[#ef1c24]">
                    Create Account
                    <ArrowRight size={16} />
                  </div>
                </Link>

                <Link
                  href="/trade-account"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-lg"
                >
                  <FileText
                    className="mb-4 text-[#ef1c24]"
                    size={28}
                  />

                  <h3 className="font-bold text-slate-900">
                    Trade Account
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Apply for recurring bookings, monthly invoicing and credit terms.
                  </p>

                  <div className="mt-4 flex items-center gap-2 font-semibold text-[#ef1c24]">
                    Apply Now
                    <ArrowRight size={16} />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}