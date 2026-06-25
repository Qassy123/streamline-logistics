"use client";

import { useEffect, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";

const ACCOUNT_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type AuthState = "loading" | "guest" | "account";

export default function PaymentAccountStatus() {
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
    <>
      <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5 shadow-md shadow-black/5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006CFF]/10 text-[#006CFF]">
            <CreditCard size={20} />
          </span>

          <div>
            <h3 className="text-base font-bold text-[#071D49]">Pay Now</h3>

            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#006CFF]">
              {isAccount ? "Account Checkout" : "Guest Checkout"}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isAccount
                ? "Pay securely now using your logged-in Streamline account. Your booking will be available from your dashboard after payment."
                : "Pay securely now without creating an account. After payment, you can create a free account."}
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#006CFF] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-[#006CFF]/20 transition hover:bg-[#2D8CFF]"
      >
        <ShieldCheck size={20} />
        {isAccount ? "Pay Securely Now" : "Pay Securely Now - Guest Checkout"}
      </button>
    </>
  );
}