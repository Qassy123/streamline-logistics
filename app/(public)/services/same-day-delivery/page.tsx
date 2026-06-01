import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
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
        {/* HERO */}
        <section className="bg-gradient-to-r from-[#0b1f3a] via-[#102d52] to-[#ef1c24] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
              Same Day Delivery Service
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-semibold leading-tight lg:text-7xl">
              Fast, Reliable Same Day Delivery For Businesses
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              When your business needs urgent goods moved quickly,
              Streamline Logistics Group provides dependable same-day
              collection and delivery services throughout the UK.
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
              <h3 className="text-4xl font-bold text-[#ef1c24]">UK Wide</h3>
              <p className="text-[#0b1f3a]">Coverage</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">24/7</h3>
              <p className="text-[#0b1f3a]">Availability</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">DBS</h3>
              <p className="text-[#0b1f3a]">Checked Drivers</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">Fully</h3>
              <p className="text-[#0b1f3a]">Insured</p>
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
                A professional same-day delivery solution built around speed,
                communication and reliability.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Clock3 className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Rapid Collection
                </h3>

                <p className="text-gray-600">
                  Fast response times for urgent business deliveries across the
                  UK.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Truck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Dedicated Delivery
                </h3>

                <p className="text-gray-600">
                  Direct collection and delivery support without unnecessary
                  delays.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <MapPinned className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Nationwide Coverage
                </h3>

                <p className="text-gray-600">
                  Supporting businesses throughout England, Scotland, Wales and
                  Northern Ireland.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <ShieldCheck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Fully Insured
                </h3>

                <p className="text-gray-600">
                  Professional drivers with DBS checks and appropriate
                  insurance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-16 text-center text-4xl font-light text-[#ef1c24]">
              How Our Same Day Service Works
            </h2>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">1</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Request Collection
                </h3>

                <p className="text-gray-600">
                  Send us your collection and delivery details.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">2</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  We Collect
                </h3>

                <p className="text-gray-600">
                  A suitable driver is assigned and collects your goods.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">3</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  We Deliver
                </h3>

                <p className="text-gray-600">
                  Your goods are delivered safely and professionally.
                </p>
              </div>
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
              Need An Urgent Collection Today?
            </h2>

            <p className="mb-8 text-xl text-white/90">
              Get a fast quotation and keep your business moving.
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