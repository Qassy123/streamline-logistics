import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import ServiceQuoteSection from "@/components/services/ServiceQuoteSection";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  MapPinned,
  ShieldCheck,
  Truck,
  Phone,
} from "lucide-react";

export default function SameDayDeliveryPage() {
  return (
    <>
      <Header />

      <main>
        <section className="bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
              Same Day Delivery Service
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-bold leading-tight lg:text-7xl">
              Fast, Reliable Same Day Delivery For Businesses
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/80">
              When your business needs urgent goods moved quickly,
              Streamline Logistics Group provides dedicated same-day delivery
              services across the UK with professional drivers, direct delivery
              routes and real-time communication.
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
                href="tel:07301827224"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/30 bg-white/10 px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-[#071D49]"
              >
                <Phone size={20} />
                07301827224
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-[#D7E6FF] bg-white py-10">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 text-center md:grid-cols-4">
            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">UK Wide</h3>
              <p className="font-semibold text-[#071D49]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">24/7</h3>
              <p className="font-semibold text-[#071D49]">Availability</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#006CFF]">DBS</h3>
              <p className="font-semibold text-[#071D49]">Checked Drivers</p>
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
                A professional same-day delivery service built around speed,
                communication, reliability and business continuity.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Clock3 className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Rapid Collection
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Fast response times for urgent business deliveries throughout
                  the UK.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <Truck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Dedicated Delivery
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Your goods travel directly to the destination without being
                  mixed with other consignments.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <MapPinned className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  UK-Wide Coverage
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Supporting businesses across England, Scotland, Wales and
                  Northern Ireland.
                </p>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                <ShieldCheck className="mb-5 text-[#006CFF]" size={46} />
                <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                  Fully Insured
                </h3>
                <p className="leading-7 text-[#4B5D7A]">
                  Professional drivers with DBS checks and appropriate insurance
                  protection.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ServiceQuoteSection
          eyebrow="Get a Quote"
          title="Get a quote for same day delivery"
          description="Complete your same day delivery quote online with collection details, delivery details, vehicle size, capacity and contact information."
          serviceName="Same Day Delivery"
        />

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-4xl font-bold text-[#071D49] lg:text-5xl">
                Industries We Support
              </h2>

              <p className="mx-auto max-w-4xl text-lg leading-8 text-[#4B5D7A]">
                Our same day delivery service supports businesses across construction,
                aviation, hospitality, healthcare, professional services,
                manufacturing, wholesale, education, events and many other sectors
                throughout the United Kingdom.
              </p>
            </div>

            <Industries />
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-4 text-center text-4xl font-bold text-[#071D49]">
              How Our Same Day Service Works
            </h2>

            <p className="mx-auto mb-16 max-w-3xl text-center text-lg leading-8 text-[#4B5D7A]">
              A simple process designed to keep your business moving.
            </p>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                ["1", "Contact Our Team", "Tell us what needs collecting and where it needs delivering."],
                ["2", "Driver Assigned", "We allocate the most suitable driver and vehicle."],
                ["3", "Direct Delivery", "Goods are delivered safely with clear communication throughout."],
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
              Same Day Delivery FAQ
            </h2>

            <div className="space-y-6">
              {[
                {
                  q: "What is a dedicated same day delivery service?",
                  a: "Your goods travel directly from collection to delivery without being combined with other consignments.",
                },
                {
                  q: "Do you operate throughout the UK?",
                  a: "Yes. We provide UK-wide coverage across England, Scotland, Wales and Northern Ireland.",
                },
                {
                  q: "Are your drivers insured?",
                  a: "Yes. Our drivers operate with appropriate insurance and professional standards.",
                },
                {
                  q: "Can businesses book regular deliveries?",
                  a: "Yes. We support both one-off urgent deliveries and ongoing business transport requirements.",
                },
              ].map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-[#D7E6FF] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-2 font-bold text-[#071D49]">
                    {faq.q}
                  </h3>
                  <p className="leading-7 text-[#4B5D7A]">{faq.a}</p>
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
                "Dedicated same-day delivery service",
                "DBS checked drivers",
                "Fully insured transport support",
                "Professional business service",
                "Real-time communication",
                "Nationwide UK coverage",
                "Fast response times",
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
              Need An Urgent Collection Today?
            </h2>

            <p className="mb-8 text-xl text-white/80">
              Get a fast quotation and keep your business moving.
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