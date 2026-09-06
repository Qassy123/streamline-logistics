"use client";

import Link from "next/link";
import {
  BadgePoundSterling,
  CircleDollarSign,
  Gauge,
  Percent,
  ReceiptText,
  Tags,
} from "lucide-react";

const cards = [
  {
    href: "/admin/pricing/base-fares",
    title: "Base Fares",
    description:
      "Set the base fare for each vehicle tariff and control whether VAT applies.",
    icon: CircleDollarSign,
  },
  {
    href: "/admin/pricing/mileage",
    title: "Mileage",
    description:
      "Manage mileage bands and the price-per-mile rate attached to each tariff.",
    icon: Gauge,
  },
  {
    href: "/admin/pricing/charges",
    title: "Charges",
    description:
      "Manage added stops, waiting charges, surcharges and other additional charges.",
    icon: ReceiptText,
  },
  {
    href: "/admin/pricing/discounts",
    title: "Discounts",
    description:
      "Manage fixed amount, percentage, customer loyalty and promotional discounts.",
    icon: Percent,
  },
];

export default function AdminPricingPage() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Tab 10
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Pricing / Tariff
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          Manage the pricing controls used by the admin team. Live quote-engine
          pricing is not being changed as part of this Tab 10 update.
        </p>
      </div>

      <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#E55300]">
              <Icon size={23} />
            </span>
            <h2 className="mt-5 text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#E55300]">
            <Tags size={23} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Refunds + Credits
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The manual includes the following adjustment types. These are
              shown here as part of Tab 10, but no new live refund-processing
              logic is being added in this pass.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                "Partial Refund",
                "Full Refund",
                "Goodwill Credit",
                "Credit Note",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <BadgePoundSterling
                      size={18}
                      className="shrink-0 text-[#E55300]"
                    />
                    <span className="text-sm font-bold text-slate-900">
                      {item}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
