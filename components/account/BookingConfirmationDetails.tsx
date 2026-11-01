"use client";
import { useEffect, useState } from "react";
const API=(process.env.NEXT_PUBLIC_API_BASE_URL||process.env.NEXT_PUBLIC_API_URL||"https://streamline-logistics-production.up.railway.app").replace(/\/$/,"");
export default function BookingConfirmationDetails({quoteId,initialReference,initialName}:{quoteId?:string;initialReference?:string|null;initialName?:string|null}){
 const [details,setDetails]=useState({reference:initialReference||"",name:initialName||""});const [error,setError]=useState("");
 useEffect(()=>{let active=true;const token=localStorage.getItem("streamline_auth_token");if(!quoteId||!token)return;
 void fetch(`${API}/api/bookings/me`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load booking confirmation.");const booking=(data.bookings||[]).find((row:{quoteId?:string;quote?:{id:string}})=>row.quoteId===quoteId||row.quote?.id===quoteId);if(active&&booking)setDetails({reference:booking.reference||"",name:data.accountName||booking.quote?.companyName||booking.quote?.legalEntity||booking.quote?.customerName||initialName||""});}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load booking confirmation.");});return()=>{active=false;};
 },[quoteId,initialName]);
 return <div className="rounded-2xl border border-[#D7E6FF] bg-white p-5"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-slate-500">Booking Reference</dt><dd className="mt-2 font-bold">{details.reference||"Confirmation pending — check your bookings"}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Business / Customer Name</dt><dd className="mt-2 font-bold">{details.name||"Sign in to view your account"}</dd></div></dl>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</div>;
}
