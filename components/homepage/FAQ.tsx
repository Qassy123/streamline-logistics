"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { faqs } from "@/data/faq";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="rounded-3xl bg-[#0b1f3a] p-8 text-white lg:p-10">
          <div className="mb-5 text-5xl font-bold tracking-tight lg:mb-8 lg:text-7xl">
            FAQ
          </div>

          <p className="text-lg leading-8 text-white/85 lg:text-2xl lg:leading-9">
            Clear answers for businesses booking urgent courier and delivery
            services with Streamline Logistics Group.
          </p>
        </div>

        <div>
          <h2 className="mb-6 border-b-4 border-[#a8dc8f] pb-3 text-3xl font-semibold leading-tight text-[#0b1f3a] lg:mb-8 lg:text-4xl">
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
                  <div className="flex items-start justify-between gap-5">
                    <h3 className="text-xl font-medium leading-8 text-[#0b1f3a] lg:text-xl">
                      {faq.question}
                    </h3>

                    {isOpen ? (
                      <Minus
                        className="mt-1 shrink-0 text-[#ff6a00]"
                        size={28}
                      />
                    ) : (
                      <Plus
                        className="mt-1 shrink-0 text-[#a8dc8f]"
                        size={28}
                      />
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