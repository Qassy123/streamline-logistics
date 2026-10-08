"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Phone, Truck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://streamline-logistics-production.up.railway.app";
type Screen = "LOGIN" | "PASSWORD" | "USERNAME" | "RESET";
type AuthPayload = { error?: string; message?: string; token?: string; expiresAt?: string; driver?: { id?: string; [key: string]: unknown } };
const inputStyle = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#006CFF] focus:ring-4 focus:ring-blue-50 disabled:opacity-60";

function clearDriverSession() {
  for (const key of ["driverToken", "driver", "driverSessionExpiresAt"]) window.localStorage.removeItem(key);
}

export default function DriverLoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("LOGIN");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("reset");
    if (token !== null) {
      setScreen("RESET");
      if (/^[a-f0-9]{64}$/i.test(token)) setResetToken(token);
      else setError("This reset link is invalid. Request a new password reset below.");
      // Keep the recovery credential out of copied URLs and subsequent navigation.
      url.searchParams.delete("reset");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setReady(true);
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  function changeScreen(next: Screen) {
    if (inFlight.current) return;
    setScreen(next); setError(""); setMessage(""); setPassword(""); setConfirmPassword(""); setShowPassword(false);
    if (next !== "RESET") setResetToken("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    setError(""); setMessage("");
    if (screen === "LOGIN" && (!login.trim() || !password)) { setError("Enter your username or email and password."); return; }
    if ((screen === "PASSWORD" || screen === "USERNAME") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter the email address registered to your driver account."); return; }
    if (screen === "RESET") {
      if (!resetToken) { setError("Request a new password reset link."); return; }
      if (password.length < 8 || new TextEncoder().encode(password).length > 72) { setError("Use at least 8 characters and no more than 72 bytes for your new password."); return; }
      if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    }
    const path = screen === "LOGIN" ? "login" : screen === "RESET" ? "reset-password" : screen === "PASSWORD" ? "forgot-password" : "forgot-username";
    const body = screen === "LOGIN" ? { login: login.trim(), password } : screen === "RESET" ? { token: resetToken, password } : { email: email.trim().toLowerCase() };
    inFlight.current = true; setLoading(true);
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 25_000);
    try {
      const response = await fetch(`${API_BASE}/api/driver/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: abort.signal, body: JSON.stringify(body) });
      const payload: AuthPayload = await response.json().catch(() => ({}));
      if (!mounted.current) return;
      if (!response.ok) throw new Error(payload.error || "Unable to complete this request. Please try again.");
      if (screen === "LOGIN") {
        const expiry = payload.expiresAt ? Date.parse(payload.expiresAt) : NaN;
        if (!payload.token || !/^[a-f0-9]{64}$/i.test(payload.token) || !payload.driver?.id || !Number.isFinite(expiry) || expiry <= Date.now()) {
          throw new Error("Unable to confirm your driver session. Please try signing in again.");
        }
        try {
          clearDriverSession();
          window.localStorage.setItem("driver", JSON.stringify(payload.driver));
          window.localStorage.setItem("driverSessionExpiresAt", payload.expiresAt!);
          // Write the credential last so a partial storage failure cannot look like a signed-in session.
          window.localStorage.setItem("driverToken", payload.token);
        } catch {
          try { clearDriverSession(); } catch { /* Browser storage may be completely unavailable. */ }
          // Revoke the newly issued session when this browser cannot retain it.
          void fetch(`${API_BASE}/api/driver/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${payload.token}` }, cache: "no-store" }).catch(() => undefined);
          throw new Error("Your browser could not save this login. Allow site storage and try again.");
        }
        setPassword(""); router.replace("/driver/dashboard");
      } else if (screen === "RESET") {
        try { clearDriverSession(); } catch { /* Server has already revoked the old sessions. */ }
        setResetToken(""); setPassword(""); setConfirmPassword(""); setShowPassword(false); setScreen("LOGIN");
        setMessage(payload.message || "Password updated. Sign in with your new password.");
      } else {
        setMessage(payload.message || "If this email matches an active driver account, check your inbox. If nothing arrives, contact dispatch.");
      }
    } catch (requestError) {
      if (mounted.current) setError(requestError instanceof Error && requestError.name === "AbortError" ? "The request timed out. Check your connection and try again. If you were resetting your password, try signing in first in case it was saved." : requestError instanceof Error ? requestError.message : "Unable to connect. Please try again.");
    } finally {
      window.clearTimeout(timeout); if (controller.current === abort) controller.current = null;
      inFlight.current = false; if (mounted.current) setLoading(false);
    }
  }

  const heading = screen === "LOGIN" ? "Driver sign in" : screen === "PASSWORD" ? "Reset your password" : screen === "USERNAME" ? "Recover your username" : "Set a new password";
  const description = screen === "LOGIN" ? "Use your driver username or email address." : screen === "RESET" ? "Choose a new password for your driver account." : "Enter your registered driver email. We’ll email you if it matches an active account.";
  return (
    <main className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-950">
      <header className="bg-[#071D49] px-5 py-5 text-white"><div className="mx-auto flex max-w-lg items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#006CFF]"><Truck size={24} aria-hidden="true" /></span><div><p className="text-lg font-bold">Streamline Logistics</p><p className="text-sm text-blue-100">Driver portal</p></div></div></header>
      <section className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-8 sm:py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={loading}>
            {screen === "LOGIN" ? <label className="block"><span className="mb-2 block text-sm font-semibold">Username or email</span><input className={inputStyle} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={loading || !ready} value={login} onChange={e => setLogin(e.target.value)} /></label> : screen !== "RESET" ? <label className="block"><span className="mb-2 block text-sm font-semibold">Driver account email</span><input className={inputStyle} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={loading || !ready} value={email} onChange={e => setEmail(e.target.value)} /></label> : null}
            {screen === "LOGIN" || screen === "RESET" ? <>
              <label className="block" htmlFor="driver-password"><span className="mb-2 block text-sm font-semibold">{screen === "RESET" ? "New password" : "Password"}</span></label>
              <div className="relative !mt-2"><input id="driver-password" name="password" className={`${inputStyle} pr-14`} type={showPassword ? "text" : "password"} autoComplete={screen === "RESET" ? "new-password" : "current-password"} required minLength={screen === "RESET" ? 8 : undefined} maxLength={screen === "RESET" ? 72 : 1024} disabled={loading || !ready || (screen === "RESET" && !resetToken)} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" disabled={loading} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            </> : null}
            {screen === "RESET" ? <label className="block"><span className="mb-2 block text-sm font-semibold">Confirm new password</span><input className={inputStyle} name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={72} disabled={loading || !ready || !resetToken} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /><span className="mt-2 block text-xs text-slate-500">At least 8 characters. Resetting your password signs you out on all devices.</span></label> : null}
            {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p> : null}
            {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{message}</p> : null}
            <button type="submit" disabled={loading || !ready || (screen === "RESET" && !resetToken)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#006CFF] px-5 py-3 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><Loader2 size={18} className="animate-spin" />Please wait…</> : screen === "LOGIN" ? "Sign in" : screen === "RESET" ? "Save new password" : screen === "PASSWORD" ? "Email reset link" : "Email my username"}</button>
          </form>
          {screen === "LOGIN" ? <div className="mt-5 flex flex-wrap justify-between gap-2"><button type="button" disabled={loading || !ready} onClick={() => changeScreen("USERNAME")} className="min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-4">Forgot username?</button><button type="button" disabled={loading || !ready} onClick={() => changeScreen("PASSWORD")} className="min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-4">Forgot password?</button></div> : <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" disabled={loading} onClick={() => changeScreen("LOGIN")} className="min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-4">Back to sign in</button>{screen === "RESET" ? <button type="button" disabled={loading} onClick={() => changeScreen("PASSWORD")} className="min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-4">Request a new reset link</button> : null}</div>}
        </div>
        <a href="tel:03333440703" className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#071D49]"><Phone size={17} />Call dispatch · 0333 344 0703</a>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">Driver access only. Your van and jobs are assigned by dispatch.</p>
      </section>
    </main>
  );
}
