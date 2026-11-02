"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Notice={id:string;label:string;reference:string;href:string};
export default function NewRecordNotifications({kind,badge=false}:{kind:"CUSTOMER"|"BOOKING";badge?:boolean}){
 const [rows,setRows]=useState<Notice[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const base=(process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")||"https://streamline-logistics-production.up.railway.app")+(kind==="CUSTOMER"?"/api/admin/customers/new-notices":"/api/bookings/admin/new-notices");
 useEffect(()=>{let active=true;async function load(){const key=localStorage.getItem("streamline_admin_key");if(!key){if(active)setRows([]);return;}try{const r=await fetch(base,{cache:"no-store",headers:{"x-admin-key":key}}),d=await r.json();if(!r.ok)throw Error(d.error||"Unable to load notifications.");if(active){setRows(d.notices||[]);setError("");}}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load notifications.");}}void load();const timer=setInterval(load,15000);window.addEventListener("focus",load);window.addEventListener("new-record-checked",load);return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",load);window.removeEventListener("new-record-checked",load);};},[base]);
 async function check(id:string){setBusy(id);try{const r=await fetch(`${base}/${encodeURIComponent(id)}/check`,{method:"POST",headers:{"x-admin-key":localStorage.getItem("streamline_admin_key")||""}});if(!r.ok)throw Error("Unable to mark checked.");window.dispatchEvent(new Event("new-record-checked"));}catch(e){setError(e instanceof Error?e.message:"Unable to mark checked.");}finally{setBusy("");}}
 if(badge)return rows.length?<span className="ml-2 rounded-full bg-red-600 px-2 text-white" aria-label={`${rows.length} new ${kind==="CUSTOMER"?"accounts":"bookings"}`}>{rows.length}</span>:null;
 if(!rows.length&&!error)return null;
 return <section className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold">New {kind==="CUSTOMER"?"customer accounts":"bookings"} ({rows.length})</h2>{error&&<p role="alert">{error}</p>}{rows.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><Link className="font-semibold underline" href={row.href}>{row.label} - {row.reference}</Link><button disabled={!!busy} onClick={()=>void check(row.id)} className="min-h-11 rounded-lg border bg-white px-4">{busy===row.id?"Saving...":"Mark checked"}</button></div>)}</section>;
}
