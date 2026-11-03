import {NextRequest,NextResponse} from "next/server";
import {sessionToken,backendAdminSession,adminBackend,adminError,sameAdminOrigin} from "@/lib/adminSessionServer";
export const dynamic="force-dynamic";
async function handle(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 const token=sessionToken(req);if(!token)return adminError("Sign in to the admin portal.",401);
 if(!["GET","HEAD"].includes(req.method)&&!sameAdminOrigin(req))return adminError("This admin request is not allowed.",403);
 const {path}=await context.params;
 if(!Array.isArray(path)||path[0]!=="api"||path.some(s=>!s||s==="."||s===".."||/[\\/%?#]/.test(s)))return adminError("Invalid admin request path.",400);
 const pathname="/"+path.map(encodeURIComponent).join("/");
 if(pathname.startsWith("/api/admin/auth/")&&!(pathname==="/api/admin/auth/me"&&req.method==="GET"))return adminError("Use the central admin login.",403);
 try{const session=await backendAdminSession(token);if(!session.ok)return adminError(session.status===401?"Your session has expired. Sign in again.":"Unable to verify your session.",session.status);
 const headers=new Headers();for(const name of ["content-type","accept","range","x-request-id","idempotency-key"]){const value=req.headers.get(name);if(value)headers.set(name,value);}headers.set("Authorization",`Bearer ${token}`);
 const body=["GET","HEAD"].includes(req.method)?undefined:await req.arrayBuffer();
 const upstream=await fetch(adminBackend()+pathname+new URL(req.url).search,{method:req.method,headers,body,cache:"no-store",redirect:"error"});
 const outgoing=new Headers({"Cache-Control":"no-store"});for(const name of ["content-type","content-disposition","content-range","accept-ranges","retry-after"]){const value=upstream.headers.get(name);if(value)outgoing.set(name,value);}
 return new NextResponse(upstream.status===204||req.method==="HEAD"?null:upstream.body,{status:upstream.status,headers:outgoing});
 }catch{return adminError("Unable to contact the admin service. Try again.",503);}
}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE,handle as HEAD};
