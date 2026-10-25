"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
const API = "https://streamline-logistics-production.up.railway.app/api/recovery";
export default function AccountRecovery() {
 const [setup, setSetup] = useState(false);
 const [kind, setKind] = useState("customer"), [token, setToken] = useState("");
 const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
 const [usernameOnly, setUsernameOnly] = useState(false), [busy, setBusy] = useState(false);
 const [message, setMessage] = useState(""), [error, setError] = useState("");
 const [complete, setComplete] = useState(false), [checking, setChecking] = useState(true), [valid, setValid] = useState(false);
 const initialised = useRef(false);
 useEffect(() => {
  if (initialised.current) return;
  initialised.current = true;
  const url = new URL(window.location.href), accountKind = url.searchParams.get("kind") === "staff" ? "staff" : "customer", linkToken = url.hash.slice(1);
  setSetup(url.searchParams.get("purpose") === "setup"); setKind(accountKind); setToken(linkToken);
  if (url.hash) history.replaceState(null, "", url.pathname + url.search);
  if (!linkToken) { setChecking(false); return; }
  void validateLink(accountKind, linkToken);
 }, []);
 async function validateLink(accountKind = kind, linkToken = token) {
  setChecking(true); setError(""); setValid(false);
  try {
   const response = await fetch(`${API}/${accountKind}/validate`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: linkToken }) });
   const data = await response.json();
   if (!response.ok || !data.valid) throw new Error(data.error || "This reset link is unavailable. Request a new link.");
   setValid(true);
  } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to check this link. Try again."); }
  finally { setChecking(false); }
 }
 async function submit(event: React.FormEvent) {
  event.preventDefault(); if (busy || checking || (token && !valid)) return;
  setError(""); setMessage("");
  if (token && password !== confirm) { setError("Passwords must match."); return; }
  setBusy(true);
  try {
   const response = await fetch(`${API}/${kind}/${token ? "reset" : "request"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token, password } : { email, usernameOnly }) });
   const data = await response.json();
   if (!response.ok) { if (token && /expired|already used|invalid.*link/i.test(data.error || "")) setValid(false); throw new Error(data.error || "Unable to recover account."); }
   setMessage(data.message);
   if (token) { setComplete(true); setValid(false); setPassword(""); setConfirm(""); }
  } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to recover account."); }
  finally { setBusy(false); }
 }
 return <main className="min-h-screen bg-blue-50 px-5 py-12 text-[#071D49]"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
  <h1 className="text-3xl font-bold">{token ? (setup ? "Set your password" : "Reset password") : "Account recovery"}</h1>
  <p className="my-4">{kind === "staff" ? "Staff account" : "Customer account"}</p>
  {checking && <p role="status">Checking your password link…</p>}
  {!checking && !complete && (!token || valid) && <form onSubmit={submit} className="grid gap-4">
   {token ? <>
    <label>New password<input className="block w-full rounded border p-3" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)}/></label>
    <label>Confirm password<input className="block w-full rounded border p-3" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)}/></label>
   </> : <>
    <label>Account email<input className="block w-full rounded border p-3" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
    <label><input type="checkbox" checked={usernameOnly} onChange={event => setUsernameOnly(event.target.checked)}/> Remind me of my sign-in details</label>
   </>}
   <button disabled={busy} className="rounded bg-blue-700 p-3 font-bold text-white">{busy ? "Please wait…" : token ? (setup ? "Set password" : "Save new password") : "Send recovery email"}</button>
  </form>}
  {error && <p className="my-4 text-red-700" role="alert">{error}</p>}
  {token && !checking && !complete && !valid && <div className="my-4 flex gap-4"><Link className="underline" href={`/account-recovery?kind=${kind}`}>Request a new link</Link><button type="button" className="underline" onClick={() => void validateLink()}>Check link again</button></div>}
  {message && <p className="my-4" role="status">{message}</p>}
  <Link className="mt-5 block underline" href={kind === "staff" ? "/admin/permissions" : "/login"}>Back to sign in</Link>
  <Link className="mt-3 block underline" href="/driver/login">Driver account recovery</Link>
 </section></main>;
}
