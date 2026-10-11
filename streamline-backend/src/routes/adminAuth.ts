import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { hashAdminToken, requireStaff } from "../lib/adminAccess";
import { DriverPortalError } from "../lib/driverPortal";

const router = express.Router();
const attempts = new Map<string, { count: number; until: number }>();
const safe = (admin: { id: string; name: string; role: string }) => ({ id: admin.id, name: admin.name, role: admin.role });
router.post("/login", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || email.length > 254 || !password || Buffer.byteLength(password) > 72) return void res.status(400).json({ error: "Enter your staff email and password." });
    const key = `${req.ip}:${email}`, now = Date.now();
    for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id);
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
    if (attempt.count >= 8 || attempts.size > 10000) return void res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    attempt.count++; attempts.set(key, attempt);
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, admin?.passwordHash || "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
    if (!admin?.active || !valid) return void res.status(401).json({ error: "Incorrect staff email or password." });
    const token = crypto.randomBytes(32).toString("hex"), expiresAt = new Date(now + 8 * 3600000);
    await prisma.$transaction(async tx => {
      await tx.adminSession.create({ data: { adminId: admin.id, tokenHash: hashAdminToken(token), expiresAt } });
      await tx.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    });
    attempts.delete(key); res.json({ token, expiresAt, admin: safe(admin) });
  } catch { res.status(500).json({ error: "Unable to sign in. Try again." }); }
});
router.get("/me", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json({ admin: safe(await requireStaff(req, ["SUPER_ADMIN", "OFFICE_MANAGER", "ACCOUNTS", "DISPATCHER", "READ_ONLY"])) }); }
  catch (error) { res.status(error instanceof DriverPortalError ? error.status : 500).json({ error: error instanceof DriverPortalError ? error.message : "Unable to check session." }); }
});
router.post("/logout", async (req, res) => {
  try {
    await requireStaff(req, ["SUPER_ADMIN", "OFFICE_MANAGER", "ACCOUNTS", "DISPATCHER", "READ_ONLY"]);
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashAdminToken(req.headers.authorization!.slice(7)) } });
    res.json({ success: true });
  } catch (error) { res.status(error instanceof DriverPortalError ? error.status : 500).json({ error: "Unable to confirm sign out." }); }
});
export default router;
