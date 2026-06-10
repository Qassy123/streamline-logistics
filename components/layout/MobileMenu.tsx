"use client";

import Image from "next/image";
import Link from "next/link";
import { Phone, X } from "lucide-react";

type MobileMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

const menuLinks = [
  { label: "Home", href: "/" },
  { label: "Instant Quote", href: "/quote" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[999] overflow-y-auto bg-[#020B1F] text-white lg:hidden">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,108,255,0.32),_transparent_35%),linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_140%)]">
        <div className="flex h-[92px] items-center justify-between border-b border-white/10 px-4 sm:px-6">
          <Link
            href="/"
            onClick={onClose}
            className="flex w-[260px] shrink-0 items-center sm:w-[330px]"
            aria-label="Streamline Logistics Group home"
          >
            <Image
              src="/images/logos/header-logo.png"
              alt="Streamline Logistics Group"
              width={330}
              height={90}
              priority
              className="h-auto w-full object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
          >
            <X size={28} />
          </button>
        </div>

        <div className="px-5 py-8 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#2D8CFF]">
            Navigation
          </p>

          <nav className="mt-6 grid gap-4">
            {menuLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-5 text-2xl font-bold text-white shadow-lg shadow-black/10 transition hover:border-[#2D8CFF] hover:bg-[#006CFF]/20"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 grid gap-4">
            <Link
              href="/quote"
              onClick={onClose}
              className="rounded-full bg-[#006CFF] px-6 py-5 text-center text-lg font-bold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
            >
              Get Instant Quote
            </Link>

            <a
              href="tel:03333440703"
              onClick={onClose}
              className="flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-6 py-5 text-lg font-bold text-white"
            >
              <Phone size={20} className="text-[#2D8CFF]" />
              0333 344 0703
            </a>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#2D8CFF]">
              Streamline Logistics Group
            </p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Fast, reliable and dependable courier services for businesses across the UK.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}