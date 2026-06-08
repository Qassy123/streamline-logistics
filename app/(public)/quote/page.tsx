"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
  capacityPercent: number | null;
};

type AddressFields = {
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};

const API_URL = "https://streamline-logistics-production.up.railway.app/api/quotes";

const twoHourWindows = [
  "00:00-02:00",
  "02:00-04:00",
  "04:00-06:00",
  "06:00-08:00",
  "08:00-10:00",
  "10:00-12:00",
  "12:00-14:00",
  "14:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
  "20:00-22:00",
  "22:00-00:00",
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
  "LWB High Roof Van": {
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
  "Luton Tail Lift Curtainsider": {
    length: "4.0m",
    width: "2.0m",
    height: "2.0m",
    pallets: "6 pallets",
    maxWeight: "1,000kg",
    image: "/Vehicles/Luton Tail Lift.jpg",
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

const emptyAddress: AddressFields = {
  addressLine1: "",
  addressLine2: "",
  townCity: "",
  county: "",
  postcode: "",
};

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWindowStartHour(window: string) {
  return Number(window.split(":")[0]);
}

function formatAddress(address: AddressFields) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.townCity,
    address.county,
    address.postcode,
  ]
    .filter((value) => value.trim() !== "")
    .join(", ");
}

function isAddressComplete(address: AddressFields) {
  return (
    address.addressLine1.trim() !== "" &&
    address.townCity.trim() !== "" &&
    address.county.trim() !== "" &&
    address.postcode.trim() !== ""
  );
}

function isValidUkPostcode(postcode: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.trim());
}

function getResponseErrorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }

  return "Unable to generate quote. Please try again.";
}

