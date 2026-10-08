"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, Loader2, MoreHorizontal, Phone, Truck } from "lucide-react";

import { pausePhoneTracking } from "@/lib/driverPhoneTracking";

export const DRIVER_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://streamline-logistics-production.up.railway.app";
export type PortalVehicle = { id: string; name: string; registration: string | null; vehicleType: string };
export type PortalDriver = { id: string; name: string; username: string; email: string; phone: string | null; active: boolean; availability: string; onDuty: boolean; vehicle: PortalVehicle | null; vehicleId?: string | null };
export class DriverRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "DriverRequestError"; }
}
type PortalContext = {
  driver: PortalDriver;
  online: boolean;
  sessionStale: boolean;
  unreadNotifications: number;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  refreshSession: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  signOut: (allDevices?: boolean) => Promise<void>;
};
const DriverContext = createContext<PortalContext | null>(null);
export function useDriverPortal() {
  const context = useContext(DriverContext);
  if (!context) throw new Error("The driver page must be inside DriverPortalShell.");
  return context;
}
function discardSession() {
  try { for (const key of ["driverToken", "driver", "driverSessionExpiresAt"]) window.localStorage.removeItem(key); }
  catch { /* Server authentication remains authoritative when browser storage is unavailable. */ }
}
export function driverStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function Navigation({ pathname, unread }: { pathname: string; unread: number }) {
  const items = [
    { href: "/driver/dashboard", label: "Today", icon: CalendarDays, active: pathname === "/driver/dashboard" || pathname === "/driver" },
    { href: "/driver/jobs", label: "Jobs", icon: ClipboardList, active: pathname === "/driver/jobs" || pathname.startsWith("/driver/jobs/") },
    { href: "/driver/vehicle", label: "Vehicle", icon: Truck, active: pathname === "/driver/vehicle" },
    { href: "/driver/profile", label: "More", icon: MoreHorizontal, active: pathname === "/driver/profile" },
  ];
  return <nav aria-label="Driver portal" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"><div className="mx-auto grid max-w-3xl grid-cols-4">{items.map(item => <Link key={item.href} href={item.href} prefetch={false} aria-current={item.active ? "page" : undefined} className={`relative flex min-h-[68px] flex-col items-center justify-center gap-1 px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${item.active ? "bg-blue-50 text-[#006CFF]" : "text-slate-500 hover:bg-slate-50"}`}><item.icon size={23} aria-hidden="true" /><span>{item.label}</span>{item.label === "More" && unread > 0 ? <span className="absolute right-[calc(50%-26px)] top-2 rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white" aria-label={`${unread} unread notifications`}>{unread > 99 ? "99+" : unread}</span> : null}</Link>)}</div></nav>;
}

function SignedInPortal({ children, pathname }: { children: ReactNode; pathname: string }) {
  const router = useRouter();
  const [driver, setDriver] = useState<PortalDriver | null>(null);
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(true);
  const [sessionStale, setSessionStale] = useState(false);
  const [error, setError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const mounted = useRef(false);
  const tokenRef = useRef("");
  const driverIdRef = useRef("");
  const sessionFlight = useRef<Promise<void> | null>(null);
  const notificationFlight = useRef<Promise<void> | null>(null);
  const pending = useRef(new Set<AbortController>());
  const lifecycle = useRef(0);

  const invalidate = useCallback(() => {
    if (driverIdRef.current) pausePhoneTracking(driverIdRef.current, "Location sharing paused because your driver session ended.");
    driverIdRef.current = ""; tokenRef.current = ""; discardSession();
    for (const abort of pending.current) abort.abort();
    if (mounted.current) { setDriver(null); setUnreadNotifications(0); setChecking(true); }
    router.replace("/driver/login");
  }, [router]);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    // Do not send a driver credential to an arbitrary URL supplied by a page or notification.
    if (!path.startsWith("/api/driver/") || path.includes("\\")) throw new DriverRequestError("Invalid driver request.", 400);
    const destination = new URL(path, DRIVER_API_BASE);
    if (destination.origin !== new URL(DRIVER_API_BASE).origin || !destination.pathname.startsWith("/api/driver/")) throw new DriverRequestError("Invalid driver request.", 400);
    const token = tokenRef.current;
    if (!token) { invalidate(); throw new DriverRequestError("Please sign in again.", 401); }
    const abort = new AbortController(); pending.current.add(abort);
    const externalAbort = () => abort.abort();
    options.signal?.addEventListener("abort", externalAbort, { once: true });
    if (options.signal?.aborted) abort.abort();
    const timeout = window.setTimeout(() => abort.abort(), 25_000);
    try {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const response = await fetch(destination.toString(), { ...options, headers, cache: "no-store", credentials: "omit", redirect: "error", signal: abort.signal });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        if (tokenRef.current === token) invalidate();
        throw new DriverRequestError("Your session has expired. Sign in again.", 401);
      }
      if (!response.ok) throw new DriverRequestError(payload?.error || "Unable to confirm this update. Refresh before retrying.", response.status);
      if (payload === null) throw new DriverRequestError("The server returned an unreadable response. Refresh before retrying an update.", 502);
      return payload as T;
    } catch (failure) {
      if (failure instanceof DriverRequestError) throw failure;
      if (failure instanceof Error && failure.name === "AbortError") throw new DriverRequestError("The request was interrupted or timed out. Refresh to check whether an update was saved.", 0);
      throw new DriverRequestError("Unable to connect. Check your connection, then refresh before retrying an update.", 0);
    } finally {
      window.clearTimeout(timeout); options.signal?.removeEventListener("abort", externalAbort); pending.current.delete(abort);
    }
  }, [invalidate]);

  const refreshSession = useCallback((): Promise<void> => {
    if (sessionFlight.current) return sessionFlight.current;
    const cycle = lifecycle.current;
    const operation = (async () => {
      try {
        const data = await request<{ driver: PortalDriver; expiresAt: string | null }>("/api/driver/auth/me");
        if (!mounted.current || cycle !== lifecycle.current) return;
        if (!data.driver?.id || !data.driver.active) { invalidate(); return; }
        driverIdRef.current = data.driver.id; setDriver(data.driver); setSessionStale(false); setError("");
        try {
          window.localStorage.setItem("driver", JSON.stringify(data.driver));
          if (data.expiresAt) window.localStorage.setItem("driverSessionExpiresAt", data.expiresAt);
        } catch { /* A valid current session can continue without refreshing the local profile cache. */ }
      } catch (failure) {
        if (mounted.current && cycle === lifecycle.current && !(failure instanceof DriverRequestError && failure.status === 401)) {
          setSessionStale(true); setError(failure instanceof Error ? failure.message : "Unable to check your driver session.");
        }
      } finally { if (mounted.current && cycle === lifecycle.current) setChecking(false); }
    })();
    sessionFlight.current = operation;
    void operation.finally(() => { if (sessionFlight.current === operation) sessionFlight.current = null; });
    return operation;
  }, [invalidate, request]);

  const refreshNotifications = useCallback((): Promise<void> => {
    if (notificationFlight.current) return notificationFlight.current;
    const cycle = lifecycle.current;
    const operation = (async () => {
      try {
        const data = await request<{ pagination: { total: number } }>("/api/driver/jobs/notifications?unread=true&pageSize=1");
        if (mounted.current && cycle === lifecycle.current && Number.isFinite(data.pagination?.total)) setUnreadNotifications(data.pagination.total);
      } catch { /* A failed notification poll does not label an unconfirmed read as successful. */ }
    })();
    notificationFlight.current = operation;
    void operation.finally(() => { if (notificationFlight.current === operation) notificationFlight.current = null; });
    return operation;
  }, [request]);

  const signOut = useCallback(async (allDevices = false) => {
    await request(allDevices ? "/api/driver/auth/logout-all" : "/api/driver/auth/logout", { method: "POST" });
    invalidate();
  }, [invalidate, request]);

  useEffect(() => {
    lifecycle.current++; mounted.current = true;
    sessionFlight.current = null; notificationFlight.current = null;
    setOnline(navigator.onLine);
    try { tokenRef.current = window.localStorage.getItem("driverToken") || ""; }
    catch { setError("Your browser cannot access the saved login. Allow site storage, then sign in again."); setChecking(false); }
    if (!tokenRef.current) { invalidate(); return () => { mounted.current = false; }; }
    const cycle = lifecycle.current;
    async function refresh() { await refreshSession(); if (mounted.current && cycle === lifecycle.current && tokenRef.current) await refreshNotifications(); }
    const reconnect = () => { setOnline(true); void refresh(); };
    const disconnect = () => { setOnline(false); setSessionStale(true); };
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key === "driverToken" || event.key === null) {
        // A login/logout in another tab must not expose the previous driver's cached work.
        if (driverIdRef.current) pausePhoneTracking(driverIdRef.current, "Driver login changed in another tab.");
        window.location.reload();
      }
    };
    window.addEventListener("online", reconnect); window.addEventListener("offline", disconnect);
    window.addEventListener("storage", storage); document.addEventListener("visibilitychange", visible);
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine && tokenRef.current) void refresh(); }, 45_000);
    return () => {
      if (driverIdRef.current) pausePhoneTracking(driverIdRef.current, "Driver portal closed. Phone sharing paused.");
      mounted.current = false; lifecycle.current++; window.clearInterval(timer);
      window.removeEventListener("online", reconnect); window.removeEventListener("offline", disconnect);
      window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible);
      for (const abort of pending.current) abort.abort();
    };
  }, [invalidate, refreshNotifications, refreshSession]);

  if (!driver) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 text-center"><div className="max-w-sm"><Truck size={32} className="mx-auto text-[#006CFF]" /><h1 className="mt-4 text-xl font-bold text-[#071D49]">Streamline driver portal</h1>{checking ? <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600"><Loader2 size={18} className="animate-spin" />Checking your session…</p> : <><p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{error || "Connect to the internet to check your driver session."}</p><button onClick={() => void refreshSession()} className="mt-4 min-h-12 rounded-xl bg-[#006CFF] px-5 py-3 font-semibold text-white">Retry connection</button><Link href="/driver/login" className="mt-3 block py-3 text-sm font-semibold text-blue-700">Return to sign in</Link><a href="tel:03333440703" className="mt-2 block py-3 text-sm font-semibold text-slate-600">Call dispatch · 0333 344 0703</a></>}</div></div>;

  return <DriverContext.Provider value={{ driver, online, sessionStale, unreadNotifications, request, refreshSession, refreshNotifications, signOut }}>
    <div className="min-h-[100dvh] bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-[#071D49] text-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4"><div className="flex min-w-0 items-center gap-3"><Truck size={26} className="shrink-0 text-blue-300" /><div className="min-w-0"><p className="truncate font-bold">{driver.name}</p><p className="text-xs text-blue-100">{driver.onDuty ? "On duty" : "Off duty"}{driver.vehicle ? ` · ${driver.vehicle.registration || driver.vehicle.name}` : " · No van assigned"}</p></div></div><a href="tel:03333440703" aria-label="Call dispatch on 0333 344 0703" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 px-3 hover:bg-white/10"><Phone size={19} /></a></div></header>
      {!online || sessionStale ? <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">{!online ? "Offline. Saved drafts remain pending until the server confirms them." : "Connection needs checking. Refresh before retrying an update."}{online ? <button className="ml-2 font-bold underline" onClick={() => void refreshSession()}>Retry</button> : null}</div> : null}
      <main id="driver-content" className="mx-auto max-w-3xl px-4 py-5 pb-[calc(100px+env(safe-area-inset-bottom))] sm:px-6">{children}</main>
      <Navigation pathname={pathname} unread={unreadNotifications} />
    </div>
  </DriverContext.Provider>;
}

function PortalRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/driver/login" || pathname === "/driver/login/") return <>{children}</>;
  return <SignedInPortal pathname={pathname || "/driver/dashboard"}>{children}</SignedInPortal>;
}
export default function DriverPortalShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-[100dvh] bg-slate-50 p-6 text-center text-sm text-slate-600">Loading driver portal…</div>}><PortalRoute>{children}</PortalRoute></Suspense>;
}
