"use client";

import Link from "next/link";
import { X } from "lucide-react";

type MobileMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1f3a] text-white lg:hidden">
      <div className="flex items-center justify-between px-6 py-6">
        <span className="text-xl font-semibold">Streamline Logistics</span>

        <button type="button" onClick={onClose} aria-label="Close menu">
          <X size={32} />
        </button>
      </div>

      <nav className="flex flex-col gap-6 px-6 pt-10 text-3xl font-semibold">
        <Link href="/" onClick={onClose}>
          Home
        </Link>

        <Link href="/instant-quote" onClick={onClose}>
          Instant Quote
        </Link>

        <Link href="/about" onClick={onClose}>
          About Us
        </Link>

        <Link href="/contact" onClick={onClose}>
          Contact
        </Link>

        <Link href="/payments" onClick={onClose}>
          Make Payment
        </Link>
      </nav>
    </div>
  );
}