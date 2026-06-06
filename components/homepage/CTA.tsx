import Link from "next/link";
import { ArrowRight, Clock, MapPin, PackageCheck } from "lucide-react";

export default function CTA() {
  return (
    <section className="bg-[#F4F8FF] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071D49] via-[#0B2A63] to-[#006CFF] shadow-2xl">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2D8CFF]/30 blur-3xl" />
          <div className="absolute -bottom-28 right-32 h-72 w-72 rounded-full bg-[#006CFF]/30 blur-3xl" />

          <div className="relative grid min-h-[360px] grid-cols-1 items-center gap-10 px-8 py-12 lg:grid-cols-2 lg:px-16">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#7FB6FF]">
                Business Deliveries Made Simple
              </p>

              <h2 className="mb-6 text-5xl font-bold leading-tight text-white">
                Need A Collection Or Delivery Today?
              </h2>

              <p className="mb-8 text-xl leading-8 text-white/85">
                Send us the collection point, drop-off address and delivery
                details. We handle the movement so your business can keep
                working.
              </p>

              <Link
                href="/quote"
                className="inline-flex items-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
              >
                Start Your Quote
                <ArrowRight size={20} />
              </Link>
            </div>

            <div className="grid gap-5">
              <div className="flex items-center gap-5 rounded-2xl border border-[#D7E6FF] bg-white p-6 shadow-xl">
                <MapPin size={38} className="text-[#006CFF]" />
                <div>
                  <h3 className="text-xl font-bold text-[#071D49]">
                    Collection To Drop-Off
                  </h3>
                  <p className="text-[#4B5D7A]">
                    Simple business deliveries from A to B.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-2xl border border-[#D7E6FF] bg-white p-6 shadow-xl">
                <Clock size={38} className="text-[#006CFF]" />
                <div>
                  <h3 className="text-xl font-bold text-[#071D49]">
                    Same-Day Options
                  </h3>
                  <p className="text-[#4B5D7A]">
                    Built for urgent and time-sensitive jobs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-2xl border border-[#D7E6FF] bg-white p-6 shadow-xl">
                <PackageCheck size={38} className="text-[#006CFF]" />
                <div>
                  <h3 className="text-xl font-bold text-[#071D49]">
                    Business Goods Handled Safely
                  </h3>
                  <p className="text-[#4B5D7A]">
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