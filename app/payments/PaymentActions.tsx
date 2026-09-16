"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, ReceiptText } from "lucide-react";

const BACKEND_API_URL =
  "https://streamline-logistics-production.up.railway.app/api";
const AUTH_TOKEN_STORAGE_KEY = "streamline_auth_token";

type CheckoutOptions = {
  accountType: string;
  payNowAvailable: boolean;
  payLaterAvailable: boolean;
  tradeStatus?: string | null;
  paymentTermsDays?: number;
  poRequired?: boolean;
  creditFacilityOnHold?: boolean;
  holdReason?: string | null;
  creditLimit?: number;
  exposure?: number;
  availableCredit?: number;
  quoteAmount?: number;
  reason?: string | null;
};

function money(value: number | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export default function PaymentActions({
  quoteId,
  totalPrice,
}: {
  quoteId: string;
  totalPrice: number;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"card" | "trade" | null>(null);
  const [error, setError] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const token =
          window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";

        const response = await fetch(
          `${BACKEND_API_URL}/payments/checkout-options/${encodeURIComponent(
            quoteId,
          )}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : undefined,
            cache: "no-store",
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load payment options.");
        }

        if (!cancelled) {
          setOptions(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load payment options.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  async function payNow() {
    setWorking("card");
    setError("");

    try {
      const token =
        window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";

      const response = await fetch(
        `${BACKEND_API_URL}/payments/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ quoteId }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Failed to create Stripe checkout session.");
      }

      window.location.href = data.checkoutUrl;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to continue to secure payment.",
      );
      setWorking(null);
    }
  }

  async function payLater() {
    setWorking("trade");
    setError("");

    try {
      const token =
        window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";

      if (!token) {
        throw new Error("Please log in again to use your Trade Account.");
      }

      const response = await fetch(`${BACKEND_API_URL}/payments/pay-later`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quoteId,
          purchaseOrderNumber: purchaseOrderNumber.trim() || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to book on your Trade Account.");
      }

      router.push(
        `/payment-success?quoteId=${encodeURIComponent(
          quoteId,
        )}&tradeBooking=true`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to book on your Trade Account.",
      );
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-[#D7E6FF] bg-white p-4 text-sm font-bold text-[#071D49]">
        <Loader2 size={18} className="animate-spin text-[#006CFF]" />
        Checking payment options...
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {options?.accountType === "TRADE" && (
        <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
          <div className="flex items-start gap-3">
            <ReceiptText className="mt-0.5 shrink-0 text-[#006CFF]" size={21} />
            <div className="min-w-0">
              <p className="font-bold text-[#071D49]">Trade Account</p>

              {options.payLaterAvailable ? (
                <>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Book now and pay by invoice under your agreed{" "}
                    {options.paymentTermsDays || 30}-day payment terms.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-[#F4F8FF] p-3">
                      <p className="text-xs font-semibold text-slate-500">
                        Available credit
                      </p>
                      <p className="mt-1 font-bold text-[#071D49]">
                        {money(options.availableCredit)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F4F8FF] p-3">
                      <p className="text-xs font-semibold text-slate-500">
                        This booking
                      </p>
                      <p className="mt-1 font-bold text-[#071D49]">
                        {money(totalPrice)}
                      </p>
                    </div>
                  </div>

                  {options.poRequired && (
                    <label className="mt-4 block">
                      <span className="text-sm font-bold text-[#071D49]">
                        PO / Order Reference
                      </span>
                      <input
                        type="text"
                        value={purchaseOrderNumber}
                        onChange={(event) =>
                          setPurchaseOrderNumber(event.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-3 text-sm text-[#071D49] outline-none transition focus:border-[#006CFF]"
                        placeholder="Enter PO / order reference"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => void payLater()}
                    disabled={working !== null}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#006CFF] px-8 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {working === "trade" ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ReceiptText size={18} />
                    )}
                    Book on Trade Account — Pay Later
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm leading-6 text-amber-700">
                  {options.reason ||
                    "Pay Later is currently unavailable for this Trade Account."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {options?.payNowAvailable !== false && (
        <button
          type="button"
          onClick={() => void payNow()}
          disabled={working !== null}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#006CFF] px-8 py-4 text-sm font-bold text-white transition hover:bg-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working === "card" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CreditCard size={18} />
          )}
          Pay Securely Now
        </button>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
