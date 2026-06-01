import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getServicePage, servicePages } from "@/data/service-pages";
import { ArrowRight, CheckCircle, Phone } from "lucide-react";

type ServicePageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return servicePages.map((service) => ({
    slug: service.slug,
  }));
}

export default function ServicePage({ params }: ServicePageProps) {
  const service = getServicePage(params.slug);

  if (!service) {
    notFound();
  }

  return (
    <>
      <Header />

      <main>
        <section className="bg-gradient-to-r from-[#0b1f3a] via-[#102d52] to-[#ef1c24] py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-4 text-sm font-bold uppercase tracking-[3px] text-[#ff7f11]">
              Streamline Logistics Services
            </p>

            <h1 className="mb-6 max-w-4xl text-5xl font-semibold leading-tight lg:text-6xl">
              {service.heroTitle}
            </h1>

            <p className="max-w-3xl text-xl leading-9 text-white/90">
              {service.intro}
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/instant-quote"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#ef1c24] px-8 py-4 font-semibold text-white transition hover:bg-[#ff6a00]"
              >
                Get Instant Quote
                <ArrowRight size={20} />
              </Link>

              <a
                href="tel:03333440703"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-[#0b1f3a]"
              >
                <Phone size={20} />
                Call Us
              </a>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-[1fr_360px]">
            <div>
              <h2 className="mb-8 text-4xl font-light text-[#ef1c24] lg:text-5xl">
                {service.title}
              </h2>

              <p className="mb-12 text-xl leading-9 text-[#0b1f3a]">
                {service.shortDescription}
              </p>

              <div className="space-y-10">
                {service.sections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                  >
                    <div className="mb-4 flex items-center gap-4">
                      <CheckCircle className="text-[#ff6a00]" size={30} />

                      <h3 className="text-2xl font-semibold text-[#0b1f3a]">
                        {section.title}
                      </h3>
                    </div>

                    <p className="text-lg leading-8 text-gray-700">
                      {section.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-3xl bg-[#f8f8f8] p-8">
              <h3 className="mb-6 text-2xl font-semibold text-[#0b1f3a]">
                Our Services
              </h3>

              <div className="flex flex-col gap-3">
                {servicePages.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/services/${item.slug}`}
                    className={`rounded-xl px-5 py-4 font-medium transition ${
                      item.slug === service.slug
                        ? "bg-[#ef1c24] text-white"
                        : "bg-white text-[#0b1f3a] hover:bg-[#ff6a00] hover:text-white"
                    }`}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-[#0b1f3a] p-6 text-white">
                <h4 className="mb-3 text-xl font-semibold">
                  Need this service today?
                </h4>

                <p className="mb-5 text-white/80">
                  Send us your collection and drop-off details.
                </p>

                <Link
                  href="/instant-quote"
                  className="inline-flex rounded-full bg-[#ef1c24] px-6 py-3 font-semibold text-white transition hover:bg-[#ff6a00]"
                >
                  Start Quote
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}