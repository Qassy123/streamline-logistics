"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export type FleetApi = <T>(path: string, options?: RequestInit) => Promise<T>;
export type FleetStaff = { id: string; name: string; role: string };
const API = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://streamline-logistics-production.up.railway.app").replace(/\/$/, "");
export const fleetInput = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950";
export const fleetButton = "min-h-11 rounded-xl bg-[#006CFF] px-4 py-3 font-semibold text-white disabled:opacity-50";
export const fleetTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Not recorded";
export default function FleetStaffGate({ children }: { children: (api: FleetApi, staff: FleetStaff) => ReactNode }) {
  const token = useRef(""), pending = useRef(new Map<string, string>()), flight = useRef(false);
  const [staff, setStaff] = useState<FleetStaff | null>(null), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const api: FleetApi = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers); headers.set("Authorization", `Bearer ${token.current}`);
    let body = options.body, key = "";
    if (typeof body === "string") { headers.set("Content-Type", "application/json"); key = `${path}:${body}`; const data = JSON.parse(body); if (!data.requestId) { let id = pending.current.get(key); if (!id) { id = crypto.randomUUID(); pending.current.set(key, id); } body = JSON.stringify({ ...data, requestId: id }); } }
    const response = await fetch(API + path, { ...options, body, headers, cache: "no-store", credentials: "omit", redirect: "error" }); const data = await response.json();
    if (!response.ok) { if (response.status === 401) { token.current = ""; sessionStorage.removeItem("hoursStaffToken"); setStaff(null); } throw new Error(data.error || "Fleet request failed."); }
    if (key) pending.current.delete(key); return data as T;
  };
  useEffect(() => { token.current = sessionStorage.getItem("hoursStaffToken") || ""; if (token.current) void api<{ admin: FleetStaff }>("/api/admin/auth/me").then(data => setStaff(data.admin)).catch(e => setError(e.message)); }, []);
  if (!staff) return <section className="my-6 max-w-lg space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold text-[#071D49]">Fleet operations — staff sign in</h2><p>Use your staff account from Staff & Permissions. Existing planning tools remain below.</p>{error && <p role="alert" className="text-red-700">{error}</p>}<form className="space-y-4" onSubmit={e => { e.preventDefault(); if (flight.current) return; flight.current = true; setBusy(true); setError(""); void (async () => { try { const response = await fetch(API + "/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }), credentials: "omit", redirect: "error" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Sign-in failed."); token.current = data.token; sessionStorage.setItem("hoursStaffToken", data.token); setStaff(data.admin); setPassword(""); } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); } finally { flight.current = false; setBusy(false); } })(); }}><label className="block">Staff email<input required type="email" autoComplete="username" className={fleetInput} value={email} onChange={e => setEmail(e.target.value)} /></label><label className="block">Password<input required type="password" autoComplete="current-password" className={fleetInput} value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy} className={fleetButton}>Sign in</button></form></section>;
  return <section className="my-6 space-y-4"><p className="text-sm">Fleet staff: {staff.name} · {staff.role.replaceAll("_", " ")}</p>{children(api, staff)}</section>;
}
