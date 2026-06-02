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
  "00:00-01:00",
  "01:00-02:00",
  "02:00-03:00",
  "03:00-04:00",
  "04:00-05:00",
  "05:00-06:00",
  "06:00-07:00",
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
  "19:00-20:00",
  "20:00-21:00",
  "21:00-22:00",
  "22:00-23:00",
  "23:00-00:00",
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
    image: string;
  }
> = {
  "Small Van": {
    length: "1.5m",
    width: "1.2m",
    height: "1.1m",
    pallets: "1 pallet",
    maxWeight: "400kg",
    image: "/Vehicles/smallvan.jpg",
  },
  "SWB Van": {
    length: "2.4m",
    width: "1.6m",
    height: "1.4m",
    pallets: "2 pallets",
    maxWeight: "900kg",
    image: "/Vehicles/swb.jpeg",
  },
  "LWB Van": {
    length: "3.4m",
    width: "1.7m",
    height: "1.7m",
    pallets: "3 pallets",
    maxWeight: "1,200kg",
    image: "/Vehicles/lwb.jpg",
  },
  "XLWB High Roof": {
    length: "4.2m",
    width: "1.7m",
    height: "1.9m",
    pallets: "4 pallets",
    maxWeight: "1,400kg",
    image: "/Vehicles/XLWB High Roof.jpg",
  },
  "Luton Tail Lift": {
    length: "4.0m",
    width: "2.0m",
    height: "2.0m",
    pallets: "6 pallets",
    maxWeight: "1,000kg",
    image: "/Vehicles/Luton Tail Lift.jpg",
  },
  Curtainsider: {
    length: "6.0m+",
    width: "2.4m",
    height: "2.4m",
    pallets: "10+ pallets",
    maxWeight: "Varies",
    image: "/Vehicles/Curtainsider.jpg",
  },
};

const capacityOptions = [
  {
    percent: 25,
    label: "25%",
    pallets: "Quarter Load",
  },
  {
    percent: 50,
    label: "50%",
    pallets: "Half Load",
  },
  {
    percent: 75,
    label: "75%",
    pallets: "Three Quarter Load",
  },
  {
    percent: 100,
    label: "100%",
    pallets: "Full Load",
  },
];

