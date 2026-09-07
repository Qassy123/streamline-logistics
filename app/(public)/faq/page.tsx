import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleHelp,
  Clock3,
  CreditCard,
  MapPin,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Streamline Logistics Group",
  description:
    "Find answers to common questions about Streamline Logistics Group courier services, bookings, deliveries, tracking, payments and business accounts.",
};

const faqSections = [
  {
    title: "Booking & Courier Services",
    description:
      "Common questions about arranging a delivery and choosing the right service.",
    icon: Truck,
    questions: [
      {
        question: "What is a dedicated same-day courier service?",
        answer:
          "A dedicated same-day courier service means your goods are collected and delivered directly without being mixed with other shipments.",
      },
      {
        question: "What is your fastest courier service?",
        answer:
          "Our fastest service is urgent same-day delivery, designed for time-critical business transport.",
      },
      {
        question: "How do I book a delivery with Streamline Logistics?",
        answer:
          "You can request an instant quote online or contact our team directly to arrange a collection.",
      },
      {
        question: "How much notice do you need?",
        answer:
          "We can support urgent same-day jobs, but earlier booking gives more flexibility for vehicle availability and pricing.",
      },
      {
        question: "What can you transport?",
        answer:
          "We transport parcels, business goods, multi-drop loads, full-load consignments and urgent commercial deliveries.",
      },
      {
        question: "Can I book a return journey?",
        answer:
          "Yes. Our quote system supports return journeys as well as one-way deliveries.",
      },
      {
        question: "Can I arrange deliveries to multiple locations?",
        answer:
          "Yes. Multi-drop journeys can include additional delivery stops as part of the route.",
      },
    ],
  },
  {
    title: "Collections & Deliveries",
    description:
      "Information about locations, timings, vehicles and delivery requirements.",
    icon: MapPin,
    questions: [
      {
        question: "Where does Streamline Logistics operate?",
        answer:
          "Streamline Logistics Group provides business collection and delivery services across the United Kingdom.",
      },
      {
        question: "Can I choose my collection date and time?",
        answer:
          "Yes. During the quote process you can select the collection date and an available collection window.",
      },
      {
        question: "Can I choose the vehicle for my delivery?",
        answer:
          "The quote process allows you to select an appropriate vehicle option based on your delivery requirements and available capacity.",
      },
      {
        question: "What information should I provide about the goods?",
        answer:
          "You should provide clear information about what is being collected, the load requirements and any relevant handling or delivery instructions.",
      },
      {
        question: "Can I add special delivery instructions?",
        answer:
          "Yes. The booking process supports additional information such as special instructions and handover details where required.",
      },
      {
        question: "What happens if a vehicle is unavailable?",
        answer:
          "Vehicle availability depends on existing bookings and the collection time requested. Where a vehicle is unavailable, the booking system may show when that vehicle type becomes available again.",
      },
    ],
  },
  {
    title: "Tracking & Proof Of Delivery",
    description:
      "Questions about following an active delivery and confirming completion.",
    icon: Route,
    questions: [
      {
        question: "Can I track my delivery?",
        answer:
          "Streamline supports live delivery tracking for active jobs where tracking has been started by the assigned driver.",
      },
      {
        question: "How does delivery tracking work?",
        answer:
          "When tracking is active, location updates from the delivery journey can be made available through the secure tracking experience.",
      },
      {
        question: "Do you provide proof of delivery?",
        answer:
          "Yes. The Streamline delivery workflow supports proof of delivery when a job is completed.",
      },
      {
        question: "What information can be recorded at delivery?",
        answer:
          "The proof-of-delivery process can record delivery confirmation information including the recipient name and, where provided, supporting signature or photo information.",
      },
    ],
  },
  {
    title: "Accounts",
    description:
      "Information about business accounts, trade accounts and your Streamline dashboard.",
    icon: UserRound,
    questions: [
      {
        question: "Do I need an account to request a quote?",
        answer:
          "No. You can use the public quote process without first creating a business account.",
      },
      {
        question: "What is a Streamline business account?",
        answer:
          "A business account gives you access to the customer dashboard and features designed to help manage your bookings and account information.",
      },
      {
        question: "What can I access from my customer dashboard?",
        answer:
          "Depending on your account and activity, the dashboard provides access to areas including your profile, bookings, tracking, invoices and saved routes.",
      },
      {
        question: "Can I save routes I use regularly?",
        answer:
          "Yes. Signed-in customers can save routes so that commonly used journeys are easier to access again.",
      },
      {
        question: "What is a trade account?",
        answer:
          "A trade account is intended for eligible business customers who require additional account options for ongoing use. Trade account applications are subject to review and approval.",
      },
      {
        question: "Is a trade account approved automatically?",
        answer:
          "No. Trade account applications can be reviewed before an account is approved.",
      },
    ],
  },
  {
    title: "Quotes, Payments & Invoices",
    description:
      "Common questions about pricing, payment and your booking documents.",
    icon: CreditCard,
    questions: [
      {
        question: "How do I get a price for my delivery?",
        answer:
          "Enter your journey, vehicle, timing and delivery requirements through the online quote process to receive a price for the booking.",
      },
      {
        question: "What information affects my quote?",
        answer:
          "The quote is based on the delivery requirements entered during the booking process, including the journey and selected transport requirements.",
      },
      {
        question: "How can I pay for a booking?",
        answer:
          "Bookings that require online payment are paid through Streamline's secure checkout process.",
      },
      {
        question: "Will I receive an invoice?",
        answer:
          "Invoice information is created as part of the relevant payment and booking workflow and can be available through the customer account.",
      },
      {
        question: "Where can I view my invoices?",
        answer:
          "Signed-in customers can access the invoices area from their Streamline dashboard.",
      },
    ],
  },
];

