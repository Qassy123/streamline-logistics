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
      <header className="sticky top-0 z-40 w-full bg-white shadow-sm">
        <div className="mx-auto flex h-[100px] max-w-[1500px] items-center justify-between px-5 lg:h-[112px] lg:px-10">
          <Link href="/" className="flex h-full w-[190px] items-center overflow-visible lg:w-[240px]">
            <div className="relative h-[80px] w-[120px] overflow-visible lg:h-[90px] lg:w-[150px]">
              <Image
                src="/images/logos/Logo.png"
                alt="Streamline Logistics Group"
                fill
                priority
                className="scale-[2.45] object-contain object-left lg:scale-[2.75]"
              />
            </div>
          </Link>

          <nav className="hidden items-center gap-10 lg:flex">
            <Link href="/" className="font-medium text-[#ef1c24]">
              Home
            </Link>

            <Link
              href="/quote"
              className="font-medium text-[#0b1f3a] transition hover:text-[#ff6a00]"
            >
              Instant Quote
            </Link>

            <Link
              href="/about"
              className="font-medium text-[#0b1f3a] transition hover:text-[#ff6a00]"
            >
              About Us
            </Link>

            <Link
              href="/contact"
              className="font-medium text-[#0b1f3a] transition hover:text-[#ff6a00]"
            >
              Contact
            </Link>
          </nav>

          <div className="hidden items-center gap-6 lg:flex">
            <a
              href="tel:03333440703"
              className="flex items-center gap-2 font-medium text-[#0b1f3a]"
            >
              <Phone size={18} className="text-[#ef1c24]" />
              0333 344 0703
            </a>

            <Link
              href="/payments"
              className="rounded-full bg-[#0b1f3a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6a00]"
            >
              Make Payment
            </Link>

            <Search size={22} className="cursor-pointer text-[#0b1f3a]" />
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="text-[#0b1f3a] lg:hidden"
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