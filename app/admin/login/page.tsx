"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,LockKeyhole,UserRound,ShieldCheck} from "lucide-react";
export default function AdminLogin(){const [identifier,setIdentifier]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const router=useRouter();
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");try{const response=await fetch("/api/admin-session/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({identifier,password})});const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to sign in.");setPassword("");localStorage.removeItem("streamline_admin_key");sessionStorage.removeItem("hoursStaffToken");const next=new URLSearchParams(window.location.search).get("next")||"/admin";router.replace(next.startsWith("/admin")&&!next.startsWith("/admin/login")&&!next.includes("\\")?next:"/admin");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to sign in.");}finally{setBusy(false);}}
 return (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06152f] px-4 py-6 sm:px-8 sm:py-12">
   <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,108,255,0.2),transparent_55%)]" />
   <div className="relative w-full max-w-[1120px]">
    <section className="grid overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.3)] lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr]">
     <div className="relative isolate flex flex-col justify-between overflow-hidden bg-[#071d49] p-7 sm:p-10 lg:p-12">
      <img src="/images/hero/hero-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 -z-20 hidden h-full w-full object-cover object-[60%_center] lg:block" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#071d49]/75 via-[#071d49]/45 to-[#031127]" />
      <img src="/images/logos/header-logo.png" alt="Streamline Logistics Group" width={280} height={80} className="h-auto w-52 object-contain object-left sm:w-60" />
      <div className="hidden pt-40 lg:block">
       <p className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#82baff]"><span aria-hidden="true" className="h-px w-8 bg-[#338aff]" />Operations portal</p>
       <h2 className="max-w-sm text-[44px] font-bold leading-[1.08] tracking-tight text-white">Every delivery.<br />One place.</h2>
       <p className="mt-5 max-w-xs text-sm leading-7 text-blue-100/85">Your team, your bookings and the road ahead. Welcome to Streamline.</p>
       <div aria-hidden="true" className="mt-8 h-1 w-12 rounded-full bg-[#006cff]" />
      </div>
     </div>
     <div className="flex flex-col justify-center px-6 py-9 sm:px-12 sm:py-12 lg:px-14">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-[#eef5ff] text-[#006cff]"><LockKeyhole size={22} strokeWidth={1.7} aria-hidden="true" /></div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#526888]">Admin access</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#071d49] sm:text-4xl">Welcome back.</h1>
      <p className="mt-3 text-sm leading-6 text-[#526888]">Sign in to your Streamline workspace.</p>
      <form className="mt-8 space-y-5" onSubmit={submit}>
       {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
       <label className="block text-sm font-semibold text-[#071d49]">Username or email
        <span className="relative mt-2 block">
         <UserRound size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#647895]" />
         <input required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="Enter your username or email" className="min-h-14 w-full rounded-xl border border-[#d6dfec] bg-[#f8faff] py-3 pl-11 pr-4 text-base font-normal text-[#071d49] outline-none transition placeholder:text-[#65758d] focus:border-[#006cff] focus:bg-white focus:ring-4 focus:ring-blue-100" value={identifier} onChange={e=>setIdentifier(e.target.value)}/>
        </span>
       </label>
       <label className="block text-sm font-semibold text-[#071d49]">Password
        <span className="relative mt-2 block">
         <LockKeyhole size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#647895]" />
         <input required type="password" autoComplete="current-password" placeholder="Enter your password" className="min-h-14 w-full rounded-xl border border-[#d6dfec] bg-[#f8faff] py-3 pl-11 pr-4 text-base font-normal text-[#071d49] outline-none transition placeholder:text-[#65758d] focus:border-[#006cff] focus:bg-white focus:ring-4 focus:ring-blue-100" value={password} onChange={e=>setPassword(e.target.value)}/>
        </span>
       </label>
       <div className="flex justify-end"><a href="/account-recovery?kind=staff" className="rounded text-sm font-semibold text-[#005bd6] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Forgot password?</a></div>
       <button disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#006cff] px-5 font-bold text-white shadow-[0_8px_20px_rgba(0,108,255,0.18)] transition hover:bg-[#005bd6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60">{busy?"Signing in...":"Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
      </form>
      <div className="mt-8 flex items-center gap-2 border-t border-[#e6edf7] pt-5 text-xs text-[#526888]"><ShieldCheck size={15} aria-hidden="true" className="shrink-0 text-[#006cff]" /><p>Secure access for the Streamline team.</p></div>
     </div>
    </section>
    <p className="mt-6 text-center text-[11px] tracking-[0.12em] text-[#9aadc8]">STREAMLINE LOGISTICS GROUP <span aria-hidden="true" className="mx-2 text-[#49617e]">/</span> FAST. RELIABLE. DEPENDABLE.</p>
   </div>
  </main>
 );
}
