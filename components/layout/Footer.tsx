import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#071D49] text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-14 md:grid-cols-4">
        <div>
          <Image
            src="/images/logos/Logo.png"
            alt="Streamline Logistics Group"
            width={190}
            height={70}
            className="mb-5 rounded-xl bg-white p-3"
          />

          <p className="text-base leading-7 text-white/80">
            Streamline Logistics Group provides fast, reliable and professional
            same-day courier support for businesses across the UK.
          </p>
        </div>

        <div>
          <h3 className="mb-5 text-lg font-bold text-[#2D8CFF]">
            Company
          </h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <Link
              href="/about"
              className="transition hover:text-[#2D8CFF]"
            >
              About Us
            </Link>

            <Link
              href="/contact"
              className="transition hover:text-[#2D8CFF]"
            >
              Contact Us
            </Link>

            <Link
              href="/faq"
              className="transition hover:text-[#2D8CFF]"
            >
              FAQ
            </Link>

            <Link
              href="/quote"
              className="transition hover:text-[#2D8CFF]"
            >
              Instant Quote
            </Link>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-lg font-bold text-[#2D8CFF]">
            Services
          </h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <Link
              href="/services/same-day-delivery"
              className="transition hover:text-[#2D8CFF]"
            >
              Same Day Delivery
            </Link>

            <Link
              href="/services/full-day-half-day-rates"
              className="transition hover:text-[#2D8CFF]"
            >
              Full Day & Half Day Rates
            </Link>

            <Link
              href="/services/multi-drop-delivery"
              className="transition hover:text-[#2D8CFF]"
            >
              Multi-Drop Delivery
            </Link>

            <Link
              href="/services/full-load"
              className="transition hover:text-[#2D8CFF]"
            >
              Full Load
            </Link>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-lg font-bold text-[#2D8CFF]">
            Contact
          </h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <a
              href="tel:03333440703"
              className="transition hover:text-[#2D8CFF]"
            >
              0333 344 0703
            </a>

            <a
              href="mailto:info@streamlinelogisticsgroup.co.uk"
              className="transition hover:text-[#2D8CFF]"
            >
              info@streamlinelogisticsgroup.co.uk
            </a>

            <span>Available 24/7 for urgent business deliveries</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1F4D94]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-7 text-sm text-white/70 md:flex-row">
          <p>© 2026 Streamline Logistics Group. All rights reserved.</p>

          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="transition hover:text-[#2D8CFF]"
            >
              Privacy
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-[#2D8CFF]"
            >
              Terms
            </Link>

            <Link
              href="/payments"
              className="transition hover:text-[#2D8CFF]"
            >
              Payments
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}