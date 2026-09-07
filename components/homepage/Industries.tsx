import Image from "next/image";
import Link from "next/link";

const industries = [
  {
    title: "Construction",
    href: "/industries/construction",
    image: "/images/industries/construction.jpg",
    description:
      "Urgent site deliveries, materials, tools and project support logistics.",
  },
  {
    title: "Aviation",
    href: "/industries/aviation",
    image: "/images/industries/aviation.jpg",
    description:
      "Time-critical collections and deliveries for aviation businesses.",
  },
  {
    title: "Hospitality",
    href: "/industries/hospitality",
    image: "/images/industries/hospitality.jpg",
    description:
      "Reliable transport support for venues, suppliers and hospitality groups.",
  },
  {
    title: "Farming",
    href: "/industries/farming",
    image: "/images/industries/farming.jpg",
    description:
      "Dependable movement of supplies and equipment across agricultural operations.",
  },
  {
    title: "Marketing & Print",
    href: "/industries/marketing-print",
    image: "/images/industries/marketing.jpg",
    description:
      "Printed materials, displays and campaign assets delivered on schedule.",
  },
  {
    title: "Pharmaceutical & Medical",
    href: "/industries/pharmaceutical-medical",
    image: "/images/industries/pharmacy.jpg",
    description:
      "Professional handling of medical supplies and business-critical deliveries.",
  },
  {
    title: "Film & Production",
    href: "/industries/film-production",
    image: "/images/industries/film.jpg",
    description:
      "Equipment, props and production assets transported safely and efficiently.",
  },
  {
    title: "Events",
    href: "/industries/events",
    image: "/images/industries/event.jpg",
    description:
      "Supporting events with dependable collection and delivery services.",
  },
  {
    title: "Professional Services",
    href: "/industries/professional-services",
    image: "/images/industries/professional.jpg",
    description:
      "Secure document, parcel and office logistics support.",
  },
  {
    title: "Education",
    href: "/industries/education",
    image: "/images/industries/education.jpg",
    description:
      "Transport solutions for schools, colleges and training providers.",
  },
  {
    title: "Arts & Antiques",
    href: "/industries/arts-antiques",
    image: "/images/industries/arts.jpg",
    description:
      "Careful transportation of valuable and delicate items.",
  },
  {
    title: "Utilities",
    href: "/industries/utilities",
    image: "/images/industries/utilities.jpg",
    description:
      "Fast response delivery support for utility providers and contractors.",
  },
  {
    title: "Fast-Moving Consumer Goods",
    href: "/industries/fmcg",
    image: "/images/industries/fast.jpg",
    description:
      "Reliable logistics support for high-volume consumer products.",
  },
  {
    title: "Automotive",
    href: "/industries/automotive",
    image: "/images/industries/automotive.jpg",
    description:
      "Parts, stock and business deliveries for the automotive sector.",
  },
  {
    title: "Wholesale",
    href: "/industries/wholesale",
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
            <Link
              key={industry.title}
              href={industry.href}
              aria-label={`View ${industry.title} courier services`}
              className="group block overflow-hidden rounded-3xl border border-[#1F4D94] bg-[#0B2A63] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D8CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071D49]"
            >
              <div className="relative h-52 overflow-hidden">
                <Image
                  src={industry.image}
                  alt={industry.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
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
            </Link>
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