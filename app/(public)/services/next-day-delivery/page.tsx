import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import ServiceQuoteSection from "@/components/services/ServiceQuoteSection";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  Clock3,
  MapPinned,
  PackageCheck,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";

export default function NextDayDeliveryPage() {
  const faqs = [
    {
      question: "What is next day delivery?",
      answer:
        "Next day delivery is a planned transport service for goods that need to arrive the following working day.",
    },
    {
      question: "Is next day delivery suitable for businesses?",
      answer:
        "Yes. It is ideal for businesses that need reliable scheduled transport without requiring same day urgency.",
    },
    {
      question: "Can I book next day delivery online?",
      answer:
        "Yes. You can request a quote online with collection details, delivery details, vehicle size and contact information.",
    },
    {
      question: "Do you provide UK-wide next day delivery?",
      answer:
        "Yes. Streamline Logistics Group supports next day delivery requirements across the UK.",
    },
  ];

  return (
    <>
      <Header />

      <main>
        <section className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
              Next Day Delivery
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-bold leading-tight lg:text-7xl">
              Reliable Next Day Delivery For Business Goods
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/80">
              Streamline Logistics Group provides dependable next day delivery
              services for businesses that need planned, professional transport
              with clear communication from collection through to delivery.
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
              <h3 className="text-4xl font-bold text-[#006CFF]">Next Day</h3>
              <p className="font-semibold text-[#071D49]">Delivery</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">Planned</h3>
              <p className="font-semibold text-[#071D49]">Collections</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">UK Wide</h3>
              <p className="font-semibold text-[#071D49]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">Fully</h3>
              <p className="font-semibold text-[#071D49]">Insured</p>
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
                A dependable next day delivery service built around planning,
                communication, reliability and business continuity.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <CalendarCheck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Planned Delivery
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Book transport ahead of time for goods that need to arrive the
                  next working day.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Truck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Professional Transport
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Suitable vehicles and drivers are allocated for your business
                  delivery requirements.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Clock3 className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Reliable Scheduling
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Delivery planning helps keep your business moving without
                  unnecessary same day pressure.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <ShieldCheck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Fully Insured
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Business goods are handled by professional drivers with
                  appropriate insurance protection.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ServiceQuoteSection
          eyebrow="Get a Quote"
          title="Get a quote for next day delivery"
          description="Complete your next day delivery quote online with collection details, delivery details, vehicle size, capacity and contact information."
          serviceName="Next Day Delivery"
        />

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-4xl font-bold text-[#071D49] lg:text-5xl">
                Industries We Support
              </h2>

              <p className="mx-auto max-w-4xl text-lg leading-8 text-[#4B5D7A]">
                Our next day delivery service supports businesses across
                construction, aviation, hospitality, healthcare, professional
                services, manufacturing, wholesale, education, events and many
                other sectors throughout the United Kingdom.
              </p>
            </div>

            <Industries />
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-4 text-center text-4xl font-bold text-[#071D49]">
              How Our Next Day Service Works
            </h2>

            <p className="mx-auto mb-16 max-w-3xl text-center text-lg leading-8 text-[#4B5D7A]">
              A simple process for planned business delivery.
            </p>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                [
                  "1",
                  "Book Online",
                  "Submit your delivery details and select the right vehicle for the job.",
                ],
                [
                  "2",
                  "Collection Scheduled",
                  "We prepare the collection and assign suitable transport support.",
                ],
                [
                  "3",
                  "Next Day Delivery",
                  "Goods are delivered professionally with clear communication throughout.",
                ],
              ].map(([number, title, text]) => (
                <div
                  key={number}
                  className="rounded-3xl border border-[#D7E6FF] bg-white p-8 text-center shadow-lg"
                >
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#006CFF] text-2xl font-bold text-white">
                    {number}
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                    {title}
                  </h3>
                  <p className="leading-7 text-[#4B5D7A]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-12 text-center text-4xl font-bold text-[#071D49]">
              Next Day Delivery FAQ
            </h2>

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

        <section className="bg-[#071D49] py-20 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-4xl font-bold">
              Why Choose Streamline Logistics Group
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                "Reliable next day delivery service",
                "Fully insured transport support",
                "Professional business service",
                "Planned collection support",
                "Clear delivery communication",
                "Nationwide UK coverage",
                "Suitable vehicles for business goods",
                "Flexible booking options",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="text-[#2D8CFF]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl rounded-[40px] bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] px-8 py-16 text-center text-white shadow-2xl shadow-[#071D49]/20">
            <h2 className="mb-6 text-4xl font-bold">
              Need A Planned Delivery For Tomorrow?
            </h2>

            <p className="mb-8 text-xl text-white/80">
              Get a fast quotation and schedule your next day delivery.
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