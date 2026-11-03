import {NextRequest,NextResponse} from "next/server";
export const ADMIN_SESSION_COOKIE="streamline_admin_session";
export const adminBackend=()=> (process.env.ADMIN_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL||process.env.NEXT_PUBLIC_API_BASE_URL||"https://streamline-logistics-production.up.railway.app").replace(/\/$/,"");
export const adminCookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict" as const,path:"/"};
export function sameAdminOrigin(req:NextRequest){const origin=req.headers.get("origin");return Boolean(origin&&origin===new URL(req.url).origin);}
export function sessionToken(req:NextRequest){const token=req.cookies.get(ADMIN_SESSION_COOKIE)?.value||"";return /^as_[a-f0-9]{64}$/.test(token)?token:"";}
export function adminError(message:string,status:number){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});}
export async function backendAdminSession(token:string){return fetch(adminBackend()+"/api/admin/auth/me",{headers:{Authorization:`Bearer ${token}`},cache:"no-store",redirect:"error"});}
