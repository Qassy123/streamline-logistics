"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";

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
};

type AddressFields = {
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};

type SavedRoutePrefill = {
  deliveryType?: string | null;
  journeyType?: string | null;
  capacityPercent?: number | null;
  vehicleSize?: string | null;
  collectionAddress?: string | null;
  collectionAddressDetails?: Partial<AddressFields> | null;
  deliveryAddress?: string | null;
  deliveryAddressDetails?: Partial<AddressFields> | null;
  extraDrops?: unknown;
  whatAreWeCollecting?: string | null;
  loadDescription?: string | null;
  specialInstructions?: string | null;
  contactPreference?: string | null;
};

const API_URL =
  "https://streamline-logistics-production.up.railway.app/api/quotes";
const QUOTE_FORM_STORAGE_KEY = "streamline_quote_form_draft";
const SAVED_ROUTE_STORAGE_KEY = "streamline_saved_route_prefill";

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
    label: string;
    length: string;
    width: string;
    height: string;
    pallets: string;
    maxWeight: string;
    image: string;
  }
> = {
  "Small Van": {
    label: "Small Van",
    length: "1.5m",
    width: "1.2m",
    height: "1.1m",
    pallets: "1 pallet",
    maxWeight: "400kg",
    image: "/Vehicles/smallvan.jpg",
  },
  "SWB Van": {
    label: "SWB Van",
    length: "2.4m",
    width: "1.6m",
    height: "1.4m",
    pallets: "2 pallets",
    maxWeight: "900kg",
    image: "/Vehicles/swb.jpeg",
  },
  "LWB High Roof Van": {
    label: "LWB High Roof Van",
    length: "3.4m",
    width: "1.7m",
    height: "1.7m",
    pallets: "3 pallets",
    maxWeight: "1,200kg",
    image: "/Vehicles/lwb.jpg",
  },
  "XLWB High Roof Van": {
    label: "XLWB High Roof Van",
    length: "4.2m",
    width: "1.7m",
    height: "1.9m",
    pallets: "4 pallets",
    maxWeight: "1,400kg",
    image: "/Vehicles/XLWB High Roof.jpg",
  },
  "Luton Tail Lift Van": {
    label: "Luton Tail Lift Van",
    length: "4.0m",
    width: "2.0m",
    height: "2.0m",
    pallets: "6 pallets",
    maxWeight: "1,000kg",
    image: "/Vehicles/Luton Tail Lift.jpg",
  },
};

const vehicleAvailability: Record<
  string,
  { available: boolean; reason?: string }
> = {
  "Small Van": { available: true },
  "SWB Van": { available: true },
  "LWB High Roof Van": { available: true },
  "XLWB High Roof Van": { available: true },
  "Luton Tail Lift Van": { available: true },
};

const vehicleOptions = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
];

const capacityOptions = [
  { percent: 25, label: "0-25%", text: "Quarter load" },
  { percent: 50, label: "25-50%", text: "Half load" },
  { percent: 75, label: "50-75%", text: "Three quarter load" },
  { percent: 100, label: "75-100%", text: "Full load" },
];

const collectingOptions = [
  "Documents",
  "Small Item",
  "Medium Item",
  "Large Item",
  "Fragile Item",
  "Pallet",
];

const emptyAddress: AddressFields = {
  addressLine1: "",
  addressLine2: "",
  townCity: "",
  county: "",
  postcode: "",
};

function normaliseAddressFields(
  details: Partial<AddressFields> | null | undefined,
  fallbackAddress?: string | null,
): AddressFields {
  if (details && typeof details === "object") {
    return {
      addressLine1: details.addressLine1 || "",
      addressLine2: details.addressLine2 || "",
      townCity: details.townCity || "",
      county: details.county || "",
      postcode: details.postcode || "",
    };
  }

  if (!fallbackAddress) return emptyAddress;

  const parts = fallbackAddress.split(",").map((part) => part.trim());

  return {
    addressLine1: parts[0] || "",
    addressLine2: parts[1] || "",
    townCity: parts[2] || "",
    county: parts[3] || "",
    postcode: parts[4] || "",
  };
}

