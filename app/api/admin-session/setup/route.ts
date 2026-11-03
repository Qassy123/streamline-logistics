import {NextRequest,NextResponse} from "next/server";
import {sessionToken,adminBackend,adminError,sameAdminOrigin} from "@/lib/adminSessionServer";
export async function POST(req:NextRequest){
 if(!sameAdminOrigin(req))return adminError("This request is not allowed.",403);
 const token=sessionToken(req);if(!token)return adminError("Sign in with your initial password first.",401);
 try{const body=await req.json();const upstream=await fetch(adminBackend()+"/api/admin/auth/setup",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({username:body.username,password:body.password}),cache:"no-store",redirect:"error"});const data=await upstream.json();if(!upstream.ok)return adminError(data.error||"Unable to save account setup.",upstream.status);return NextResponse.json({admin:data.admin},{headers:{"Cache-Control":"no-store"}});}catch{return adminError("Unable to save account setup. Try again.",503);}
}
