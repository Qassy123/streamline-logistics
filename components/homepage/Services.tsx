import Link from "next/link";
import { Boxes, Clock3, Route, Truck } from "lucide-react";
import { services } from "@/data/services";

const icons = [Truck, Clock3, Route, Boxes];

export default function Services() {
  return (
    <section className="bg-[#F4F8FF] py-16 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-12 text-center lg:mb-16">
          <h2 className="mb-6 text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
            Our Transport Services
          </h2>

          <p className="mx-auto max-w-5xl text-lg leading-8 text-[#3B4A66] sm:text-xl lg:text-2xl lg:leading-10">
            Whether you require an urgent same-day delivery or a dependable
            logistics partner, Streamline Logistics Group delivers professional
            transport solutions tailored to your business.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => {
            const Icon = icons[index];

            return (
              <Link
                key={service.title}
                href={service.link}
                className="group"
              >
                <div className="h-full rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#006CFF] hover:shadow-2xl">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#006CFF]">
                    <Icon
                      size={34}
                      className="text-white"
                    />
                  </div>

                  <h3 className="mb-4 text-2xl font-bold text-[#071D49]">
                    {service.title}
                  </h3>

                  <p className="mb-6 text-base leading-7 text-[#4B5D7A]">
                    {service.description}
                  </p>

                  <div className="inline-flex items-center font-semibold text-[#006CFF] transition group-hover:text-[#2D8CFF]">
                    Learn More →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}