"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CornerDownLeft,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Signature,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "https://streamline-logistics-production.up.railway.app";
const AUTO_LOCATION_INTERVAL_MS = 15000;

type Vehicle = {
  id: string;
  name: string;
  vehicleType: string;
  registration?: string | null;
};

type TrackingEvent = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  createdAt: string;
};

type DriverLocation = {
  id: string;
  latitude: string | number;
  longitude: string | number;
  accuracy?: string | number | null;
  heading?: string | number | null;
  speed?: string | number | null;
  createdAt: string;
};

type POD = {
  id: string;
  status: string;
  recipientName?: string | null;
  signatureUrl?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  deliveredAt?: string | null;
};

type Stop = {
  sequence: number;
  type: "COLLECTION" | "DROP" | "DELIVERY" | "RETURN";
  label: string;
  address: string;
  notes?: string | null;
  navigationUrl: string;
};

type Job = {
  id: string;
  reference: string;
  status: string;
  collectionDate: string;
  collectionWindow: string;
  collectionAddress: string;
  deliveryAddress: string;
  extraDrops?: unknown;
  totalPrice: string | number;
  trackingStartedAt?: string | null;
  trackingEndedAt?: string | null;
  vehicle?: Vehicle | null;
  pod?: POD | null;
  trackingEvents?: TrackingEvent[];
  driverLocations?: DriverLocation[];
  stops?: Stop[];
  stopSummary?: {
    totalStops: number;
    extraDrops: number;
    hasReturn: boolean;
    description: string;
  };
  nextStop?: Stop | null;
};

const STATUS_ACTIONS = [
  {
    label: "Accepted",
    status: "ASSIGNED",
    title: "Job accepted",
    description: "The driver has accepted this job.",
  },
  {
    label: "En Route",
    status: "IN_PROGRESS",
    title: "Driver en route",
    description: "The driver is travelling to the collection address.",
  },
  {
    label: "Arrived Collection",
    status: "IN_PROGRESS",
    title: "Arrived at collection",
    description: "The driver has arrived at the collection address.",
  },
  {
    label: "Goods Collected",
    status: "IN_PROGRESS",
    title: "Goods collected",
    description: "The goods have been collected.",
  },
  {
    label: "En Route Delivery",
    status: "IN_PROGRESS",
    title: "En route to delivery",
    description: "The driver is travelling to the delivery address.",
  },
  {
    label: "Arrived Delivery",
    status: "IN_PROGRESS",
    title: "Arrived at delivery",
    description: "The driver has arrived at the delivery address.",
  },
];

