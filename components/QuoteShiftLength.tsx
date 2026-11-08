"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

const customerTokenKey = "streamline_auth_token";

export function useQuoteShiftOptions(quoteApi: string, adminCustomerId?: string) {
  const [result, setResult] = useState<{ key: string; required: boolean; error: string }>();
  const [attempt, setAttempt] = useState(0);
  const key = `${quoteApi}:${adminCustomerId ?? "customer"}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const isAdmin = adminCustomerId !== undefined;
        const token = isAdmin ? null : window.localStorage.getItem(customerTokenKey);
        if ((isAdmin && (!adminCustomerId || adminCustomerId === "GUEST")) || (!isAdmin && !token)) return;
        const response = isAdmin
          ? await adminFetch(`${quoteApi}/admin/shift-options?customerId=${encodeURIComponent(adminCustomerId)}`, { signal: controller.signal })
          : await fetch(`${quoteApi}/shift-options`, {
              signal: controller.signal, cache: "no-store", headers: { Authorization: `Bearer ${token}` },
            });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to check shift options.");
        if (!controller.signal.aborted) setResult({ key, required: data.required === true, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ key, required: false, error: error instanceof Error ? error.message : "Unable to check shift options." });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [adminCustomerId, key, quoteApi]);

  return {
    required: result?.key === key && result.required,
    error: result?.key === key ? result.error : "",
    retry: () => setAttempt(value => value + 1),
  };
}

export function QuoteShiftLength({
  options, value, onChange, className,
}: {
  options: ReturnType<typeof useQuoteShiftOptions>;
  value?: string;
  onChange?: (value: string) => void;
  className: string;
}) {
  if (options.error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {options.error}{" "}
        <button type="button" className="font-semibold underline" onClick={options.retry}>Retry</button>
      </p>
    );
  }
  if (!options.required) return null;
  return (
    <label className="block text-sm font-semibold">
      Shift length
      <select name="shiftHours" className={className} value={value} defaultValue={value === undefined ? "" : undefined}
        onChange={onChange ? event => onChange(event.target.value) : undefined} required>
        <option value="">Select shift length</option>
        <option value="8">8 hours</option>
        <option value="12">12 hours</option>
      </select>
    </label>
  );
}
