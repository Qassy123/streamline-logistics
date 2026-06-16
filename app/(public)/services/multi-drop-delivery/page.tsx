import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import ServiceQuoteSection from "@/components/services/ServiceQuoteSection";
import Link from "next/link";
import {
  ArrowRight,
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
        <section className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
              Multi-Drop Delivery
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-bold leading-tight lg:text-7xl">
              Efficient Multi-Drop Delivery Solutions For Businesses
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/80">
              Streamline Logistics Group helps businesses complete multiple
              collections and deliveries in one planned route. Ideal for
              companies that need goods moved to several locations efficiently,
              safely and professionally.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
              >
                Get Instant Quote
                <ArrowRight size={20} />
              </Link>

              <a
                href="tel:03333440703"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/30 bg-white/10 px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-[#071D49]"
              >
                <Phone size={20} />
                0333 344 0703
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-[#D7E6FF] bg-white py-10">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 text-center md:grid-cols-4">
            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">Multiple</h3>
              <p className="font-semibold text-[#071D49]">Delivery Points</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">Planned</h3>
              <p className="font-semibold text-[#071D49]">Routes</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">UK Wide</h3>
              <p className="font-semibold text-[#071D49]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">24/7</h3>
              <p className="font-semibold text-[#071D49]">Support</p>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-4xl font-bold text-[#071D49] lg:text-5xl">
                Why Businesses Choose Streamline
              </h2>

              <p className="mx-auto max-w-3xl text-lg leading-8 text-[#4B5D7A]">
                A reliable multi-drop delivery service built around route
                planning, efficiency and professional communication.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Route className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Planned Routes
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Collections and deliveries can be structured into one
                  organised route.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <MapPinned className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Multiple Stops
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Ideal for businesses delivering to several sites, customers or
                  locations.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Clock3 className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Efficient Delivery
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Reduce wasted time by grouping several jobs into one booking.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Truck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Dedicated Support
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  A suitable driver and vehicle are allocated to your route.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ServiceQuoteSection
          eyebrow="Get a Quote"
          title="Get a quote for multi-drop delivery"
          description="Plan your multi-drop delivery route online with collection details, delivery locations, vehicle requirements and business contact information."
          serviceName="Multi-Drop Delivery"
        />

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="mb-4 text-4xl font-bold text-[#071D49]">
              Industries We Support
            </h2>

            <p className="mx-auto mb-12 max-w-4xl text-lg leading-8 text-[#4B5D7A]">
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

        <section className="bg-[#F4F8FF] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-4 text-center text-4xl font-bold text-[#071D49]">
              Multi-Drop Delivery FAQ
            </h2>

            <p className="mx-auto mb-12 max-w-3xl text-center text-lg leading-8 text-[#4B5D7A]">
              Common questions about our multi-drop delivery service.
            </p>

            <div className="space-y-6">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-[#D7E6FF] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-2 font-bold text-[#071D49]">
                    {faq.question}
                  </h3>
                  <p className="leading-7 text-[#4B5D7A]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl rounded-[40px] bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] px-8 py-16 text-center text-white shadow-2xl shadow-[#071D49]/20">
            <h2 className="mb-6 text-4xl font-bold">
              Need Multiple Drops Planned Efficiently?
            </h2>

            <p className="mb-8 text-xl text-white/80">
              Build a multi-drop quote online and keep your business moving.
            </p>

            <Link
              href="/quote"
              className="inline-flex items-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:bg-[#2D8CFF]"
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
