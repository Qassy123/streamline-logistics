"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutDashboard, Lock, UserPlus } from "lucide-react";

const ACCOUNT_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type AuthState = "loading" | "guest" | "account";

export default function PaymentSuccessAccountStatus({
  quoteId,
}: {
  quoteId?: string;
}) {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    async function checkAccount() {
      try {
        const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

        if (!token) {
          setAuthState("guest");
          return;
        }

        const response = await fetch(ACCOUNT_API_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setAuthState("guest");
          return;
        }

        setAuthState("account");
      } catch {
        setAuthState("guest");
      }
    }

    checkAccount();
  }, []);

  const isAccount = authState === "account";

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Link
        href={
          isAccount
            ? "/dashboard"
            : quoteId
            ? `/register-business?quoteId=${quoteId}`
            : "/register-business"
        }
        className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#245BFF] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#245BFF]/20 transition hover:bg-[#006CFF]"
      >
        {isAccount ? (
          <>
            <LayoutDashboard size={22} />
            Go To Dashboard
            <ArrowRight size={18} />
          </>
        ) : (
          <>
            <UserPlus size={22} />
            Create Free Account
            <span aria-hidden="true">→</span>
          </>
        )}
      </Link>

      {!isAccount && (
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
          <Lock size={16} />
          Free to create. No card details required.
        </p>
      )}
    </div>
  );
}