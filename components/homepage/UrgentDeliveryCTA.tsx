import Link from "next/link";
import { Phone } from "lucide-react";

export default function UrgentDeliveryCTA() {
  return (
    <section className="bg-gradient-to-r from-[#ff6a00] via-[#ff4d00] to-[#ef1c24] py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 text-center lg:flex-row lg:text-left">
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-white/80">
            Available 24/7
          </p>

          <h2 className="mb-4 text-4xl font-bold text-white lg:text-5xl">
            Need An Urgent Business Delivery Today?
          </h2>

          <p className="max-w-2xl text-lg text-white/90">
            Fast collection and delivery services for businesses across the UK.
            When timing matters, Streamline Logistics Group is ready to help.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="tel:03333440703"
            className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-[#ef1c24] transition hover:scale-105"
          >
            <Phone size={20} />
            0333 344 0703
          </a>

          <Link
            href="/instant-quote"
            className="rounded-full border-2 border-white px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-[#ef1c24]"
          >
            Get Instant Quote
          </Link>
        </div>
      </div>
    </section>
  );
}