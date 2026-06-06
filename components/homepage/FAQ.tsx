"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { faqs } from "@/data/faq";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-[#F4F8FF] py-14 lg:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="rounded-3xl bg-gradient-to-br from-[#071D49] via-[#0B2A63] to-[#006CFF] p-7 text-white shadow-2xl lg:p-10">
          <div className="mb-4 text-5xl font-bold tracking-tight lg:mb-8 lg:text-7xl">
            FAQ
          </div>

          <p className="text-base leading-7 text-white/85 lg:text-2xl lg:leading-9">
            Clear answers for businesses booking urgent courier and delivery
            services with Streamline Logistics Group.
          </p>
        </div>

        <div>
          <h2 className="mb-5 border-b-4 border-[#006CFF] pb-3 text-3xl font-bold leading-tight text-[#071D49] lg:mb-8 lg:text-4xl">
            Streamline Logistics FAQ
          </h2>

          <div className="divide-y divide-[#D7E6FF] rounded-3xl border border-[#D7E6FF] bg-white px-6 shadow-lg">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;

              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-start justify-between gap-5 py-5 text-left lg:py-6"
                  >
                    <h3 className="text-xl font-semibold leading-7 text-[#071D49] lg:text-xl">
                      {faq.question}
                    </h3>

                    {isOpen ? (
                      <Minus
                        className="mt-1 shrink-0 text-[#006CFF]"
                        size={28}
                      />
                    ) : (
                      <Plus
                        className="mt-1 shrink-0 text-[#2D8CFF]"
                        size={28}
                      />
                    )}
                  </button>

                  {isOpen && (
                    <div className="pb-5">
                      <p className="max-w-2xl text-base leading-7 text-[#4B5D7A]">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}