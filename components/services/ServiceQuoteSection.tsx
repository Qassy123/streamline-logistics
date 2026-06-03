import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  ClipboardCheck,
  Headphones,
  Mail,
  MapPinned,
  Phone,
  ShieldCheck,
} from "lucide-react";

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
    <section className="relative overflow-hidden bg-[#071426] py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(239,28,36,0.35),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(255,106,0,0.18),_transparent_32%)]" />

      <div className="relative mx-auto max-w-7xl overflow-hidden px-6">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
          <div className="min-w-0 overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
              {eyebrow}
            </p>

            <h2 className="mb-6 text-4xl font-semibold leading-tight lg:text-5xl">
              {title}
            </h2>

            <p className="mb-8 text-lg leading-8 text-white/80">
              {description}
            </p>

            <div className="grid gap-4">
              <a
                href="tel:03333440703"
                className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-semibold text-white"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ef1c24]">
                  <Phone size={20} />
                </span>

                <div className="min-w-0">
                  <span className="block">0333 344 0703</span>
                </div>
              </a>

              <a
                href="mailto:info@streamlinelogisticsgroup.co.uk"
                className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-semibold text-white"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ef1c24]">
                  <Mail size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <span className="block break-all text-sm leading-relaxed sm:text-base">
                    info@streamlinelogisticsgroup.co.uk
                  </span>
                </div>
              </a>
            </div>
          </div>

          <div className="rounded-[36px] bg-white p-8 text-[#0b1f3a] shadow-2xl">
            <div className="mb-8 flex flex-col gap-6 border-b border-gray-200 pb-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#ef1c24]">
                  Streamline Quote System
                </p>

                <h3 className="text-3xl font-semibold">
                  Start your {serviceName.toLowerCase()} quote online
                </h3>

                <p className="mt-4 max-w-2xl text-gray-600">
                  Open the live quote form and select your service, vehicle,
                  delivery route, capacity and contact details in one secure
                  flow.
                </p>
              </div>

              <Link
                href="/quote"
                className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-7 py-4 font-semibold text-white transition hover:bg-[#ff6a00]"
              >
                Open Quote Form
                <ArrowRight size={20} />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: ClipboardCheck,
                  title: "Structured quote details",
                  text: "Capture service type, journey type, addresses, load details and customer information.",
                },
                {
                  icon: MapPinned,
                  title: "Built for delivery routes",
                  text: "Supports one-way, return and multi-drop journeys ready for route-based pricing.",
                },
                {
                  icon: Clock3,
                  title: "30-minute quote window",
                  text: "Quotes are designed around time-sensitive booking and payment flow.",
                },
                {
                  icon: ShieldCheck,
                  title: "Business-ready records",
                  text: "Quotes are saved against the backend for booking, payment and admin workflows.",
                },
                {
                  icon: Headphones,
                  title: "Human support available",
                  text: "Customers can still call the team if a job needs operational review.",
                },
                {
                  icon: BadgeCheck,
                  title: "Ready for trade accounts",
                  text: "The flow supports future business and trade account booking journeys.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-gray-200 bg-[#f8fafc] p-6"
                  >
                    <Icon className="mb-5 text-[#ef1c24]" size={34} />

                    <h4 className="mb-3 text-lg font-semibold text-[#0b1f3a]">
                      {item.title}
                    </h4>

                    <p className="text-sm leading-6 text-gray-600">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}