export default function QuotePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState("");

  const [selectedDeliveryType, setSelectedDeliveryType] = useState("");
  const [selectedJourneyType, setSelectedJourneyType] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [capacityPercent, setCapacityPercent] = useState<number | null>(null);
  const [extraStops, setExtraStops] = useState<ExtraStop[]>([]);

  const [collectionDate, setCollectionDate] = useState("");
  const [collectionWindow, setCollectionWindow] = useState("");
  const [collectionAddress, setCollectionAddress] =
    useState<AddressFields>(emptyAddress);
  const [deliveryAddress, setDeliveryAddress] =
    useState<AddressFields>(emptyAddress);

  const [fragileGoods, setFragileGoods] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  const hideJourneyType =
    selectedDeliveryType === "Full Day Booking" ||
    selectedDeliveryType === "Half Day Booking";

  const showCapacity = selectedDeliveryType !== "Full Load (One Way, Return, Multi Drop)";
  const showExtraStops = selectedJourneyType === "Multi Drop";
  const showAddressFields = Boolean(collectionDate && collectionWindow);
  const returnAddress = formatAddress(collectionAddress);

  const availableCollectionWindows = useMemo(() => {
    if (
      selectedDeliveryType !== "Same Day Delivery (One Way, Return, Multi Drop)" ||
      collectionDate !== getTodayDateString()
    ) {
      return twoHourWindows;
    }

    const now = new Date();
    const earliestHour = now.getHours() + 2;

    return twoHourWindows.filter((window) => {
      const startHour = getWindowStartHour(window);
      return startHour >= earliestHour;
    });
  }, [selectedDeliveryType, collectionDate]);

  function updateCollectionAddress(field: keyof AddressFields, value: string) {
    setCollectionAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDeliveryAddress(field: keyof AddressFields, value: string) {
    setDeliveryAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addStop() {
    setExtraStops((currentStops) => [
      ...currentStops,
      {
        order: currentStops.length + 2,
        addressLine1: "",
        addressLine2: "",
        townCity: "",
        county: "",
        postcode: "",
        capacityPercent: null,
      },
    ]);
  }

  function removeStop(index: number) {
    setExtraStops((currentStops) =>
      currentStops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({
          ...stop,
          order: stopIndex + 2,
        }))
    );
  }

  function updateStopAddress(
    index: number,
    field: keyof Omit<ExtraStop, "order" | "capacityPercent">,
    value: string
  ) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop
      )
    );
  }

  function updateStopCapacity(index: number, value: number) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, capacityPercent: value } : stop
      )
    );
  }

  function handleDeliveryTypeChange(value: string) {
    setSelectedDeliveryType(value);
    setError("");
    setCollectionWindow("");

    if (value === "Full Load (One Way, Return, Multi Drop)") {
      setCapacityPercent(null);
    }

    if (value === "Full Day Booking" || value === "Half Day Booking") {
      setSelectedJourneyType("");
      setExtraStops([]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuote(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!hideJourneyType && !selectedJourneyType) {
      setError("Please select One Way, Return, or Multi Drop.");
      setLoading(false);
      return;
    }

    if (!collectionDate || !collectionWindow) {
      setError("Please select collection date and collection window.");
      setLoading(false);
      return;
    }

    if (!showAddressFields) {
      setError("Please select collection date and time before entering route details.");
      setLoading(false);
      return;
    }

    if (!isAddressComplete(collectionAddress)) {
      setError("Please complete the full collection address.");
      setLoading(false);
      return;
    }

    if (!isValidUkPostcode(collectionAddress.postcode)) {
      setError("Please enter a valid UK postcode for the collection address.");
      setLoading(false);
      return;
    }

    if (!isAddressComplete(deliveryAddress)) {
      setError("Please complete the full delivery address.");
      setLoading(false);
      return;
    }

    if (!isValidUkPostcode(deliveryAddress.postcode)) {
      setError("Please enter a valid UK postcode for the delivery address.");
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
      .filter((stop) => formatAddress(stop).trim() !== "")
      .map((stop) => ({
        order: stop.order,
        address: formatAddress(stop),
        addressLine1: stop.addressLine1,
        addressLine2: stop.addressLine2,
        townCity: stop.townCity,
        county: stop.county,
        postcode: stop.postcode,
        capacityPercent: stop.capacityPercent,
      }))
      .sort((a, b) => a.order - b.order);

    if (showExtraStops && cleanedStops.length === 0) {
      setError("Please add at least one extra stop for this multi-drop journey.");
      setLoading(false);
      return;
    }

    if (
      showExtraStops &&
      extraStops.some(
        (stop) => !isAddressComplete(stop) || stop.capacityPercent === null
      )
    ) {
      setError("Please complete the address and capacity for every extra stop.");
      setLoading(false);
      return;
    }

    if (
      showExtraStops &&
      extraStops.some((stop) => !isValidUkPostcode(stop.postcode))
    ) {
      setError("Please enter a valid UK postcode for every extra stop.");
      setLoading(false);
      return;
    }

    const payload = {
      deliveryType: formData.get("deliveryType"),
      journeyType: hideJourneyType ? null : selectedJourneyType,
      capacityPercent: showCapacity ? capacityPercent : null,

      collectionDate: new Date(`${collectionDate}T00:00:00.000Z`).toISOString(),
      collectionWindow,
      vehicleSize: formData.get("vehicleSize"),

      collectionAddress: formatAddress(collectionAddress),
      collectionAddressDetails: collectionAddress,

      deliveryAddress: formatAddress(deliveryAddress),
      deliveryAddressDetails: deliveryAddress,

      returnAddress:
        selectedJourneyType === "Return" ? formatAddress(collectionAddress) : null,

      extraDrops: cleanedStops.length > 0 ? cleanedStops : null,

      loadDescription: formData.get("loadDescription"),
      fragileGoods,
      contactPreference: formData.get("contactPreference"),
      accuracyConfirmed,

      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail"),
      customerPhone: formData.get("customerPhone"),
      legalEntity: formData.get("legalEntity"),
      tradingName: formData.get("tradingName"),
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(data));
      }

      router.push(`/quote/${data.id}`);
    } catch (error) {
      console.error("Quote submission error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to generate quote. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF]">
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,108,255,0.28),_transparent_34%),linear-gradient(135deg,_#020B1F_0%,_#071D49_52%,_#006CFF_100%)] px-6 py-20 text-white md:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.055)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.055)_1px,_transparent_1px)] bg-[size:42px_42px] opacity-20" />

        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Premium UK Logistics
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
              Instant courier quotes built for serious business deliveries.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">
              Select your service, vehicle, capacity and delivery route. Get a structured quote
              instantly with clear pricing and a reference number.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Same day", "Multi-drop", "Full load"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur"
                >
                  <p className="text-sm font-semibold text-white">{item}</p>
                  <p className="mt-1 text-xs text-white/60">Business-ready service</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-6 text-[#071D49]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#006CFF]">
                Quote system live
              </p>
              <h2 className="mt-3 text-3xl font-bold">Get priced in minutes</h2>
              <div className="mt-6 grid gap-4">
                {[
                  ["1", "Choose delivery type"],
                  ["2", "Enter collection date and route"],
                  ["3", "Select vehicle and capacity"],
                  ["4", "Enter load and contact details"],
                ].map(([number, label]) => (
                  <div key={number} className="flex items-center gap-4 rounded-2xl bg-[#F4F8FF] p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006CFF] text-sm font-bold text-white">
                      {number}
                    </span>
                    <span className="text-sm font-semibold text-[#071D49]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex justify-center">
            <img
              src="/images/quote/Quotes.png"
              alt="Streamline Logistics Group delivering what matters"
              className="w-full max-w-[700px] rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10"
            />
          </div>

          <div className="mx-auto mb-10 grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[2rem] border border-white/10 bg-[#071D49] p-8 text-white shadow-2xl shadow-black/20">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
                What happens next
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                From quote request to confirmed delivery.
              </h2>

              <div className="mt-8 grid gap-4">
                {[
                  [
                    "1",
                    "Submit your quote",
                    "Enter the delivery type, route, vehicle, load and contact details.",
                  ],
                  [
                    "2",
                    "Review your price",
                    "The system returns your quote with distance, VAT and total price.",
                  ],
                  [
                    "3",
                    "Confirm the booking",
                    "Once payment is completed, the booking is created and the vehicle is reserved.",
                  ],
                  [
                    "4",
                    "Delivery is managed",
                    "Your job moves through booking, dispatch, delivery and proof of delivery.",
                  ],
                ].map(([number, title, text]) => (
                  <div
                    key={number}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#006CFF] text-sm font-bold text-white">
                      {number}
                    </span>

                    <div>
                      <h3 className="font-bold text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#D7E6FF] bg-white p-8 text-[#071D49] shadow-2xl shadow-black/10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#006CFF]">
                Vehicle size guide
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Choose the right vehicle for your load.
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Use this guide to check the size, pallet capacity and maximum weight before
                submitting your quote.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {Object.entries(vehicleDetails).map(([vehicle, details]) => (
                  <div
                    key={vehicle}
                    className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-[#071D49]">{vehicle}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {details.pallets}
                        </p>
                      </div>

                      <span className="rounded-full bg-[#006CFF] px-3 py-1 text-xs font-bold text-white">
                        {details.maxWeight}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <div className="rounded-xl bg-white p-3">
                        <p className="font-bold text-[#071D49]">Length</p>
                        <p className="mt-1">{details.length}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="font-bold text-[#071D49]">Width</p>
                        <p className="mt-1">{details.width}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="font-bold text-[#071D49]">Height</p>
                        <p className="mt-1">{details.height}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {quote && (
            <section className="mb-10 overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
              <div className="bg-gradient-to-r from-[#020B1F] via-[#071D49] to-[#006CFF] p-8 text-white">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
                      Quote generated
                    </p>

                    <h2 className="mt-3 text-5xl font-bold">
                      £{quote.totalPrice}
                    </h2>

                    <p className="mt-3 text-sm text-white/70">
                      Reference: {quote.id}
                    </p>
                  </div>

                  <div className="rounded-full border border-[#2D8CFF]/40 bg-[#006CFF]/15 px-5 py-2 text-sm font-semibold text-white">
                    {quote.status}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-6 text-sm md:grid-cols-3">
                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <p className="text-slate-500">Estimated Distance</p>
                  <p className="mt-2 text-xl font-bold text-[#071D49]">
                    {quote.distanceMiles} miles
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <p className="text-slate-500">Base Price</p>
                  <p className="mt-2 text-xl font-bold text-[#071D49]">
                    £{quote.basePrice}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <p className="text-slate-500">Fuel Surcharge</p>
                  <p className="mt-2 text-xl font-bold text-[#071D49]">
                    £{quote.fuelSurcharge}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <p className="text-slate-500">Subtotal Before VAT</p>
                  <p className="mt-2 text-xl font-bold text-[#071D49]">
                    £{quote.adminPrice}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <p className="text-slate-500">VAT</p>
                  <p className="mt-2 text-xl font-bold text-[#071D49]">
                    £{quote.vatAmount}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#071D49] bg-[#071D49] p-5 text-white">
                  <p className="text-white/70">Total</p>
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

          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.56fr_0.72fr] lg:items-start">
            <aside className="hidden space-y-4 lg:block lg:sticky lg:top-32">
              {[
                ["Dedicated vehicle", "Your delivery is handled by a suitable vehicle for the job."],
                ["Business courier support", "Clear details help us manage urgent and scheduled deliveries properly."],
                ["Proof of delivery", "Delivery information supports booking, dispatch and handover records."],
                ["UK-wide coverage", "Built for business deliveries across the United Kingdom."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-3xl border border-[#D7E6FF] bg-white p-5 shadow-lg shadow-black/5"
                >
                  <h3 className="text-sm font-bold text-[#071D49]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </aside>

            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10"
            >
              <div className="border-b border-[#D7E6FF] bg-[#071D49] p-8 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
                  Quote details
                </p>
                <h2 className="mt-3 text-3xl font-bold">Build your delivery quote</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                  Complete the sections below. Required details are checked before quote generation.
                </p>
              </div>

              <div className="grid gap-8 p-6 md:p-8">
                <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                      Step 1
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#071D49]">
                      Service requirements
                    </h3>
                  </div>

                  <div className="grid gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Delivery Type
                      </label>
                      <select
                        name="deliveryType"
                        required
                        value={selectedDeliveryType}
                        onChange={(event) => handleDeliveryTypeChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      >
                        <option value="">Select delivery type</option>
                        <option value="Same Day Delivery (One Way, Return, Multi Drop)">
                          Same Day Delivery (One Way, Return, Multi Drop)
                        </option>
                        <option value="Next Day Delivery (One Way, Return, Multi Drop)">
                          Next Day Delivery (One Way, Return, Multi Drop)
                        </option>
                        <option value="Full Day Booking">Full Day Booking</option>
                        <option value="Half Day Booking">Half Day Booking</option>
                        <option value="Full Load (One Way, Return, Multi Drop)">
                          Full Load (One Way, Return, Multi Drop)
                        </option>
                      </select>
                    </div>

                    {!hideJourneyType && (
                      <div>
                        <label className="block text-sm font-semibold text-[#071D49]">
                          Journey Type
                        </label>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          {["One Way", "Return", "Multi Drop"].map((option) => (
                            <label
                              key={option}
                              className={`cursor-pointer rounded-2xl border p-5 text-sm font-bold transition ${selectedJourneyType === option
                                  ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                                  : "border-[#D7E6FF] bg-white text-[#071D49] hover:border-[#2D8CFF]"
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
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                      Step 2
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#071D49]">
                      Collection and delivery route
                    </h3>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Collection Date
                      </label>
                      <input
                        type="date"
                        name="collectionDate"
                        required
                        min={getTodayDateString()}
                        value={collectionDate}
                        onChange={(event) => {
                          setCollectionDate(event.target.value);
                          setCollectionWindow("");
                        }}
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Collection Window
                      </label>
                      <select
                        name="collectionWindow"
                        required
                        value={collectionWindow}
                        onChange={(event) => setCollectionWindow(event.target.value)}
                        disabled={!collectionDate}
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">Select collection window</option>
                        {availableCollectionWindows.map((window) => (
                          <option key={window} value={window}>
                            {window}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!showAddressFields && (
                    <div className="mt-6 rounded-2xl border border-[#D7E6FF] bg-white p-5 text-sm font-semibold text-[#071D49]">
                      Select the collection date and collection window before entering collection and delivery addresses.
                    </div>
                  )}

                  {showAddressFields && (
                    <div className="mt-6 grid gap-6">
                      <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                        <h4 className="text-base font-bold text-[#071D49]">
                          Collection Address
                        </h4>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <input
                            required
                            placeholder="Address line 1"
                            value={collectionAddress.addressLine1}
                            onChange={(event) =>
                              updateCollectionAddress("addressLine1", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            placeholder="Address line 2"
                            value={collectionAddress.addressLine2}
                            onChange={(event) =>
                              updateCollectionAddress("addressLine2", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="Town / City"
                            value={collectionAddress.townCity}
                            onChange={(event) =>
                              updateCollectionAddress("townCity", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="County"
                            value={collectionAddress.county}
                            onChange={(event) =>
                              updateCollectionAddress("county", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="Postcode"
                            value={collectionAddress.postcode}
                            onChange={(event) =>
                              updateCollectionAddress("postcode", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10 md:col-span-2"
                          />
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                        <h4 className="text-base font-bold text-[#071D49]">
                          {showExtraStops ? "Delivery Address (Stop 1)" : "Delivery Address"}
                        </h4>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <input
                            required
                            placeholder="Address line 1"
                            value={deliveryAddress.addressLine1}
                            onChange={(event) =>
                              updateDeliveryAddress("addressLine1", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            placeholder="Address line 2"
                            value={deliveryAddress.addressLine2}
                            onChange={(event) =>
                              updateDeliveryAddress("addressLine2", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="Town / City"
                            value={deliveryAddress.townCity}
                            onChange={(event) =>
                              updateDeliveryAddress("townCity", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="County"
                            value={deliveryAddress.county}
                            onChange={(event) =>
                              updateDeliveryAddress("county", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                          />

                          <input
                            required
                            placeholder="Postcode"
                            value={deliveryAddress.postcode}
                            onChange={(event) =>
                              updateDeliveryAddress("postcode", event.target.value)
                            }
                            className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10 md:col-span-2"
                          />
                        </div>
                      </div>

                      {selectedJourneyType === "Return" && (
                        <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                          <label className="block text-sm font-semibold text-[#071D49]">
                            Return Address
                          </label>

                          <textarea
                            readOnly
                            rows={3}
                            value={returnAddress}
                            className="mt-2 w-full resize-none rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] px-4 py-4 text-[#071D49] outline-none"
                          />

                          <p className="mt-3 text-sm font-semibold text-[#071D49]">
                            Return address is automatically set to the collection address.
                            If the return address is different, select Multi Drop instead.
                          </p>
                        </div>
                      )}

                      {showExtraStops && (
                        <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-bold text-[#071D49]">
                                Extra Stops
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Delivery Address is Stop 1. Added stops begin from Stop 2.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={addStop}
                              className="rounded-full bg-[#006CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2D8CFF]"
                            >
                              Add Stop
                            </button>
                          </div>

                          <div className="mt-5 grid gap-4">
                            {extraStops.map((stop, index) => (
                              <div
                                key={index}
                                className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4"
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <p className="text-sm font-bold text-[#071D49]">
                                    Stop {stop.order}
                                  </p>

                                  <button
                                    type="button"
                                    onClick={() => removeStop(index)}
                                    className="text-sm font-bold text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <input
                                    required
                                    value={stop.addressLine1}
                                    onChange={(event) =>
                                      updateStopAddress(index, "addressLine1", event.target.value)
                                    }
                                    placeholder="Address line 1"
                                    className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                                  />

                                  <input
                                    value={stop.addressLine2}
                                    onChange={(event) =>
                                      updateStopAddress(index, "addressLine2", event.target.value)
                                    }
                                    placeholder="Address line 2"
                                    className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                                  />

                                  <input
                                    required
                                    value={stop.townCity}
                                    onChange={(event) =>
                                      updateStopAddress(index, "townCity", event.target.value)
                                    }
                                    placeholder="Town / City"
                                    className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                                  />

                                  <input
                                    required
                                    value={stop.county}
                                    onChange={(event) =>
                                      updateStopAddress(index, "county", event.target.value)
                                    }
                                    placeholder="County"
                                    className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                                  />

                                  <input
                                    required
                                    value={stop.postcode}
                                    onChange={(event) =>
                                      updateStopAddress(index, "postcode", event.target.value)
                                    }
                                    placeholder="Postcode"
                                    className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10 md:col-span-2"
                                  />
                                </div>

                                <div className="mt-4">
                                  <label className="block text-sm font-semibold text-[#071D49]">
                                    Capacity Required At Stop {stop.order}
                                  </label>

                                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                                    {capacityOptions.map((option) => (
                                      <button
                                        key={option.percent}
                                        type="button"
                                        onClick={() => updateStopCapacity(index, option.percent)}
                                        className={`rounded-2xl border p-4 text-left text-sm font-bold transition ${stop.capacityPercent === option.percent
                                            ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                                            : "border-[#D7E6FF] bg-white text-[#071D49] hover:border-[#2D8CFF]"
                                          }`}
                                      >
                                        <span className="block text-xl">{option.label}</span>
                                        <span className="mt-1 block text-xs opacity-80">
                                          {option.pallets}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-[#D7E6FF] bg-white p-6">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                      Step 3
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#071D49]">
                      Vehicle and load capacity
                    </h3>
                  </div>

                  <div className="grid gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
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
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      >
                        <option value="">Select vehicle</option>
                        <option value="Small Van">Small Van</option>
                        <option value="SWB Van">SWB Van</option>
                        <option value="LWB High Roof Van">LWB High Roof Van</option>
                        <option value="XLWB High Roof">XLWB High Roof</option>
                        <option value="Luton Tail Lift Curtainsider">
                          Luton Tail Lift Curtainsider
                        </option>
                      </select>
                    </div>

                    {showCapacity && selectedVehicle && (
                      <div>
                        <label className="block text-sm font-semibold text-[#071D49]">
                          Vehicle Capacity Required
                        </label>

                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          {capacityOptions.map((option) => (
                            <button
                              key={option.percent}
                              type="button"
                              onClick={() => setCapacityPercent(option.percent)}
                              className={`rounded-2xl border p-5 text-left text-sm font-bold transition ${capacityPercent === option.percent
                                  ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                                  : "border-[#D7E6FF] bg-[#F4F8FF] text-[#071D49] hover:border-[#2D8CFF]"
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

                <section className="rounded-3xl border border-[#D7E6FF] bg-white p-6">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                      Step 4
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#071D49]">
                      Load and contact details
                    </h3>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Load Description
                      </label>
                      <textarea
                        name="loadDescription"
                        required
                        rows={3}
                        placeholder="Example: palletised goods, machinery, boxed items"
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Contact Preference
                      </label>
                      <select
                        name="contactPreference"
                        required
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      >
                        <option value="">Select contact preference</option>
                        <option value="Phone">Phone</option>
                        <option value="Email">Email</option>
                        <option value="WhatsApp">WhatsApp</option>
                      </select>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 text-sm font-bold text-[#071D49]">
                      <input
                        type="checkbox"
                        checked={fragileGoods}
                        onChange={(event) => setFragileGoods(event.target.checked)}
                      />
                      Fragile goods
                    </label>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Your Name
                      </label>
                      <input
                        name="customerName"
                        required
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Email
                      </label>
                      <input
                        type="email"
                        name="customerEmail"
                        required
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Phone
                      </label>
                      <input
                        name="customerPhone"
                        required
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Legal Entity
                      </label>
                      <input
                        name="legalEntity"
                        required
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Trading Name If Different
                      </label>
                      <input
                        name="tradingName"
                        className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-6">
                  <label className="flex cursor-pointer items-start gap-4 text-sm font-bold text-[#071D49]">
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
                  className="rounded-2xl bg-gradient-to-r from-[#071D49] via-[#0B2A63] to-[#006CFF] px-8 py-5 text-base font-bold text-white shadow-xl shadow-[#071D49]/20 transition hover:from-[#020B1F] hover:to-[#2D8CFF] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating Quote..." : "Get Instant Quote"}
                </button>
              </div>
            </form>

            <aside className="hidden space-y-4 lg:block lg:sticky lg:top-32">
              <div className="overflow-hidden rounded-3xl border border-[#D7E6FF] bg-white shadow-lg shadow-black/5">
                <img
                  src="/images/quote/Quotes.png"
                  alt="Streamline Logistics Group van"
                  className="h-44 w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="text-sm font-bold text-[#071D49]">
                    Need help choosing a vehicle?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use the vehicle guide above before selecting your van size and capacity.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#D7E6FF] bg-[#071D49] p-6 text-white shadow-lg shadow-black/10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2D8CFF]">
                  Support
                </p>
                <h3 className="mt-2 text-2xl font-bold">0333 344 0703</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Contact Streamline Logistics Group if the shipment needs specialist handling.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <section className="mx-auto mt-8 max-w-7xl rounded-[2rem] border border-[#2D8CFF]/20 bg-[linear-gradient(135deg,_#071D49_0%,_#0B2A63_50%,_#006CFF_100%)] p-8 text-white shadow-2xl shadow-black/20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
                Quote promise
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Clear delivery quotes for business customers.
              </h2>

              <p className="mt-4 text-sm leading-6 text-white/70">
                The quote form is built to collect the details needed for a reliable
                business delivery price, without unnecessary questions or duplicated steps.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["No unnecessary fields", "Only the information needed to price and record the delivery."],
                ["Business-ready records", "Quotes are saved for booking, payment, invoice and admin workflows."],
                ["Vehicle clarity", "Vehicle dimensions and capacities are visible before submitting."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
                >
                  <h3 className="font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      {showVehicleModal &&
        selectedVehicle &&
        vehicleDetails[selectedVehicle] && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
        <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-6 bg-[#071D49] p-6 text-white">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
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
              className="h-64 w-full rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] object-contain"
            />

            <div className="mt-6 grid gap-4 text-sm text-[#071D49] md:grid-cols-2">
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                Length: {vehicleDetails[selectedVehicle].length}
              </div>
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                Width: {vehicleDetails[selectedVehicle].width}
              </div>
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                Height: {vehicleDetails[selectedVehicle].height}
              </div>
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4">
                Pallets: {vehicleDetails[selectedVehicle].pallets}
              </div>
              <div className="rounded-2xl border border-[#D7E6FF] bg-[#F4F8FF] p-4 md:col-span-2">
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