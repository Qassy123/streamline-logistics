"use client";
import { calendarInterval, calendarTimeText, dropCollectionWindow } from "@/lib/bookingCalendar";
import FleetAllocationBoard from "@/components/admin/FleetAllocationBoard";

import { useCallback, useEffect, useMemo, useState } from "react";
import PostcodeAddressLookup, { formatPostcodeAddress } from "@/components/PostcodeAddressLookup";
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  MapPinned,
  Plus,
  PoundSterling,
  ReceiptText,
  RefreshCw,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";

import AdminCustomerQuoteForm, { type AdminQuotePayload } from "@/components/admin/AdminCustomerQuoteForm";

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
  { label: "0â€“25", value: 25, pricingVehicle: "Small Van" },
  { label: "25â€“50", value: 50, pricingVehicle: "SWB Van" },
  { label: "50â€“75", value: 75, pricingVehicle: "LWB High Roof Van" },
  { label: "75â€“100", value: 100, pricingVehicle: "XLWB High Roof Van" },
] as const;

const TIMELINE_START_HOUR = 0;
const TIMELINE_END_HOUR = 24;
const HOUR_WIDTH = 100;
const VEHICLE_COLUMN_WIDTH = 220;
const ROW_HEIGHT = 88;
const END_MARKER_WIDTH = 72;
const TIMELINE_WIDTH = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_WIDTH;

const COLLECTION_WINDOWS = Array.from({ length: 23 }, (_, hour) => dropCollectionWindow(hour * HOUR_WIDTH, HOUR_WIDTH));

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
  accountType?: string;
};

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
  active?: boolean;
  taxDueDate?: string | null;
  motExpiry?: string | null;
};

type BookingRefund = {id:string;amount:string|number;method:string;status:string;lastError?:string|null;manualReference?:string|null};
type Booking = {
  refundRequests?: BookingRefund[];
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  estimatedStartTime?: string | null;
  estimatedEndTime?: string | null;
  vehicleAvailableAt?: string | null;
  collectionAddress: string;
  deliveryAddress: string;
  returnAddress?: string | null;
  extraDrops?: unknown;
  totalPrice: string | number;
  customerReference?: string | null;
  purchaseOrderNumber?: string | null;
  internalNotes?: string | null;
  dispatchNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    companyName?: string | null;
    legalEntity?: string | null;
    tradingName?: string | null;
    email: string;
    phone?: string | null;
    accountType?: string | null;
    accountNumber?: string | null;
  } | null;
  quote?: {
    id?: string;
    status?: string | null;
    companyName?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    deliveryType?: string | null;
    journeyType?: string | null;
    vehicleSize?: string | null;
    capacityPercent?: number | null;
    distanceMiles?: string | number | null;
    basePrice?: string | number | null;
    fuelSurcharge?: string | number | null;
    adminPrice?: string | number | null;
    vatAmount?: string | number | null;
    totalPrice?: string | number | null;
    whatAreWeCollecting?: string | null;
    loadDescription?: string | null;
    specialInstructions?: string | null;
    contactPreference?: string | null;
    handoverContactName?: string | null;
    handoverContactPhone?: string | null;
    handoverContactNotes?: string | null;
    fragileGoods?: boolean | null;
    palletCount?: number | null;
  } | null;
  vehicle?: Vehicle | null;
  vehicleId?: string | null;
  driver?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    availability?: string | null;
  } | null;
  driverId?: string | null;
  payments?: Array<{
    id: string;
    status?: string | null;
    amount?: string | number | null;
    createdAt?: string | null;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber?: string | null;
    status?: string | null;
    total?: string | number | null;
  }>;
  pod?: {
    status?: string | null;
    recipientName?: string | null;
    deliveredAt?: string | null;
  } | null;
  reservation?: {
    status?: string | null;
    reservedFrom?: string | null;
    reservedUntil?: string | null;
  } | null;
  trackingEvents?: Array<{
    id: string;
    title?: string | null;
    description?: string | null;
    status?: string | null;
    createdAt?: string | null;
  }>;
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
  pagination?: { totalPages: number };
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
  action?: "PAYMENT_REQUIRED" | "TRADE_BOOKING_CREATED" | "GUEST_BOOKING_CREATED";
  accountType?: string;
  quoteId?: string;
  paymentUrl?: string;
  booking?: Booking;
  id?: string;
  code?: string;
  error?: string;
  canOverride?: boolean;
  complianceWarnings?: Array<{
    type: "TAX" | "MOT";
    dueDate: string;
    daysUntil: number;
    expired: boolean;
  }>;
  vehicle?: {
    id: string;
    name?: string | null;
    registration?: string | null;
    vehicleType?: string | null;
  };
  credit?: {
    creditLimit?: string | number;
    exposure?: string | number;
    availableCredit?: string | number;
    requestedAmount?: string | number;
  };
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
  purchaseOrderNumber: string;
  customerReference: string;
  creditOverrideReason: string;
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
  purchaseOrderNumber: "",
  customerReference: "",
  creditOverrideReason: "",
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

function mileageRate(calculation: Calculation | null) {
  if (!calculation || calculation.distanceMiles <= 0) return 0;

  return Number(calculation.fuelSurcharge || 0) / calculation.distanceMiles;
}

function extraStopsPrice(calculation: Calculation | null) {
  if (!calculation) return 0;

  return Math.max(
    Number(calculation.adminPrice || 0) -
      Number(calculation.basePrice || 0) -
      Number(calculation.fuelSurcharge || 0),
    0,
  );
}

function formatMileageRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Â£0.00";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

