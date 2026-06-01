import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  MapPinned,
  Route,
  Truck,
  Phone,
} from "lucide-react";

export default function MultiDropDeliveryPage() {
  const faqs = [
    {
      question: "What is a multi-drop delivery service?",
      answer:
        "A multi-drop delivery service allows your business to complete several collections or deliveries within one planned route.",
    },
    {
      question: "Can collections and deliveries be combined?",
      answer:
        "Yes. Multi-drop routes can include both collections and deliveries depending on your business requirements.",
    },
    {
      question: "Is multi-drop delivery suitable for regular routes?",
      answer:
        "Yes. It is ideal for businesses with recurring delivery schedules, repeated customer drops or regular branch movements.",
    },
    {
      question: "Do you cover the UK?",
      answer:
        "Yes. Streamline Logistics Group provides UK-wide collection and delivery support.",
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
              Multi-Drop Delivery
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-semibold leading-tight lg:text-7xl">
              Efficient Multi-Drop Delivery Solutions For Businesses
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              Streamline Logistics Group helps businesses complete multiple
              collections and deliveries in one planned route. Ideal for
              companies that need goods moved to several locations efficiently,
              safely and professionally.
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
              <h3 className="text-4xl font-bold text-[#ef1c24]">Multiple</h3>
              <p className="text-[#0b1f3a]">Delivery Points</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">Planned</h3>
              <p className="text-[#0b1f3a]">Routes</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">UK Wide</h3>
              <p className="text-[#0b1f3a]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">24/7</h3>
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
                A reliable multi-drop delivery service built around route
                planning, efficiency and professional communication.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Route className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Planned Routes
                </h3>

                <p className="text-gray-600">
                  Collections and deliveries can be structured into one
                  organised route.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <MapPinned className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Multiple Stops
                </h3>

                <p className="text-gray-600">
                  Ideal for businesses delivering to several sites, customers or
                  locations.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Clock3 className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Efficient Delivery
                </h3>

                <p className="text-gray-600">
                  Reduce wasted time by grouping several jobs into one booking.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Truck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Dedicated Support
                </h3>

                <p className="text-gray-600">
                  A suitable driver and vehicle are allocated to your route.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="mb-4 text-4xl font-light text-[#ef1c24]">
              Industries We Support
            </h2>

            <p className="mx-auto mb-12 max-w-4xl text-lg text-[#0b1f3a]">
              Our multi-drop delivery service supports the industries we work
              with, including construction, aviation, hospitality, farming,
              marketing and print, pharmaceutical and medical, film and
              production, events, professional services, education, arts and
              antiques, utilities, fast-moving consumer goods, automotive and
              wholesale.
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
                  Plan Your Route
                </h3>

                <p className="text-gray-600">
                  Tell us the collection points, delivery locations and route
                  requirements.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">2</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Driver Assigned
                </h3>

                <p className="text-gray-600">
                  A suitable driver and vehicle are allocated to your booking.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">3</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Deliver Efficiently
                </h3>

                <p className="text-gray-600">
                  Goods are delivered across each destination safely and
                  professionally.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-12 text-center text-4xl font-light text-[#ef1c24]">
              Multi-Drop Delivery FAQ
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
                "Dedicated route planning",
                "Multiple delivery locations supported",
                "Professional DBS checked drivers",
                "UK-wide transport support",
                "Reliable communication",
                "Fully insured service",
                "Flexible scheduling options",
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
              Need Multiple Deliveries Completed?
            </h2>

            <p className="mb-8 text-xl text-white/90">
              Let Streamline Logistics Group help manage your delivery schedule
              efficiently.
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