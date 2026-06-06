import Link from "next/link";
import { Phone } from "lucide-react";

export default function UrgentDeliveryCTA() {
  return (
    <section className="bg-gradient-to-r from-[#071D49] via-[#0B2A63] to-[#006CFF] py-20">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 px-6 text-center lg:flex-row lg:text-left">
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#7FB6FF]">
            Available 24/7
          </p>

          <h2 className="mb-4 text-4xl font-bold text-white lg:text-5xl">
            Need An Urgent Business Delivery Today?
          </h2>

          <p className="max-w-2xl text-lg text-white/85">
            Fast collection and delivery services for businesses across the UK.
            When timing matters, Streamline Logistics Group is ready to help.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="tel:03333440703"
            className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-[#071D49] transition hover:bg-[#EAF2FF]"
          >
            <Phone size={20} />
            0333 344 0703
          </a>

          <Link
            href="/quote"
            className="rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:bg-[#2D8CFF]"
          >
            Get Instant Quote
          </Link>
        </div>
      </div>
    </section>
  );
}