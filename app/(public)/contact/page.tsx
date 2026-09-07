import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Clock3,
  FileText,
  Headphones,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Truck,
  UserRound,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Contact Us | Streamline Logistics Group",
  description:
    "Contact Streamline Logistics Group for courier bookings, account support and business delivery enquiries across the United Kingdom.",
};

const contactOptions = [
  {
    icon: Truck,
    title: "New Delivery",
    description:
      "Need to arrange a collection and delivery? Use our online quote system to enter your journey and load requirements.",
    href: "/quote",
    action: "Get An Instant Quote",
  },
  {
    icon: UserRound,
    title: "Existing Customers",
    description:
      "Already have a Streamline account? Sign in to access your bookings, tracking, invoices and account information.",
    href: "/login",
    action: "Login To Your Account",
  },
  {
    icon: Building2,
    title: "Business Accounts",
    description:
      "Create a business account for access to the Streamline customer dashboard and ongoing booking management.",
    href: "/register-business",
    action: "Create Business Account",
  },
];

export default function ContactPage() {
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
                <MessageSquareText size={18} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  Contact Streamline
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                How Can We Help?
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/85 sm:text-xl">
                Whether you need to arrange a delivery, have a question about
                an existing booking or want to discuss your business logistics
                requirements, you can get in touch with Streamline Logistics
                Group.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="tel:03333440703"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
                >
                  <Phone size={20} />
                  0333 344 0703
                </a>

                <a
                  href="mailto:info@streamlinelogisticsgroup.co.uk"
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-white/25 bg-white/10 px-8 py-4 font-semibold text-white transition hover:bg-white/15"
                >
                  <Mail size={20} />
                  Email Us
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Get In Touch
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Contact Streamline Logistics Group
              </h2>

              <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                Choose the contact method that works best for you. For a new
                delivery, the fastest way to get started is through our instant
                quote system.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <a
                href="tel:03333440703"
                className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-xl"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Phone size={27} className="text-[#006CFF]" />
                </div>

                <p className="mb-2 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Call Us
                </p>

                <h3 className="text-2xl font-bold text-[#071D49]">
                  0333 344 0703
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  Speak to Streamline about your delivery or logistics
                  requirements.
                </p>
              </a>

              <a
                href="mailto:info@streamlinelogisticsgroup.co.uk"
                className="group rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#006CFF] hover:shadow-xl"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Mail size={27} className="text-[#006CFF]" />
                </div>

                <p className="mb-2 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Email Us
                </p>

                <h3 className="break-words text-xl font-bold text-[#071D49]">
                  info@streamlinelogisticsgroup.co.uk
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  Send us an email for general enquiries, account questions or
                  business logistics enquiries.
                </p>
              </a>

              <div className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Clock3 size={27} className="text-[#006CFF]" />
                </div>

                <p className="mb-2 text-sm font-bold uppercase tracking-[2px] text-[#006CFF]">
                  Urgent Deliveries
                </p>

                <h3 className="text-2xl font-bold text-[#071D49]">
                  Delivery Support
                </h3>

                <p className="mt-4 leading-7 text-[#4B5D7A]">
                  For urgent business delivery requirements, use our quote
                  system or contact us directly.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 max-w-3xl">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Where Do You Need Help?
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                Get To The Right Place Quickly
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {contactOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <article
                    key={option.title}
                    className="flex flex-col rounded-3xl border border-[#D7E6FF] bg-white p-8 shadow-sm"
                  >
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF]">
                      <Icon size={28} className="text-[#006CFF]" />
                    </div>

                    <h3 className="text-2xl font-bold text-[#071D49]">
                      {option.title}
                    </h3>

                    <p className="mt-4 flex-1 leading-7 text-[#4B5D7A]">
                      {option.description}
                    </p>

                    <Link
                      href={option.href}
                      className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
                    >
                      {option.action}
                      <ArrowRight size={18} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#071D49] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
                Before You Contact Us
              </p>

              <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                Information That Helps Us Understand Your Delivery
              </h2>

              <p className="mt-6 text-lg leading-8 text-white/75">
                Having the main journey and load details available can make it
                easier to understand what you need.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {[
                {
                  icon: MapPin,
                  title: "Collection & Delivery",
                  description:
                    "The collection and delivery locations for the journey.",
                },
                {
                  icon: Clock3,
                  title: "Date & Timing",
                  description:
                    "When the goods need to be collected and delivered.",
                },
                {
                  icon: FileText,
                  title: "Load Details",
                  description:
                    "What is being collected and any important handling information.",
                },
                {
                  icon: Truck,
                  title: "Journey Requirements",
                  description:
                    "Whether the job is one-way, return or requires multiple stops.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-7"
                  >
                    <Icon size={28} className="mb-5 text-[#2D8CFF]" />

                    <h3 className="text-xl font-bold text-white">
                      {item.title}
                    </h3>

                    <p className="mt-3 leading-7 text-white/75">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-[#D7E6FF] bg-[#F4F8FF] p-8 sm:p-10">
                <Headphones size={34} className="mb-6 text-[#006CFF]" />

                <h2 className="text-3xl font-bold text-[#071D49]">
                  Existing Booking?
                </h2>

                <p className="mt-5 text-lg leading-8 text-[#4B5D7A]">
                  If you already have an account, your dashboard provides
                  access to your bookings and other customer information.
                </p>

                <Link
                  href="/dashboard"
                  className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
                >
                  Go To Dashboard
                  <ArrowRight size={18} />
                </Link>
              </div>

              <div className="rounded-[2rem] border border-[#D7E6FF] bg-[#F4F8FF] p-8 sm:p-10">
                <MessageSquareText
                  size={34}
                  className="mb-6 text-[#006CFF]"
                />

                <h2 className="text-3xl font-bold text-[#071D49]">
                  General Question?
                </h2>

                <p className="mt-5 text-lg leading-8 text-[#4B5D7A]">
                  Our FAQ page will cover common questions about bookings,
                  deliveries, accounts, payments and using Streamline.
                </p>

                <Link
                  href="/faq"
                  className="mt-7 inline-flex items-center gap-2 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
                >
                  View FAQs
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] pb-24 pt-4">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071D49] via-[#0B2A63] to-[#006CFF] px-8 py-14 shadow-2xl sm:px-12 lg:px-16 lg:py-16">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2D8CFF]/30 blur-3xl" />

              <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[3px] text-[#7FB6FF]">
                    Ready To Book?
                  </p>

                  <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                    Get Your Delivery Quote
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-white/80">
                    Enter your collection, delivery and load requirements
                    through our online quote system.
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