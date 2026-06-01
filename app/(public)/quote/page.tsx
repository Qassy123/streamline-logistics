"use client";

import { useState } from "react";

type QuoteResponse = {
  id: string;
  status: string;
  distanceMiles: string;
  basePrice: string;
  fuelSurcharge: string;
  adminPrice: string;
  vatAmount: string;
  totalPrice: string;
};

export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuote(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      deliveryType: formData.get("deliveryType"),
      collectionDate: new Date(String(formData.get("collectionDate"))).toISOString(),
      collectionWindow: formData.get("collectionWindow"),
      vehicleSize: formData.get("vehicleSize"),
      collectionAddress: formData.get("collectionAddress"),
      deliveryAddress: formData.get("deliveryAddress"),
      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail"),
      customerPhone: formData.get("customerPhone"),
      companyName: formData.get("companyName"),
    };

    try {
      const response = await fetch("http://localhost:5000/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Quote request failed");
      }

      const data = await response.json();

      setQuote(data);
      form.reset();
    } catch {
      setError("Unable to generate quote. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Instant Quote
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Get an instant delivery quote
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Enter your collection, delivery and vehicle details to generate a quote.
          </p>
        </div>

        {quote && (
          <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Quote generated
                </p>

                <h2 className="mt-2 text-4xl font-bold text-slate-950">
                  £{quote.totalPrice}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Reference: {quote.id}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                {quote.status}
              </div>
            </div>

            <div className="mt-8 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500">Estimated Distance</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {quote.distanceMiles} miles
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500">Base Price</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  £{quote.basePrice}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500">Fuel Surcharge</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  £{quote.fuelSurcharge}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500">Subtotal Before VAT</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  £{quote.adminPrice}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500">VAT</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  £{quote.vatAmount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-950 bg-slate-950 p-4 text-white">
                <p className="text-slate-300">Total</p>
                <p className="mt-1 text-2xl font-bold">
                  £{quote.totalPrice}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-500">
              This quote is generated from the current pricing rules and is subject to
              confirmation if any collection or delivery details are inaccurate.
            </p>
          </section>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-10 grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Delivery Type
            </label>
            <select
              name="deliveryType"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            >
              <option value="">Select delivery type</option>
              <option value="Same Day">Same Day Delivery</option>
              <option value="Full Day Booking">Full Day Booking</option>
              <option value="Half Day Booking">Half Day Booking</option>
              <option value="Multi Drop">Multi-Drop Delivery</option>
              <option value="Full Load">Full Load</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Collection Date
            </label>
            <input
              type="datetime-local"
              name="collectionDate"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Collection Window
            </label>
            <select
              name="collectionWindow"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            >
              <option value="">Select collection window</option>
              <option value="09:00-12:00">09:00 - 12:00</option>
              <option value="12:00-14:00">12:00 - 14:00</option>
              <option value="ASAP">ASAP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Vehicle Size
            </label>
            <select
              name="vehicleSize"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            >
              <option value="">Select vehicle</option>
              <option value="Small Van">Small Van</option>
              <option value="SWB Van">SWB Van</option>
              <option value="LWB Van">LWB Van</option>
              <option value="XLWB High Roof">XLWB High Roof</option>
              <option value="Luton Tail Lift">Luton Tail Lift</option>
              <option value="Curtainsider">Curtainsider</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Collection Address
            </label>
            <textarea
              name="collectionAddress"
              required
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Delivery Address
            </label>
            <textarea
              name="deliveryAddress"
              required
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Your Name
            </label>
            <input
              name="customerName"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Email
            </label>
            <input
              type="email"
              name="customerEmail"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Phone
            </label>
            <input
              name="customerPhone"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Company Name
            </label>
            <input
              name="companyName"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-950 px-6 py-4 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Generating Quote..." : "Get Instant Quote"}
          </button>
        </form>
      </div>
    </main>
  );
}