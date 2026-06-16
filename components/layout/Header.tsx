"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Phone, Search } from "lucide-react";
import { useState } from "react";
import MobileMenu from "@/components/layout/MobileMenu";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#071D49] shadow-sm">
        <div className="mx-auto flex h-[86px] max-w-[1700px] items-center justify-between gap-4 px-4 sm:h-[96px] sm:px-6 lg:h-[120px] lg:gap-8 lg:px-10">
          <Link
            href="/"
            className="flex h-full w-[270px] shrink-0 items-center sm:w-[330px] md:w-[380px] lg:w-[480px]"
            aria-label="Streamline Logistics Group home"
          >
            <Image
              src="/images/logos/header-logo.png"
              alt="Streamline Logistics Group"
              width={480}
              height={120}
              priority
              className="h-auto w-full object-contain"
            />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-12 lg:flex">
            <Link href="/" className="font-medium text-[#006CFF]">
              Home
            </Link>

            <Link
              href="/quote"
              className="font-medium text-white transition hover:text-[#2D8CFF]"
            >
              Instant Quote
            </Link>

            <Link
              href="/about"
              className="font-medium text-white transition hover:text-[#2D8CFF]"
            >
              About Us
            </Link>

            <Link
              href="/contact"
              className="font-medium text-white transition hover:text-[#2D8CFF]"
            >
              Contact
            </Link>
          </nav>

          <div className="hidden w-[380px] shrink-0 items-center justify-end gap-6 lg:flex">
            <a
              href="tel:03333440703"
              className="flex items-center gap-2 whitespace-nowrap font-medium text-white"
            >
              <Phone size={18} className="text-[#006CFF]" />
              0333 344 0703
            </a>

            <Link
              href="/payments"
              className="whitespace-nowrap rounded-full bg-[#006CFF] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#2D8CFF]"
            >
              Make Payment
            </Link>

            <Search size={22} className="shrink-0 cursor-pointer text-white" />
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={30} />
          </button>
        </div>
      </header>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}