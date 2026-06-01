import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  CheckCircle,
  Phone,
  ShieldCheck,
  MapPinned,
} from "lucide-react";

export default function SameDayDeliveryPage() {
  return (
    <>
      <Header />

      <main>
        {/* HERO */}
        <section className="bg-gradient-to-r from-[#0b1f3a] via-[#102d52] to-[#ef1c24] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
              Streamline Logistics Group
            </p>

            <h1 className="mb-6 max-w-4xl text-5xl font-semibold leading-tight lg:text-7xl">
              Same Day Delivery Services
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              Fast and dependable same-day collection and delivery solutions
              for businesses throughout the United Kingdom. When time matters,
              we help keep your operations moving.
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

        {/* INTRO */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="mb-8 text-4xl font-light text-[#ef1c24] lg:text-5xl">
              Business Deliveries Without Delays
            </h2>

            <p className="text-xl leading-9 text-[#0b1f3a]">
              Whether you're moving urgent stock, customer orders,
              equipment, documents or business-critical goods,
              Streamline Logistics Group provides direct collection
              and delivery support designed around your schedule.
            </p>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="bg-[#f8fafc] py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="text-4xl font-light text-[#ef1c24]">
                Why Businesses Choose Streamline
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Clock3 size={44} className="mb-5 text-[#ff6a00]" />
                <h3 className="mb-4 text-xl font-semibold text-[#0b1f3a]">
                  Rapid Collection
                </h3>
                <p className="leading-7 text-gray-600">
                  Fast response times helping businesses move urgent goods
                  when deadlines matter.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <ShieldCheck size={44} className="mb-5 text-[#ff6a00]" />
                <h3 className="mb-4 text-xl font-semibold text-[#0b1f3a]">
                  Insured & Vetted Drivers
                </h3>
                <p className="leading-7 text-gray-600">
                  Professional delivery partners with insurance cover and
                  background checks completed.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <MapPinned size={44} className="mb-5 text-[#ff6a00]" />
                <h3 className="mb-4 text-xl font-semibold text-[#0b1f3a]">
                  UK Wide Coverage
                </h3>
                <p className="leading-7 text-gray-600">
                  Collection and delivery support available across the UK
                  for businesses of all sizes.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <CheckCircle size={44} className="mb-5 text-[#ff6a00]" />
                <h3 className="mb-4 text-xl font-semibold text-[#0b1f3a]">
                  Real-Time Updates
                </h3>
                <p className="leading-7 text-gray-600">
                  Clear communication throughout the delivery process from
                  collection through to completion.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-4xl font-light text-[#ef1c24]">
                Industries We Support
              </h2>

              <p className="mx-auto max-w-3xl text-lg text-[#0b1f3a]">
                Trusted by businesses operating across a wide range of sectors.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "Construction",
                "Aviation",
                "Hospitality",
                "Medical",
                "Events",
                "Education",
                "Utilities",
                "Wholesale",
              ].map((industry) => (
                <div
                  key={industry}
                  className="rounded-2xl border border-gray-200 p-5 text-center font-medium text-[#0b1f3a]"
                >
                  {industry}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0b1f3a] py-20 text-white">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="mb-6 text-4xl font-light">
              Need A Same Day Delivery?
            </h2>

            <p className="mb-10 text-xl text-white/80">
              Tell us your collection and delivery requirements and we'll
              provide a fast quotation.
            </p>

            <Link
              href="/instant-quote"
              className="inline-flex items-center gap-3 rounded-full bg-[#ef1c24] px-10 py-5 text-lg font-semibold text-white transition hover:bg-[#ff6a00]"
            >
              Get Instant Quote
              <ArrowRight size={22} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}