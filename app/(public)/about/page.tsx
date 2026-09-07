import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "About Us | Streamline Logistics Group",
  description:
    "Learn more about Streamline Logistics Group and our business courier and logistics services across the United Kingdom.",
};

const strengths = [
  {
    icon: Clock3,
    title: "Time-Critical Support",
    description:
      "We support urgent and planned business deliveries where timing matters and standard delivery options may not be suitable.",
  },
  {
    icon: Route,
    title: "Flexible Journeys",
    description:
      "One-way, return and multi-drop journeys allow businesses to arrange transport around the actual requirements of each job.",
  },
  {
    icon: Truck,
    title: "Vehicle Options",
    description:
      "Vehicle capacity can be selected around the size and requirements of the goods being transported.",
  },
  {
    icon: MapPin,
    title: "UK-Wide Coverage",
    description:
      "We support business collections and deliveries across the United Kingdom.",
  },
];

const values = [
  "Clear and straightforward booking",
  "Professional business communication",
  "Reliable collection and delivery support",
  "Practical transport solutions",
  "Visibility throughout active jobs",
  "Proof of delivery",
];

export default function AboutPage() {
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
                <Building2 size={18} className="text-[#7FB6FF]" />
                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  About Streamline
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Business Logistics Built Around The Job
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/85 sm:text-xl">
                Streamline Logistics Group provides flexible courier and
                transport support for businesses that need goods collected,
                moved and delivered reliably across the United Kingdom.
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
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Who We Are
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                A Practical Logistics Partner For UK Businesses
              </h2>
            </div>

            <div className="space-y-5 text-lg leading-8 text-[#4B5D7A]">
              <p>
                Streamline Logistics Group supports businesses that need a more
                direct and flexible approach to collection and delivery.
              </p>

              <p>
                Our service is designed around real operational requirements,
                from urgent same-day collections to planned deliveries,
                multi-drop routes and return journeys.
              </p>

              <p>
                Customers can enter their route, load and timing requirements,
                receive a quote and manage the delivery journey through the
                Streamline platform.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                What We Focus On
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Transport That Works Around Your Business
              </h2>

              <p className="mt-5 text-lg leading-8 text-[#4B5D7A]">
                Every booking has different requirements. Our platform is built
                to support different routes, timings, vehicles and delivery
                needs without making the process unnecessarily complicated.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {strengths.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-[#D7E6FF] bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF]">
                      <Icon size={28} className="text-[#006CFF]" />
                    </div>

                    <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                      {item.title}
                    </h3>

                    <p className="leading-7 text-[#4B5D7A]">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#071D49] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
                  How It Works
                </p>

                <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                  A Straightforward Delivery Process
                </h2>

                <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
                  From quote to delivery, the process is designed to keep
                  business transport simple and visible.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  {
                    number: "01",
                    title: "Enter Your Requirements",
                    description:
                      "Add collection, delivery, load, timing and journey details.",
                  },
                  {
                    number: "02",
                    title: "Receive Your Quote",
                    description:
                      "The platform calculates the journey and available transport options.",
                  },
                  {
                    number: "03",
                    title: "Collection & Tracking",
                    description:
                      "The assigned delivery can progress through collection and active tracking.",
                  },
                  {
                    number: "04",
                    title: "Delivery Completion",
                    description:
                      "The job is completed with delivery confirmation and proof of delivery support.",
                  },
                ].map((step) => (
                  <div
                    key={step.number}
                    className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-7"
                  >
                    <span className="text-sm font-bold tracking-[2px] text-[#2D8CFF]">
                      {step.number}
                    </span>

                    <h3 className="mt-6 text-xl font-bold text-white">
                      {step.title}
                    </h3>

                    <p className="mt-3 leading-7 text-white/75">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Our Approach
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                Built Around Reliability, Visibility And Simplicity
              </h2>

              <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                We aim to make business transport easier to arrange and easier
                to follow, while giving customers the flexibility to book the
                journey type that fits the actual requirement.
              </p>

              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                {values.map((value) => (
                  <div key={value} className="flex items-start gap-3">
                    <CheckCircle2
                      size={22}
                      className="mt-0.5 shrink-0 text-[#006CFF]"
                    />

                    <span className="font-medium leading-6 text-[#071D49]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-[#F4F8FF] p-8 sm:p-10">
              <div className="grid gap-6">
                <div className="rounded-3xl border border-[#D7E6FF] bg-white p-7">
                  <Users size={30} className="mb-5 text-[#006CFF]" />

                  <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                    Business Customers
                  </h3>

                  <p className="leading-7 text-[#4B5D7A]">
                    Business accounts can manage bookings and access the
                    customer dashboard.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#D7E6FF] bg-white p-7">
                  <PackageCheck size={30} className="mb-5 text-[#006CFF]" />

                  <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                    Trade Customers
                  </h3>

                  <p className="leading-7 text-[#4B5D7A]">
                    Approved trade accounts can access additional account
                    options designed for ongoing business use.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#D7E6FF] bg-white p-7">
                  <ShieldCheck size={30} className="mb-5 text-[#006CFF]" />

                  <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                    Delivery Visibility
                  </h3>

                  <p className="leading-7 text-[#4B5D7A]">
                    Active delivery workflows support tracking and proof of
                    delivery so customers can follow the progress of a job.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Industries We Support
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Supporting Businesses Across Multiple Sectors
              </h2>

              <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                Streamline supports businesses across construction, aviation,
                hospitality, automotive, events, education, utilities,
                professional services and many other sectors.
              </p>

              <Link
                href="/#industries"
                className="mt-8 inline-flex items-center gap-3 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
              >
                Explore Industries
                <ArrowRight size={19} />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white pb-24 pt-4">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071D49] via-[#0B2A63] to-[#006CFF] px-8 py-14 shadow-2xl sm:px-12 lg:px-16 lg:py-16">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2D8CFF]/30 blur-3xl" />

              <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#7FB6FF]">
                    Need A Delivery?
                  </p>

                  <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                    Build Your Quote Online
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-white/80">
                    Enter your collection, delivery and load requirements to get
                    started.
                  </p>
                </div>

                <Link
                  href="/quote"
                  className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-white px-8 py-4 font-bold text-[#071D49] transition hover:-translate-y-1"
                >
                  Get An Instant Quote
                  <ArrowRight size={20} className="text-[#006CFF]" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}