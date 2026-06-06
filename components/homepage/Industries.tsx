import Image from "next/image";

const industries = [
  {
    title: "Construction",
    image: "/images/industries/construction.jpg",
    description:
      "Urgent site deliveries, materials, tools and project support logistics.",
  },
  {
    title: "Aviation",
    image: "/images/industries/aviation.jpg",
    description:
      "Time-critical collections and deliveries for aviation businesses.",
  },
  {
    title: "Hospitality",
    image: "/images/industries/hospitality.jpg",
    description:
      "Reliable transport support for venues, suppliers and hospitality groups.",
  },
  {
    title: "Farming",
    image: "/images/industries/farming.jpg",
    description:
      "Dependable movement of supplies and equipment across agricultural operations.",
  },
  {
    title: "Marketing & Print",
    image: "/images/industries/marketing.jpg",
    description:
      "Printed materials, displays and campaign assets delivered on schedule.",
  },
  {
    title: "Pharmaceutical & Medical",
    image: "/images/industries/pharmacy.jpg",
    description:
      "Professional handling of medical supplies and business-critical deliveries.",
  },
  {
    title: "Film & Production",
    image: "/images/industries/film.jpg",
    description:
      "Equipment, props and production assets transported safely and efficiently.",
  },
  {
    title: "Events",
    image: "/images/industries/event.jpg",
    description:
      "Supporting events with dependable collection and delivery services.",
  },
  {
    title: "Professional Services",
    image: "/images/industries/professional.jpg",
    description:
      "Secure document, parcel and office logistics support.",
  },
  {
    title: "Education",
    image: "/images/industries/education.jpg",
    description:
      "Transport solutions for schools, colleges and training providers.",
  },
  {
    title: "Arts & Antiques",
    image: "/images/industries/arts.jpg",
    description:
      "Careful transportation of valuable and delicate items.",
  },
  {
    title: "Utilities",
    image: "/images/industries/utilities.jpg",
    description:
      "Fast response delivery support for utility providers and contractors.",
  },
  {
    title: "Fast-Moving Consumer Goods",
    image: "/images/industries/fast.jpg",
    description:
      "Reliable logistics support for high-volume consumer products.",
  },
  {
    title: "Automotive",
    image: "/images/industries/automotive.jpg",
    description:
      "Parts, stock and business deliveries for the automotive sector.",
  },
  {
    title: "Wholesale",
    image: "/images/industries/wholesale.jpg",
    description:
      "Efficient movement of wholesale goods and business inventory.",
  },
];

export default function Industries() {
  return (
    <section className="bg-[#071D49] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-14 max-w-4xl text-center">
          <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
            Industries We Support
          </p>

          <h2 className="mb-6 text-4xl font-bold text-white lg:text-5xl">
            Courier Services Tailored To Your Industry
          </h2>

          <p className="text-lg leading-8 text-white/85 lg:text-xl">
            Streamline Logistics Group supports businesses across a wide range
            of sectors with dependable collection and delivery services
            throughout the United Kingdom.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {industries.map((industry) => (
            <div
              key={industry.title}
              className="group overflow-hidden rounded-3xl border border-[#1F4D94] bg-[#0B2A63] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-2xl"
            >
              <div className="relative h-52 overflow-hidden">
                <Image
                  src={industry.image}
                  alt={industry.title}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#020B1F]/70 via-transparent to-transparent" />
              </div>

              <div className="p-5">
                <h3 className="mb-3 text-lg font-bold text-white">
                  {industry.title}
                </h3>

                <p className="text-sm leading-6 text-white/75">
                  {industry.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <p className="mx-auto max-w-3xl text-lg leading-8 text-white/85">
            Don't see your industry listed? We work with businesses across many
            sectors and can tailor our collection and delivery services to your
            specific requirements.
          </p>
        </div>
      </div>
    </section>
  );
}