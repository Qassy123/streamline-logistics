import { CheckCircle } from "lucide-react";
import { reasons } from "@/data/promise";

export default function WhyChooseUs() {
  return (
    <section className="bg-white pb-16 lg:pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="mb-10 text-center text-4xl font-light leading-tight text-[#ef1c24] lg:mb-12 lg:text-5xl">
          Why Choose Streamline Logistics?
        </h2>

        <div className="space-y-6">
          {reasons.map((reason) => (
            <div key={reason.title} className="flex gap-4 lg:gap-5">
              <CheckCircle
                size={30}
                className="mt-1 shrink-0 text-[#ff6a00]"
              />

              <p className="text-lg leading-8 text-[#0b1f3a] lg:text-2xl lg:leading-9">
                <span className="font-semibold text-[#ef1c24]">
                  {reason.title}:
                </span>{" "}
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}