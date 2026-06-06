import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-[720px] w-full overflow-hidden bg-[#062015] sm:min-h-[760px] lg:h-[650px] lg:min-h-0">
      <div
        className="absolute inset-0 bg-cover bg-[center_center] lg:scale-105 lg:bg-center"
        style={{
          backgroundImage: "url('/images/hero/hero-bg.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#03130d]/95 via-[#062015]/75 to-[#062015]/25" />

      <div className="relative z-10 mx-auto flex min-h-[720px] max-w-[1500px] items-center px-6 py-12 sm:min-h-[760px] lg:h-full lg:min-h-0 lg:px-10 lg:py-0">
        <div className="max-w-[650px] text-white">
          <p className="mb-4 text-sm font-bold uppercase tracking-[2px] text-[#fb923c] lg:mb-5 lg:text-base lg:tracking-[3px]">
            Business To Business Courier Services
          </p>

          <h1 className="mb-6 text-[42px] font-semibold leading-[1.08] sm:text-5xl lg:mb-7 lg:text-6xl">
            Fast, Reliable Deliveries When Your Business Needs Them Most
          </h1>

          <p className="mb-8 max-w-[580px] text-[20px] leading-8 text-white/95 sm:text-xl lg:mb-9 lg:text-2xl lg:leading-9">
            Streamline Logistics Group provides dependable collection and
            delivery services for businesses across the UK. From urgent
            same-day consignments to multi-drop and full-load deliveries, we
            ensure your goods reach their destination safely and on time.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/quote"
              className="rounded-full bg-[#f97316] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#15803d]"
            >
              Get Instant Quote
            </Link>

            <Link
              href="/about"
              className="rounded-full border border-white px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-white hover:text-[#062015]"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="/quote"
        className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 rounded-l-3xl bg-[#22c55e] px-5 py-12 text-sm font-semibold text-[#062015] [writing-mode:vertical-rl] transition hover:bg-[#f97316] lg:block"
      >
        Get A Quote
      </Link>
    </section>
  );
}