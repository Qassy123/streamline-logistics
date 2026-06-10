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
      <header className="sticky top-0 z-40 w-full bg-[#071D49] shadow-sm">
        <div className="mx-auto flex h-[96px] max-w-[1500px] items-center justify-between px-5 sm:h-[104px] lg:h-[108px] lg:px-10">
          <Link
            href="/"
            className="relative z-10 flex h-full w-[240px] shrink-0 items-center sm:w-[280px] lg:w-[320px]"
            aria-label="Streamline Logistics Group home"
          >
            <div className="relative h-[82px] w-[240px] sm:h-[90px] sm:w-[280px] lg:h-[96px] lg:w-[320px]">
              <Image
                src="/images/logos/header-logo.png"
                alt="Streamline Logistics Group"
                fill
                priority
                sizes="(max-width: 640px) 240px, (max-width: 1024px) 280px, 320px"
                className="object-contain object-left"
              />
            </div>
          </Link>

          <nav className="relative z-20 hidden items-center gap-9 lg:flex">
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

          <div className="relative z-20 hidden items-center gap-6 lg:flex">
            <a
              href="tel:03333440703"
              className="flex items-center gap-2 font-medium text-white"
            >
              <Phone size={18} className="text-[#006CFF]" />
              0333 344 0703
            </a>

            <Link
              href="/payments"
              className="rounded-full bg-[#006CFF] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#2D8CFF]"
            >
              Make Payment
            </Link>

            <Search size={22} className="cursor-pointer text-white" />
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="relative z-20 shrink-0 text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={34} />
          </button>
        </div>
      </header>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}