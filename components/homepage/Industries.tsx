import {
  BriefcaseBusiness,
  Building2,
  Car,
  Clapperboard,
  Factory,
  GraduationCap,
  Hammer,
  HeartPulse,
  Landmark,
  Plane,
  Sprout,
  Store,
  Truck,
  Utensils,
  Zap,
} from "lucide-react";

const industries = [
  {
    title: "Construction",
    description: "Tools, materials and urgent site deliveries moved quickly.",
    icon: Hammer,
  },
  {
    title: "Aviation",
    description: "Time-sensitive parts and operational goods delivered safely.",
    icon: Plane,
  },
  {
    title: "Hospitality",
    description: "Reliable delivery support for venues, suppliers and events.",
    icon: Utensils,
  },
  {
    title: "Farming",
    description: "Business goods and supplies transported with care.",
    icon: Sprout,
  },
  {
    title: "Marketing & Print",
    description: "Print materials, displays and campaign items delivered on time.",
    icon: Landmark,
  },
  {
    title: "Pharmaceutical & Medical",
    description: "Careful handling for business medical supplies and equipment.",
    icon: HeartPulse,
  },
  {
    title: "Film & Production",
    description: "Production equipment, props and urgent shoot materials moved fast.",
    icon: Clapperboard,
  },
  {
    title: "Events",
    description: "Event stock, equipment and supplies delivered when needed.",
    icon: Store,
  },
  {
    title: "Professional Services",
    description: "Secure document, parcel and office delivery support.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Education",
    description: "Supplies, equipment and materials delivered between sites.",
    icon: GraduationCap,
  },
  {
    title: "Arts & Antiques",
    description: "Careful delivery support for delicate and valuable items.",
    icon: Building2,
  },
  {
    title: "Utilities",
    description: "Urgent parts and operational goods delivered to teams.",
    icon: Zap,
  },
  {
    title: "Fast-Moving Consumer Goods",
    description: "Responsive delivery support for busy supply chains.",
    icon: Truck,
  },
  {
    title: "Automotive",
    description: "Parts, stock and business items transported efficiently.",
    icon: Car,
  },
  {
    title: "Wholesale",
    description: "Bulk goods, stock movements and business deliveries handled.",
    icon: Factory,
  },
];

export default function Industries() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-4xl text-center lg:mb-16">
          <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff6a00]">
            Sectors We Support
          </p>

          <h2 className="mb-5 text-4xl font-light leading-tight text-[#ef1c24] lg:text-5xl">
            Courier Services Tailored To Your Industry
          </h2>

          <p className="text-lg leading-8 text-[#0b1f3a] lg:text-xl">
            From urgent site supplies to business parcels, Streamline Logistics
            Group supports companies across a wide range of industries with
            dependable collection and delivery services.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {industries.map((industry) => {
            const Icon = industry.icon;

            return (
              <div
                key={industry.title}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#ff6a00] hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1e8] text-[#ef1c24] transition group-hover:bg-[#ef1c24] group-hover:text-white">
                  <Icon size={28} />
                </div>

                <h3 className="mb-3 text-xl font-semibold leading-7 text-[#0b1f3a]">
                  {industry.title}
                </h3>

                <p className="text-base leading-7 text-gray-600">
                  {industry.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}