"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
export type CentralAdmin={id:string;name:string;email:string;role:string;sections:string[]};
const AdminContext=createContext<{admin:CentralAdmin;signOut:()=>Promise<void>}|null>(null);
export function useAdminSession(){const value=useContext(AdminContext);if(!value)throw Error("Admin session is unavailable.");return value;}
export function canAdminPage(admin:CentralAdmin,path:string){if(path==="/admin")return true;const raw=path.split("/")[2],section=({"audit-log":"reports",documents:"reports"} as Record<string,string>)[raw]||raw;return admin.role==="SUPER_ADMIN"||admin.sections.includes(section);}
export default function AdminSessionGate({children}:{children:ReactNode}){
 const [admin,setAdmin]=useState<CentralAdmin|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);const router=useRouter(),pathname=usePathname();
 useEffect(()=>{let active=true;localStorage.removeItem("streamline_admin_key");sessionStorage.removeItem("hoursStaffToken");
 async function check(){try{const response=await fetch("/api/admin-session/me",{cache:"no-store",credentials:"same-origin"});const data=await response.json();if(!active)return;if(response.status===401){setAdmin(null);router.replace("/admin/login?next="+encodeURIComponent(window.location.pathname+window.location.search));return;}if(!response.ok)throw Error(data.error||"Unable to verify your session.");setAdmin(data.admin);setError("");}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to verify your session.");}}
 void check();const timer=setInterval(check,60000);window.addEventListener("focus",check);window.addEventListener("admin-session-expired",check);return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",check);window.removeEventListener("admin-session-expired",check);};},[router,attempt]);
 async function signOut(){try{const response=await fetch("/api/admin-session/logout",{method:"POST",credentials:"same-origin"});if(!response.ok)throw Error("Unable to confirm sign out. Try again.");setAdmin(null);router.replace("/admin/login");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to sign out.");}}
 if(!admin)return <main className="mx-auto max-w-lg p-8" role="status">{error?<><p role="alert">{error}</p><button className="mt-4 rounded-lg border p-3" onClick={()=>setAttempt(a=>a+1)}>Retry</button></>:"Checking your admin session..."}</main>;
 if(!canAdminPage(admin,pathname))return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Access not available</h1><p className="mt-3">Your account does not have permission for this section.</p><a className="mt-4 inline-block underline" href="/admin">Return to admin home</a></main>;
 return <AdminContext.Provider value={{admin,signOut}}>{error&&<p role="alert" className="bg-amber-50 p-3 text-amber-900">{error}</p>}{children}</AdminContext.Provider>;
}