function normaliseExtraStops(extraDrops: unknown): ExtraStop[] {
  if (!Array.isArray(extraDrops)) return [];

  return extraDrops
    .filter((drop) => drop && typeof drop === "object")
    .map((drop, index) => {
      const stop = drop as Partial<ExtraStop> & {
        address?: string;
      };

      const fallbackAddress = stop.address || "";
      const fallbackParts = fallbackAddress
        .split(",")
        .map((part) => part.trim());

      return {
        order: Number(stop.order || index + 2),
        addressLine1: stop.addressLine1 || fallbackParts[0] || "",
        addressLine2: stop.addressLine2 || fallbackParts[1] || "",
        townCity: stop.townCity || fallbackParts[2] || "",
        county: stop.county || fallbackParts[3] || "",
        postcode: stop.postcode || fallbackParts[4] || "",
      };
    });
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWindowStartMinutes(window: string) {
  const [hours, minutes] = window.split("-")[0].split(":").map(Number);

  return hours * 60 + minutes;
}

function formatTimeFromMinutes(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const wrappedMinutes =
    ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildSameDayCollectionWindows() {
  const now = new Date();
  const earliestMinutes = now.getHours() * 60 + now.getMinutes() + 120;
  const firstSlotStart = Math.ceil(earliestMinutes / 60) * 60;

  return Array.from({ length: 12 }, (_, index) => {
    const startMinutes = firstSlotStart + index * 120;
    const endMinutes = startMinutes + 120;

    return `${formatTimeFromMinutes(startMinutes)}-${formatTimeFromMinutes(endMinutes)}`;
  });
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        className="inline-flex text-[#006CFF]"
        aria-label="Show information"
      >
        <HelpCircle size={18} aria-hidden="true" />
      </button>

      {open && (
        <span className="absolute left-1/2 top-7 z-20 w-72 -translate-x-1/2 rounded-2xl border border-[#D7E6FF] bg-white p-4 text-xs font-semibold leading-5 text-[#071D49] shadow-2xl shadow-black/10">
          {text}
        </span>
      )}
    </span>
  );
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
  const formRef = useRef<HTMLFormElement | null>(null);

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState("");

  const [selectedDeliveryType, setSelectedDeliveryType] = useState("");
  const [selectedJourneyType, setSelectedJourneyType] = useState("");
  const [selectedCollectingItem, setSelectedCollectingItem] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [capacityPercent, setCapacityPercent] = useState<number | null>(null);
  const [returnCapacityPercent, setReturnCapacityPercent] = useState<number | null>(null);
  const [extraStops, setExtraStops] = useState<ExtraStop[]>([]);

  const [collectionDate, setCollectionDate] = useState("");
  const [collectionWindow, setCollectionWindow] = useState("");
  const [collectionAddress, setCollectionAddress] =
    useState<AddressFields>(emptyAddress);
  const [deliveryAddress, setDeliveryAddress] =
    useState<AddressFields>(emptyAddress);

  const [fragileGoods, setFragileGoods] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  useEffect(() => {
    try {
      const savedRoute = window.localStorage.getItem(SAVED_ROUTE_STORAGE_KEY);

      if (savedRoute) {
        const route = JSON.parse(savedRoute) as SavedRoutePrefill;

        setSelectedDeliveryType(route.deliveryType || "");
        setSelectedJourneyType(route.journeyType || "");
        setSelectedCollectingItem(route.whatAreWeCollecting || "");
        setSelectedVehicle(route.vehicleSize || "");
        setCapacityPercent(route.capacityPercent ?? null);
        setReturnCapacityPercent(null);
        setExtraStops(normaliseExtraStops(route.extraDrops));
        setCollectionAddress(
          normaliseAddressFields(
            route.collectionAddressDetails,
            route.collectionAddress,
          ),
        );
        setDeliveryAddress(
          normaliseAddressFields(
            route.deliveryAddressDetails,
            route.deliveryAddress,
          ),
        );
        setFragileGoods(false);
        setAccuracyConfirmed(false);

        window.localStorage.removeItem(SAVED_ROUTE_STORAGE_KEY);
        window.localStorage.removeItem(QUOTE_FORM_STORAGE_KEY);

        window.requestAnimationFrame(() => {
          const form = formRef.current;

          if (!form) return;

          const formValues: Record<string, string> = {
            loadDescription: route.loadDescription || "",
            specialInstructions: route.specialInstructions || "",
            contactPreference: route.contactPreference || "",
          };

          Object.entries(formValues).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);

            if (
              field instanceof HTMLInputElement ||
              field instanceof HTMLSelectElement ||
              field instanceof HTMLTextAreaElement
            ) {
              field.value = value;
            }
          });
        });

        setDraftLoaded(true);
        return;
      }

      const savedDraft = window.localStorage.getItem(QUOTE_FORM_STORAGE_KEY);

      if (!savedDraft) {
        setDraftLoaded(true);
        return;
      }

      const draft = JSON.parse(savedDraft) as {
        selectedDeliveryType?: string;
        selectedJourneyType?: string;
        selectedCollectingItem?: string;
        selectedVehicle?: string;
        capacityPercent?: number | null;
        returnCapacityPercent?: number | null;
        extraStops?: ExtraStop[];
        collectionDate?: string;
        collectionWindow?: string;
        collectionAddress?: AddressFields;
        deliveryAddress?: AddressFields;
        fragileGoods?: boolean;
        accuracyConfirmed?: boolean;
        formValues?: Record<string, string>;
      };

      setSelectedDeliveryType(draft.selectedDeliveryType || "");
      setSelectedJourneyType(draft.selectedJourneyType || "");
      setSelectedCollectingItem(draft.selectedCollectingItem || "");
      setSelectedVehicle(draft.selectedVehicle || "");
      setCapacityPercent(draft.capacityPercent ?? null);
      setReturnCapacityPercent(draft.returnCapacityPercent ?? null);
      setExtraStops(Array.isArray(draft.extraStops) ? draft.extraStops : []);
      setCollectionDate(draft.collectionDate || "");
      setCollectionWindow(draft.collectionWindow || "");
      setCollectionAddress(draft.collectionAddress || emptyAddress);
      setDeliveryAddress(draft.deliveryAddress || emptyAddress);
      setFragileGoods(Boolean(draft.fragileGoods));
      setAccuracyConfirmed(Boolean(draft.accuracyConfirmed));

      window.requestAnimationFrame(() => {
        const form = formRef.current;

        if (!form || !draft.formValues) return;

        Object.entries(draft.formValues).forEach(([name, value]) => {
          const field = form.elements.namedItem(name);

          if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLSelectElement ||
            field instanceof HTMLTextAreaElement
          ) {
            if (field.type !== "checkbox" && field.type !== "radio") {
              field.value = value;
            }
          }
        });
      });
    } catch {
      window.localStorage.removeItem(QUOTE_FORM_STORAGE_KEY);
      window.localStorage.removeItem(SAVED_ROUTE_STORAGE_KEY);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  function saveQuoteDraft() {
    if (!draftLoaded) return;

    const formValues: Record<string, string> = {};

    if (formRef.current) {
      const formData = new FormData(formRef.current);

      formData.forEach((value, key) => {
        formValues[key] = String(value);
      });
    }

    window.localStorage.setItem(
      QUOTE_FORM_STORAGE_KEY,
      JSON.stringify({
        selectedDeliveryType,
        selectedJourneyType,
        selectedCollectingItem,
        selectedVehicle,
        capacityPercent,
        returnCapacityPercent,
        extraStops,
        collectionDate,
        collectionWindow,
        collectionAddress,
        deliveryAddress,
        fragileGoods,
        accuracyConfirmed,
        formValues,
      }),
    );
  }

  useEffect(() => {
    saveQuoteDraft();
  }, [
    draftLoaded,
    selectedDeliveryType,
    selectedJourneyType,
    selectedCollectingItem,
    selectedVehicle,
    capacityPercent,
    returnCapacityPercent,
    extraStops,
    collectionDate,
    collectionWindow,
    collectionAddress,
    deliveryAddress,
    fragileGoods,
    accuracyConfirmed,
  ]);

  const hideJourneyType =
    selectedDeliveryType === "Full Day Booking" ||
    selectedDeliveryType === "Half Day Booking";

  const showCollectionCapacity =
    selectedJourneyType === "One Way" || selectedJourneyType === "Return";
  const showReturnCapacity = selectedJourneyType === "Return";
  const showCapacity = showCollectionCapacity;
  const showExtraStops = selectedJourneyType === "Multi Drop";
  const showAddressFields = Boolean(collectionDate && collectionWindow);
  const returnAddress = formatAddress(collectionAddress);

  const availableCollectionWindows = useMemo(() => {
    if (collectionDate !== getTodayDateString()) {
      return twoHourWindows;
    }

    return buildSameDayCollectionWindows();
  }, [collectionDate]);

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
        })),
    );
  }

  function updateStopAddress(
    index: number,
    field: keyof Omit<ExtraStop, "order">,
    value: string,
  ) {
    setExtraStops((currentStops) =>
      currentStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop,
      ),
    );
  }

  function scrollToField(target?: string) {
    window.requestAnimationFrame(() => {
      const form = formRef.current;

      if (!form) return;

      const targetElement = target
        ? form.querySelector<HTMLElement>(
            `[name="${target}"], [data-scroll-target="${target}"], #${target}`,
          )
        : form.querySelector<HTMLElement>(":invalid");

      if (!targetElement) return;

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (
        targetElement instanceof HTMLInputElement ||
        targetElement instanceof HTMLSelectElement ||
        targetElement instanceof HTMLTextAreaElement ||
        targetElement instanceof HTMLButtonElement
      ) {
        targetElement.focus({ preventScroll: true });
      }
    });
  }

  function stopWithError(message: string, target?: string) {
    setError(message);
    setLoading(false);
    scrollToField(target);
  }

  function handleDeliveryTypeChange(value: string) {
    setSelectedDeliveryType(value);
    setError("");
    setCollectionWindow("");

    if (value === "Full Day Booking" || value === "Half Day Booking") {
      setSelectedJourneyType("");
      setCapacityPercent(null);
      setReturnCapacityPercent(null);
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
      stopWithError("Please select One Way, Return, or Multi Drop.", "journeyType");
      return;
    }

    if (!selectedCollectingItem) {
      stopWithError("Please select what we are collecting.", "collecting-item");
      return;
    }

    if (!collectionDate || !collectionWindow) {
      stopWithError("Please select collection date and collection window.", "collectionDate");
      return;
    }

    if (!showAddressFields) {
      stopWithError(
        "Please select collection date and time before entering route details.",
        "collectionDate",
      );
      return;
    }

    if (!selectedVehicle) {
      stopWithError("Please select a vehicle size.", "vehicleSize");
      return;
    }

    if (
      selectedVehicle &&
      vehicleAvailability[selectedVehicle] &&
      !vehicleAvailability[selectedVehicle].available
    ) {
      stopWithError(
        "The selected vehicle is currently unavailable. Please choose another vehicle.",
        "vehicleSize",
      );
      return;
    }

    if (showCapacity && !capacityPercent) {
      stopWithError(
        "Please select the capacity required on collection.",
        "collection-capacity",
      );
      return;
    }

    if (showReturnCapacity && !returnCapacityPercent) {
      stopWithError(
        "Please select the capacity required on return.",
        "return-capacity",
      );
      return;
    }

    if (!isAddressComplete(collectionAddress)) {
      stopWithError(
        "Please complete the full collection address.",
        "route-information",
      );
      return;
    }

    if (!isValidUkPostcode(collectionAddress.postcode)) {
      stopWithError(
        "Please enter a valid UK postcode for the collection address.",
        "route-information",
      );
      return;
    }

    if (!isAddressComplete(deliveryAddress)) {
      stopWithError(
        "Please complete the full delivery address.",
        "route-information",
      );
      return;
    }

    if (!isValidUkPostcode(deliveryAddress.postcode)) {
      stopWithError(
        "Please enter a valid UK postcode for the delivery address.",
        "route-information",
      );
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
      }))
      .sort((a, b) => a.order - b.order);

    if (showExtraStops && cleanedStops.length === 0) {
      stopWithError(
        "Please add at least one extra stop for this multi-drop journey.",
        "extra-stops",
      );
      return;
    }

    if (showExtraStops && extraStops.some((stop) => !isAddressComplete(stop))) {
      stopWithError(
        "Please complete the address for every extra stop.",
        "extra-stops",
      );
      return;
    }

    if (
      showExtraStops &&
      extraStops.some((stop) => !isValidUkPostcode(stop.postcode))
    ) {
      stopWithError(
        "Please enter a valid UK postcode for every extra stop.",
        "extra-stops",
      );
      return;
    }

    if (!accuracyConfirmed) {
      stopWithError(
        "Please confirm that the quote details are accurate.",
        "accuracyConfirmed",
      );
      return;
    }

    const loadDescription = String(
      formData.get("loadDescription") || "",
    ).trim();
    const specialInstructions = String(
      formData.get("specialInstructions") || "",
    ).trim();

    const payload = {
      deliveryType: formData.get("deliveryType"),
      journeyType: hideJourneyType ? null : selectedJourneyType,
      whatAreWeCollecting: selectedCollectingItem || null,
      capacityPercent: showCapacity ? capacityPercent : null,
      returnCapacityPercent: showReturnCapacity ? returnCapacityPercent : null,

      collectionDate: new Date(`${collectionDate}T00:00:00.000Z`).toISOString(),
      collectionWindow,
      vehicleSize: formData.get("vehicleSize"),

      collectionAddress: formatAddress(collectionAddress),
      collectionAddressDetails: collectionAddress,

      deliveryAddress: formatAddress(deliveryAddress),
      deliveryAddressDetails: deliveryAddress,

      returnAddress:
        selectedJourneyType === "Return"
          ? formatAddress(collectionAddress)
          : null,

      extraDrops: showExtraStops && cleanedStops.length > 0 ? cleanedStops : null,

      loadDescription,
      specialInstructions,
      handoverContactName: null,
      handoverContactPhone: null,
      handoverNotes: null,
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
          : "Unable to generate quote. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-8 text-[#071D49] sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D7E6FF] bg-white px-5 py-3 text-sm font-bold text-[#071D49] shadow-sm transition hover:border-[#006CFF] hover:text-[#006CFF]"
        >
          ← Back
        </button>

        <section className="mb-8 overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-[linear-gradient(135deg,_#020B1F_0%,_#071D49_55%,_#006CFF_100%)] p-6 text-white shadow-2xl shadow-black/10 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2D8CFF]">
                Premium UK Logistics
              </p>

              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Instant courier quotes built for serious business deliveries.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
                Select your service, collection time, vehicle, route and load
                details. Get a structured quote instantly with clear pricing and
                a reference number.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Same day", "Multi-drop", "Full load"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-4"
                >
                  <p className="text-sm font-bold text-white">{item}</p>
                  <p className="mt-1 text-xs text-white/60">
                    Business-ready service
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {quote && (
          <section className="mb-8 overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10">
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

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onChange={saveQuoteDraft}
          className="overflow-hidden rounded-[2rem] border border-[#D7E6FF] bg-white shadow-2xl shadow-black/10"
        >
          <div className="border-b border-[#D7E6FF] bg-[#071D49] p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2D8CFF]">
              Quote details
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Build your delivery quote
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Complete the sections below. Required details are checked before
              quote generation.
            </p>
          </div>

          <div className="grid gap-8 p-5 sm:p-8">
            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                  Step 1
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#071D49]">
                    Service requirements
                  </h2>
                  <InfoTooltip text="Choose the delivery type and journey type. One Way is a single collection and delivery, Return brings the vehicle back, and Multi Drop allows multiple delivery stops." />
                </div>
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
                    onChange={(event) =>
                      handleDeliveryTypeChange(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                  >
                    <option value="">Select delivery type</option>
                    <option value="Same Day Delivery">Same Day Delivery</option>
                    <option value="Next Day Delivery">Next Day Delivery</option>
                    <option value="Multi Drop Delivery">Multi Drop Delivery</option>
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
                          className={`cursor-pointer rounded-2xl border p-5 text-center text-sm font-bold transition ${
                            selectedJourneyType === option
                              ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                              : "border-[#D7E6FF] bg-white text-[#071D49] hover:border-[#2D8CFF]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="journeyType"
                            value={option}
                            checked={selectedJourneyType === option}
                            onChange={() => {
                              setSelectedJourneyType(option);

                              if (option === "Multi Drop") {
                                setCapacityPercent(null);
                                setReturnCapacityPercent(null);
                              } else {
                                setExtraStops([]);
                              }

                              if (option !== "Return") {
                                setReturnCapacityPercent(null);
                              }
                            }}
                            className="sr-only"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="rounded-3xl border border-[#D7E6FF] bg-white p-5"
                  data-scroll-target="collecting-item"
                >
                  <label className="block text-sm font-semibold text-[#071D49]">
                    What are we collecting?
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {collectingOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelectedCollectingItem(option)}
                        className={`rounded-2xl border p-4 text-left text-sm font-bold transition ${
                          selectedCollectingItem === option
                            ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                            : "border-[#D7E6FF] bg-[#F4F8FF] text-[#071D49] hover:border-[#2D8CFF]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-800">
                    Our couriers work in <span className="font-bold">1 man teams</span>; you may need to provide assistance lifting heavy or fragile items at the collection and delivery addresses.
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-900">
                    <span className="font-bold">
                      Please ensure suitable loading and unloading facilities are available
                    </span>{" "}
                    at both the pick up and delivery address (e.g a forklift,
                    pallet truck, or sufficient manual assistance). Streamline
                    cannot be held responsible if a pallet cannot be loaded or
                    unloaded due to inadequate facilities at either address.
                  </div>
                </div>

                {showCollectionCapacity && (
                  <div
                    className="rounded-3xl border border-[#D7E6FF] bg-white p-5"
                    data-scroll-target="collection-capacity"
                  >
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Capacity Required On Collection
                      </label>
                      <InfoTooltip text="Select how much vehicle space your goods need on collection." />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {capacityOptions.map((option) => (
                        <button
                          key={option.percent}
                          type="button"
                          onClick={() => setCapacityPercent(option.percent)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            capacityPercent === option.percent
                              ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                              : "border-[#D7E6FF] bg-[#F4F8FF] text-[#071D49] hover:border-[#2D8CFF]"
                          }`}
                        >
                          <span className="block text-lg font-bold">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs font-semibold opacity-80">
                            {option.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showReturnCapacity && (
                  <div
                    className="rounded-3xl border border-[#D7E6FF] bg-white p-5"
                    data-scroll-target="return-capacity"
                  >
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-semibold text-[#071D49]">
                        Capacity Required On Return
                      </label>
                      <InfoTooltip text="Select how much vehicle space your return load needs." />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {capacityOptions.map((option) => (
                        <button
                          key={option.percent}
                          type="button"
                          onClick={() => setReturnCapacityPercent(option.percent)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            returnCapacityPercent === option.percent
                              ? "border-[#006CFF] bg-[#006CFF] text-white shadow-lg shadow-[#006CFF]/20"
                              : "border-[#D7E6FF] bg-[#F4F8FF] text-[#071D49] hover:border-[#2D8CFF]"
                          }`}
                        >
                          <span className="block text-lg font-bold">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs font-semibold opacity-80">
                            {option.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                  Step 2
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#071D49]">
                    Collection Date & Time
                  </h2>
                  <InfoTooltip text="Select the collection date and collection window. Same-day bookings only show windows at least 2 hours ahead. Future dates show all valid windows." />
                </div>
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
                    onChange={(event) =>
                      setCollectionWindow(event.target.value)
                    }
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
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-white p-5 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                  Step 3
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#071D49]">
                    Vehicle size
                  </h2>
                  <InfoTooltip text="Choose the vehicle size needed for the load. Available vehicles are shown first and unavailable vehicles are disabled for future booking control." />
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-900">
                <span className="font-bold">Important:</span> you are
                responsible for selecting the correct minimum van size. Please
                ensure the van you select is large enough for all your items -
                consider size, weight, and quantity. If in doubt, please choose
                a larger size. Streamline cannot be held responsible if an
                incorrectly sized van is selected and your items do not fit.
              </div>

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
                  {vehicleOptions.map((vehicle) => {
                    const availability = vehicleAvailability[vehicle];
                    const isAvailable = availability?.available ?? true;

                    return (
                      <option
                        key={vehicle}
                        value={vehicle}
                        disabled={!isAvailable}
                      >
                        {vehicleDetails[vehicle].label}{" "}
                        {isAvailable ? "(Available)" : "(Unavailable)"}
                      </option>
                    );
                  })}
                </select>
              </div>
            </section>

            <section
              className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6"
              data-scroll-target="route-information"
            >
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                  Step 4
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#071D49]">
                    Route information
                  </h2>
                  <InfoTooltip text="Enter collection and delivery addresses. For Multi Drop, add extra delivery stops after the first delivery address." />
                </div>
              </div>

              {!showAddressFields && (
                <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5 text-sm font-semibold text-[#071D49]">
                  Select the collection date and collection window before
                  entering route information.
                </div>
              )}

              {showAddressFields && (
                <div className="grid gap-6">
                  <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#071D49]">
                        Collection Address
                      </h3>
                      <InfoTooltip text="Enter the full collection address. Postcode lookup fields are structured here so the address finder can be connected next." />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input
                        required
                        placeholder="Address line 1"
                        value={collectionAddress.addressLine1}
                        onChange={(event) =>
                          updateCollectionAddress(
                            "addressLine1",
                            event.target.value,
                          )
                        }
                        className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />

                      <input
                        placeholder="Address line 2"
                        value={collectionAddress.addressLine2}
                        onChange={(event) =>
                          updateCollectionAddress(
                            "addressLine2",
                            event.target.value,
                          )
                        }
                        className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />

                      <input
                        required
                        placeholder="Town / City"
                        value={collectionAddress.townCity}
                        onChange={(event) =>
                          updateCollectionAddress(
                            "townCity",
                            event.target.value,
                          )
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

                      <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
                        <input
                          required
                          placeholder="Postcode"
                          value={collectionAddress.postcode}
                          onChange={(event) =>
                            updateCollectionAddress(
                              "postcode",
                              event.target.value,
                            )
                          }
                          className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                        />
                        <button
                          type="button"
                          className="rounded-2xl border border-[#006CFF] bg-white px-5 py-4 text-sm font-bold text-[#006CFF] transition hover:bg-[#006CFF] hover:text-white"
                        >
                          Find Address
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#D7E6FF] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#071D49]">
                        {showExtraStops
                          ? "Delivery Address (Stop 1)"
                          : "Delivery Address"}
                      </h3>
                      <InfoTooltip text="Enter the full delivery address. For Multi Drop, this is treated as Stop 1 and extra stops can be added below." />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input
                        required
                        placeholder="Address line 1"
                        value={deliveryAddress.addressLine1}
                        onChange={(event) =>
                          updateDeliveryAddress(
                            "addressLine1",
                            event.target.value,
                          )
                        }
                        className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                      />

                      <input
                        placeholder="Address line 2"
                        value={deliveryAddress.addressLine2}
                        onChange={(event) =>
                          updateDeliveryAddress(
                            "addressLine2",
                            event.target.value,
                          )
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

                      <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
                        <input
                          required
                          placeholder="Postcode"
                          value={deliveryAddress.postcode}
                          onChange={(event) =>
                            updateDeliveryAddress(
                              "postcode",
                              event.target.value,
                            )
                          }
                          className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                        />
                        <button
                          type="button"
                          className="rounded-2xl border border-[#006CFF] bg-white px-5 py-4 text-sm font-bold text-[#006CFF] transition hover:bg-[#006CFF] hover:text-white"
                        >
                          Find Address
                        </button>
                      </div>
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
                        Return address is automatically set to the collection
                        address. If the return address is different, select
                        Multi Drop instead.
                      </p>
                    </div>
                  )}

                  {showExtraStops && (
                    <div
                      className="rounded-3xl border border-[#D7E6FF] bg-white p-5"
                      data-scroll-target="extra-stops"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#071D49]">
                            Extra Stops
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Delivery Address is Stop 1. Added stops begin from
                            Stop 2.
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
                                  updateStopAddress(
                                    index,
                                    "addressLine1",
                                    event.target.value,
                                  )
                                }
                                placeholder="Address line 1"
                                className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                              />

                              <input
                                value={stop.addressLine2}
                                onChange={(event) =>
                                  updateStopAddress(
                                    index,
                                    "addressLine2",
                                    event.target.value,
                                  )
                                }
                                placeholder="Address line 2"
                                className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                              />

                              <input
                                required
                                value={stop.townCity}
                                onChange={(event) =>
                                  updateStopAddress(
                                    index,
                                    "townCity",
                                    event.target.value,
                                  )
                                }
                                placeholder="Town / City"
                                className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                              />

                              <input
                                required
                                value={stop.county}
                                onChange={(event) =>
                                  updateStopAddress(
                                    index,
                                    "county",
                                    event.target.value,
                                  )
                                }
                                placeholder="County"
                                className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                              />

                              <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
                                <input
                                  required
                                  value={stop.postcode}
                                  onChange={(event) =>
                                    updateStopAddress(
                                      index,
                                      "postcode",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Postcode"
                                  className="rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                                />
                                <button
                                  type="button"
                                  className="rounded-2xl border border-[#006CFF] bg-white px-5 py-4 text-sm font-bold text-[#006CFF] transition hover:bg-[#006CFF] hover:text-white"
                                >
                                  Find Address
                                </button>
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

            <section className="rounded-3xl border border-[#D7E6FF] bg-white p-5 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#006CFF]">
                  Step 5
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#071D49]">
                    Load & Contact Details
                  </h2>
                  <InfoTooltip text="Provide load information and the best contact details for booking updates. Add handover contact details for the delivery handover at collection." />
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-[#006CFF]/30 bg-[#EAF2FF] p-5 text-sm font-bold leading-6 text-[#071D49] shadow-sm">
                Please provide the contact information for the delivery handover
                at collection.
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
                    placeholder="Example: palletised goods, boxed items"
                    className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#071D49]">
                    Any special instructions
                  </label>
                  <textarea
                    name="specialInstructions"
                    rows={3}
                    placeholder="Add any special instructions for collection, delivery, access, loading or unloading."
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
                    Legal Entity Name
                  </label>
                  <input
                    name="legalEntity"
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
                    Trading Name If Different
                  </label>
                  <input
                    name="tradingName"
                    className="mt-2 w-full rounded-2xl border border-[#D7E6FF] bg-white px-4 py-4 text-[#071D49] outline-none transition focus:border-[#006CFF] focus:ring-4 focus:ring-[#006CFF]/10"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5 sm:p-6">
              <label className="flex cursor-pointer items-start gap-4 text-sm font-bold text-[#071D49]">
                <input
                  type="checkbox"
                  name="accuracyConfirmed"
                  checked={accuracyConfirmed}
                  onChange={(event) =>
                    setAccuracyConfirmed(event.target.checked)
                  }
                  className="mt-1"
                />
                I confirm that the collection, delivery, load and contact
                details provided are accurate.
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
      </div>

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
                    {vehicleDetails[selectedVehicle].label}
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
                  alt={vehicleDetails[selectedVehicle].label}
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
