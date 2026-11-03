import {NextRequest,NextResponse} from "next/server";
import {adminBackend,ADMIN_SESSION_COOKIE,adminCookieOptions,sameAdminOrigin,adminError} from "@/lib/adminSessionServer";
export async function POST(req:NextRequest){
 if(!sameAdminOrigin(req))return adminError("This sign-in request is not allowed.",403);
 try{const body=await req.json(),identifier=typeof body.identifier==="string"?body.identifier:"",password=typeof body.password==="string"?body.password:"";
 if(!identifier||identifier.length>254||!password||password.length>1000)return adminError("Enter your username/email and password.",400);
 const upstream=await fetch(adminBackend()+"/api/admin/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier,password}),cache:"no-store",redirect:"error"});const data=await upstream.json();
 if(!upstream.ok)return adminError(data.error||"Unable to sign in.",upstream.status);
 const expires=new Date(data.expiresAt);if(!/^as_[a-f0-9]{64}$/.test(data.token||"")||!Number.isFinite(+expires)||expires<=new Date())return adminError("Unable to establish a secure session.",503);
 const response=NextResponse.json({admin:data.admin},{headers:{"Cache-Control":"no-store"}});response.cookies.set(ADMIN_SESSION_COOKIE,data.token,{...adminCookieOptions,expires});return response;
 }catch{return adminError("Unable to sign in. Try again.",503);}
}
