"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://streamline-logistics-production.up.railway.app";

const ADMIN_KEY_STORAGE_KEY = "streamline_admin_key";

const VEHICLE_TYPES = [
  "Small Van",
  "SWB Van",
  "LWB High Roof Van",
  "XLWB High Roof Van",
  "Luton Tail Lift Van",
] as const;

const CAPACITY_OPTIONS = [
  { label: "0–25", value: 25, pricingVehicle: "Small Van" },
  { label: "25–50", value: 50, pricingVehicle: "SWB Van" },
  { label: "50–75", value: 75, pricingVehicle: "LWB High Roof Van" },
  { label: "75–100", value: 100, pricingVehicle: "XLWB High Roof Van" },
] as const;

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 22;
const HOUR_WIDTH = 100;
const VEHICLE_COLUMN_WIDTH = 220;
const ROW_HEIGHT = 88;
const TIMELINE_WIDTH = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_WIDTH;

const COLLECTION_WINDOWS = [
  "06:00-08:00",
  "08:00-10:00",
  "10:00-12:00",
  "12:00-14:00",
  "14:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
  "20:00-22:00",
] as const;

type JourneyType = "One Way" | "Return" | "Multi";

type Customer = {
  id: string;
  name: string;
  companyName?: string | null;
  legalEntity?: string | null;
  tradingName?: string | null;
  email: string;
  phone?: string | null;
  accountStatus: string;
};

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  active?: boolean;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  estimatedStartTime?: string | null;
  estimatedEndTime?: string | null;
  collectionAddress: string;
  deliveryAddress: string;
  totalPrice: string | number;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    email: string;
  } | null;
  quote?: {
    id?: string;
    companyName?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    vehicleSize?: string | null;
    totalPrice?: string | number | null;
  } | null;
  vehicle?: Vehicle | null;
  vehicleId?: string | null;
};

type Calculation = {
  distanceMiles: number;
  durationMinutes: number | null;
  basePrice: string | number;
  fuelSurcharge: string | number;
  adminPrice: string | number;
  discountAmount: string | number;
  vatAmount: string | number;
  totalPrice: string | number;
  extraDropCount: number;
};

type PlanningPayload = {
  bookings?: Booking[];
  vehicles?: Vehicle[];
  error?: string;
};

type CustomerPayload = {
  customers?: Customer[];
  error?: string;
};

type CalculatePayload = {
  success?: boolean;
  calculation?: Calculation;
  error?: string;
};

type QuotePayload = {
  success?: boolean;
  quote?: {
    id: string;
  };
  calculation?: Calculation;
  error?: string;
};

type BookingPayload = {
  success?: boolean;
  booking?: Booking;
  id?: string;
  error?: string;
};

type FormState = {
  accountId: string;
  journeyType: JourneyType;
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress: string;
  capacityPercent: number;
  guestCompanyName: string;
  guestAddress: string;
  guestEmail: string;
  guestPhone: string;
  guestVatNumber: string;
};

const initialForm: FormState = {
  accountId: "GUEST",
  journeyType: "One Way",
  collectionAddress: "",
  deliveryAddress: "",
  returnAddress: "",
  capacityPercent: 25,
  guestCompanyName: "",
  guestAddress: "",
  guestEmail: "",
  guestPhone: "",
  guestVatNumber: "",
};

