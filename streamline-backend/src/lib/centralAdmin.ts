import crypto from "crypto";
import type {AdminUser} from "@prisma/client";
import type {Request,Response,NextFunction} from "express";
import {prisma} from "./prisma";
const authenticated=new WeakMap<object,AdminUser>();
export const adminTokenHash=(token:string)=>crypto.createHash("sha256").update(token).digest("hex");
export const centralTokenPattern=/^as_[a-f0-9]{64}$/;
const operational=["customers","guest-bookings","quotes","bookings","planning-board","fleet","drivers","tracking","vehicle-records","driver-hours"];
const finance=["customers","guest-bookings","trade-accounts","invoices","payments","pricing","commercial-tariffs","reports","notifications","search"];
export function adminSections(role:string){if(role==="SUPER_ADMIN")return[...new Set([...operational,...finance,"permissions","settings"])];if(role==="READ_ONLY")return[...new Set([...operational,...finance,"settings"])];if(role==="OFFICE_MANAGER")return[...new Set([...operational,...finance,"settings"])];if(role==="DISPATCHER")return operational;if(role==="ACCOUNTS")return finance;return [];}
function sectionForApi(path:string){
 if(/^\/api\/admin\//.test(path)){const group=path.split("/")[3];return ({planning:"planning-board","fleet-operations":"fleet","tariffs":"pricing","commercial-contracts":"commercial-tariffs",discounts:"pricing",audit:"reports",documents:"reports"} as Record<string,string>)[group]||group;}
 const group=path.split("/")[2];if(["bookings","quotes","payments","invoices","trade-accounts"].includes(group))return group;if(group==="saved-routes")return"customers";if(group==="vehicles")return"fleet";if(group==="tracking"&&/^\/api\/tracking\/(admin|fleet)(?:\/|$)/.test(path))return"tracking";return"";
}
export function canAdminRequest(role:string,path:string,method:string){
 if(role==="SUPER_ADMIN")return true;
 if(role==="DISPATCHER"&&(/^\/api\/bookings\/admin\/.*\/refunds(?:\/|$)/.test(path)||/\/confirm-payment$/.test(path)))return false;
 const section=sectionForApi(path),read=["GET","HEAD","OPTIONS"].includes(method);
 if(!section)return true; if(!adminSections(role).includes(section))return false;
 if(section==="commercial-tariffs"&&path.startsWith("/api/admin/commercial-contracts")&&role!=="OFFICE_MANAGER")return read;
 if(role==="READ_ONLY")return read;
 if(section==="permissions")return false;
 if(role==="DISPATCHER"&&["customers","guest-bookings"].includes(section))return read;
 if(role==="ACCOUNTS"&&["customers","guest-bookings","trade-accounts"].includes(section))return read||/\/(billing|billing-profile|payments|invoices)(?:\/|$)/.test(path);
 if(section==="driver-hours"&&role==="DISPATCHER"&&/payroll|pay-policy|pay-adjust|work-settings/.test(path))return false;
 return true;
}
export async function authenticateAdmin(req:Request){
 const cached=authenticated.get(req);if(cached)return cached;
 const token=/^Bearer (as_[a-f0-9]{64})$/.exec(req.headers.authorization||"")?.[1];if(!token)return null;
 const session=await prisma.adminSession.findUnique({where:{tokenHash:adminTokenHash(token)},include:{admin:true}});
 if(!session||session.expiresAt<=new Date()||!session.admin.active||!adminSections(session.admin.role).length)return null;
 authenticated.set(req,session.admin);return session.admin;
}
export function centralAdminAccess(req:object){const admin=authenticated.get(req);return{authorised:Boolean(admin&&!admin.mustSetup),status:admin?.mustSetup?403:admin?200:401,error:admin?.mustSetup?"Choose your username and password before continuing.":admin?"":"Sign in to the admin portal.",admin};}
export async function attachCentralAdmin(req:Request,res:Response,next:NextFunction){
 try{const path=req.path;
  const isAdmin=/^\/api\/admin(?:\/|$)/.test(path)||/^\/api\/(bookings|quotes|payments|invoices|trade-accounts|saved-routes|tracking)\/admin(?:\/|$)/.test(path);
  const publicAuth=path.startsWith("/api/admin/auth/")||(path==="/api/admin/settings/downtime"&&["GET","HEAD"].includes(req.method));
  const admin=await authenticateAdmin(req);
  if(admin?.mustSetup&&!new Set(["/api/admin/auth/me","/api/admin/auth/logout","/api/admin/auth/setup"]).has(path))return void res.status(403).json({error:"Choose your username and password before continuing.",code:"ADMIN_SETUP_REQUIRED"});
  if(isAdmin&&!publicAuth&&!admin)return void res.status(401).json({error:"Sign in to the admin portal."});
  if(admin&&!publicAuth&&!canAdminRequest(admin.role,path,req.method))return void res.status(403).json({error:"Your account does not have permission for this action."});
  if(isAdmin)res.setHeader("Cache-Control","no-store");next();
 }catch{return void res.status(503).json({error:"Unable to verify the admin session. Try again."});}
}
