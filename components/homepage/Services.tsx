import Link from "next/link";
import { Boxes, Clock3, Package, Route, Truck } from "lucide-react";
import { services } from "@/data/services";

const icons = [Truck, Clock3, Route, Package, Boxes];

const serviceLinks = [
  "/services/same-day-delivery",
  "/services/full-day-half-day-rates",
  "/services/multi-drop-delivery",
  "/services/parcel-delivery",
  "/services/full-load",
];

export default function Services() {
  return (
    <section className="bg-white pb-16 lg:pb-28">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-12 text-center lg:mb-16">
          <h2 className="mb-6 text-4xl font-light leading-tight text-[#ef1c24] lg:text-5xl">
            Our Transport Services
          </h2>

          <p className="mx-auto max-w-5xl text-lg leading-8 text-[#0b1f3a] sm:text-xl lg:text-2xl lg:leading-10">
            Whether you require an urgent same-day delivery or a dependable
            logistics partner, Streamline Logistics Group delivers professional
            transport solutions tailored to your business.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-6">
          {services.map((service, index) => {
            const Icon = icons[index];

            return (
              <Link
                key={service.title}
                href={serviceLinks[index]}
                className={`text-center ${
                  index < 3
                    ? "lg:col-span-2"
                    : index === 3
                    ? "lg:col-span-2 lg:col-start-2"
                    : "lg:col-span-2"
                }`}
              >
                <div className="group mb-4 flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#ff6a00] hover:shadow-2xl lg:min-h-[210px] lg:p-8">
                  <Icon
                    size={58}
                    className="mb-5 text-[#0b1f3a] transition group-hover:text-[#ff6a00] lg:size-[66px]"
                  />

                  <h3 className="text-xl font-medium leading-7 text-[#ef1c24] lg:text-2xl">
                    {service.title}
                  </h3>
                </div>

                <p className="px-2 text-base leading-7 text-[#0b1f3a] lg:text-lg">
                  {service.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}