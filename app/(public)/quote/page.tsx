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

type ExtraStop = {
  order: number;
  address: string;
};

const API_URL = "https://streamline-logistics-production.up.railway.app/api/quotes";

const hourlyWindows = [
  "07:00-08:00",
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "ASAP",
];

const vehicleDetails: Record<
  string,
  {
    length: string;
    width: string;
    height: string;
    pallets: string;
    maxWeight: string;
  }
> = {
  "Small Van": {
    length: "1.5m",
    width: "1.2m",
    height: "1.1m",
    pallets: "1 pallet",
    maxWeight: "400kg",
  },
  "SWB Van": {
    length: "2.4m",
    width: "1.6m",
    height: "1.4m",
    pallets: "2 pallets",
    maxWeight: "900kg",
  },
  "LWB Van": {
    length: "3.4m",
    width: "1.7m",
    height: "1.7m",
    pallets: "3 pallets",
    maxWeight: "1,200kg",
  },
  "XLWB High Roof": {
    length: "4.2m",
    width: "1.7m",
    height: "1.9m",
    pallets: "4 pallets",
    maxWeight: "1,400kg",
  },
  "Luton Tail Lift": {
    length: "4.0m",
    width: "2.0m",
    height: "2.0m",
    pallets: "6 pallets",
    maxWeight: "1,000kg",
  },
  Curtainsider: {
    length: "6.0m+",
    width: "2.4m",
    height: "2.4m",
    pallets: "10+ pallets",
    maxWeight: "Varies",
  },
};

export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedDeliveryType, setSelectedDeliveryType] = useState("");
  const [selectedJourneyType, setSelectedJourneyType] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [capacityPercent, setCapacityPercent] = useState<number | null>(null);
  const [extraStops, setExtraStops] = useState<ExtraStop[]>([]);

  const showCapacity = selectedDeliveryType !== "Full Load";
  const showExtraStops =
    selectedDeliveryType === "Multi Drop" ||
    selectedJourneyType === "Multi Drop";

  function addStop() {
    setExtraStops((currentStops) => [
      ...currentStops,
      {
        order: currentStops.length + 1,
        address: "",
      },
    ]);
  }

  function removeStop(index: number) {
    setExtraStops((currentStops) =>
      currentStops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({
          ...stop,
          order: stopIndex + 1,
        }))
    );
  }

  function updateStop(index: number, value: string) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index
          ? {
              ...stop,
              address: value,
            }
          : stop
      )
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuote(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!selectedJourneyType) {
      setError("Select a journey type before generating a quote.");
      setLoading(false);
      return;
    }

    if (showCapacity && !capacityPercent) {
      setError("Select a vehicle capacity before generating a quote.");
      setLoading(false);
      return;
    }

    const cleanedStops = extraStops.filter((stop) => stop.address.trim() !== "");

    if (showExtraStops && cleanedStops.length === 0) {
      setError("Add at least one extra stop for a multi-drop journey.");
      setLoading(false);
      return;
    }

    const collectionDateValue = String(formData.get("collectionDate"));

    const payload = {
      deliveryType: formData.get("deliveryType"),
      journeyType: selectedJourneyType,
      capacityPercent: showCapacity ? capacityPercent : null,
      collectionDate: new Date(`${collectionDateValue}T00:00:00.000Z`).toISOString(),
      collectionWindow: formData.get("collectionWindow"),
      vehicleSize: formData.get("vehicleSize"),
      collectionAddress: formData.get("collectionAddress"),
      deliveryAddress: formData.get("deliveryAddress"),
      extraDrops: cleanedStops.length > 0 ? cleanedStops : null,
      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail"),
      customerPhone: formData.get("customerPhone"),
      companyName: formData.get("companyName"),
    };

    try {
      const response = await fetch(API_URL, {
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
      setSelectedDeliveryType("");
      setSelectedJourneyType("");
      setSelectedVehicle("");
      setCapacityPercent(null);
      setExtraStops([]);
    } catch (error) {
      console.error("Quote submission error:", error);
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
            Enter your delivery details, vehicle requirements and journey type to
            generate a quote.
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
                <p className="mt-1 text-2xl font-bold">£{quote.totalPrice}</p>
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
              value={selectedDeliveryType}
              onChange={(event) => {
                setSelectedDeliveryType(event.target.value);

                if (event.target.value === "Full Load") {
                  setCapacityPercent(null);
                }
              }}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            >
              <option value="">Select delivery type</option>
              <option value="Same Day Delivery">Same Day Delivery</option>
              <option value="Next Day Delivery">Next Day Delivery</option>
              <option value="Full Day Booking">Full Day Booking</option>
              <option value="Half Day Booking">Half Day Booking</option>
              <option value="Multi Drop">Multi-Drop Delivery</option>
              <option value="Full Load">Full Load</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Journey Type
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {["One Way", "Return", "Multi Drop"].map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-xl border p-4 text-sm font-semibold ${
                    selectedJourneyType === option
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="journeyType"
                    value={option}
                    checked={selectedJourneyType === option}
                    onChange={() => setSelectedJourneyType(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Vehicle Size
            </label>
            <select
              name="vehicleSize"
              required
              value={selectedVehicle}
              onChange={(event) => setSelectedVehicle(event.target.value)}
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

          {selectedVehicle && vehicleDetails[selectedVehicle] && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">
                {selectedVehicle} details
              </p>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <p>Length: {vehicleDetails[selectedVehicle].length}</p>
                <p>Width: {vehicleDetails[selectedVehicle].width}</p>
                <p>Height: {vehicleDetails[selectedVehicle].height}</p>
                <p>Pallets: {vehicleDetails[selectedVehicle].pallets}</p>
                <p>Max Weight: {vehicleDetails[selectedVehicle].maxWeight}</p>
              </div>
            </div>
          )}

          {showCapacity && selectedVehicle && (
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Vehicle Capacity Required
              </label>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => setCapacityPercent(percent)}
                    className={`rounded-xl border p-4 text-sm font-semibold ${
                      capacityPercent === percent
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800">
              Collection Date
            </label>
            <input
              type="date"
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
              {hourlyWindows.map((window) => (
                <option key={window} value={window}>
                  {window}
                </option>
              ))}
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

          {showExtraStops && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Extra Stops
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add as many additional stops as required.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addStop}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  Add Stop
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                {extraStops.map((stop, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-950">
                        Stop {index + 1}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeStop(index)}
                        className="text-sm font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      value={stop.address}
                      onChange={(event) => updateStop(index, event.target.value)}
                      placeholder="Stop address"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3"
                    />

                    <p className="mt-2 text-xs text-slate-500">
                      Order: {index + 1}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

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