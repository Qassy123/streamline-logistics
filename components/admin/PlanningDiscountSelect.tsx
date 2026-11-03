"use client";
import {adminFetch} from "@/lib/adminFetch";
import {useEffect,useState} from "react";
export default function PlanningDiscountSelect({customerId,value,onChange}:{customerId:string|null;value:string;onChange:(id:string)=>void}){
 const [rows,setRows]=useState<{id:string;label:string}[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true;setRows([]);setError("");const key=String("session");if(!key)return;const base=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")||"https://streamline-logistics-production.up.railway.app";void adminFetch(`${base}/api/quotes/admin/discount-options?customerId=${encodeURIComponent(customerId||"")}`,{cache:"no-store",headers:{}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Unable to load discounts.");if(active)setRows(d.discounts||[]);}).catch(()=>{if(active)setError("Unable to load discounts.");});return()=>{active=false;};},[customerId]);
 return <label className="mt-4 block text-sm font-semibold">Select discount<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Select discount</option>{rows.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select>{error&&<span role="alert" className="text-red-700">{error}</span>}</label>;
}
