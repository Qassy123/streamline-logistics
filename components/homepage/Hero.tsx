"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://streamline-logistics-production.up.railway.app";

export default function Hero() {
  const [websiteDowntime, setWebsiteDowntime] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshStatus() {
      try {
        const response = await fetch(
          API_BASE_URL + "/api/admin/settings/downtime",
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok || typeof data.websiteDowntime !== "boolean") return;
        if (active) {
          setWebsiteDowntime(data.websiteDowntime);
          if (!data.websiteDowntime) setShowPhoneNumber(false);
        }
      } catch {
        // Preserve the last known status; the quote backend also enforces downtime.
      }
    }
    void refreshStatus();
    const interval = window.setInterval(() => { void refreshStatus(); }, 30000);
    window.addEventListener("focus", refreshStatus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshStatus);
    };
  }, []);

  return (
    <>
      {websiteDowntime && (
        <section aria-labelledby="homepage-maintenance-title" className="bg-[#F4F8FF] px-6 py-6 sm:py-8">
          <div role="status" className="mx-auto max-w-6xl rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-800">Website maintenance</p>
                <h2 id="homepage-maintenance-title" className="text-xl font-bold leading-snug text-[#071D49] sm:text-2xl">
                  call to get a quote site under maintance temporarily
                </h2>
                <p className="mt-3 text-base leading-7 text-[#071D49]/80">
                  You can still browse our services. Call our team for a quote while online quoting is temporarily unavailable.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-3">
                <button
                  type="button"
                  aria-expanded={showPhoneNumber}
                  aria-controls="homepage-maintenance-phone"
                  onClick={() => setShowPhoneNumber((visible) => !visible)}
                  className="rounded-full bg-[#006CFF] px-8 py-4 text-base font-bold text-white transition hover:bg-[#071D49] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#006CFF]"
                >
                  {showPhoneNumber ? "Hide number" : "Call for a quote"}
                </button>
                <div id="homepage-maintenance-phone" hidden={!showPhoneNumber}>
                  <a href="tel:03333440703" className="text-xl font-bold text-[#071D49] underline underline-offset-4">
                    0333 344 0703
                  </a>
                  <p className="mt-1 text-sm text-[#071D49]/80">Tap the number to call.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    <section className="relative w-full overflow-hidden bg-[#071D49]">
      <div
        className="absolute inset-0 bg-cover bg-center lg:scale-105"
        style={{
          backgroundImage: "url('/images/hero/hero-bg.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#020B1F]/95 via-[#071D49]/72 to-[#071D49]/10" />

      <div className="relative z-10 mx-auto flex min-h-[560px] max-w-[1500px] items-center px-6 py-12 sm:min-h-[600px] sm:py-16 lg:min-h-[650px] lg:px-10 lg:py-16">
        <div className="max-w-[650px] text-white">
          <p className="mb-4 text-sm font-bold uppercase tracking-[2px] text-[#006CFF] lg:mb-5 lg:text-base lg:tracking-[3px]">
            24/7 Same Day Courier Specialists
          </p>

          <h1 className="mb-6 text-4xl font-bold leading-[1.12] sm:text-5xl lg:mb-7 lg:text-[56px]">
            Fast, Reliable, Dependable Business to Business Same Day Delivery
          </h1>

          <p className="mb-8 max-w-[580px] text-base leading-7 text-white/90 sm:text-lg lg:mb-9">
            Streamline Logistics Group based in the West Midlands provides
            dependable collection and delivery services for businesses across
            the UK. From urgent same-day consignments to multi-drop and next-day
            deliveries, we ensure your goods reach their destination safely and
            on time.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/quote"
              className="rounded-full bg-[#006CFF] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#2D8CFF]"
            >
              Get Instant Quote
            </Link>

            <Link
              href="/about"
              className="rounded-full border border-white/70 px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-white hover:text-[#071D49]"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="/quote"
        className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 rounded-l-3xl border-l border-t border-b border-[#2D8CFF] bg-[#006CFF] px-5 py-12 text-sm font-semibold text-white [writing-mode:vertical-rl] transition hover:bg-[#2D8CFF] lg:block"
      >
        Get A Quote
      </Link>
    </section>
    </>
  );
}