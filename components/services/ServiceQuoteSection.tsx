import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";

type ServiceQuoteSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  serviceName: string;
};

export default function ServiceQuoteSection({
  eyebrow,
  title,
  description,
  serviceName,
}: ServiceQuoteSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#ef1c24] py-20 text-white">
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full border-[34px] border-[#a8dc8f]" />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-white/80">
            {eyebrow}
          </p>

          <h2 className="mb-6 text-4xl font-semibold leading-tight lg:text-5xl">
            {title}
          </h2>

          <p className="mb-8 max-w-xl text-lg leading-8 text-white/90">
            {description}
          </p>

          <div className="space-y-4 text-white">
            <a
              href="tel:03333440703"
              className="flex items-center gap-3 font-semibold"
            >
              <Phone size={20} />
              0333 344 0703
            </a>

            <a
              href="mailto:info@streamlinelogisticsgroup.co.uk"
              className="flex items-center gap-3 font-semibold"
            >
              <Mail size={20} />
              info@streamlinelogisticsgroup.co.uk
            </a>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-8 text-[#0b1f3a] shadow-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#ef1c24]">
            Start Your Quote
          </p>

          <h3 className="mb-4 text-3xl font-semibold">
            Get a quote for {serviceName}
          </h3>

          <p className="mb-8 text-gray-600">
            Use our instant quote system to enter your collection address,
            delivery address, vehicle type, capacity and contact details.
          </p>

          <div className="mb-8 grid gap-4">
            {[
              "Instant quote reference",
              "Vehicle and capacity selection",
              "Multi-drop support",
              "Business contact details",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 font-semibold"
              >
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/quote"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#0b1f3a] px-8 py-4 font-semibold text-white transition hover:bg-[#ff6a00]"
          >
            Open Instant Quote
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}