function bookingBlockStyle(booking: Booking, selectedDate: string) {
  const interval = calendarInterval(booking, selectedDate);
  if (!interval) return null;
  return { left: interval.start / 60 * HOUR_WIDTH, width: Math.max(46, (interval.end - interval.start) / 60 * HOUR_WIDTH - 6) };
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

function windowFromDropOffset(offsetX: number) { return dropCollectionWindow(offsetX, HOUR_WIDTH); }

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

  const [customerFormPayload, setCustomerFormPayload] = useState<AdminQuotePayload | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [boardOnly, setBoardOnly] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [draggingDraft, setDraggingDraft] = useState(false);
  const [savedDraftReference, setSavedDraftReference] = useState("");
  const [draftVehicleId, setDraftVehicleId] = useState("");
  const [draftWindow, setDraftWindow] = useState("08:00-10:00");
  const [dragTarget, setDragTarget] = useState<{
    vehicleId: string;
    collectionWindow: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editCollectionWindow, setEditCollectionWindow] = useState("");
  const [editCollectionAddress, setEditCollectionAddress] = useState("");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editTotalPrice, setEditTotalPrice] = useState("");
  const [editManualPrice,setEditManualPrice]=useState(false);
  const [editRecalculate,setEditRecalculate]=useState(false);
  const [editAdjustment,setEditAdjustment]=useState("");
  const [editAdjustmentReason,setEditAdjustmentReason]=useState("");
  const [editExtraDrops,setEditExtraDrops]=useState<Array<Record<string,unknown>&{address:string}>>([]);
  const [refundBusy,setRefundBusy]=useState(false);
  const [refundReferences,setRefundReferences]=useState<Record<string,string>>({});
  const [editReturnAddress, setEditReturnAddress] = useState("");
  const [editCustomerReference, setEditCustomerReference] = useState("");
  const [editPurchaseOrderNumber, setEditPurchaseOrderNumber] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editDispatchNotes, setEditDispatchNotes] = useState("");
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);

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
      vehicles,
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
      const allCustomers: Customer[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await fetch(API_BASE + "/api/admin/customers?page=" + page + "&pageSize=100&accountStatus=ACTIVE", { headers: { "x-admin-key": adminKey }, cache: "no-store" });
        const payload = await response.json() as CustomerPayload;
        if (!response.ok) throw new Error(payload.error || "Unable to load customer accounts.");
        allCustomers.push(...(payload.customers || []));
        totalPages = payload.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);
      setCustomers(allCustomers);
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

        setBookings((payload.bookings || []).filter(booking => booking.collectionDate.slice(0, 10) === planningDate || calendarInterval(booking, planningDate)));
        const fleet = new Map((payload.vehicles || []).map(vehicle => [vehicle.id, vehicle]));
        for (const booking of payload.bookings || []) if (booking.vehicle) fleet.set(booking.vehicle.id, booking.vehicle);
        setVehicles([...fleet.values()]);
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

  async function calculateJourney(payload: AdminQuotePayload) {
    if (!adminKey) throw new Error("Unlock the admin area before calculating a quote.");
    setCalculating(true); setError(""); setMessage(""); setCreatedBookingId(null); setSavedDraftReference("");
    try {
      const response = await fetch(API_BASE + "/api/quotes/admin/calculate", {
        method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify(payload),
      });
      const result = await response.json() as CalculatePayload;
      if (!response.ok || !result.calculation) throw new Error(result.error || "Unable to calculate the journey.");
      setCustomerFormPayload(payload);
      setDraftVehicleId(""); setDraftWindow(String(payload.collectionWindow || "08:00-10:00"));
      setPlanningDate(String(payload.collectionDate).slice(0, 10));
      setForm((current) => ({ ...current,
        journeyType: payload.journeyType === "Multi Drop" ? "Multi" : payload.journeyType === "Return" ? "Return" : "One Way",
        collectionAddress: String(payload.collectionAddress || ""), deliveryAddress: String(payload.deliveryAddress || ""), returnAddress: String(payload.returnAddress || ""),
        capacityPercent: Number(payload.capacityPercent || 0), guestCompanyName: String(payload.legalEntity || payload.customerName || ""),
        guestEmail: String(payload.customerEmail || ""), guestPhone: String(payload.customerPhone || ""),
      }));
      setExtraStops(Array.isArray(payload.extraDrops) ? payload.extraDrops.map((drop: { address?: string }) => drop.address || "") : []);
      setCalculation(result.calculation); setBoardOnly(false); setPlanningOpen(true);
      setMessage("Journey calculated. Choose a vehicle and collection time below, or drag onto the calendar.");
    } catch (error) {
      setCalculation(null);
      throw error;
    } finally { setCalculating(false); }
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
    if (!customerFormPayload) throw new Error("Complete and calculate the quote form first.");
    const commonBody = {
      ...customerFormPayload,
      vehicleSize: vehicle.vehicleType,
      collectionDate: new Date(planningDate + "T00:00:00.000Z").toISOString(),
      collectionWindow, sendToCustomer: false,
      customerReference: form.customerReference.trim() || null,
      purchaseOrderNumber: form.purchaseOrderNumber.trim() || null,
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
          customerName: String(customerFormPayload.customerName || form.guestCompanyName).trim(),
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
        body: JSON.stringify({
          purchaseOrderNumber: form.purchaseOrderNumber.trim() || null,
          customerReference: form.customerReference.trim() || null,
          creditOverrideReason: form.creditOverrideReason.trim() || null,
        }),
      },
    );

    const payload = (await response.json()) as BookingPayload;

    if (!response.ok) {
      if (payload.code === "CREDIT_LIMIT_EXCEEDED") {
        const available = money(payload.credit?.availableCredit);
        const requested = money(payload.credit?.requestedAmount);
        throw new Error(
          `${payload.error || "Credit limit exceeded."} Available credit: ${available}. Booking: ${requested}. Enter an override reason to continue.`,
        );
      }
      throw new Error(payload.error || "Unable to create planning booking.");
    }

    if (payload.action === "PAYMENT_REQUIRED" && payload.paymentUrl) {
      window.location.href = payload.paymentUrl;
      return null;
    }

    if (!payload.booking?.id) {
      throw new Error(payload.error || "Unable to create planning booking.");
    }

    return payload.booking;
  }

  async function assignExactVehicle(
    bookingId: string,
    vehicleId: string,
    complianceOverride = false,
  ) {
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
          complianceOverride,
        }),
      },
    );

    const payload = (await response.json()) as BookingPayload;

    if (
      response.status === 409 &&
      payload.code === "VEHICLE_COMPLIANCE_WARNING" &&
      payload.canOverride &&
      payload.complianceWarnings?.length
    ) {
      const vehicleLabel =
        payload.vehicle?.registration ||
        payload.vehicle?.name ||
        payload.vehicle?.vehicleType ||
        "Selected vehicle";

      const warningLines = payload.complianceWarnings.map((warning) => {
        const dueDate = new Date(warning.dueDate);
        const formattedDate = Number.isNaN(dueDate.getTime())
          ? warning.dueDate
          : new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(dueDate);

        if (warning.expired) {
          return `${warning.type}: expired ${Math.abs(
            warning.daysUntil,
          )} day${Math.abs(warning.daysUntil) === 1 ? "" : "s"} ago (${formattedDate})`;
        }

        if (warning.daysUntil === 0) {
          return `${warning.type}: due today (${formattedDate})`;
        }

        return `${warning.type}: due in ${warning.daysUntil} day${
          warning.daysUntil === 1 ? "" : "s"
        } (${formattedDate})`;
      });

      const confirmed = window.confirm(
        `Vehicle compliance warning for ${vehicleLabel}:\n\n${warningLines.join(
          "\n",
        )}\n\nThis is a warning only. Continue anyway?`,
      );

      if (!confirmed) {
        throw new Error("Vehicle assignment cancelled due to compliance warning.");
      }

      return assignExactVehicle(bookingId, vehicleId, true);
    }

    if (!response.ok) {
      throw new Error(payload.error || "Unable to assign the vehicle.");
    }
  }

  async function handleDraftDrop(event: React.DragEvent<HTMLDivElement>, vehicle: Vehicle) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const collectionWindow = windowFromDropOffset(event.clientX - rect.left);
    setDraftVehicleId(vehicle.id); setDraftWindow(collectionWindow);
    setDraggingDraft(false); setDragTarget(null);
    if (vehicle.vehicleType !== customerFormPayload?.vehicleSize) { setError("Choose a vehicle matching the quoted size."); return; }
    setMessage(`Selected ${vehicle.registration || vehicle.name} at ${collectionWindow}. Review and press Create booking below.`);
  }

  async function submitDraft(vehicle: Vehicle, collectionWindow: string) {
    if (!calculation || !customerFormPayload || assigning || createdBookingId || savedDraftReference) return;
    if (vehicle.vehicleType !== customerFormPayload.vehicleSize) { setError("Choose a vehicle matching the quoted size."); return; }
    if (!COLLECTION_WINDOWS.includes(collectionWindow)) { setError("Choose a valid collection time."); return; }

    setAssigning(true);
    setDraggingDraft(false);
    setDragTarget(null);
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
          body: JSON.stringify({ ...customerFormPayload, vehicleSize: vehicle.vehicleType, collectionDate: planningDate + "T00:00:00.000Z", collectionWindow }),
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

      if (!newBooking) return;

      setSavedDraftReference(newBooking.reference);
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

  function populateBookingEditor(booking: Booking) {
    setEditingBooking(booking);
    setEditCollectionDate(localDateInput(booking.collectionDate));
    setEditCollectionWindow(booking.collectionWindow || "00:00-02:00");
    setEditCollectionAddress(booking.collectionAddress || "");
    setEditDeliveryAddress(booking.deliveryAddress || "");
    setEditReturnAddress(booking.returnAddress || "");
    setEditVehicleId(booking.vehicleId || "");
    setEditTotalPrice(String(booking.totalPrice ?? ""));
    setEditManualPrice(false);setEditRecalculate(false);setEditAdjustment("");setEditAdjustmentReason("");
    let drops=booking.extraDrops; if(typeof drops==="string"){try{drops=JSON.parse(drops);}catch{drops=[];}}
    setEditExtraDrops(Array.isArray(drops)?drops.map(drop=>typeof drop==="object"&&drop?{...drop,address:String(drop.address||"")}:{address:String(drop)}):[]);
    setEditCustomerReference(booking.customerReference || "");
    setEditPurchaseOrderNumber(booking.purchaseOrderNumber || "");
    setEditInternalNotes(booking.internalNotes || "");
    setEditDispatchNotes(booking.dispatchNotes || "");
  }

  async function openBookingEditor(booking: Booking) {
    populateBookingEditor(booking);
    setLoadingBookingDetails(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/admin/${booking.id}`,
        {
          headers: {
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as {
        booking?: Booking;
        error?: string;
      };

      if (!response.ok || !payload.booking) {
        throw new Error(payload.error || "Unable to load full booking details.");
      }

      populateBookingEditor(payload.booking);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load full booking details.",
      );
    } finally {
      setLoadingBookingDetails(false);
    }
  }

  function closeBookingEditor() {
    if (savingBooking||refundBusy) return;
    setEditingBooking(null);
  }

  async function saveBookingChanges() {
    if (!editingBooking || savingBooking) return;

    if (!editCollectionDate) {
      setError("Select the collection date.");
      return;
    }

    if (!editCollectionWindow) {
      setError("Select the collection window.");
      return;
    }

    if (!editCollectionAddress.trim() || !editDeliveryAddress.trim()) {
      setError("Collection and delivery addresses are required.");
      return;
    }

    const parsedTotal = Number(editTotalPrice);
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setError("Enter a valid booking charge.");
      return;
    }

    if(editAdjustment && !editAdjustmentReason.trim()){setError("Enter a reason for the charge or reduction.");return;}
    setSavingBooking(true);
    setError("");setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/admin/${editingBooking.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            collectionDate: `${editCollectionDate}T00:00:00`,
            collectionWindow: editCollectionWindow,
            collectionAddress: editCollectionAddress.trim(),
            deliveryAddress: editDeliveryAddress.trim(),
            returnAddress: editReturnAddress.trim() || null,
            vehicleId: editVehicleId || null,
            totalPrice: parsedTotal,
            manualPrice:editManualPrice,recalculatePrice:editRecalculate,
            adjustmentAmount:editAdjustment||"0",adjustmentReason:editAdjustmentReason.trim(),
            expectedUpdatedAt:editingBooking.updatedAt,
            extraDrops:editExtraDrops,
            customerReference: editCustomerReference.trim() || null,
            purchaseOrderNumber: editPurchaseOrderNumber.trim() || null,
            internalNotes: editInternalNotes.trim() || null,
            dispatchNotes: editDispatchNotes.trim() || null,
          }),
        },
      );

      const payload = (await response.json()) as BookingPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update booking.");
      }

      await loadPlanningBoard(false);
      if(payload.booking)populateBookingEditor(payload.booking);
      setMessage(`${editingBooking.reference} updated. Mileage, price and planning details are saved.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update booking.",
      );
    } finally {
      setSavingBooking(false);
    }
  }

  async function processBookingRefund(refund:BookingRefund,manual=false){
    if(!editingBooking||refundBusy||savingBooking)return;
    if(!window.confirm(manual?`Confirm ${money(refund.amount)} has been returned manually by ${refund.method}?`:`Approve / check ${money(refund.amount)} refund through the original ${refund.method} payment?`))return;
    setRefundBusy(true);setError("");setMessage("");
    try{
      const response=await fetch(`${API_BASE}/api/bookings/admin/${editingBooking.id}/refunds/${refund.id}/${manual?"record-manual":"approve"}`,{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":adminKey},body:JSON.stringify({reference:refundReferences[refund.id]||""})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to update the refund.");
      await loadPlanningBoard(false);if(data.booking)populateBookingEditor(data.booking);
      setMessage("Refund record updated. Check its status below.");
    }catch(error){setError(error instanceof Error?error.message:"Unable to update the refund.");}finally{setRefundBusy(false);}
  }

  async function cancelBooking() {
    if (!editingBooking || savingBooking) return;

    const confirmed = window.confirm(
      `Cancel booking ${editingBooking.reference}?`,
    );

    if (!confirmed) return;

    setSavingBooking(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/admin/${editingBooking.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            status: "CANCELLED", reason: "Admin cancelled this booking from the booking editor.",
          }),
        },
      );

      const payload = (await response.json()) as BookingPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to cancel booking.");
      }

      setEditingBooking(null);
      await loadPlanningBoard(false);
      setMessage(`${editingBooking.reference} cancelled.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to cancel booking.",
      );
    } finally {
      setSavingBooking(false);
    }
  }

  function resetForAnotherBooking() {
    window.localStorage.removeItem("streamline_admin_quote_form_draft_" + form.accountId);
    setFormVersion((version) => version + 1);
    setCustomerFormPayload(null);
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

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer py-3 text-lg font-bold text-[#071D49]">Driver & van allocations</summary><FleetAllocationBoard /></details>
      {!planningOpen ? (
        <section className="mt-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <FieldLabel label="Select Account">
              <select value={form.accountId} disabled={loadingCustomers || calculating} onChange={(event) => { updateForm("accountId", event.target.value); setCustomerFormPayload(null); }} className="manual-input">
                <option value="GUEST">Guest Customer (No Account)</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.accountType === "TRADE" ? "Trade" : "Business"} Â· {customer.companyName || customer.legalEntity || customer.name}</option>)}
              </select>
            </FieldLabel>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Purchase Order Number"><input value={form.purchaseOrderNumber} onChange={(event) => updateForm("purchaseOrderNumber", event.target.value)} className="manual-input" /></FieldLabel>
              <FieldLabel label="Customer Reference"><input value={form.customerReference} onChange={(event) => updateForm("customerReference", event.target.value)} className="manual-input" /></FieldLabel>
              {form.accountId === "GUEST" && <>
                <div className="space-y-3">
                  <PostcodeAddressLookup
                    key={"guest-billing:" + formVersion}
                    apiBase={API_BASE + "/api"}
                    label="Find guest billing address"
                    accent="orange"
                    disabled={calculating}
                    onSelect={address => updateForm("guestAddress", formatPostcodeAddress(address))}
                  />
                <FieldLabel label="Guest billing address"><input value={form.guestAddress} onChange={(event) => updateForm("guestAddress", event.target.value)} className="manual-input" /></FieldLabel>
                </div>
                <FieldLabel label="Guest VAT number (if applicable)"><input value={form.guestVatNumber} onChange={(event) => updateForm("guestVatNumber", event.target.value)} className="manual-input" /></FieldLabel>
              </>}
              {selectedCustomer?.accountType === "TRADE" && <FieldLabel label="Credit override reason (if required)"><input value={form.creditOverrideReason} onChange={(event) => updateForm("creditOverrideReason", event.target.value)} className="manual-input" /></FieldLabel>}
            </div>
            {error && <ErrorBox text={error} />}
          </div>
          <AdminCustomerQuoteForm key={form.accountId + ":" + formVersion} apiBase={API_BASE} accountId={form.accountId} customer={selectedCustomer}
            onCalculate={calculateJourney}
            onOpenBoard={() => { setCalculation(null); setCreatedBookingId(null); setBoardOnly(true); setPlanningOpen(true); setMessage(""); setError(""); }}
          />
        </section>
      ) : (
        <>
          {!boardOnly ? (
          <section className="mt-7">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-[linear-gradient(135deg,_#020617_0%,_#0F172A_52%,_#FF6A00_100%)] p-5 text-white sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF9A52]">
                      New booking ready to plan
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      {form.accountId === "GUEST"
                        ? form.guestCompanyName
                        : selectedCustomer?.companyName ||
                          selectedCustomer?.legalEntity ||
                          selectedCustomer?.name ||
                          "Customer"}
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      Admin quote breakdown before vehicle and time assignment
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                      Total Inc VAT
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      {money(calculation?.totalPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-5">
                  <section className="rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <Truck className="text-[#FF6A00]" size={22} />
                      <h3 className="text-lg font-bold text-[#0F172A]">
                        Service Details
                      </h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <QuoteDetail label="Delivery Type" value={String(customerFormPayload?.deliveryType || "Not provided")} />
                      <QuoteDetail
                        label="Vehicle Size"
                        value={String(customerFormPayload?.vehicleSize || "Not selected")}
                      />
                      <QuoteDetail
                        label="Journey Type"
                        value={String(customerFormPayload?.journeyType || "Included in service")}
                      />
                      {form.journeyType !== "Multi" ? (
                        <QuoteDetail
                          label="Capacity Required"
                          value={`${form.capacityPercent}%`}
                        />
                      ) : null}
                      <QuoteDetail
                        label="Collection Date"
                        value={displayLongDate(planningDate)}
                      />
                      <QuoteDetail
                        label="Collection Window"
                        value={String(customerFormPayload?.collectionWindow || "Select by dropping onto the planning grid")}
                      />
                      <QuoteDetail
                        label="Journey Time"
                        value={
                          calculation?.durationMinutes != null
                            ? `${calculation.durationMinutes} mins`
                            : "Not returned"
                        }
                      />
                      <QuoteDetail
                        label="Estimated Distance"
                        value={`${calculation?.distanceMiles ?? 0} miles`}
                      />
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <MapPin className="text-[#FF6A00]" size={22} />
                      <h3 className="text-lg font-bold text-[#0F172A]">
                        Route Details
                      </h3>
                    </div>

                    <div className="grid gap-3">
                      <QuoteAddress
                        label="Collection Address"
                        value={form.collectionAddress}
                      />
                      <QuoteAddress
                        label="Delivery Address"
                        value={form.deliveryAddress}
                      />

                      {form.journeyType === "Return" ? (
                        <QuoteAddress
                          label="Return Address"
                          value={form.returnAddress}
                        />
                      ) : null}

                      {form.journeyType === "Multi" && buildExtraDrops().length > 0 ? (
                        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                          <p className="text-sm font-bold text-slate-500">
                            Extra Stops
                          </p>
                          <div className="mt-3 grid gap-2">
                            {buildExtraDrops().map((stop, index) => (
                              <div
                                key={`${stop.order}-${stop.address}`}
                                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                              >
                                <p className="text-xs font-bold text-[#0F172A]">
                                  Stop {index + 1}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">
                                  {stop.address}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <User className="text-[#FF6A00]" size={22} />
                      <h3 className="text-lg font-bold text-[#0F172A]">
                        Customer Details
                      </h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <QuoteDetail
                        label="Customer / Company"
                        value={
                          form.accountId === "GUEST"
                            ? form.guestCompanyName
                            : selectedCustomer?.companyName ||
                              selectedCustomer?.legalEntity ||
                              selectedCustomer?.name ||
                              "Not provided"
                        }
                      />
                      <QuoteDetail
                        label="Email"
                        value={
                          form.accountId === "GUEST"
                            ? form.guestEmail
                            : selectedCustomer?.email || "Not provided"
                        }
                      />
                      <QuoteDetail
                        label="Phone"
                        value={
                          form.accountId === "GUEST"
                            ? form.guestPhone
                            : selectedCustomer?.phone || "Not provided"
                        }
                      />
                      <QuoteDetail
                        label="Account Type"
                        value={
                          form.accountId === "GUEST"
                            ? "Guest"
                            : selectedCustomer?.accountType || "Business"
                        }
                      />
                    </div>
                  </section>
                </div>

                <aside className="h-fit rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-lg shadow-black/5">
                  <div className="mb-4 flex items-center gap-3">
                    <ReceiptText className="text-[#FF6A00]" size={22} />
                    <h3 className="text-lg font-bold text-[#0F172A]">
                      Price breakdown
                    </h3>
                  </div>

                  <div className="grid gap-3">
                    <QuotePriceRow
                      icon={<Truck size={20} />}
                      label={`Base Fare (${String(customerFormPayload?.vehicleSize || "Vehicle")})`}
                      value={money(calculation?.basePrice)}
                    />
                    <QuotePriceRow
                      icon={<MapPinned size={20} />}
                      label={`Mileage (${calculation?.distanceMiles ?? 0} mi Ã— ${formatMileageRate(
                        mileageRate(calculation),
                      )})`}
                      value={money(calculation?.fuelSurcharge)}
                    />
                    <QuotePriceRow
                      icon={<MapPin size={20} />}
                      label={`Extra Stops (${calculation?.extraDropCount ?? 0})`}
                      value={money(extraStopsPrice(calculation))}
                    />
                    <QuotePriceRow
                      icon={<ReceiptText size={20} />}
                      label="Subtotal (ex VAT)"
                      value={money(calculation?.adminPrice)}
                    />
                    <QuotePriceRow
                      icon={<ReceiptText size={20} />}
                      label="VAT @20%"
                      value={money(calculation?.vatAmount)}
                    />

                    <div className="mt-1 rounded-2xl bg-[linear-gradient(135deg,_#020617_0%,_#0F172A_55%,_#FF6A00_100%)] p-4 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <PoundSterling size={20} />
                          <p className="font-bold">Total Inc VAT</p>
                        </div>
                        <p className="text-xl font-bold">
                          {money(calculation?.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

          </section>
          ) : null}

          <div className={`mt-6 grid items-start gap-4 ${boardOnly ? "" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}>
            {!boardOnly ? (
            <div
              draggable={!assigning && !createdBookingId && !savedDraftReference}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", "planning-draft"); event.dataTransfer.effectAllowed = "copy";
                setDraggingDraft(true);
                setDragTarget(null);
              }}
              onDragEnd={() => {
                setDraggingDraft(false);
                setDragTarget(null);
              }}
              className={`flex min-h-[220px] w-full flex-col justify-center rounded-2xl border-2 border-dashed p-5 shadow-sm lg:sticky lg:top-6 lg:self-start ${assigning || createdBookingId ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${
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
              ) : savedDraftReference ? (
                <><p className="font-bold">Booking saved: {savedDraftReference}</p><p className="mt-2 text-sm">Vehicle assignment needs review. Open the existing booking before trying again.</p><a className="mt-3 inline-flex min-h-12 items-center font-bold text-blue-700" href="/admin/bookings">Open existing bookings →</a></>
              ) : (
                <>
                  <Truck className="h-7 w-7 text-[#E55300]" />
                  <p className="mt-3 font-bold text-slate-950">
                    Choose vehicle and time
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Use the controls below, or drag onto the calendar to select a time. Review before creating.
                  </p>
                  <p className="mt-3 text-lg font-bold text-[#E55300]">
                    {money(calculation?.totalPrice)}
                  </p>
                  <label className="mt-4 block text-sm font-bold">Vehicle
                    <select value={draftVehicleId} onChange={event => setDraftVehicleId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal">
                      <option value="">Choose vehicle</option>
                      {canonicalVehicles.filter(vehicle => vehicle.vehicleType === customerFormPayload?.vehicleSize).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration || vehicle.name}</option>)}
                    </select>
                  </label>
                  <label className="mt-3 block text-sm font-bold">Collection window (UK)
                    <select value={draftWindow} onChange={event => setDraftWindow(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal">
                      {COLLECTION_WINDOWS.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <p className="mt-3 text-sm">Date: {planningDate}. Van availability is checked when you create the booking. The minimum six-hour reservation still applies.</p>
                  <button type="button" disabled={!draftVehicleId || assigning} onClick={() => { const vehicle = canonicalVehicles.find(item => item.id === draftVehicleId); if (vehicle) void submitDraft(vehicle, draftWindow); }} className="mt-4 min-h-12 w-full rounded-xl bg-[#FF6A00] px-4 py-3 font-bold text-white disabled:opacity-50">Create booking</button>

                </>
              )}
            </div>
            ) : null}
          <section
            className={`${
              "min-w-0"
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
                    minWidth: VEHICLE_COLUMN_WIDTH + TIMELINE_WIDTH + END_MARKER_WIDTH,
                  }}
                >
                  <div
                    className="sticky top-0 z-20 grid border-b border-slate-200 bg-white"
                    style={{
                      gridTemplateColumns: `${VEHICLE_COLUMN_WIDTH}px ${TIMELINE_WIDTH}px ${END_MARKER_WIDTH}px`,
                    }}
                  >
                    <div className="sticky left-0 z-30 flex h-16 items-center border-r border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)]">
                      Vehicle
                    </div>

                    <div className="relative h-16">
                      {Array.from(
                        {
                          length:
                            TIMELINE_END_HOUR - TIMELINE_START_HOUR,
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
                              <span className="absolute left-2 top-5 whitespace-nowrap text-[13px] font-bold text-slate-700">
                                {String(hour).padStart(2, "0")}:00
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                    <div className="flex h-16 items-center border-l border-slate-300 bg-slate-50 px-2 text-[13px] font-bold text-slate-700" aria-label="End of day, 24:00">
                      24:00
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
                            gridTemplateColumns: `${VEHICLE_COLUMN_WIDTH}px ${TIMELINE_WIDTH}px ${END_MARKER_WIDTH}px`,
                            minHeight: ROW_HEIGHT,
                          }}
                        >
                          <div className="sticky left-0 z-20 flex min-h-[88px] flex-col justify-center border-r border-slate-300 bg-slate-50 px-5 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)]">
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
                              if (!createdBookingId && !savedDraftReference && draggingDraft) {
                                event.preventDefault();
                                const rect = event.currentTarget.getBoundingClientRect();
                                const collectionWindow = windowFromDropOffset(
                                  event.clientX - rect.left,
                                );

                                setDragTarget((current) =>
                                  current?.vehicleId === vehicle.id &&
                                  current.collectionWindow === collectionWindow
                                    ? current
                                    : {
                                        vehicleId: vehicle.id,
                                        collectionWindow,
                                      },
                                );
                              }
                            }}
                            onDragLeave={(event) => {
                              const nextTarget = event.relatedTarget as Node | null;

                              if (
                                !nextTarget ||
                                !event.currentTarget.contains(nextTarget)
                              ) {
                                setDragTarget((current) =>
                                  current?.vehicleId === vehicle.id ? null : current,
                                );
                              }
                            }}
                            onDrop={(event) => {
                              if (!createdBookingId && !savedDraftReference) {
                                setDragTarget(null);
                                void handleDraftDrop(event, vehicle);
                              }
                            }}
                          >
                            {dragTarget?.vehicleId === vehicle.id ? (
                              <div
                                className="pointer-events-none absolute inset-y-0 z-[5] border-2 border-[#FF6A00] bg-orange-100/80"
                                style={{
                                  left:
                                    COLLECTION_WINDOWS.indexOf(
                                      dragTarget.collectionWindow as (typeof COLLECTION_WINDOWS)[number],
                                    ) *
                                    HOUR_WIDTH,
                                  width: 2 * HOUR_WIDTH,
                                }}
                              >
                                <div className="flex h-full items-center justify-center">
                                  <span className="rounded-lg bg-[#FF6A00] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                                    {dragTarget.collectionWindow}
                                  </span>
                                </div>
                              </div>
                            ) : null}

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
                                    left: index === TIMELINE_END_HOUR - TIMELINE_START_HOUR
                                      ? TIMELINE_WIDTH - 1
                                      : index * HOUR_WIDTH,
                                  }}
                                />
                              ),
                            )}

                            {vehicleBookings.map((booking) => {
                              const block = bookingBlockStyle(booking, planningDate);

                              if (!block) return null;

                              const isCreated = booking.id === createdBookingId;

                              return (
                                <button
                                  type="button"
                                  key={booking.id}
                                  onClick={() => void openBookingEditor(booking)}
                                  className={`absolute top-3 z-10 h-[62px] overflow-hidden rounded-xl border px-3 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-orange-300 ${
                                    isCreated
                                      ? "border-emerald-300 bg-emerald-50"
                                      : "border-orange-200 bg-orange-50"
                                  }`}
                                  style={{
                                    left: block.left,
                                    width: block.width,
                                  }}
                                  title={`${booking.reference} Â· ${bookingCustomerName(
                                    booking,
                                  )} Â· ${money(booking.totalPrice)}`}
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
                                    {calendarTimeText(booking)}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                          <div aria-hidden="true" className="border-l border-slate-200 bg-slate-50" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>
          </div>

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

      {editingBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E55300]">
                  Booking details / edit
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {editingBooking.reference}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-[#E55300]">
                    {editingBooking.status.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {bookingCustomerName(editingBooking)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBookingEditor}
                disabled={savingBooking}
                className="rounded-xl border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close booking editor"
              >
                <X size={19} />
              </button>
            </div>

            {loadingBookingDetails ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
              </div>
            ) : (
              <div className="space-y-6 p-5 sm:p-6">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-bold text-slate-950">Customer</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox label="Customer / Company" value={bookingCustomerName(editingBooking)} />
                    <InfoBox label="Email" value={editingBooking.user?.email || editingBooking.quote?.customerEmail || "Not provided"} />
                    <InfoBox label="Phone" value={editingBooking.user?.phone || editingBooking.quote?.customerPhone || "Not provided"} />
                    <InfoBox label="Account Type" value={editingBooking.user?.accountType || (editingBooking.user ? "Business" : "Guest")} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-bold text-slate-950">Journey & assignment</h3>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <FieldLabel label="Collection Date">
                      <input type="date" value={editCollectionDate} onChange={(event) => setEditCollectionDate(event.target.value)} className="manual-input" />
                    </FieldLabel>
                    <FieldLabel label="Collection Window">
                      <select value={editCollectionWindow} onChange={(event) => setEditCollectionWindow(event.target.value)} className="manual-input">
                        {COLLECTION_WINDOWS.map((window) => (
                          <option key={window} value={window}>{window}</option>
                        ))}
                      </select>
                    </FieldLabel>
                    <div className="sm:col-span-2">
                      <PostcodeAddressLookup
                        key={`${editingBooking.id}-collection`}
                        apiBase={API_BASE + "/api"}
                        label="Find collection address"
                        className="mb-3"
                        accent="orange"
                        disabled={refundBusy || savingBooking || loadingBookingDetails || editingBooking.status === "CANCELLED"}
                        onSelect={address => setEditCollectionAddress(formatPostcodeAddress(address))}
                      />
                      <FieldLabel label="Collection Address">
                        <textarea rows={3} value={editCollectionAddress} onChange={(event) => setEditCollectionAddress(event.target.value)} className="manual-input resize-none" />
                      </FieldLabel>
                    </div>
                    <div className="sm:col-span-2">
                      <PostcodeAddressLookup
                        key={`${editingBooking.id}-delivery`}
                        apiBase={API_BASE + "/api"}
                        label="Find delivery address"
                        className="mb-3"
                        accent="orange"
                        disabled={refundBusy || savingBooking || loadingBookingDetails || editingBooking.status === "CANCELLED"}
                        onSelect={address => setEditDeliveryAddress(formatPostcodeAddress(address))}
                      />
                      <FieldLabel label="Delivery Address">
                        <textarea rows={3} value={editDeliveryAddress} onChange={(event) => setEditDeliveryAddress(event.target.value)} className="manual-input resize-none" />
                      </FieldLabel>
                    </div>
                    <div className="sm:col-span-2">
                      <PostcodeAddressLookup
                        key={`${editingBooking.id}-return`}
                        apiBase={API_BASE + "/api"}
                        label="Find return address"
                        className="mb-3"
                        accent="orange"
                        disabled={refundBusy || savingBooking || loadingBookingDetails || editingBooking.status === "CANCELLED"}
                        onSelect={address => setEditReturnAddress(formatPostcodeAddress(address))}
                      />
                      <FieldLabel label="Return Address">
                        <textarea rows={2} value={editReturnAddress} onChange={(event) => setEditReturnAddress(event.target.value)} placeholder="Not required for one-way journeys" className="manual-input resize-none" />
                      </FieldLabel>
                    </div>
                    <FieldLabel label="Vehicle">
                      <select value={editVehicleId} onChange={(event) => setEditVehicleId(event.target.value)} className="manual-input">
                        <option value="">Unassigned</option>
                        {canonicalVehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration || vehicle.name || vehicle.vehicleType} - {vehicle.vehicleType}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                    <FieldLabel label="Booking Charge">
                      <input type="number" min="0" step="0.01" value={editTotalPrice} onChange={(event) => {setEditTotalPrice(event.target.value);setEditManualPrice(true);}} className="manual-input" />
                    </FieldLabel>
                  </div>

                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-600">Address, stop or vehicle changes recalculate mileage and the booking price when saved. Editing Booking Charge sets a manual total.</p>
                    <label className="flex gap-2 text-sm"><input type="checkbox" checked={editRecalculate} onChange={event=>{setEditRecalculate(event.target.checked);setEditManualPrice(false);}} />Recalculate route and price on save</label>
                    <h4 className="font-bold">Additional stops</h4>
                    {editExtraDrops.map((drop,index)=><div key={index} className="flex gap-2"><input aria-label={`Stop ${index+1} address`} className="manual-input" value={drop.address} onChange={event=>setEditExtraDrops(rows=>rows.map((row,i)=>i===index?{...row,address:event.target.value}:row))}/><button type="button" onClick={()=>setEditExtraDrops(rows=>rows.filter((_,i)=>i!==index))}>Remove</button></div>)}
                    <button type="button" onClick={()=>setEditExtraDrops(rows=>[...rows,{address:""}])} className="rounded-lg border px-3 py-2">Add stop</button>
                    <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Additional charge / reduction (£, including VAT)"><input type="number" step="0.01" value={editAdjustment} onChange={event=>setEditAdjustment(event.target.value)} placeholder="Positive charge or negative reduction" className="manual-input" /></FieldLabel><FieldLabel label="Reason for price adjustment"><input value={editAdjustmentReason} onChange={event=>setEditAdjustmentReason(event.target.value)} className="manual-input" /></FieldLabel></div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox label="Journey Type" value={editingBooking.quote?.journeyType || "Not provided"} />
                    <InfoBox label="Vehicle Size" value={editingBooking.quote?.vehicleSize || editingBooking.vehicle?.vehicleType || "Not provided"} />
                    <InfoBox label="Distance" value={editingBooking.quote?.distanceMiles != null ? `${editingBooking.quote.distanceMiles} miles` : "Not provided"} />
                    <InfoBox label="Driver" value={editingBooking.driver?.name || "Unassigned"} />
                  </div>
                </section>

                <section className="rounded-3xl border border-[#D7E6FF] bg-[#F4F8FF] p-5">
                  <h3 className="text-lg font-bold text-[#071D49]">Quote / load details</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoBox label="Delivery Type" value={editingBooking.quote?.deliveryType || "Not provided"} />
                    <InfoBox label="Capacity" value={editingBooking.quote?.capacityPercent != null ? `${editingBooking.quote.capacityPercent}%` : "Not provided"} />
                    <InfoBox label="What Are We Collecting?" value={editingBooking.quote?.whatAreWeCollecting || "Not provided"} />
                    <InfoBox label="Load Description" value={editingBooking.quote?.loadDescription || "Not provided"} />
                    <InfoBox label="Fragile Goods" value={editingBooking.quote?.fragileGoods == null ? "Not provided" : editingBooking.quote.fragileGoods ? "Yes" : "No"} />
                    <InfoBox label="Pallet Count" value={editingBooking.quote?.palletCount != null ? String(editingBooking.quote.palletCount) : "Not provided"} />
                    <InfoBox label="Contact Preference" value={editingBooking.quote?.contactPreference || "Not provided"} />
                    <InfoBox label="Handover Contact" value={editingBooking.quote?.handoverContactName || "Not provided"} />
                    <InfoBox label="Handover Phone" value={editingBooking.quote?.handoverContactPhone || "Not provided"} />
                  </div>
                  {editingBooking.quote?.specialInstructions ? (
                    <div className="mt-3 rounded-2xl border border-[#D7E6FF] bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Special Instructions</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#071D49]">{editingBooking.quote.specialInstructions}</p>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-bold text-slate-950">References & admin notes</h3>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <FieldLabel label="Customer Reference">
                      <input value={editCustomerReference} onChange={(event) => setEditCustomerReference(event.target.value)} className="manual-input" />
                    </FieldLabel>
                    <FieldLabel label="PO / Order Reference">
                      <input value={editPurchaseOrderNumber} onChange={(event) => setEditPurchaseOrderNumber(event.target.value)} className="manual-input" />
                    </FieldLabel>
                    <FieldLabel label="Internal Notes">
                      <textarea rows={3} value={editInternalNotes} onChange={(event) => setEditInternalNotes(event.target.value)} className="manual-input resize-none" />
                    </FieldLabel>
                    <FieldLabel label="Dispatch Notes">
                      <textarea rows={3} value={editDispatchNotes} onChange={(event) => setEditDispatchNotes(event.target.value)} className="manual-input resize-none" />
                    </FieldLabel>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-bold text-slate-950">Financial / operational status</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox label="Booking Total" value={money(editingBooking.totalPrice)} />
                    <InfoBox label="Payments" value={editingBooking.payments?.length ? `${editingBooking.payments.length} payment record(s)` : "No payment records"} />
                    <InfoBox label="Invoices" value={editingBooking.invoices?.length ? `${editingBooking.invoices.length} invoice(s)` : "No invoices"} />
                    <InfoBox label="POD" value={editingBooking.pod?.status || "Not completed"} />
                    <InfoBox label="Reservation" value={editingBooking.reservation?.status || "None"} />
                    <InfoBox label="Tracking Events" value={editingBooking.trackingEvents?.length ? `${editingBooking.trackingEvents.length} event(s)` : "No events"} />
                    <InfoBox label="Estimated Start" value={displayTime(editingBooking.estimatedStartTime) || "Not set"} />
                    <InfoBox label="Estimated End" value={displayTime(editingBooking.estimatedEndTime) || "Not set"} />
                  </div>
                </section>

                {editingBooking.refundRequests?.some(row=>row.status!=="CANCELLED")?<section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-bold">Booking refunds</h3><p className="mt-2 text-sm">Business reductions require approval. Stripe returns to the original payment; bank transfers are refunded manually.</p>{editingBooking.refundRequests.filter(row=>row.status!=="CANCELLED").map(refund=><div key={refund.id} className="mt-3 space-y-2 rounded-xl border p-4"><p className="font-semibold">{money(refund.amount)} · {refund.method} · {refund.status.replaceAll("_"," ")}</p>{refund.lastError?<p role="alert" className="text-sm text-red-700">{refund.lastError}</p>:null}{["PENDING_APPROVAL","FAILED","PROCESSING"].includes(refund.status)?<button type="button" disabled={refundBusy||savingBooking} onClick={()=>void processBookingRefund(refund)} className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-50">{refundBusy?"Checking…":refund.status==="PROCESSING"?"Check / retry":"Approve refund"}</button>:null}{refund.status==="APPROVED_MANUAL"?<><p>Approved. Return the money through the original bank/payment method, then record the reference.</p><input aria-label="Manual refund reference" value={refundReferences[refund.id]||""} onChange={event=>setRefundReferences(rows=>({...rows,[refund.id]:event.target.value}))} className="manual-input"/><button type="button" disabled={refundBusy||savingBooking} onClick={()=>void processBookingRefund(refund,true)} className="rounded-lg border px-3 py-2">Record completed refund</button></>:null}{refund.manualReference?<p>Refund reference: {refund.manualReference}</p>:null}</div>)}</section>:null}
                {message?<p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{message}</p>:null}
                {error ? <ErrorBox text={error} /> : null}
              </div>
            )}

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-5 sm:p-6">
              <button
                type="button"
                onClick={() => void cancelBooking()}
                disabled={refundBusy || savingBooking || loadingBookingDetails || editingBooking.status === "CANCELLED"}
                className="rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {editingBooking.status === "CANCELLED" ? "Booking Cancelled" : "Cancel Booking"}
              </button>

              <div className="flex gap-3">
                <button type="button" onClick={closeBookingEditor} disabled={savingBooking} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void saveBookingChanges()}
                  disabled={refundBusy || savingBooking || loadingBookingDetails || editingBooking.status === "CANCELLED"}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#E55300] disabled:opacity-50"
                >
                  {savingBooking ? <Loader2 size={17} className="animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

function QuoteDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-[#0F172A]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function QuoteAddress({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 whitespace-pre-line break-words text-sm font-semibold leading-6 text-[#0F172A]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function QuotePriceRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex min-w-0 items-center gap-3 text-[#FF6A00]">
        <span className="shrink-0">{icon}</span>
        <p className="min-w-0 text-sm font-bold text-[#0F172A]">{label}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-[#0F172A]">{value}</p>
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