export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState("");

  const [selectedDeliveryType, setSelectedDeliveryType] = useState("");
  const [selectedJourneyType, setSelectedJourneyType] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [capacityPercent, setCapacityPercent] = useState<number | null>(null);
  const [extraStops, setExtraStops] = useState<ExtraStop[]>([]);

  const [fragileGoods, setFragileGoods] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  const showCapacity = selectedDeliveryType !== "Full Load (One Way, Return, Multi Drop)";
  const showExtraStops = selectedJourneyType === "Multi Drop";

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

  function updateStopAddress(index: number, value: string) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, address: value } : stop
      )
    );
  }

  function updateStopOrder(index: number, value: number) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, order: value } : stop
      )
    );
  }

  function handleDeliveryTypeChange(value: string) {
    setSelectedDeliveryType(value);
    setError("");

    if (value === "Full Load (One Way, Return, Multi Drop)") {
      setCapacityPercent(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuote(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!selectedJourneyType) {
      setError("Please select One Way, Return, or Multi Drop.");
      setLoading(false);
      return;
    }

    if (showCapacity && !capacityPercent) {
      setError("Please select the vehicle capacity required.");
      setLoading(false);
      return;
    }

    if (!accuracyConfirmed) {
      setError("Please confirm that the quote details are accurate.");
      setLoading(false);
      return;
    }

    const cleanedStops = extraStops
      .filter((stop) => stop.address.trim() !== "")
      .sort((a, b) => a.order - b.order);

    if (showExtraStops && cleanedStops.length === 0) {
      setError("Please add at least one extra stop for this multi-drop journey.");
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

      loadDescription: formData.get("loadDescription"),
      palletCount: formData.get("palletCount"),
      fragileGoods,
      contactPreference: formData.get("contactPreference"),
      accuracyConfirmed,

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
      setShowVehicleModal(false);
      setCapacityPercent(null);
      setExtraStops([]);
      setFragileGoods(false);
      setAccuracyConfirmed(false);
    } catch (error) {
      console.error("Quote submission error:", error);
      setError("Unable to generate quote. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070b12]">
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_34%),linear-gradient(135deg,_#070b12_0%,_#111827_50%,_#020617_100%)] px-6 py-20 text-white md:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:42px_42px] opacity-20" />

        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
              Premium UK Logistics
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
              Instant courier quotes built for serious business deliveries.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Select your service, vehicle, capacity and delivery route. Get a structured quote
              instantly with clear pricing and a reference number.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Same day", "Multi-drop", "Full load"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur"
                >
                  <p className="text-sm font-semibold text-white">{item}</p>
                  <p className="mt-1 text-xs text-slate-400">Business-ready service</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                Quote system live
              </p>
              <h2 className="mt-3 text-3xl font-bold">Get priced in minutes</h2>
              <div className="mt-6 grid gap-4">
                {[
                  ["1", "Choose delivery type"],
                  ["2", "Select vehicle and capacity"],
                  ["3", "Enter addresses and load details"],
                  ["4", "Receive instant quote"],
                ].map(([number, label]) => (
                  <div key={number} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                      {number}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-7xl">
          {quote && (
            <section className="mb-10 overflow-hidden rounded-[2rem] border border-amber-200/40 bg-white shadow-2xl shadow-black/10">
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-8 text-white">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
                      Quote generated
                    </p>

                    <h2 className="mt-3 text-5xl font-bold">
                      £{quote.totalPrice}
                    </h2>

                    <p className="mt-3 text-sm text-slate-300">
                      Reference: {quote.id}
                    </p>
                  </div>

                  <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-2 text-sm font-semibold text-amber-200">
                    {quote.status}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-6 text-sm md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-slate-500">Estimated Distance</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {quote.distanceMiles} miles
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-slate-500">Base Price</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    £{quote.basePrice}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-slate-500">Fuel Surcharge</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    £{quote.fuelSurcharge}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-slate-500">Subtotal Before VAT</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    £{quote.adminPrice}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-slate-500">VAT</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    £{quote.vatAmount}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-950 bg-slate-950 p-5 text-white">
                  <p className="text-slate-300">Total</p>
                  <p className="mt-2 text-3xl font-bold">£{quote.totalPrice}</p>
                </div>
              </div>
            </section>
          )}

          {error && (
            <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 shadow-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-black/10"
          >
            <div className="border-b border-slate-200 bg-slate-950 p-8 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
                Quote details
              </p>
              <h2 className="mt-3 text-3xl font-bold">Build your delivery quote</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Complete the sections below. Required details are checked before quote generation.
              </p>
            </div>

            <div className="grid gap-8 p-6 md:p-8">
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                    Step 1
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Service requirements
                  </h3>
                </div>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Delivery Type
                    </label>
                    <select
                      name="deliveryType"
                      required
                      value={selectedDeliveryType}
                      onChange={(event) => handleDeliveryTypeChange(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    >
                      <option value="">Select delivery type</option>
                      <option value="Same Day Delivery (One Way, Return, Multi Drop)">
                        Same Day Delivery (One Way, Return, Multi Drop)
                      </option>
                      <option value="Next Day Delivery">Next Day Delivery</option>
                      <option value="Full Day Booking">Full Day Booking</option>
                      <option value="Half Day Booking">Half Day Booking</option>
                      <option value="Full Load (One Way, Return, Multi Drop)">
                        Full Load (One Way, Return, Multi Drop)
                      </option>
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
                          className={`cursor-pointer rounded-2xl border p-5 text-sm font-bold transition ${
                            selectedJourneyType === option
                              ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
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
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                    Step 2
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Vehicle and load capacity
                  </h3>
                </div>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Vehicle Size
                    </label>
                    <select
                      name="vehicleSize"
                      required
                      value={selectedVehicle}
                      onChange={(event) => {
                        setSelectedVehicle(event.target.value);
                        setShowVehicleModal(Boolean(event.target.value));
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
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

                  {showCapacity && selectedVehicle && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        Vehicle Capacity Required
                      </label>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        {capacityOptions.map((option) => (
                          <button
                            key={option.percent}
                            type="button"
                            onClick={() => setCapacityPercent(option.percent)}
                            className={`rounded-2xl border p-5 text-left text-sm font-bold transition ${
                              capacityPercent === option.percent
                                ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"
                            }`}
                          >
                            <span className="block text-2xl">{option.label}</span>
                            <span className="mt-1 block text-xs opacity-80">
                              {option.pallets}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                    Step 3
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Collection and delivery route
                  </h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Collection Date
                    </label>
                    <input
                      type="date"
                      name="collectionDate"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Collection Window
                    </label>
                    <select
                      name="collectionWindow"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
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
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
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
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>
                </div>

                {showExtraStops && (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          Extra Stops
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Add unlimited extra stops and set the stop order.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addStop}
                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        Add Stop
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4">
                      {extraStops.map((stop, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-950">
                              Stop {index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() => removeStop(index)}
                              className="text-sm font-bold text-red-600"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                            <input
                              value={stop.address}
                              onChange={(event) =>
                                updateStopAddress(index, event.target.value)
                              }
                              placeholder="Stop address"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                            />

                            <select
                              value={stop.order}
                              onChange={(event) =>
                                updateStopOrder(index, Number(event.target.value))
                              }
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                            >
                              {extraStops.map((_, orderIndex) => (
                                <option key={orderIndex + 1} value={orderIndex + 1}>
                                  Stop {orderIndex + 1}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                    Step 4
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Load and contact details
                  </h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-800">
                      Load Description
                    </label>
                    <textarea
                      name="loadDescription"
                      required
                      rows={3}
                      placeholder="Example: palletised goods, furniture, machinery, boxed items"
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Pallet Count
                    </label>
                    <input
                      type="number"
                      name="palletCount"
                      min="0"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Contact Preference
                    </label>
                    <select
                      name="contactPreference"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    >
                      <option value="">Select contact preference</option>
                      <option value="Phone">Phone</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={fragileGoods}
                      onChange={(event) => setFragileGoods(event.target.checked)}
                    />
                    Fragile goods
                  </label>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Your Name
                    </label>
                    <input
                      name="customerName"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
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
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Phone
                    </label>
                    <input
                      name="customerPhone"
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Company Name
                    </label>
                    <input
                      name="companyName"
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <label className="flex cursor-pointer items-start gap-4 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={accuracyConfirmed}
                    onChange={(event) => setAccuracyConfirmed(event.target.checked)}
                    className="mt-1"
                  />
                  I confirm that the collection, delivery, load and contact details provided
                  are accurate.
                </label>
              </section>

              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-8 py-5 text-base font-bold text-white shadow-xl shadow-slate-950/20 transition hover:from-slate-800 hover:to-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generating Quote..." : "Get Instant Quote"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {showVehicleModal && selectedVehicle && vehicleDetails[selectedVehicle] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 bg-slate-950 p-6 text-white">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
                  Vehicle Details
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {selectedVehicle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowVehicleModal(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="p-6">
              <img
                src={vehicleDetails[selectedVehicle].image}
                alt={selectedVehicle}
                className="h-64 w-full rounded-3xl border border-slate-200 bg-slate-50 object-contain"
              />

              <div className="mt-6 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Length: {vehicleDetails[selectedVehicle].length}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Width: {vehicleDetails[selectedVehicle].width}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Height: {vehicleDetails[selectedVehicle].height}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Pallets: {vehicleDetails[selectedVehicle].pallets}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  Max Weight: {vehicleDetails[selectedVehicle].maxWeight}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}