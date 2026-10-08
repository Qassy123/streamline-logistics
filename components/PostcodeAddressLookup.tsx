"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectedPostcodeAddress = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};

type Summary = { id: string; label: string };
type Props = {
  onSelect: (address: SelectedPostcodeAddress) => void;
  apiBase?: string;
  postcode?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  accent?: "blue" | "orange";
};

const DEFAULT_API_BASE = "https://streamline-logistics-production.up.railway.app/api";

export function formatPostcodeAddress(address: SelectedPostcodeAddress): string {
  return [address.addressLine1, address.addressLine2, address.townCity, address.county, address.postcode]
    .filter(Boolean).join(", ");
}

export default function PostcodeAddressLookup({
  onSelect, apiBase = DEFAULT_API_BASE, postcode = "", disabled = false,
  label = "Find a UK address", className = "", accent = "blue",
}: Props) {
  const id = useId();
  const [query, setQuery] = useState(postcode);
  const [results, setResults] = useState<Summary[]>([]);
  const [searchedPostcode, setSearchedPostcode] = useState("");
  const [selection, setSelection] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const base = apiBase.replace(/\/+$/, "");

  function cancel() {
    sequence.current += 1;
    controller.current?.abort();
    controller.current = null;
  }

  function reset(value: string) {
    cancel();
    setQuery(value);
    setResults([]);
    setSearchedPostcode("");
    setSelection("");
    setMessage("");
    setBusy(false);
  }

  useEffect(() => {
    reset(postcode);
    // Reset results when the parent changes recipient, address, or endpoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcode, base, disabled]);

  useEffect(() => () => {
    sequence.current += 1;
    controller.current?.abort();
  }, []);

  async function request(path: string): Promise<unknown> {
    cancel();
    const current = sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 18000);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${base}/distance/${path}`, {
        signal: abort.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (current !== sequence.current) return null;
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Address lookup is unavailable.");
      }
      return data;
    } catch (error) {
      if (current === sequence.current) {
        setMessage(abort.signal.aborted
          ? "Address lookup timed out. Try again or enter the address manually."
          : error instanceof Error ? error.message : "Address lookup is unavailable. Enter the address manually.");
      }
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (current === sequence.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  async function search() {
    if (disabled || busy) return;
    const compact = query.toUpperCase().replace(/\s+/g, "");
    if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) {
      setMessage("Enter a full UK postcode, for example B1 1AA.");
      return;
    }
    setResults([]);
    setSelection("");
    setSearchedPostcode("");
    const data = await request(`address-lookup?postcode=${encodeURIComponent(compact)}`) as
      { postcode?: unknown; addresses?: unknown } | null;
    if (!data) return;
    if (typeof data.postcode !== "string" || !Array.isArray(data.addresses) ||
      !data.addresses.every(item => item && typeof item.id === "string" && typeof item.label === "string")) {
      setMessage("Address lookup returned an invalid result. Enter the address manually.");
      return;
    }
    setSearchedPostcode(data.postcode);
    setResults(data.addresses);
    if (!data.addresses.length) setMessage("No addresses found. Check the postcode or enter the address manually.");
  }

  async function select(value: string) {
    setSelection(value);
    if (!value || disabled || busy || !results.some(item => item.id === value)) return;
    const data = await request(`address-details?id=${encodeURIComponent(value)}&postcode=${encodeURIComponent(searchedPostcode)}`) as
      { address?: Partial<SelectedPostcodeAddress> } | null;
    if (!data) { setSelection(""); return; }
    const address = data.address;
    if (!address || !["label", "addressLine1", "addressLine2", "townCity", "county", "postcode"]
      .every(key => typeof address[key as keyof SelectedPostcodeAddress] === "string") ||
      !address.addressLine1 || !address.postcode) {
      setMessage("This address could not be filled. Enter it manually.");
      setSelection("");
      return;
    }
    onSelect(address as SelectedPostcodeAddress);
    setMessage("Address filled. Check the details and add any delivery instructions separately.");
  }

  const buttonColour = accent === "orange" ? "bg-[#FF6A00] hover:bg-[#E95F00]" : "bg-[#006CFF] hover:bg-[#0059D6]";
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-950 ${className}`}>
      <label htmlFor={`${id}-postcode`} className="mb-2 block text-sm font-semibold">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={`${id}-postcode`} type="text" value={query} disabled={disabled}
          onChange={event => reset(event.target.value)} autoComplete="off" maxLength={10}
          placeholder="Enter postcode" aria-describedby={`${id}-message`}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); void search(); }
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50" />
        <button type="button" onClick={() => void search()} disabled={disabled || busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${buttonColour}`}>
          {busy ? "Loading…" : "Find address"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-3">
          <label htmlFor={`${id}-address`} className="mb-1 block text-sm">Choose your address</label>
          <select id={`${id}-address`} value={selection} disabled={disabled || busy}
            onChange={event => void select(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50">
            <option value="">Select an address ({results.length} found)</option>
            {results.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
      )}
      <p id={`${id}-message`} role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-slate-600">
        {message || "You can also enter or edit the address manually."}
      </p>
    </div>
  );
}
