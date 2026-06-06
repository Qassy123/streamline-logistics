import { CheckCircle } from "lucide-react";
import { reasons } from "@/data/promise";

export default function WhyChooseUs() {
  return (
    <section className="bg-[#071D49] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-4xl font-bold text-white lg:text-5xl">
          Why Choose Streamline Logistics?
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8 transition hover:border-[#006CFF]"
            >
              <div className="flex gap-4">
                <CheckCircle
                  size={30}
                  className="mt-1 shrink-0 text-[#006CFF]"
                />

                <p className="text-lg leading-8 text-white/90">
                  <span className="font-bold text-[#2D8CFF]">
                    {reason.title}:
                  </span>{" "}
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}