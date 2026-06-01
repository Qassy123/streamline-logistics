import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Industries from "@/components/homepage/Industries";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  Boxes,
  Phone,
} from "lucide-react";

export default function FullLoadPage() {
  const faqs = [
    {
      question: "What is a full load delivery service?",
      answer:
        "A full load delivery is used when your goods require dedicated space and transport support from collection to delivery.",
    },
    {
      question: "Is full load suitable for larger consignments?",
      answer:
        "Yes. Full load delivery is designed for larger business consignments, stock movements, equipment and commercial goods.",
    },
    {
      question: "Can full load deliveries be arranged across the UK?",
      answer:
        "Yes. Streamline Logistics Group provides UK-wide full load collection and delivery support.",
    },
    {
      question: "Are full load deliveries insured?",
      answer:
        "Yes. Deliveries are handled by professional drivers with suitable insurance and business delivery standards.",
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
              Full Load Delivery
            </p>

            <h1 className="mb-6 max-w-5xl text-5xl font-semibold leading-tight lg:text-7xl">
              Dedicated Full Load Delivery For Larger Business Consignments
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              Streamline Logistics Group provides dedicated full load delivery
              support for businesses moving larger consignments, stock,
              equipment and commercial goods across the UK.
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
              <h3 className="text-4xl font-bold text-[#ef1c24]">Full Load</h3>
              <p className="text-[#0b1f3a]">Larger Consignments</p>
            </div>

            <div>
              <h3 className="text-4xl font-bold text-[#ef1c24]">Dedicated</h3>
              <p className="text-[#0b1f3a]">Transport Support</p>
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
                Full load transport support built around space, reliability,
                careful handling and clear communication.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Boxes className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Larger Consignments
                </h3>

                <p className="text-gray-600">
                  Suitable for larger loads, stock movements, equipment and
                  commercial goods.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <Truck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Dedicated Vehicle
                </h3>

                <p className="text-gray-600">
                  Transport support focused on your goods from collection to
                  final delivery.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <PackageCheck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Secure Handling
                </h3>

                <p className="text-gray-600">
                  Goods are handled professionally throughout the delivery
                  process.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <ShieldCheck className="mb-5 text-[#ff6a00]" size={46} />

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Fully Insured
                </h3>

                <p className="text-gray-600">
                  Professional delivery support with appropriate insurance and
                  driver standards.
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
              Our full load service supports the industries we work with,
              including construction, aviation, hospitality, farming, marketing
              and print, pharmaceutical and medical, film and production,
              events, professional services, education, arts and antiques,
              utilities, fast-moving consumer goods, automotive and wholesale.
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
                  Confirm The Load
                </h3>

                <p className="text-gray-600">
                  Tell us what needs moving, where it is being collected from
                  and where it needs delivering.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">2</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Vehicle Assigned
                </h3>

                <p className="text-gray-600">
                  A suitable vehicle and driver are allocated to support your
                  delivery requirements.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <div className="mb-4 text-5xl font-bold text-[#ef1c24]">3</div>

                <h3 className="mb-3 text-xl font-semibold text-[#0b1f3a]">
                  Delivered Directly
                </h3>

                <p className="text-gray-600">
                  Your goods are delivered safely and professionally to their
                  destination.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-12 text-center text-4xl font-light text-[#ef1c24]">
              Full Load Delivery FAQ
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
                "Dedicated full load transport support",
                "Suitable for larger consignments",
                "Professional DBS checked drivers",
                "UK-wide delivery coverage",
                "Reliable communication",
                "Fully insured service",
                "Flexible collection and delivery options",
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
              Need To Move A Larger Load?
            </h2>

            <p className="mb-8 text-xl text-white/90">
              Let Streamline Logistics Group support your full load delivery
              requirements across the UK.
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