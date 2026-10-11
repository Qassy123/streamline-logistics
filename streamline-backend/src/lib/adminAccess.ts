import crypto from "crypto";
import type { AdminRole } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma";
import { DriverPortalError } from "./driverPortal";

export const payrollRoles: AdminRole[] = ["SUPER_ADMIN", "OFFICE_MANAGER", "ACCOUNTS"];
export const attendanceRoles: AdminRole[] = [...payrollRoles, "DISPATCHER"];
export const hashAdminToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function requireStaff(req: Request, roles: AdminRole[]) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.authorization || "");
  if (!match) throw new DriverPortalError(401, "Sign in with your staff account.");
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashAdminToken(match[1]) }, include: { admin: true } });
  if (!session || session.expiresAt <= new Date() || !session.admin.active) throw new DriverPortalError(401, "Your staff session expired. Sign in again.");
  if (!roles.includes(session.admin.role)) throw new DriverPortalError(403, "Your staff role cannot perform this operation.");
  return session.admin;
}
