"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Phone, Search, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import MobileMenu from "@/components/layout/MobileMenu";

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";
const LOGOUT_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/logout";
const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";
const AUTH_USER_STORAGE_KEY = "streamline_auth_user";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType: "BUSINESS" | "TRADE";
};

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    loadUser();

    window.addEventListener("streamline-auth-change", loadUser);
    window.addEventListener("storage", loadUser);

    return () => {
      window.removeEventListener("streamline-auth-change", loadUser);
      window.removeEventListener("storage", loadUser);
    };
  }, []);

  async function loadUser() {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!token) {
      setUser(null);
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return;
    }

    try {
      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setUser(null);
        return;
      }

      const data = await response.json();

      setUser(data.user);
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data.user));
    } catch {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
    }
  }

  function handleLogout() {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    window.dispatchEvent(new Event("streamline-auth-change"));

    if (token) {
      fetch(LOGOUT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);
    }

    window.location.href = "/";
  }

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

          <div className="hidden w-[460px] shrink-0 items-center justify-end gap-5 lg:flex">
            <a
              href="tel:03333440703"
              className="flex items-center gap-2 whitespace-nowrap font-medium text-white"
            >
              <Phone size={18} className="text-[#006CFF]" />
              0333 344 0703
            </a>

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#006CFF] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2D8CFF]"
                >
                  <UserCircle size={18} />
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="whitespace-nowrap text-sm font-semibold text-white transition hover:text-[#2D8CFF]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="whitespace-nowrap text-sm font-semibold text-white transition hover:text-[#2D8CFF]"
                >
                  Login
                </Link>

                <Link
                  href="/register-business"
                  className="whitespace-nowrap rounded-full bg-[#006CFF] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2D8CFF]"
                >
                  Create Account
                </Link>
              </>
            )}

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
