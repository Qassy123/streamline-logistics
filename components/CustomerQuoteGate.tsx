"use client";
import { useEffect, useState, type ReactNode } from "react";
const API = "https://streamline-logistics-production.up.railway.app/api/accounts/me";
export default function CustomerQuoteGate({ children }: { children: ReactNode }) {
 const [status, setStatus] = useState<"CHECKING" | "OPEN" | "SUSPENDED" | "ERROR">("CHECKING");
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  let active = true, controller: AbortController | null = null;
  async function refresh() {
   controller?.abort(); const current = new AbortController(); controller = current;
   const token = localStorage.getItem("streamline_auth_token");
   if (!token) { if (active) setStatus("OPEN"); return; }
   const timeout = window.setTimeout(() => current.abort(), 8000);
   try {
    const response = await fetch(API, { cache: "no-store", signal: current.signal, headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!active || controller !== current) return;
    if (response.status === 401) { setStatus("OPEN"); return; }
    if (!response.ok || !data.user) throw new Error("Account check failed");
    setStatus(data.user.accountStatus === "SUSPENDED" ? "SUSPENDED" : data.user.accountStatus && data.user.accountStatus !== "ACTIVE" ? "ERROR" : "OPEN");
   } catch { if (active && controller === current) setStatus("ERROR"); }
   finally { window.clearTimeout(timeout); }
  }
  void refresh();
  const interval = window.setInterval(() => void refresh(), 30000);
  window.addEventListener("focus", refresh); window.addEventListener("streamline-auth-change", refresh);
  return () => { active = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("streamline-auth-change", refresh); };
 }, [retry]);
 if (status === "OPEN") return <>{children}</>;
 return <main className="min-h-screen bg-[#F4F8FF] px-4 py-12 text-[#071D49]"><section className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-white p-6" role="status">
  <h1 className="text-2xl font-bold">{status === "CHECKING" ? "Checking your account…" : status === "SUSPENDED" ? "Your account is suspended" : "Unable to check your account"}</h1>
  {status !== "CHECKING" && <><p className="mt-4">{status === "SUSPENDED" ? "Online booking is unavailable while your account is suspended. Please contact our team for more information." : "Please try again before filling out your quote, or contact our team."}</p><a className="mt-5 inline-block font-bold underline" href="tel:07301827224">Call 07301827224</a><a className="ml-5 underline" href="/contact">Contact us</a>{status === "ERROR" && <button type="button" className="ml-5 underline" onClick={() => setRetry(value => value + 1)}>Try again</button>}</>}
 </section></main>;
}