function localDateInput(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function displayLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function displayTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function bookingCustomerName(booking: Booking) {
  return (
    booking.user?.companyName ||
    booking.user?.name ||
    booking.quote?.companyName ||
    booking.quote?.customerName ||
    "Guest Customer"
  );
}

function minutesFromTimelineStart(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return (
    (date.getHours() - TIMELINE_START_HOUR) * 60 +
    date.getMinutes()
  );
}

function bookingBlockStyle(booking: Booking) {
  const startMinutes = minutesFromTimelineStart(booking.estimatedStartTime);
  const endMinutes = minutesFromTimelineStart(booking.estimatedEndTime);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const visibleStart = Math.max(0, startMinutes);
  const visibleEnd = Math.min(
    (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60,
    endMinutes,
  );

  if (visibleEnd <= visibleStart) return null;

  return {
    left: (visibleStart / 60) * HOUR_WIDTH,
    width: Math.max(72, ((visibleEnd - visibleStart) / 60) * HOUR_WIDTH),
  };
}

function normaliseJourneyTypeForApi(journeyType: JourneyType) {
  if (journeyType === "Return") return "Return";
  if (journeyType === "Multi") return "Multi";
  return "One-way";
}

function capacityPricingVehicle(capacityPercent: number) {
  return (
    CAPACITY_OPTIONS.find((option) => option.value === capacityPercent)
      ?.pricingVehicle || "Small Van"
  );
}

function windowFromDropOffset(offsetX: number) {
  const rawHour = TIMELINE_START_HOUR + offsetX / HOUR_WIDTH;
  const clampedHour = Math.min(
    TIMELINE_END_HOUR - 2,
    Math.max(TIMELINE_START_HOUR, rawHour),
  );

  const roundedStart =
    TIMELINE_START_HOUR +
    Math.round((clampedHour - TIMELINE_START_HOUR) / 2) * 2;

  const safeStart = Math.min(TIMELINE_END_HOUR - 2, roundedStart);
  const label = `${String(safeStart).padStart(2, "0")}:00-${String(
    safeStart + 2,
  ).padStart(2, "0")}:00`;

  return COLLECTION_WINDOWS.includes(
    label as (typeof COLLECTION_WINDOWS)[number],
  )
    ? label
    : "06:00-08:00";
}

export default function AdminPlanningBoardPage() {
  const [adminKey, setAdminKey] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [extraStops, setExtraStops] = useState<string[]>([]);
  const [planningDate, setPlanningDate] = useState(() =>
    localDateInput(new Date()),
  );

  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [boardOnly, setBoardOnly] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [draggingDraft, setDraggingDraft] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAdminKey(
      window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY)?.trim() || "",
    );
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.accountId) || null,
    [customers, form.accountId],
  );

  const canonicalVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) =>
        VEHICLE_TYPES.includes(
          vehicle.vehicleType as (typeof VEHICLE_TYPES)[number],
        ),
      ),
    [vehicles],
  );

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.vehicleId &&
          canonicalVehicles.some((vehicle) => vehicle.id === booking.vehicleId),
      ),
    [bookings, canonicalVehicles],
  );

  const loadCustomers = useCallback(async () => {
    if (!adminKey) {
      setLoadingCustomers(false);
      return;
    }

    setLoadingCustomers(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/customers?page=1&pageSize=100&accountStatus=ACTIVE`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as CustomerPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load customer accounts.");
      }

      setCustomers(payload.customers || []);
    } catch (requestError) {
      setCustomers([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load customer accounts.",
      );
    } finally {
      setLoadingCustomers(false);
    }
  }, [adminKey]);

  const loadPlanningBoard = useCallback(
    async (showLoader = true) => {
      if (!adminKey || !planningDate) return;

      if (showLoader) setLoadingBoard(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: planningDate,
          days: "1",
          status: "ALL",
          driverId: "ALL",
          vehicleType: "ALL",
          unassignedOnly: "false",
        });

        const response = await fetch(
          `${API_BASE}/api/admin/planning?${params.toString()}`,
          {
            headers: {
              "x-admin-key": adminKey,
            },
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as PlanningPayload;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load planning board.");
        }

        setBookings(payload.bookings || []);
        setVehicles(payload.vehicles || []);
      } catch (requestError) {
        setBookings([]);
        setVehicles([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load planning board.",
        );
      } finally {
        if (showLoader) setLoadingBoard(false);
      }
    },
    [adminKey, planningDate],
  );

  useEffect(() => {
    if (adminKey) {
      void loadCustomers();
    } else {
      setLoadingCustomers(false);
    }
  }, [adminKey, loadCustomers]);

  useEffect(() => {
    if (planningOpen && adminKey) {
      void loadPlanningBoard();
    }
  }, [adminKey, loadPlanningBoard, planningOpen]);

  function updateForm<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addStop() {
    setExtraStops((current) => [...current, ""]);
  }

  function updateStop(index: number, value: string) {
    setExtraStops((current) =>
      current.map((stop, stopIndex) => (stopIndex === index ? value : stop)),
    );
  }

  function removeStop(index: number) {
    setExtraStops((current) =>
      current.filter((_, stopIndex) => stopIndex !== index),
    );
  }

  function buildExtraDrops() {
    return extraStops
      .map((address, index) => ({
        order: index + 1,
        address: address.trim(),
      }))
      .filter((drop) => drop.address);
  }

  function validateManualForm() {
    if (!form.accountId) {
      return "Select an account.";
    }

    if (form.accountId === "GUEST") {
      if (!form.guestCompanyName.trim()) {
        return "Enter the guest company name.";
      }

      if (!form.guestAddress.trim()) {
        return "Enter the guest address.";
      }

      if (!form.guestEmail.trim()) {
        return "Enter the guest email.";
      }

      if (!form.guestPhone.trim()) {
        return "Enter the guest contact number.";
      }
    }

    if (!form.collectionAddress.trim()) {
      return "Enter the collection address.";
    }

    if (!form.deliveryAddress.trim()) {
      return "Enter the delivery address.";
    }

    if (form.journeyType === "Return" && !form.returnAddress.trim()) {
      return "Enter the return address.";
    }

    if (
      form.journeyType === "Multi" &&
      buildExtraDrops().length === 0
    ) {
      return "Add at least one stop for a multi journey.";
    }

    return "";
  }

  async function calculateJourney() {
    if (!adminKey) {
      setError(
        "Admin key is required. Unlock the admin area from Driver Management.",
      );
      return;
    }

    const validationError = validateManualForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setCalculating(true);
    setError("");
    setMessage("");
    setCreatedBookingId(null);

    try {
      const response = await fetch(`${API_BASE}/api/quotes/admin/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          deliveryType: "Dedicated",
          journeyType: normaliseJourneyTypeForApi(form.journeyType),
          vehicleSize: capacityPricingVehicle(form.capacityPercent),
          collectionAddress: form.collectionAddress.trim(),
          deliveryAddress: form.deliveryAddress.trim(),
          returnAddress:
            form.journeyType === "Return"
              ? form.returnAddress.trim()
              : null,
          extraDrops:
            form.journeyType === "Multi" ? buildExtraDrops() : [],
          capacityPercent: form.capacityPercent,
        }),
      });

      const payload = (await response.json()) as CalculatePayload;

      if (!response.ok || !payload.calculation) {
        throw new Error(payload.error || "Unable to calculate the journey.");
      }

      setCalculation(payload.calculation);
      setBoardOnly(false);
      setPlanningOpen(true);
      setMessage(
        "Journey calculated. Drag the booking onto an available vehicle and time.",
      );
    } catch (requestError) {
      setCalculation(null);
      setPlanningOpen(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to calculate the journey.",
      );
    } finally {
      setCalculating(false);
    }
  }

  function shiftPlanningDate(direction: number) {
    const [year, month, day] = planningDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + direction);
    setPlanningDate(localDateInput(date));
  }

  async function createQuoteForDrop(
    vehicle: Vehicle,
    collectionWindow: string,
  ) {
    const commonBody = {
      deliveryType: "Dedicated",
      journeyType: normaliseJourneyTypeForApi(form.journeyType),
      vehicleSize: vehicle.vehicleType,
      collectionDate: `${planningDate}T00:00:00`,
      collectionWindow,
      collectionAddress: form.collectionAddress.trim(),
      deliveryAddress: form.deliveryAddress.trim(),
      returnAddress:
        form.journeyType === "Return" ? form.returnAddress.trim() : null,
      extraDrops:
        form.journeyType === "Multi" ? buildExtraDrops() : [],
      capacityPercent: form.capacityPercent,
      sendToCustomer: false,
      accuracyConfirmed: true,
    };

    if (form.accountId === "GUEST") {
      const response = await fetch(`${API_BASE}/api/quotes/admin/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          ...commonBody,
          companyName: form.guestCompanyName.trim(),
          customerName: form.guestCompanyName.trim(),
          customerEmail: form.guestEmail.trim(),
          customerPhone: form.guestPhone.trim(),
          guestAddress: form.guestAddress.trim(),
          vatNumber: form.guestVatNumber.trim() || null,
        }),
      });

      const payload = (await response.json()) as QuotePayload;

      if (!response.ok || !payload.quote?.id) {
        throw new Error(payload.error || "Unable to create guest quote.");
      }

      return {
        quoteId: payload.quote.id,
        calculation: payload.calculation || null,
      };
    }

    const response = await fetch(
      `${API_BASE}/api/quotes/admin/customer/${form.accountId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify(commonBody),
      },
    );

    const payload = (await response.json()) as QuotePayload;

    if (!response.ok || !payload.quote?.id) {
      throw new Error(payload.error || "Unable to create customer quote.");
    }

    return {
      quoteId: payload.quote.id,
      calculation: payload.calculation || null,
    };
  }

  async function createUnassignedBooking(quoteId: string) {
    const response = await fetch(
      `${API_BASE}/api/bookings/admin/from-quote/${quoteId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
      },
    );

    const payload = (await response.json()) as BookingPayload;
    const booking = payload.booking;

    if (!response.ok || !booking?.id) {
      throw new Error(payload.error || "Unable to create planning booking.");
    }

    return booking;
  }

  async function assignExactVehicle(bookingId: string, vehicleId: string) {
    const response = await fetch(
      `${API_BASE}/api/admin/planning/bookings/${bookingId}/assignment`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          vehicleId,
        }),
      },
    );

    const payload = (await response.json()) as BookingPayload;

    if (!response.ok) {
      throw new Error(payload.error || "Unable to assign the vehicle.");
    }
  }

  async function handleDraftDrop(
    event: React.DragEvent<HTMLDivElement>,
    vehicle: Vehicle,
  ) {
    event.preventDefault();

    if (!calculation || assigning) return;

    const timelineElement = event.currentTarget;
    const rect = timelineElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const collectionWindow = windowFromDropOffset(offsetX);

    setAssigning(true);
    setDraggingDraft(false);
    setError("");
    setMessage("");

    try {
      /*
       * Recalculate against the exact vehicle type being assigned.
       * This keeps the final stored charge aligned with the physical vehicle
       * chosen on the planning board.
       */
      const finalCalculationResponse = await fetch(
        `${API_BASE}/api/quotes/admin/calculate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            deliveryType: "Dedicated",
            journeyType: normaliseJourneyTypeForApi(form.journeyType),
            vehicleSize: vehicle.vehicleType,
            collectionAddress: form.collectionAddress.trim(),
            deliveryAddress: form.deliveryAddress.trim(),
            returnAddress:
              form.journeyType === "Return"
                ? form.returnAddress.trim()
                : null,
            extraDrops:
              form.journeyType === "Multi" ? buildExtraDrops() : [],
            capacityPercent: form.capacityPercent,
          }),
        },
      );

      const finalCalculationPayload =
        (await finalCalculationResponse.json()) as CalculatePayload;

      if (!finalCalculationResponse.ok) {
        throw new Error(
          finalCalculationPayload.error ||
            "Unable to calculate the final vehicle charge.",
        );
      }

      const quoteResult = await createQuoteForDrop(vehicle, collectionWindow);

      if (quoteResult.calculation) {
        setCalculation(quoteResult.calculation);
      } else if (finalCalculationPayload.calculation) {
        setCalculation(finalCalculationPayload.calculation);
      }

      const newBooking = await createUnassignedBooking(quoteResult.quoteId);

      await assignExactVehicle(newBooking.id, vehicle.id);

      setCreatedBookingId(newBooking.id);

      await loadPlanningBoard(false);

      setMessage(
        `${newBooking.reference} assigned to ${
          vehicle.registration || vehicle.name || vehicle.vehicleType
        } at ${collectionWindow}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign the booking.",
      );
    } finally {
      setAssigning(false);
    }
  }

  function resetForAnotherBooking() {
    setForm(initialForm);
    setExtraStops([]);
    setCalculation(null);
    setBoardOnly(false);
    setPlanningOpen(false);
    setCreatedBookingId(null);
    setMessage("");
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
          Tab 4
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Planning / Create New Booking
        </h1>
      </div>

      {!planningOpen ? (
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <FieldLabel label="Select Account">
                <select
                  value={form.accountId}
                  disabled={loadingCustomers}
                  onChange={(event) =>
                    updateForm("accountId", event.target.value)
                  }
                  className="manual-input"
                >
                  <option value="GUEST">Guest Customer (No Account)</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName ||
                        customer.legalEntity ||
                        customer.tradingName ||
                        customer.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              {selectedCustomer ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-bold text-slate-900">
                    {selectedCustomer.companyName ||
                      selectedCustomer.legalEntity ||
                      selectedCustomer.name}
                  </span>
                  <span className="mx-2 text-slate-300">•</span>
                  {selectedCustomer.email}
                  {selectedCustomer.phone ? (
                    <>
                      <span className="mx-2 text-slate-300">•</span>
                      {selectedCustomer.phone}
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-7">
                <p className="text-sm font-bold text-slate-700">Journey</p>
                <div className="mt-3 flex flex-wrap gap-5">
                  {(["One Way", "Return", "Multi"] as JourneyType[]).map(
                    (journeyType) => (
                      <label
                        key={journeyType}
                        className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="radio"
                          name="journeyType"
                          value={journeyType}
                          checked={form.journeyType === journeyType}
                          onChange={() => {
                            setForm((current) => ({
                              ...current,
                              journeyType,
                              returnAddress:
                                journeyType === "Return"
                                  ? current.collectionAddress
                                  : current.returnAddress,
                            }));
                          }}
                          className="h-4 w-4 accent-[#FF6A00]"
                        />
                        {journeyType}
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <FieldLabel label="Collection Address">
                  <textarea
                    rows={3}
                    value={form.collectionAddress}
                    onChange={(event) => {
                      const nextCollectionAddress = event.target.value;

                      setForm((current) => ({
                        ...current,
                        collectionAddress: nextCollectionAddress,
                        returnAddress:
                          current.journeyType === "Return"
                            ? nextCollectionAddress
                            : current.returnAddress,
                      }));
                    }}
                    className="manual-input resize-none"
                  />
                </FieldLabel>

                <FieldLabel label="Delivery Address">
                  <textarea
                    rows={3}
                    value={form.deliveryAddress}
                    onChange={(event) =>
                      updateForm("deliveryAddress", event.target.value)
                    }
                    className="manual-input resize-none"
                  />
                </FieldLabel>

                {form.journeyType === "Return" ? (
                  <FieldLabel label="Return Address">
                    <textarea
                      rows={3}
                      value={form.returnAddress}
                      onChange={(event) =>
                        updateForm("returnAddress", event.target.value)
                      }
                      className="manual-input resize-none"
                    />
                  </FieldLabel>
                ) : null}

                {form.journeyType === "Multi" ? (
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-slate-700">
                        Add Stops
                      </p>
                      <button
                        type="button"
                        onClick={addStop}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Plus size={16} />
                        Add Stop
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {extraStops.map((stop, index) => (
                        <div key={index} className="flex gap-2">
                          <textarea
                            rows={2}
                            value={stop}
                            onChange={(event) =>
                              updateStop(index, event.target.value)
                            }
                            placeholder={`Stop ${index + 1}`}
                            className="manual-input resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeStop(index)}
                            className="rounded-xl border border-slate-300 px-3 text-slate-500 hover:bg-slate-50 hover:text-red-600"
                            aria-label={`Remove stop ${index + 1}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))}

                      {extraStops.length === 0 ? (
                        <button
                          type="button"
                          onClick={addStop}
                          className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-500 hover:border-orange-300 hover:bg-orange-50/40"
                        >
                          Add first stop
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-7">
                <p className="text-sm font-bold text-slate-700">Capacity</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {CAPACITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold ${
                        form.capacityPercent === option.value
                          ? "border-[#FF6A00] bg-orange-50 text-[#E55300]"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="capacity"
                        className="sr-only"
                        checked={form.capacityPercent === option.value}
                        onChange={() =>
                          updateForm("capacityPercent", option.value)
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <aside>
              {form.accountId === "GUEST" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <p className="text-sm font-bold text-slate-950">
                    Guest Customer Details
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    For invoice purpose
                  </p>

                  <div className="mt-5 space-y-4">
                    <FieldLabel label="Company Name">
                      <input
                        value={form.guestCompanyName}
                        onChange={(event) =>
                          updateForm("guestCompanyName", event.target.value)
                        }
                        className="manual-input"
                      />
                    </FieldLabel>

                    <FieldLabel label="Address">
                      <textarea
                        rows={3}
                        value={form.guestAddress}
                        onChange={(event) =>
                          updateForm("guestAddress", event.target.value)
                        }
                        className="manual-input resize-none"
                      />
                    </FieldLabel>

                    <FieldLabel label="Email">
                      <input
                        type="email"
                        value={form.guestEmail}
                        onChange={(event) =>
                          updateForm("guestEmail", event.target.value)
                        }
                        className="manual-input"
                      />
                    </FieldLabel>

                    <FieldLabel label="Contact No">
                      <input
                        value={form.guestPhone}
                        onChange={(event) =>
                          updateForm("guestPhone", event.target.value)
                        }
                        className="manual-input"
                      />
                    </FieldLabel>

                    <FieldLabel label="VAT No if applicable">
                      <input
                        value={form.guestVatNumber}
                        onChange={(event) =>
                          updateForm("guestVatNumber", event.target.value)
                        }
                        className="manual-input"
                      />
                    </FieldLabel>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Select an existing account on the left. Guest invoice details
                  are only required when Guest Customer is selected.
                </div>
              )}
            </aside>
          </div>

          {error ? <ErrorBox text={error} /> : null}

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setCalculation(null);
                setCreatedBookingId(null);
                setBoardOnly(true);
                setPlanningOpen(true);
                setMessage("");
                setError("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Truck size={18} />
              Open Planning Board
            </button>

            <button
              type="button"
              disabled={calculating}
              onClick={() => void calculateJourney()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-60"
            >
              {calculating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Calculator size={18} />
              )}
              Calculate Journey Time + Charges
            </button>
          </div>
        </section>
      ) : (
        <>
          {!boardOnly ? (
          <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                    New booking ready to plan
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {form.accountId === "GUEST"
                      ? form.guestCompanyName
                      : selectedCustomer?.companyName ||
                        selectedCustomer?.legalEntity ||
                        selectedCustomer?.name ||
                        "Customer"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {form.collectionAddress} → {form.deliveryAddress}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Charge
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {money(calculation?.totalPrice)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoBox
                  label="Journey time"
                  value={
                    calculation?.durationMinutes != null
                      ? `${calculation.durationMinutes} mins`
                      : "Not returned"
                  }
                />
                <InfoBox
                  label="Distance"
                  value={`${calculation?.distanceMiles ?? 0} miles`}
                />
                <InfoBox
                  label="Capacity"
                  value={
                    CAPACITY_OPTIONS.find(
                      (option) => option.value === form.capacityPercent,
                    )?.label || ""
                  }
                />
              </div>
            </div>

            <div
              draggable={!assigning && !createdBookingId}
              onDragStart={() => setDraggingDraft(true)}
              onDragEnd={() => setDraggingDraft(false)}
              className={`flex min-h-[160px] w-full cursor-grab flex-col justify-center rounded-3xl border-2 border-dashed p-5 shadow-sm lg:w-[300px] ${
                draggingDraft
                  ? "border-[#FF6A00] bg-orange-50"
                  : createdBookingId
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-orange-300 bg-white"
              }`}
            >
              {assigning ? (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FF6A00]" />
              ) : createdBookingId ? (
                <>
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  <p className="mt-3 font-bold text-emerald-800">
                    Booking assigned
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    It is now shown on the planning board.
                  </p>
                </>
              ) : (
                <>
                  <Truck className="h-7 w-7 text-[#E55300]" />
                  <p className="mt-3 font-bold text-slate-950">
                    Drag this booking
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Drop it onto an available vehicle at the required time.
                  </p>
                  <p className="mt-3 text-lg font-bold text-[#E55300]">
                    {money(calculation?.totalPrice)}
                  </p>
                </>
              )}
            </div>
          </section>
          ) : null}

          <section
            className={`${
              boardOnly ? "mt-7" : "mt-6"
            } rounded-3xl border border-slate-200 bg-white shadow-sm`}
          >
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftPlanningDate(-1)}
                  className="rounded-xl border border-slate-300 p-2.5 text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft size={19} />
                </button>

                <button
                  type="button"
                  onClick={() => setPlanningDate(localDateInput(new Date()))}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => shiftPlanningDate(1)}
                  className="rounded-xl border border-slate-300 p-2.5 text-slate-700 hover:bg-slate-50"
                >
                  <ChevronRight size={19} />
                </button>

                <input
                  type="date"
                  value={planningDate}
                  onChange={(event) => setPlanningDate(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
                />
              </div>

              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-700">
                  {displayLongDate(planningDate)}
                </p>
                <button
                  type="button"
                  onClick={() => void loadPlanningBoard()}
                  disabled={loadingBoard}
                  className="rounded-xl border border-slate-300 p-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Refresh planning board"
                >
                  <RefreshCw
                    size={18}
                    className={loadingBoard ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </div>

            {loadingBoard ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="relative"
                  style={{
                    minWidth: VEHICLE_COLUMN_WIDTH + TIMELINE_WIDTH,
                  }}
                >
                  <div
                    className="sticky top-0 z-20 grid border-b border-slate-200 bg-white"
                    style={{
                      gridTemplateColumns: `${VEHICLE_COLUMN_WIDTH}px ${TIMELINE_WIDTH}px`,
                    }}
                  >
                    <div className="flex h-16 items-center border-r border-slate-200 px-5 text-sm font-bold text-slate-700">
                      Vehicle
                    </div>

                    <div className="relative h-16">
                      {Array.from(
                        {
                          length:
                            TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1,
                        },
                        (_, index) => {
                          const hour = TIMELINE_START_HOUR + index;
                          const left = index * HOUR_WIDTH;

                          return (
                            <div
                              key={hour}
                              className="absolute top-0 h-full border-l border-slate-200"
                              style={{ left }}
                            >
                              <span className="absolute left-2 top-5 text-xs font-bold text-slate-500">
                                {String(hour).padStart(2, "0")}:00
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {canonicalVehicles.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No active canonical fleet vehicles were returned.
                    </div>
                  ) : (
                    canonicalVehicles.map((vehicle) => {
                      const vehicleBookings = visibleBookings.filter(
                        (booking) => booking.vehicleId === vehicle.id,
                      );

                      return (
                        <div
                          key={vehicle.id}
                          className="grid border-b border-slate-200 last:border-b-0"
                          style={{
                            gridTemplateColumns: `${VEHICLE_COLUMN_WIDTH}px ${TIMELINE_WIDTH}px`,
                            minHeight: ROW_HEIGHT,
                          }}
                        >
                          <div className="flex min-h-[88px] flex-col justify-center border-r border-slate-200 bg-slate-50 px-5">
                            <p className="font-bold text-slate-950">
                              {vehicle.registration ||
                                vehicle.name ||
                                vehicle.vehicleType}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {vehicle.vehicleType}
                            </p>
                          </div>

                          <div
                            className={`relative min-h-[88px] ${
                              draggingDraft && !createdBookingId
                                ? "bg-orange-50/50"
                                : "bg-white"
                            }`}
                            onDragOver={(event) => {
                              if (!createdBookingId) {
                                event.preventDefault();
                              }
                            }}
                            onDrop={(event) => {
                              if (!createdBookingId) {
                                void handleDraftDrop(event, vehicle);
                              }
                            }}
                          >
                            {Array.from(
                              {
                                length:
                                  TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1,
                              },
                              (_, index) => (
                                <div
                                  key={index}
                                  className="pointer-events-none absolute top-0 h-full border-l border-slate-100"
                                  style={{
                                    left: index * HOUR_WIDTH,
                                  }}
                                />
                              ),
                            )}

                            {vehicleBookings.map((booking) => {
                              const block = bookingBlockStyle(booking);

                              if (!block) return null;

                              const isCreated = booking.id === createdBookingId;

                              return (
                                <div
                                  key={booking.id}
                                  className={`absolute top-3 z-10 h-[62px] overflow-hidden rounded-xl border px-3 py-2 shadow-sm ${
                                    isCreated
                                      ? "border-emerald-300 bg-emerald-50"
                                      : "border-orange-200 bg-orange-50"
                                  }`}
                                  style={{
                                    left: block.left,
                                    width: block.width,
                                  }}
                                  title={`${booking.reference} · ${bookingCustomerName(
                                    booking,
                                  )} · ${money(booking.totalPrice)}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-bold text-slate-950">
                                      {bookingCustomerName(booking)}
                                    </p>
                                    <span className="shrink-0 text-[11px] font-bold text-[#E55300]">
                                      {money(booking.totalPrice)}
                                    </span>
                                  </div>
                                  <p className="mt-1 truncate text-[11px] text-slate-500">
                                    {displayTime(booking.estimatedStartTime)}–
                                    {displayTime(booking.estimatedEndTime)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          {error ? <ErrorBox text={error} /> : null}

          {message ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPlanningOpen(false);
                setBoardOnly(false);
                setCreatedBookingId(null);
                setMessage("");
                setError("");
              }}
              disabled={assigning}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Back to Booking Details
            </button>

            {createdBookingId ? (
              <button
                type="button"
                onClick={resetForAnotherBooking}
                className="rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300]"
              >
                Create Another Booking
              </button>
            ) : null}
          </div>
        </>
      )}

      <style jsx>{`
        :global(.manual-input) {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
        }

        :global(.manual-input:focus) {
          border-color: #ff6a00;
          box-shadow: 0 0 0 4px rgb(255 237 213);
        }
      `}</style>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
      {text}
    </div>
  );
}
