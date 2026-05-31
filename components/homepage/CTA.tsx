import Link from "next/link";
import { ArrowRight, Clock, MapPin, PackageCheck } from "lucide-react";

export default function CTA() {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0b1f3a]">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ef1c24]" />
          <div className="absolute -bottom-28 right-32 h-72 w-72 rounded-full bg-[#ff6a00]/70" />

          <div className="relative grid min-h-[360px] grid-cols-1 items-center gap-10 px-8 py-12 lg:grid-cols-2 lg:px-16">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
                Business Deliveries Made Simple
              </p>

              <h2 className="mb-6 text-5xl font-semibold leading-tight text-white">
                Need A Collection Or Delivery Today?
              </h2>

              <p className="mb-8 text-xl leading-8 text-white/85">
                Send us the collection point, drop-off address and delivery
                details. We handle the movement so your business can keep
                working.
              </p>

              <Link
                href="/instant-quote"
                className="inline-flex items-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 font-semibold text-white transition hover:-translate-y-1 hover:bg-[#ff6a00]"
              >
                Start Your Quote
                <ArrowRight size={20} />
              </Link>
            </div>

            <div className="grid gap-5">
              <div className="flex items-center gap-5 rounded-2xl bg-white/95 p-6 shadow-xl">
                <MapPin size={38} className="text-[#ef1c24]" />
                <div>
                  <h3 className="text-xl font-semibold text-[#0b1f3a]">
                    Collection To Drop-Off
                  </h3>
                  <p className="text-gray-600">
                    Simple business deliveries from A to B.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-2xl bg-white/95 p-6 shadow-xl">
                <Clock size={38} className="text-[#ef1c24]" />
                <div>
                  <h3 className="text-xl font-semibold text-[#0b1f3a]">
                    Same-Day Options
                  </h3>
                  <p className="text-gray-600">
                    Built for urgent and time-sensitive jobs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-2xl bg-white/95 p-6 shadow-xl">
                <PackageCheck size={38} className="text-[#ef1c24]" />
                <div>
                  <h3 className="text-xl font-semibold text-[#0b1f3a]">
                    Business Goods Handled Safely
                  </h3>
                  <p className="text-gray-600">
                    Professional handling from pickup to delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}