const STOP_ACTIONS = [
  {
    label: "En route",
    titleSuffix: "en route",
    descriptionSuffix: "The driver is travelling to this stop.",
  },
  {
    label: "Arrived",
    titleSuffix: "arrived",
    descriptionSuffix: "The driver has arrived at this stop.",
  },
  {
    label: "Completed",
    titleSuffix: "completed",
    descriptionSuffix: "This stop has been completed.",
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function stopBadgeClass(type: Stop["type"]) {
  if (type === "COLLECTION") return "bg-blue-100 text-blue-700";
  if (type === "DROP") return "bg-amber-100 text-amber-700";
  if (type === "RETURN") return "bg-purple-100 text-purple-700";

  return "bg-green-100 text-green-700";
}

function stopTypeLabel(type: Stop["type"]) {
  return type.replaceAll("_", " ");
}

function isStopActionDone(events: TrackingEvent[] | undefined, stop: Stop, actionSuffix: string) {
  const target = `${stop.label} ${actionSuffix}`.toLowerCase();

  return Boolean(
    events?.some((event) =>
      `${event.title} ${event.description || ""}`.toLowerCase().includes(target),
    ),
  );
}

function getLocationPayload(position: GeolocationPosition) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
  };
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export default function DriverJobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = String(params.id);

  const watchIdRef = useRef<number | null>(null);
  const lastLocationSentAtRef = useRef(0);
  const autoTrackingStartedRef = useRef(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [trackingMessage, setTrackingMessage] = useState("");
  const [lastAutoLocationAt, setLastAutoLocationAt] = useState("");
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(false);

  const [podRecipient, setPodRecipient] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [podMessage, setPodMessage] = useState("");

  const trackingActive = useMemo(() => {
    return Boolean(job?.trackingStartedAt) && !job?.trackingEndedAt;
  }, [job]);

  const deliveryCompleted = useMemo(() => {
    return Boolean(
      job?.status === "COMPLETED" ||
        job?.pod?.status === "COMPLETED" ||
        job?.pod?.deliveredAt,
    );
  }, [job]);

  async function authedFetch(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem("driverToken");

    if (!token) {
      router.push("/driver/login");
      throw new Error("Unauthorized");
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const payload = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("driverToken");
      localStorage.removeItem("driver");
      router.push("/driver/login");
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      throw new Error(payload?.error || "Request failed");
    }

    return payload;
  }

  async function uploadPodFile(file: File | Blob, type: "signature" | "photo") {
    const token = localStorage.getItem("driverToken");

    if (!token) {
      router.push("/driver/login");
      throw new Error("Unauthorized");
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append(
      "file",
      file,
      type === "signature" ? "signature.png" : "delivery-photo.jpg",
    );

    const response = await fetch(`${API_BASE}/api/driver/pod/${bookingId}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
      localStorage.removeItem("driverToken");
      localStorage.removeItem("driver");
      router.push("/driver/login");
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      throw new Error(payload?.error || "Upload failed");
    }

    return payload as {
      message: string;
      type: "signature" | "photo";
      url: string;
      pod: POD;
    };
  }

  async function loadJob(options?: { silent?: boolean }) {
    setError("");

    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const payload = await authedFetch(`/api/driver/jobs/${bookingId}`);
      setJob(payload.job);
      setPodRecipient(payload.job?.pod?.recipientName || "");
      setPodNotes(payload.job?.pod?.notes || "");
      setSignatureUrl(payload.job?.pod?.signatureUrl || "");
      setPhotoUrl(payload.job?.pod?.photoUrl || "");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function updateStatus(action: (typeof STATUS_ACTIONS)[number]) {
    if (deliveryCompleted) {
      setError("This job has already been completed and cannot be changed.");
      return;
    }

    setError("");
    setWorking(action.label);

    try {
      const payload = await authedFetch(`/api/driver/tracking/${bookingId}/event`, {
        method: "POST",
        body: JSON.stringify({
          status: action.status,
          title: action.title,
          description: action.description,
          userVisible: true,
        }),
      });

      setJob(payload.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setWorking("");
    }
  }

  async function updateStopStatus(stop: Stop, action: (typeof STOP_ACTIONS)[number]) {
    if (deliveryCompleted) {
      setError("This job has already been completed and cannot be changed.");
      return;
    }

    setError("");
    setWorking(`${stop.sequence}-${action.label}`);

    try {
      const title = `${stop.label} ${action.titleSuffix}`;
      const payload = await authedFetch(`/api/driver/tracking/${bookingId}/event`, {
        method: "POST",
        body: JSON.stringify({
          status: action.titleSuffix === "completed" ? "IN_PROGRESS" : "IN_PROGRESS",
          title,
          description: `${action.descriptionSuffix} Address: ${stop.address}`,
          userVisible: true,
        }),
      });

      setJob(payload.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update stop");
    } finally {
      setWorking("");
    }
  }

  async function sendLocationPayload(payload: ReturnType<typeof getLocationPayload>) {
    await authedFetch(`/api/driver/tracking/${bookingId}/location`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const now = new Date().toISOString();
    setLastAutoLocationAt(now);
    setTrackingMessage("Location sent automatically.");
  }

  async function handleAutoLocation(position: GeolocationPosition) {
    const now = Date.now();

    if (now - lastLocationSentAtRef.current < AUTO_LOCATION_INTERVAL_MS) {
      return;
    }

    lastLocationSentAtRef.current = now;

    try {
      await sendLocationPayload(getLocationPayload(position));
      await loadJob({ silent: true });
    } catch (err) {
      setTrackingMessage(
        err instanceof Error ? err.message : "Unable to send location update.",
      );
    }
  }

  function startBrowserAutoTracking() {
    if (!navigator.geolocation) {
      setTrackingMessage("GPS is not available on this device.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setAutoTrackingEnabled(true);
    setTrackingMessage("Automatic GPS updates are active. Keep this page open.");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void handleAutoLocation(position);
      },
      (locationError) => {
        setAutoTrackingEnabled(false);
        setTrackingMessage(
          locationError.message || "Location permission was denied.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );

    watchIdRef.current = watchId;
  }

  function stopBrowserAutoTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    autoTrackingStartedRef.current = false;
    setAutoTrackingEnabled(false);
  }

  async function startTracking() {
    if (deliveryCompleted) {
      setError("This job has already been completed and tracking cannot be restarted.");
      return;
    }

    setError("");
    setTrackingMessage("");
    setWorking("start-tracking");

    try {
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);

        navigator.geolocation.getCurrentPosition(
          (result) => resolve(result),
          () => resolve(null),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      });

      const body = position ? getLocationPayload(position) : {};

      const payload = await authedFetch(`/api/driver/tracking/${bookingId}/start`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (position) {
        lastLocationSentAtRef.current = Date.now();
        setLastAutoLocationAt(new Date().toISOString());
      }

      setJob(payload.booking);
      startBrowserAutoTracking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start tracking");
    } finally {
      setWorking("");
    }
  }

  async function stopTracking() {
    setError("");
    setWorking("stop-tracking");

    try {
      stopBrowserAutoTracking();

      const payload = await authedFetch(`/api/driver/tracking/${bookingId}/stop`, {
        method: "POST",
      });

      setJob(payload.booking);
      setTrackingMessage("Tracking stopped.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stop tracking");
    } finally {
      setWorking("");
    }
  }

  function prepareSignaturePad() {
    const canvas = signatureCanvasRef.current;

    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const context = canvas.getContext("2d");

    if (!context) return;

    context.scale(ratio, ratio);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#07182f";
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (deliveryCompleted) return;

    const canvas = signatureCanvasRef.current;

    if (!canvas) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    const context = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, event);

    if (!context) return;

    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (deliveryCompleted) return;
    if (!drawingRef.current) return;

    const canvas = signatureCanvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, event);

    if (!context) return;

    context.lineTo(point.x, point.y);
    context.stroke();
    setSignatureDrawn(true);
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;

    if (!canvas) return;

    drawingRef.current = false;

    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // pointer capture may already be released
    }
  }

  function clearSignature() {
    if (deliveryCompleted) return;

    prepareSignaturePad();
    setSignatureDrawn(false);
    setSignatureUrl("");
    setPodMessage("");
  }

  async function savePodDraft(updatedValues?: {
    signatureUrl?: string;
    photoUrl?: string;
  }) {
    if (deliveryCompleted) return;

    await authedFetch(`/api/driver/pod/${bookingId}`, {
      method: "POST",
      body: JSON.stringify({
        recipientName: podRecipient,
        signatureUrl: updatedValues?.signatureUrl || signatureUrl,
        photoUrl: updatedValues?.photoUrl || photoUrl,
        notes: podNotes,
      }),
    });
  }

  async function uploadSignature() {
    if (deliveryCompleted) {
      setError("Proof of delivery is already completed and cannot be changed.");
      return;
    }

    setError("");
    setPodMessage("");

    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      setError("Signature pad is not available");
      return;
    }

    if (!signatureDrawn && !signatureUrl) {
      setError("Please capture a signature before uploading");
      return;
    }

    setWorking("upload-signature");

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), "image/png");
      });

      if (!blob) {
        throw new Error("Unable to prepare signature image");
      }

      const result = await uploadPodFile(blob, "signature");

      setSignatureUrl(result.url);
      setJob((currentJob) =>
        currentJob
          ? {
              ...currentJob,
              pod: result.pod,
            }
          : currentJob,
      );

      await savePodDraft({
        signatureUrl: result.url,
      });

      setPodMessage("Signature uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload signature");
    } finally {
      setWorking("");
    }
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;

    if (deliveryCompleted) {
      setError("Proof of delivery is already completed and cannot be changed.");
      return;
    }

    setError("");
    setPodMessage("");
    setWorking("upload-photo");

    try {
      const result = await uploadPodFile(file, "photo");

      setPhotoUrl(result.url);
      setJob((currentJob) =>
        currentJob
          ? {
              ...currentJob,
              pod: result.pod,
            }
          : currentJob,
      );

      await savePodDraft({
        photoUrl: result.url,
      });

      setPodMessage("Delivery photo uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload photo");
    } finally {
      setWorking("");
    }
  }

  async function completeDelivery() {
    if (deliveryCompleted) {
      setError("This job has already been completed.");
      return;
    }

    setError("");
    setPodMessage("");
    setWorking("complete");

    try {
      if (!podRecipient.trim()) {
        throw new Error("Recipient name is required");
      }

      if (!signatureUrl) {
        throw new Error("Signature must be uploaded before completing delivery");
      }

      if (!photoUrl) {
        throw new Error("Delivery photo must be uploaded before completing delivery");
      }

      stopBrowserAutoTracking();

      const payload = await authedFetch(`/api/driver/pod/${bookingId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          recipientName: podRecipient,
          signatureUrl,
          photoUrl,
          notes: podNotes,
        }),
      });

      setJob(payload.booking);
      setTrackingMessage("Delivery completed.");
      setPodMessage("Delivery completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete delivery");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    loadJob();

    return () => {
      stopBrowserAutoTracking();
    };
  }, []);

  useEffect(() => {
    if (!trackingActive) {
      stopBrowserAutoTracking();
      return;
    }

    if (autoTrackingStartedRef.current) return;

    autoTrackingStartedRef.current = true;
    startBrowserAutoTracking();
  }, [trackingActive]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!trackingActive) return;

      if (document.visibilityState === "visible") {
        startBrowserAutoTracking();
        void loadJob({ silent: true });
      } else {
        setTrackingMessage(
          "Tracking can pause if this page is closed or the phone is locked.",
        );
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [trackingActive]);

  useEffect(() => {
    prepareSignaturePad();

    function handleResize() {
      prepareSignaturePad();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07182f] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4 text-sm text-blue-100">Loading job</p>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <button
            onClick={() => router.push("/driver/jobs")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[#07182f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </button>
          <h1 className="text-3xl font-bold">Job not found</h1>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-[#07182f] text-white">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <button
            onClick={() => router.push("/driver/jobs")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-blue-100 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </button>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-200">
                Driver Job
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                {job.reference}
              </h1>
              <p className="mt-3 text-blue-100">
                {formatDate(job.collectionDate)} · {job.collectionWindow}
              </p>

              {job.stopSummary && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
                  <Route className="h-4 w-4 text-[#18a8ff]" />
                  {job.stopSummary.description}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-blue-100">Current status</p>
              <p className="mt-2 text-2xl font-bold uppercase">
                {statusLabel(job.status)}
              </p>
              <p className="mt-2 text-sm text-blue-100">
                Tracking: {trackingActive ? "Live" : "Inactive"}
              </p>
              <p className="mt-1 text-sm text-blue-100">
                Auto GPS: {autoTrackingEnabled ? "Active" : "Inactive"}
              </p>
              {deliveryCompleted && (
                <p className="mt-3 rounded-full bg-green-500/20 px-3 py-2 text-sm font-bold text-green-100">
                  Delivery locked
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {podMessage && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {podMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Route stops</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {job.stopSummary?.description || `${job.stops?.length || 2} stops`}
                  </p>
                </div>

                {job.stopSummary?.hasReturn && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-xs font-bold text-purple-700">
                    <CornerDownLeft className="h-4 w-4" />
                    Return journey
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-4">
                {(job.stops && job.stops.length > 0
                  ? job.stops
                  : [
                      {
                        sequence: 1,
                        type: "COLLECTION" as const,
                        label: "Collection",
                        address: job.collectionAddress,
                        navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.collectionAddress)}`,
                      },
                      {
                        sequence: 2,
                        type: "DELIVERY" as const,
                        label: "Delivery",
                        address: job.deliveryAddress,
                        navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.deliveryAddress)}`,
                      },
                    ]
                ).map((stop) => (
                  <div
                    key={`${stop.sequence}-${stop.label}-${stop.address}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07182f] text-sm font-bold text-white">
                            {stop.sequence}
                          </span>

                          <h3 className="text-lg font-bold text-[#07182f]">
                            {stop.label}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${stopBadgeClass(stop.type)}`}
                          >
                            {stopTypeLabel(stop.type)}
                          </span>
                        </div>

                        <p className="mt-3 flex items-start gap-2 text-sm font-semibold leading-6 text-slate-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#18a8ff]" />
                          {stop.address}
                        </p>

                        {stop.notes && (
                          <p className="mt-2 rounded-xl bg-white p-3 text-sm font-semibold text-slate-600">
                            {stop.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <a
                          href={stop.navigationUrl}
                          target="_blank"
                          className="inline-flex items-center gap-2 rounded-full bg-[#18a8ff] px-4 py-2 text-xs font-bold text-white hover:bg-[#008fe6]"
                        >
                          <Navigation className="h-4 w-4" />
                          Navigate
                        </a>

                        {STOP_ACTIONS.map((action) => {
                          const done = isStopActionDone(
                            job.trackingEvents,
                            stop,
                            action.titleSuffix,
                          );

                          return (
                            <button
                              key={`${stop.sequence}-${action.label}`}
                              type="button"
                              onClick={() => updateStopStatus(stop, action)}
                              disabled={Boolean(working) || deliveryCompleted}
                              className={`rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                                done
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {working === `${stop.sequence}-${action.label}`
                                ? "Updating..."
                                : done
                                  ? `${action.label} ✓`
                                  : action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">Status updates</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STATUS_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => updateStatus(action)}
                    disabled={Boolean(working) || deliveryCompleted}
                    className="rounded-2xl border border-slate-200 px-4 py-4 text-left text-sm font-bold transition hover:border-[#18a8ff] hover:bg-blue-50 disabled:opacity-60"
                  >
                    {working === action.label ? "Updating..." : action.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">Proof of delivery</h2>

              {deliveryCompleted && (
                <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
                  Delivery has been completed. Proof of delivery is locked and cannot be edited.
                </div>
              )}

              <div className="mt-5 grid gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Recipient name
                  </span>
                  <input
                    value={podRecipient}
                    onChange={(event) => setPodRecipient(event.target.value)}
                    disabled={deliveryCompleted}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#18a8ff] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="Name of recipient"
                  />
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <Signature className="h-4 w-4" />
                      Recipient signature
                    </span>

                    <button
                      type="button"
                      onClick={clearSignature}
                      disabled={deliveryCompleted}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  </div>

                  <canvas
                    ref={signatureCanvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={drawSignature}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    className={`h-56 w-full touch-none rounded-2xl border border-slate-300 bg-white shadow-inner ${
                      deliveryCompleted ? "opacity-60" : ""
                    }`}
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={uploadSignature}
                      disabled={
                        Boolean(working) ||
                        deliveryCompleted ||
                        (!signatureDrawn && !signatureUrl)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18a8ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#008fe6] disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      {working === "upload-signature"
                        ? "Uploading signature..."
                        : "Upload signature"}
                    </button>

                    {signatureUrl && (
                      <a
                        href={signatureUrl}
                        target="_blank"
                        className="text-sm font-bold text-[#007bff]"
                      >
                        View uploaded signature
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Camera className="h-4 w-4" />
                    Delivery photo
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={deliveryCompleted}
                    onChange={(event) =>
                      uploadPhoto(event.target.files?.[0] || null)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[#07182f] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:bg-slate-100 disabled:text-slate-500"
                  />

                  {working === "upload-photo" && (
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Uploading photo...
                    </p>
                  )}

                  {photoUrl && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img
                        src={photoUrl}
                        alt="Delivery proof"
                        className="max-h-80 w-full object-contain"
                      />
                      <a
                        href={photoUrl}
                        target="_blank"
                        className="block px-4 py-3 text-sm font-bold text-[#007bff]"
                      >
                        Open uploaded photo
                      </a>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Notes
                  </span>
                  <textarea
                    value={podNotes}
                    onChange={(event) => setPodNotes(event.target.value)}
                    disabled={deliveryCompleted}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#18a8ff] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="Delivery notes"
                  />
                </label>

                <button
                  onClick={completeDelivery}
                  disabled={Boolean(working) || deliveryCompleted}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#07182f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0b2445] disabled:opacity-60"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {deliveryCompleted
                    ? "Delivery completed"
                    : working === "complete"
                      ? "Completing..."
                      : "Complete delivery"}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">Live tracking</h2>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={startTracking}
                  disabled={Boolean(working) || trackingActive || deliveryCompleted}
                  className="rounded-full bg-[#18a8ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#008fe6] disabled:opacity-60"
                >
                  {working === "start-tracking" ? "Starting..." : "Start tracking"}
                </button>

                <button
                  onClick={stopTracking}
                  disabled={Boolean(working) || !trackingActive || deliveryCompleted}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {working === "stop-tracking" ? "Stopping..." : "Stop tracking"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-bold">Automatic GPS updates</p>
                <p className="mt-2 leading-6">
                  After Start tracking is pressed, this page sends location every
                  15 seconds while it remains open and the phone allows location access.
                </p>
                <p className="mt-2 font-semibold">
                  Keep this page open during the delivery. Mobile browsers can pause
                  GPS if the phone is locked or the browser is closed.
                </p>
              </div>

              {trackingMessage && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  {trackingMessage}
                </div>
              )}

              {lastAutoLocationAt && (
                <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                  Last automatic update: {formatDateTime(lastAutoLocationAt)}
                </div>
              )}

              {job.driverLocations?.[0] && (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="font-bold">Latest GPS</p>
                  <p className="mt-2 text-slate-600">
                    Lat: {job.driverLocations[0].latitude}
                  </p>
                  <p className="text-slate-600">
                    Lng: {job.driverLocations[0].longitude}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatTime(job.driverLocations[0].createdAt)}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">Vehicle</h2>

              {job.vehicle ? (
                <div className="mt-5 rounded-3xl bg-[#07182f] p-5 text-white">
                  <Truck className="h-8 w-8 text-[#18a8ff]" />
                  <p className="mt-4 text-2xl font-bold">{job.vehicle.name}</p>
                  <p className="mt-1 text-sm text-blue-100">
                    {job.vehicle.vehicleType}
                  </p>
                  {job.vehicle.registration && (
                    <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
                      {job.vehicle.registration}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  No vehicle assigned.
                </p>
              )}
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">Timeline</h2>

              <div className="mt-5 space-y-4">
                {(job.trackingEvents || []).length > 0 ? (
                  job.trackingEvents?.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#18a8ff]">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold">{event.title}</p>
                        {event.description && (
                          <p className="text-sm text-slate-500">
                            {event.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {formatTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                    No timeline events yet.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function AddressCard({ title, address }: { title: string; address: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">
        <MapPin className="h-4 w-4" />
        {title}
      </div>
      <p className="font-semibold leading-6">{address}</p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address,
        )}`}
        target="_blank"
        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#007bff]"
      >
        <Phone className="h-4 w-4" />
        Open location
      </a>
    </div>
  );
}
