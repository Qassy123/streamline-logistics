"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { faqs } from "@/data/faq";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-white pb-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-[#0b1f3a] p-10 text-white">
          <div className="mb-8 text-7xl font-bold tracking-tight">FAQ</div>

          <p className="text-2xl leading-9 text-white/85">
            Clear answers for businesses booking urgent courier and delivery
            services with Streamline Logistics Group.
          </p>
        </div>

        <div>
          <h2 className="mb-8 border-b-4 border-[#a8dc8f] pb-3 text-4xl font-semibold text-[#0b1f3a]">
            Streamline Logistics FAQ
          </h2>

          <div className="divide-y divide-gray-200">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;

              return (
                <button
                  key={faq.question}
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full py-5 text-left"
                >
                  <div className="flex items-center justify-between gap-6">
                    <h3 className="text-xl font-medium text-[#0b1f3a]">
                      {faq.question}
                    </h3>

                    {isOpen ? (
                      <Minus className="shrink-0 text-[#ff6a00]" size={30} />
                    ) : (
                      <Plus className="shrink-0 text-[#a8dc8f]" size={30} />
                    )}
                  </div>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}