"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  LayoutDashboard,
  Lock,
  Save,
  UserPlus,
} from "lucide-react";

const ACCOUNT_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/accounts/me";
const PAYMENT_CONFIRM_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/payments/confirm-checkout-session";
const SAVE_ROUTE_API_URL =
  "https://streamline-logistics-production.up.railway.app/api/saved-routes/from-quote";

const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";
const AUTH_USER_STORAGE_KEY = "streamline_auth_user";

type AuthState = "loading" | "guest" | "account";

export default function PaymentSuccessAccountStatus({
  quoteId,
  sessionId,
}: {
  quoteId?: string;
  sessionId?: string;
}) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [finaliseMessage, setFinaliseMessage] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [saveRouteMessage, setSaveRouteMessage] = useState("");

  useEffect(() => {
    async function checkAccountAndFinalisePayment() {
      try {
        const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

        if (!token) {
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          setAuthState("guest");
          return;
        }

        const accountResponse = await fetch(ACCOUNT_API_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!accountResponse.ok) {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          setAuthState("guest");
          return;
        }

        const accountData = await accountResponse.json();
        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(accountData.user),
        );

        setAuthState("account");

        if (!quoteId || !sessionId) return;

        const confirmResponse = await fetch(PAYMENT_CONFIRM_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quoteId,
            sessionId,
          }),
        });

        if (!confirmResponse.ok) {
          const data = await confirmResponse.json().catch(() => null);

          setFinaliseMessage(
            data?.error ||
              "Payment received. Booking finalisation is still processing.",
          );
          return;
        }

        setFinaliseMessage("Booking confirmed and linked to your dashboard.");
      } catch {
        setAuthState("guest");
      }
    }

    checkAccountAndFinalisePayment();
  }, [quoteId, sessionId]);

  async function handleSaveRoute() {
    try {
      if (!quoteId) return;

      setSavingRoute(true);
      setSaveRouteMessage("");

      const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!token) {
        setAuthState("guest");
        return;
      }

      const response = await fetch(`${SAVE_ROUTE_API_URL}/${quoteId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setSaveRouteMessage(data?.error || "Unable to save this route.");
        return;
      }

      setSaveRouteMessage(
        data?.alreadyExists
          ? "This route is already saved."
          : "Route saved to your dashboard.",
      );
    } catch {
      setSaveRouteMessage("Unable to save this route.");
    } finally {
      setSavingRoute(false);
    }
  }

  if (authState === "loading") {
    return (
      <div className="mx-auto grid max-w-xl gap-4">
        <div className="rounded-xl border border-[#D7E6FF] bg-[#F4F8FF] px-8 py-4 text-center text-sm font-bold text-[#071D49]">
          Checking account status...
        </div>
      </div>
    );
  }

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

      {isAccount && quoteId && (
        <button
          type="button"
          onClick={handleSaveRoute}
          disabled={savingRoute}
          className="inline-flex items-center justify-center gap-3 rounded-xl border border-[#006CFF] bg-white px-8 py-4 text-base font-bold text-[#006CFF] shadow-lg shadow-black/5 transition hover:bg-[#006CFF] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveRouteMessage === "Route saved to your dashboard." ||
          saveRouteMessage === "This route is already saved." ? (
            <CheckCircle size={22} />
          ) : (
            <Save size={22} />
          )}
          {savingRoute ? "Saving Route..." : "Save This Route"}
        </button>
      )}

      {finaliseMessage && isAccount && (
        <p className="text-center text-sm font-semibold text-slate-500">
          {finaliseMessage}
        </p>
      )}

      {saveRouteMessage && isAccount && (
        <p className="text-center text-sm font-semibold text-slate-500">
          {saveRouteMessage}
        </p>
      )}

      {!isAccount && (
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
          <Lock size={16} />
          Free to create. No card details required.
        </p>
      )}
    </div>
  );
}
