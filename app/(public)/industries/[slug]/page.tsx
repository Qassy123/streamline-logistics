import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getIndustryBySlug, industries } from "@/data/industries";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return industries.map((industry) => ({
    slug: industry.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustryBySlug(slug);

  if (!industry) {
    return {
      title: "Industry Not Found | Streamline Logistics Group",
    };
  }

  return {
    title: `${industry.heroTitle} | Streamline Logistics Group`,
    description: industry.heroDescription,
  };
}

export default async function IndustryPage({ params }: PageProps) {
  const { slug } = await params;
  const industry = getIndustryBySlug(slug);

  if (!industry) {
    notFound();
  }

  const otherIndustries = industries
    .filter((item) => item.slug !== industry.slug)
    .slice(0, 3);

  return (
    <>
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[#071D49]">
          <div className="absolute inset-0">
            <Image
              src={industry.image}
              alt=""
              fill
              priority
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-[#071D49] via-[#071D49]/95 to-[#071D49]/55" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071D49] via-transparent to-transparent" />
          </div>

          <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/10 px-4 py-2">
                <Truck size={17} className="text-[#7FB6FF]" />

                <span className="text-sm font-bold uppercase tracking-[2px] text-[#7FB6FF]">
                  {industry.eyebrow}
                </span>
              </div>

              <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                {industry.heroTitle}
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
                {industry.heroDescription}
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#006CFF] px-8 py-4 font-semibold text-white transition hover:-translate-y-1 hover:bg-[#2D8CFF]"
                >
                  Get An Instant Quote
                  <ArrowRight size={20} />
                </Link>

                <a
                  href="tel:03333440703"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-8 py-4 font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  0333 344 0703
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Built Around Your Business
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                {industry.introTitle}
              </h2>
            </div>

            <div className="space-y-5 text-lg leading-8 text-[#4B5D7A]">
              {industry.introParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                What We Can Move
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Transport Support For Your Industry
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {industry.transportItems.map((item, index) => {
                const icons = [Wrench, PackageCheck, Truck, FileCheck2];
                const Icon = icons[index % icons.length];

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
            <div className="mb-14 max-w-3xl">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#2D8CFF]">
                Straightforward From Start To Finish
              </p>

              <h2 className="text-4xl font-bold text-white lg:text-5xl">
                Book. Collect. Track. Deliver.
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  number: "01",
                  title: "Book",
                  text: "Enter the journey, load and collection requirements through the quote system.",
                },
                {
                  number: "02",
                  title: "Collect",
                  text: "The assigned vehicle collects from the supplier, site, depot or other suitable business location.",
                },
                {
                  number: "03",
                  title: "Track",
                  text: "Operational tracking keeps the delivery journey visible while the booking is in progress.",
                },
                {
                  number: "04",
                  title: "Deliver",
                  text: "The goods reach the required destination and the job can be completed with proof of delivery.",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="rounded-3xl border border-[#1F4D94] bg-[#0B2A63] p-7"
                >
                  <span className="text-sm font-bold tracking-[2px] text-[#2D8CFF]">
                    {step.number}
                  </span>

                  <h3 className="mt-8 text-2xl font-bold text-white">
                    {step.title}
                  </h3>

                  <p className="mt-4 leading-7 text-white/75">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                  Flexible Delivery Options
                </p>

                <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                  Logistics That Fits The Job
                </h2>

                <p className="mt-6 text-lg leading-8 text-[#4B5D7A]">
                  Streamline supports different journey types so transport can
                  be arranged around the actual operational requirement.
                </p>

                <Link
                  href="/quote"
                  className="mt-8 inline-flex items-center gap-3 font-bold text-[#006CFF] transition hover:text-[#2D8CFF]"
                >
                  Build Your Quote
                  <ArrowRight size={19} />
                </Link>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {industry.services.map((service, index) => {
                  const icons = [Clock3, Route, RefreshCw, Truck];
                  const Icon = icons[index % icons.length];

                  return (
                    <div
                      key={service.title}
                      className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-7"
                    >
                      <Icon size={31} className="mb-5 text-[#006CFF]" />

                      <h3 className="mb-3 text-xl font-bold text-[#071D49]">
                        {service.title}
                      </h3>

                      <p className="leading-7 text-[#4B5D7A]">
                        {service.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
            <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] shadow-xl">
              <Image
                src={industry.image}
                alt={`${industry.title} logistics support`}
                fill
                className="object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#071D49]/75 via-transparent to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 font-semibold text-[#071D49] shadow-lg">
                  <ShieldCheck size={21} className="text-[#006CFF]" />
                  Professional business transport
                </div>
              </div>
            </div>

            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Why Streamline
              </p>

              <h2 className="text-4xl font-bold leading-tight text-[#071D49] lg:text-5xl">
                Delivery Support Built Around Your Operation
              </h2>

              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                {industry.benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#006CFF]">
                      <Check size={14} className="text-white" />
                    </div>

                    <span className="font-medium leading-6 text-[#071D49]">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                Real Business Requirements
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                When A Standard Delivery Is Not Enough
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {industry.scenarios.map((scenario, index) => (
                <article
                  key={scenario.title}
                  className="relative overflow-hidden rounded-3xl border border-[#D7E6FF] p-8"
                >
                  <div className="absolute right-5 top-3 text-7xl font-black text-[#EAF2FF]">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="relative">
                    <MapPin size={30} className="mb-8 text-[#006CFF]" />

                    <h3 className="mb-4 text-2xl font-bold leading-tight text-[#071D49]">
                      {scenario.title}
                    </h3>

                    <p className="leading-7 text-[#4B5D7A]">
                      {scenario.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FF] py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                {industry.shortTitle ?? industry.title} FAQ
              </p>

              <h2 className="text-4xl font-bold text-[#071D49] lg:text-5xl">
                Common Questions
              </h2>
            </div>

            <div className="space-y-4">
              {industry.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border border-[#D7E6FF] bg-white p-6 open:shadow-lg"
                >
                  <summary className="flex list-none items-center justify-between gap-6 font-bold text-[#071D49]">
                    <span>{faq.question}</span>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-xl text-[#006CFF] transition group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <p className="mt-5 max-w-3xl leading-7 text-[#4B5D7A]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12">
              <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#006CFF]">
                More Industries
              </p>

              <h2 className="text-4xl font-bold text-[#071D49]">
                Supporting Businesses Across The UK
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {otherIndustries.map((otherIndustry) => (
                <Link
                  key={otherIndustry.slug}
                  href={`/industries/${otherIndustry.slug}`}
                  className="group relative min-h-[320px] overflow-hidden rounded-3xl"
                >
                  <Image
                    src={otherIndustry.image}
                    alt={otherIndustry.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#071D49] via-[#071D49]/25 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-7">
                    <h3 className="text-2xl font-bold text-white">
                      {otherIndustry.title}
                    </h3>

                    <div className="mt-3 inline-flex items-center gap-2 font-semibold text-[#7FB6FF]">
                      View Industry
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </Link>
              ))}
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
                    Ready To Book
                  </p>

                  <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                    Need Something Moved?
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-white/80">
                    Enter your collection, delivery and load details to build
                    your Streamline quote.
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