const quickLinks = [
  {
    icon: Clock3,
    title: "Need A Delivery?",
    description:
      "Enter your journey and load requirements through our online quote system.",
    href: "/quote",
    action: "Get An Instant Quote",
  },
  {
    icon: Building2,
    title: "Need An Account?",
    description:
      "Create a Streamline business account for access to the customer dashboard.",
    href: "/register-business",
    action: "Create An Account",
  },
  {
    icon: CircleHelp,
    title: "Still Need Help?",
    description:
      "Contact Streamline if you cannot find the answer to your question here.",
    href: "/contact",
    action: "Contact Us",
  },
];

export default function FAQPage() {
  return (
    <>
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[#071D49] py-24 lg:py-32">
          <div className="absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#006CFF]/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#2D8CFF]/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/10 px-4 py-2">
                <CircleHelp size={18} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  Help & Support
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Frequently Asked Questions
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/85 sm:text-xl">
                Find answers to common questions about booking a courier,
                collections and deliveries, tracking, accounts, payments and
                using Streamline Logistics Group.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
                >
                  Get An Instant Quote
                  <ArrowRight size={20} />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-8 py-4 font-semibold text-white transition hover:bg-white/15"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Quick Help
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                What Do You Need Help With?
              </h2>

              <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                Browse the sections below or use one of these shortcuts to get
                where you need to go.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="flex flex-col rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8"
                  >
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Icon size={28} className="text-[#006CFF]" />
                    </div>

                    <h3 className="text-2xl font-bold text-[#071D49]">
                      {item.title}
                    </h3>

                    <p className="mt-4 flex-1 leading-7 text-[#4B5D7A]">
                      {item.description}
                    </p>

                    <Link
                      href={item.href}
                      className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
                    >
                      {item.action}
                      <ArrowRight size={18} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="space-y-16">
              {faqSections.map((section) => {
                const Icon = section.icon;

                return (
                  <section key={section.title}>
                    <div className="mb-8 flex items-start gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#006CFF]">
                        <Icon size={27} className="text-white" />
                      </div>

                      <div>
                        <h2 className="text-3xl font-bold text-[#071D49] sm:text-4xl">
                          {section.title}
                        </h2>

                        <p className="mt-2 leading-7 text-[#4B5D7A]">
                          {section.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {section.questions.map((faq) => (
                        <details
                          key={faq.question}
                          className="group overflow-hidden rounded-2xl border border-[#D7E6FF] bg-white shadow-sm"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 font-bold text-[#071D49] sm:px-7">
                            <span>{faq.question}</span>

                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-xl font-normal text-[#006CFF] transition group-open:rotate-45">
                              +
                            </span>
                          </summary>

                          <div className="border-t border-[#D7E6FF] px-6 py-5 sm:px-7">
                            <p className="leading-7 text-[#4B5D7A]">
                              {faq.answer}
                            </p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#071D49] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <PackageCheck size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Clear Load Information
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Provide accurate information about the goods being transported
                  when arranging your delivery.
                </p>
              </div>

              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <ShieldCheck size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Accurate Booking Details
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Check collection, delivery, contact and timing information
                  before confirming your booking.
                </p>
              </div>

              <div className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-8">
                <Route size={30} className="mb-5 text-[#2D8CFF]" />

                <h3 className="text-xl font-bold text-white">
                  Journey Requirements
                </h3>

                <p className="mt-3 leading-7 text-white/75">
                  Select the journey type that matches your requirements,
                  including one-way, return or multi-drop where applicable.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
              Need More Help?
            </p>

            <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
              Can't Find The Answer?
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#4B5D7A]">
              If your question is not covered here, contact Streamline Logistics
              Group and tell us what you need help with.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-bold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
              >
                Contact Us
                <ArrowRight size={20} />
              </Link>

              <Link
                href="/quote"
                className="inline-flex items-center justify-center rounded-full border border-[#D7E6FF] bg-[#F4F8FF] px-8 py-4 font-bold text-[#071D49] transition hover:border-[#006CFF]"
              >
                Get A Quote
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}