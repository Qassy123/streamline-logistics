import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  Truck,
  CalendarDays,
  PoundSterling,
  Phone,
} from "lucide-react";

export default function FullDayHalfDayRatesPage() {
  const faqs = [
    {
      question: "What is a half day courier booking?",
      answer:
        "A dedicated vehicle and driver are allocated to your business for a set number of hours.",
    },
    {
      question: "What is included in a full day booking?",
      answer:
        "Your driver remains available throughout the agreed booking period for collections and deliveries.",
    },
    {
      question: "Can multiple deliveries be completed?",
      answer:
        "Yes. Full and half day bookings are ideal for businesses with several delivery points.",
    },
    {
      question: "Can routes change during the day?",
      answer:
        "Yes. Route adjustments can often be accommodated depending on operational requirements.",
    },
  ];

  return (
    <>
      <Header />

      <main>
        {/* HERO */}
        <section className="bg-gradient-to-r from-[#0b1f3a] via-[#102d52] to-[#ef1c24] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
              Full Day & Half Day Rates
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-semibold leading-tight lg:text-7xl">
              Flexible Full Day & Half Day Courier Solutions
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              For businesses that require a dedicated vehicle for several
              hours or a full working day, Streamline Logistics Group
              provides flexible transport solutions tailored around your
              schedule.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/instant-quote"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 font-semibold text-white transition hover:bg-[#ff6a00]"
              >
                Get Instant Quote
                <ArrowRight size={20} />
              </Link>

              <a
                href="tel:03333440703"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-[#0b1f3a]"
              >
                <Phone size={20} />
                0333 344 0703
              </a>
            </div>
          </div>
        </section>

        {/* TRUST STATS */}
        <section className="border-b bg-white py-10">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 text-center md:grid-cols-4">
            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">
                Half Day
              </h3>
              <p className="text-[#0b1f3a]">Flexible Bookings</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">
                Full Day
              </h3>
              <p className="text-[#0b1f3a]">Dedicated Vehicle</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">
                UK Wide
              </h3>
              <p className="text-[#0b1f3a]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">
                24/7
              </h3>
              <p className="text-[#0b1f3a]">Support</p>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="bg-[#f8fafc] py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-4xl font-light text-[#ef1c24] lg:text-5xl">
                Why Businesses Choose Streamline
              </h2>

              <p className="mx-auto max-w-3xl text-lg text-[#0b1f3a]">
                Flexible transport support built around your working day.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <CalendarDays className="mb-5 text-[#ff6a00]" size={46} />
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Flexible Booking
                </h3>
                <p className="text-gray-600">
                  Book a vehicle for half a day, a full day or recurring
                  transport support.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Truck className="mb-5 text-[#ff6a00]" size={46} />
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Dedicated Vehicle
                </h3>
                <p className="text-gray-600">
                  Your driver remains focused on your business throughout
                  the booking period.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Clock3 className="mb-5 text-[#ff6a00]" size={46} />
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Multiple Collections
                </h3>
                <p className="text-gray-600">
                  Ideal for businesses requiring several collections and
                  deliveries in one day.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <PoundSterling className="mb-5 text-[#ff6a00]" size={46} />
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Cost Effective
                </h3>
                <p className="text-gray-600">
                  A practical alternative to multiple individual same-day
                  bookings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="mb-4 text-4xl font-light text-[#ef1c24]">
              Businesses Using Our Full Day & Half Day Service
            </h2>

            <p className="mx-auto mb-12 max-w-4xl text-lg text-[#0b1f3a]">
              Perfect for construction companies, wholesalers, retailers,
              professional services, healthcare suppliers, manufacturers
              and businesses with regular delivery requirements.
            </p>

            <Industries />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-[#f8fafc] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-16 text-center text-4xl font-light text-[#ef1c24]">
              How It Works
            </h2>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">1</div>
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Book Your Vehicle
                </h3>
                <p className="text-gray-600">
                  Tell us how long you require transport support.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">2</div>
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Driver Assigned
                </h3>
                <p className="text-gray-600">
                  A dedicated driver and suitable vehicle are allocated.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">3</div>
                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Operate All Day
                </h3>
                <p className="text-gray-600">
                  Collections and deliveries are completed throughout the booking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-12 text-center text-4xl font-light text-[#ef1c24]">
              Full Day & Half Day FAQ
            </h2>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-gray-200 p-6"
                >
                  <h3 className="mb-2 font-semibold text-[#0b1f3a]">
                    {faq.question}
                  </h3>

                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY STREAMLINE */}
        <section className="bg-[#0b1f3a] py-20 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-4xl font-light">
              Why Choose Streamline Logistics Group
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                "Dedicated vehicle allocation",
                "Flexible half-day and full-day bookings",
                "Suitable for recurring logistics work",
                "Professional DBS checked drivers",
                "UK-wide transport support",
                "Clear communication throughout",
                "Fully insured service",
                "Business-focused logistics solutions",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="text-[#ff6a00]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl rounded-[40px] bg-[#ef1c24] px-8 py-16 text-center text-white">
            <h2 className="mb-6 text-4xl font-semibold">
              Need Dedicated Transport Support?
            </h2>

            <p className="mb-8 text-xl text-white/90">
              Book a half-day or full-day vehicle and keep your business moving efficiently.
            </p>

            <Link
              href="/instant-quote"
              className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 font-semibold text-[#ef1c24]"
            >
              Get Instant Quote
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}