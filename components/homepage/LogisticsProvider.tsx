import {
  BadgeCheck,
  Clock3,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    title: "Complete Delivery Solutions",
    description:
      "Collection and drop-off support for parcels, business goods, multi-drop routes and full-load deliveries.",
    icon: MapPinned,
  },
  {
    title: "Fast & Efficient Service",
    description:
      "Built for businesses that need urgent collections handled quickly, professionally and without confusion.",
    icon: Clock3,
  },
  {
    title: "Reliable & Vetted Drivers",
    description:
      "Our drivers are fully insured, carefully checked and prepared to handle business deliveries responsibly.",
    icon: ShieldCheck,
  },
  {
    title: "Dedicated Business Deliveries",
    description:
      "Your goods are handled with care from collection to delivery, with a clear focus on safe transport.",
    icon: PackageCheck,
  },
  {
    title: "Clear Delivery Updates",
    description:
      "Stay informed with straightforward communication from pickup through to successful delivery.",
    icon: MessageSquareText,
  },
  {
    title: "Flexible Pricing",
    description:
      "Pricing built around the job, including same-day, multi-drop, parcel and full-load delivery needs.",
    icon: BadgeCheck,
  },
];

export default function LogisticsProvider() {
  return (
    <section className="bg-gradient-to-br from-[#0b1f3a] via-[#102d52] to-[#ef1c24] py-20 text-white lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <h2 className="mb-5 text-4xl font-semibold leading-tight lg:text-5xl">
            Business Delivery Support You Can Depend On
          </h2>

          <p className="text-lg leading-8 text-white/85 lg:text-xl">
            Streamline Logistics Group gives businesses a simple, reliable way
            to move goods across the UK with speed, care and clear
            communication.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group text-center"
              >
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10 backdrop-blur transition group-hover:-translate-y-1 group-hover:bg-white group-hover:text-[#ef1c24]">
                  <Icon size={38} />
                </div>

                <h3 className="mb-4 text-2xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mx-auto max-w-[320px] text-base leading-7 text-white/80">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}