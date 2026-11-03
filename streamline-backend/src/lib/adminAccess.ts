import type {AdminRole} from "@prisma/client";
import type {Request} from "express";
import {authenticateAdmin,adminTokenHash} from "./centralAdmin";
import {DriverPortalError} from "./driverPortal";
export const payrollRoles:AdminRole[]=["SUPER_ADMIN","OFFICE_MANAGER","ACCOUNTS"];
export const attendanceRoles:AdminRole[]=[...payrollRoles,"DISPATCHER"];
export const hashAdminToken=adminTokenHash;
export async function requireStaff(req:Request,roles:AdminRole[]){const admin=await authenticateAdmin(req);if(!admin)throw new DriverPortalError(401,"Sign in to the admin portal.");if(admin.mustSetup)throw new DriverPortalError(403,"Choose your username and password before continuing.");if(admin.role!=="SUPER_ADMIN"&&!roles.includes(admin.role)&&!(admin.role==="READ_ONLY"&&["GET","HEAD"].includes(req.method)&&roles.includes("DISPATCHER")))throw new DriverPortalError(403,"Your account does not have permission for this action.");return admin;}
