import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative h-[620px] w-full overflow-hidden bg-[#0b1f3a] lg:h-[650px]">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center lg:bg-center"
        style={{
          backgroundImage: "url('/images/hero/hero-bg.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1500px] items-center px-6 lg:px-10">
        <div className="max-w-[650px] text-white">
          <p className="mb-4 text-sm font-bold uppercase tracking-[2px] text-[#ff7f11] lg:mb-5 lg:text-base lg:tracking-[3px]">
            Business To Business Courier Services
          </p>

          <h1 className="mb-6 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:mb-7 lg:text-6xl">
            Fast, Reliable Deliveries When Your Business Needs Them Most
          </h1>

          <p className="mb-8 max-w-[580px] text-lg leading-8 text-white/95 sm:text-xl lg:mb-9 lg:text-2xl lg:leading-9">
            Streamline Logistics Group provides dependable collection and
            delivery services for businesses across the UK. From urgent
            same-day consignments to multi-drop and full-load deliveries, we
            ensure your goods reach their destination safely and on time.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/instant-quote"
              className="rounded-full bg-[#ef1c24] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#ff6a00]"
            >
              Get Instant Quote
            </Link>

            <Link
              href="/about"
              className="rounded-full border border-white px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-white hover:text-[#0b1f3a]"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="/instant-quote"
        className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 rounded-l-3xl bg-[#a8dc8f] px-5 py-12 text-sm font-semibold text-[#0b1f3a] [writing-mode:vertical-rl] lg:block"
      >
        Get A Quote
      </Link>
    </section>
  );
}