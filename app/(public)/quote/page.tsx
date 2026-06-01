"use client";

import { useState } from "react";

export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);

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

    const response = await fetch("http://localhost:5000/api/quotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    setSuccessId(data.id);
    setLoading(false);
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-white px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Get a Quote
        </h1>

        <p className="mt-4 text-gray-600">
          Submit your delivery details and our team will review your request.
        </p>

        {successId && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            Quote submitted successfully. Reference: {successId}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Delivery Type
            </label>
            <select
              name="deliveryType"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
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
            <label className="block text-sm font-medium text-gray-700">
              Collection Date
            </label>
            <input
              type="datetime-local"
              name="collectionDate"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Collection Window
            </label>
            <select
              name="collectionWindow"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            >
              <option value="">Select time window</option>
              <option value="09:00-12:00">09:00 - 12:00</option>
              <option value="12:00-14:00">12:00 - 14:00</option>
              <option value="ASAP">ASAP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Vehicle Size
            </label>
            <select
              name="vehicleSize"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
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
            <label className="block text-sm font-medium text-gray-700">
              Collection Address
            </label>
            <textarea
              name="collectionAddress"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Delivery Address
            </label>
            <textarea
              name="deliveryAddress"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              name="customerName"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="customerEmail"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              name="customerPhone"
              required
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              name="companyName"
              className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-6 py-4 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit Quote Request"}
          </button>
        </form>
      </div>
    </main>
  );
}