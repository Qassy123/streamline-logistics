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
      "Collection and drop-off support for same day delivery, next day delivery, multi-drop routes and wider business delivery needs.",
    icon: MapPinned,
  },
  {
    title: "Fast & Efficient Service",
    description:
      "Built for businesses that need urgent collections handled quickly, professionally and without confusion.",
    icon: Clock3,
  },
  {
    title: "Reliable & Trusted",
    description:
      "We are fully prepared to handle business deliveries responsibly.",
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
      "Pricing built around the job, including same day delivery, next day delivery and multi-drop delivery needs.",
    icon: BadgeCheck,
  },
];

export default function LogisticsProvider() {
  return (
    <section className="bg-[#F4F8FF] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <h2 className="mb-5 text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
            Business Delivery Support You Can Depend On
          </h2>

          <p className="text-lg leading-8 text-[#4B5D7A] lg:text-xl">
            Streamline Logistics Group gives businesses a simple, reliable way
            to move goods across the UK with speed, care and clear
            communication.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#006CFF]">
                  <Icon
                    size={30}
                    className="text-white"
                  />
                </div>

                <h3 className="mb-4 text-2xl font-bold text-[#071D49]">
                  {feature.title}
                </h3>

                <p className="text-base leading-7 text-[#4B5D7A]">
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