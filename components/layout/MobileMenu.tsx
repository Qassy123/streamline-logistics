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
    <div className="fixed inset-0 z-50 bg-[#071D49] text-white lg:hidden">
      <div className="flex items-center justify-between border-b border-[#1F4D94] px-6 py-6">
        <span className="text-xl font-bold">Streamline Logistics</span>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="text-[#2D8CFF]"
        >
          <X size={32} />
        </button>
      </div>

      <nav className="flex flex-col gap-6 px-6 pt-10 text-3xl font-bold">
        <Link
          href="/"
          onClick={onClose}
          className="transition hover:text-[#2D8CFF]"
        >
          Home
        </Link>

        <Link
          href="/quote"
          onClick={onClose}
          className="transition hover:text-[#2D8CFF]"
        >
          Instant Quote
        </Link>

        <Link
          href="/about"
          onClick={onClose}
          className="transition hover:text-[#2D8CFF]"
        >
          About Us
        </Link>

        <Link
          href="/contact"
          onClick={onClose}
          className="transition hover:text-[#2D8CFF]"
        >
          Contact
        </Link>

        <Link
          href="/payments"
          onClick={onClose}
          className="rounded-full bg-[#006CFF] px-6 py-4 text-center text-xl transition hover:bg-[#2D8CFF]"
        >
          Make Payment
        </Link>
      </nav>
    </div>
  );
}