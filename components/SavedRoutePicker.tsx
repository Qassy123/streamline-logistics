"use client";
import { useEffect, useRef, useState } from "react";
export type RouteChoice = { id:string; name?:string|null; collectionAddress:string; deliveryAddress:string };
export default function SavedRoutePicker({accountId,apiBase="https://streamline-logistics-production.up.railway.app/api",onSelect,refresh=0}:{accountId?:string;apiBase?:string;onSelect:(route:RouteChoice)=>void;refresh?:number}) {
  const [routes,setRoutes]=useState<RouteChoice[]>([]),[query,setQuery]=useState(""),[error,setError]=useState("");
  const details=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const controller=new AbortController(); setRoutes([]); setError(""); setQuery("");
    const token=accountId?sessionStorage.getItem("hoursStaffToken"):localStorage.getItem("streamline_auth_token");
    const key=accountId?localStorage.getItem("streamline_admin_key"):null;
    if (!token && !key) return;
    fetch(`${apiBase}/saved-routes/${accountId?`admin/${encodeURIComponent(accountId)}`:"me"}`,{cache:"no-store",signal:controller.signal,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(key?{"x-admin-key":key}:{})}})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load routes.");setRoutes(data.savedRoutes||[]);})
      .catch(error=>{if(!controller.signal.aborted)setError(error.message);});
    return ()=>controller.abort();
  },[accountId,apiBase,refresh]);
  if (!routes.length && !error) return null;
  const filtered=routes.filter(route=>(route.name||`${route.collectionAddress} to ${route.deliveryAddress}`).toLowerCase().includes(query.toLowerCase()));
  return <details ref={details} className="my-4 rounded-xl border border-blue-200 bg-white p-4 text-[#071D49]">
    <summary className="cursor-pointer font-bold">Choose a saved route ({routes.length})</summary>
    <label className="mt-3 block">Search by route name<input aria-label="Search saved route names" value={query} onChange={event=>setQuery(event.target.value)} className="my-2 w-full rounded-lg border p-3" /></label>
    {error&&<p role="alert">{error}</p>}
    <div className="max-h-64 overflow-y-auto">{filtered.map(route=><button type="button" className="block w-full border-b p-3 text-left hover:bg-blue-50" key={route.id} onClick={()=>{onSelect(route);if(details.current)details.current.open=false;}}><strong>{route.name||"Unnamed route"}</strong><span className="block text-sm">{route.collectionAddress} → {route.deliveryAddress}</span></button>)}{!filtered.length&&<p>No matching routes.</p>}</div>
  </details>;
}
