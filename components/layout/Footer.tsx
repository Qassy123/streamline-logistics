import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0b1f3a] text-white">
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
          <h3 className="mb-5 text-lg font-semibold">Company</h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <Link href="/about">About Us</Link>
            <Link href="/contact">Contact Us</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/instant-quote">Instant Quote</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-lg font-semibold">Services</h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <span>Same Day Delivery</span>
            <span>Full Day & Half Day Rates</span>
            <span>Multi-Drop Delivery</span>
            <span>Parcel Delivery</span>
            <span>Full Load</span>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-lg font-semibold">Contact</h3>

          <div className="flex flex-col gap-3 text-base text-white/80">
            <a href="tel:03333440703">0333 344 0703</a>

            <a href="mailto:info@streamlinelogisticsgroup.co.uk">
              info@streamlinelogisticsgroup.co.uk
            </a>

            <span>
              Available 24/7 for urgent business deliveries
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-7 text-sm text-white/70 md:flex-row">
          <p>
            © 2026 Streamline Logistics Group. All rights reserved.
          </p>

          <div className="flex gap-6">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/payments">Payments</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}