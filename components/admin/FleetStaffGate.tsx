"use client";
import {useRef,type ReactNode} from "react";
import {useAdminSession} from "./AdminSession";
import {adminFetch} from "@/lib/adminFetch";
export type FleetApi=<T>(path:string,options?:RequestInit)=>Promise<T>;
export type FleetStaff={id:string;name:string;role:string};
const API=(process.env.NEXT_PUBLIC_API_BASE_URL||process.env.NEXT_PUBLIC_API_URL||"https://streamline-logistics-production.up.railway.app").replace(/\/$/,"");
export const fleetInput="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950";
export const fleetButton="min-h-11 rounded-xl bg-[#006CFF] px-4 py-3 font-semibold text-white disabled:opacity-50";
export const fleetTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London"}):"Not recorded";
export default function FleetStaffGate({children}:{children:(api:FleetApi,staff:FleetStaff)=>ReactNode}){
 const {admin}=useAdminSession(),pending=useRef(new Map<string,string>());
 const api:FleetApi=async<T,>(path:string,options:RequestInit={}):Promise<T>=>{const headers=new Headers(options.headers);let body=options.body,key="";
 if(typeof body==="string"){headers.set("Content-Type","application/json");key=`${path}:${body}`;const data=JSON.parse(body);if(!data.requestId){let id=pending.current.get(key);if(!id){id=crypto.randomUUID();pending.current.set(key,id);}body=JSON.stringify({...data,requestId:id});}}
 const response=await adminFetch(API+path,{...options,body,headers,cache:"no-store",redirect:"error"}),data=await response.json();if(!response.ok)throw Error(data.error||"Fleet request failed.");if(key)pending.current.delete(key);return data as T;};
 return <section className="my-6 space-y-4">{children(api,admin)}</section>;
}
