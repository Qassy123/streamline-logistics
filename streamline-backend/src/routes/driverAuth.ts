import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendEmail, emailLayout } from "../lib/email";
import { authenticateDriver, DriverPortalError, reconcileDriverActivity, safeDriver, sessionHash, text } from "../lib/driverPortal";

const router = express.Router();
const SESSION_DURATION_MS = 7 * 24 * 60 * 60_000;
const RESET_DURATION_MS = 30 * 60_000;
const attempts = new Map<string, { count: number; until: number }>();

function limit(req: express.Request, scope: string, maximum: number, account = "") {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const keys = [`${scope}:ip:${req.ip || req.socket.remoteAddress || "unknown"}`];
  if (account) keys.push(`${scope}:account:${sessionHash(account.toLowerCase())}`);
  for (const key of keys) {
    if ((attempts.get(key)?.count || 0) >= maximum) throw new DriverPortalError(429, "Too many attempts. Please wait 15 minutes and try again.");
  }
  for (const key of keys) {
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    entry.count++; attempts.set(key, entry);
  }
  // This is a local process limit; shared rate limiting can be added if the backend is scaled out.
  while (attempts.size > 10000) attempts.delete(attempts.keys().next().value!);
}

type Handler = (req: express.Request, res: express.Response) => Promise<unknown>;
function route(handler: Handler): express.RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof DriverPortalError) {
        if (error.status === 429) res.setHeader("Retry-After", "900");
        return void res.status(error.status).json({ error: error.message });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return void res.status(409).json({ error: "Your account changed. Please retry." });
      }
      console.error("Driver account request failed:", error);
      res.status(500).json({ error: "Unable to complete this account request. Please try again." });
    }
  };
}

function bearer(req: express.Request) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new DriverPortalError(401, "Please sign in to the driver portal.");
  return token;
}

async function signedIn(req: express.Request) {
  const driver = await authenticateDriver(req.headers.authorization);
  if (!driver) throw new DriverPortalError(401, "Your session has expired. Please sign in again.");
  return driver;
}

function newPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || Buffer.byteLength(value, "utf8") > 72) {
    throw new DriverPortalError(400, "Use a password of at least 8 characters and no more than 72 bytes.");
  }
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function portalUrl(path: string) {
  const base = process.env.FRONTEND_URL || "https://streamlinelogisticsgroup.co.uk";
  const url = new URL(path, base);
  if (!["https:", "http:"].includes(url.protocol)) throw new DriverPortalError(503, "Account recovery is not configured. Contact dispatch.");
  return url.toString();
}

router.post("/login", route(async (req, res) => {
  const login = text(req.body?.login, 254);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!login || !password || password.length > 1024) throw new DriverPortalError(400, "Enter your username or email and password.");
  limit(req, "login", 30, login);
  const driver = await prisma.driver.findFirst({ where: { OR: [{ email: login.toLowerCase() }, { username: login }] } });
  if (!driver?.active || driver.status !== "ACTIVE" || !await bcrypt.compare(password, driver.password)) {
    throw new DriverPortalError(401, "Invalid login details.");
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driver.id } });
    if (!current?.active || current.status !== "ACTIVE" || current.password !== driver.password) {
      throw new DriverPortalError(401, "Your account changed. Please sign in again.");
    }
    // Retire the raw legacy credential; other portal devices retain their own bounded sessions.
    if (current.sessionToken) await tx.driverPortalSession.updateMany({
      where: { driverId: driver.id, tokenHash: sessionHash(current.sessionToken), revokedAt: null }, data: { revokedAt: new Date() },
    });
    await tx.driverPortalSession.create({ data: { driverId: driver.id, tokenHash: sessionHash(token), expiresAt } });
    return tx.driver.update({ where: { id: driver.id }, data: { sessionToken: null, lastLoginAt: new Date() }, include: { vehicle: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ token, expiresAt, driver: { ...safeDriver(updated), vehicleId: updated.vehicleId }, message: "Login successful." });
}));

router.get("/me", route(async (req, res) => {
  const driver = await signedIn(req);
  const tokenHash = sessionHash(bearer(req));
  const session = await prisma.driverPortalSession.findUnique({ where: { tokenHash } });
  res.json({ driver: { ...safeDriver(driver), vehicleId: driver.vehicleId }, expiresAt: session?.expiresAt || null, serverTime: new Date() });
}));

router.post("/logout", route(async (req, res) => {
  const token = bearer(req), tokenHash = sessionHash(token);
  await prisma.$transaction(async tx => {
    await tx.driverPortalSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.driver.updateMany({ where: { sessionToken: token }, data: { sessionToken: null } });
  });
  // Signing out must not cancel assignments or change the driver's duty state.
  res.json({ message: "Logged out successfully." });
}));

router.post("/logout-all", route(async (req, res) => {
  const driver = await signedIn(req);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    await tx.driverPortalSession.updateMany({ where: { driverId: driver.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.driver.update({ where: { id: driver.id }, data: { sessionToken: null } });
  });
  res.json({ message: "Signed out on all devices." });
}));

// Password-reset hashes are namespaced so a reset token can NEVER authenticate as a portal session.
router.post("/forgot-password", route(async (req, res) => {
  const email = text(req.body?.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DriverPortalError(400, "Enter your driver account email.");
  limit(req, "recovery", 5, email);
  if (!process.env.RESEND_API_KEY) throw new DriverPortalError(503, "Email recovery is unavailable. Contact dispatch to reset your password.");
  const driver = await prisma.driver.findUnique({ where: { email } });
  const message = "If this email matches an active driver account, check your inbox. If nothing arrives, contact dispatch.";
  if (driver?.active && driver.status === "ACTIVE") {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = `reset:${sessionHash(token)}`;
    const url = portalUrl(`/driver/login?reset=${token}`);
    const reset = await prisma.driverPortalSession.create({ data: { driverId: driver.id, tokenHash, expiresAt: new Date(Date.now() + RESET_DURATION_MS) } });
    try {
      const result = await sendEmail({ to: driver.email, department: "operations", subject: "Reset your Streamline driver password",
        html: emailLayout("Reset driver password", `<p>Hello ${escapeHtml(driver.name)},</p><p>Use the link below to reset your driver password. It expires in 30 minutes and can be used once.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#006CFF;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700;border-radius:6px;">Reset password</a></p><p>If you did not request this, you can ignore this email.</p><p>Kind regards,<br/><strong>Operations Team</strong><br/>Streamline Logistics Group</p>`, "operations") });
      if (("skipped" in result && result.skipped) || ("error" in result && result.error)) throw new Error("Recovery email not delivered");
    } catch {
      await prisma.driverPortalSession.update({ where: { id: reset.id }, data: { revokedAt: new Date() } });
      console.warn("Driver password recovery email could not be delivered.");
    }
  }
  res.json({ message });
}));

router.post("/reset-password", route(async (req, res) => {
  limit(req, "reset", 10);
  const token = text(req.body?.token, 100);
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new DriverPortalError(400, "This reset link is invalid or expired.");
  const password = newPassword(req.body?.password);
  const tokenHash = `reset:${sessionHash(token)}`;
  const reset = await prisma.driverPortalSession.findUnique({ where: { tokenHash } });
  if (!reset || reset.revokedAt || reset.expiresAt <= new Date()) throw new DriverPortalError(400, "This reset link is invalid or expired.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${reset.driverId} FOR UPDATE`;
    const currentReset = await tx.driverPortalSession.findUnique({ where: { tokenHash } });
    const driver = await tx.driver.findUnique({ where: { id: reset.driverId } });
    if (!currentReset || currentReset.revokedAt || currentReset.expiresAt <= new Date() || !driver?.active || driver.status !== "ACTIVE") {
      throw new DriverPortalError(400, "This reset link is invalid or expired.");
    }
    await tx.driver.update({ where: { id: driver.id }, data: { password: passwordHash, sessionToken: null } });
    await tx.driverPortalSession.updateMany({ where: { driverId: driver.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ message: "Password updated. Sign in with your new password." });
}));

router.post("/forgot-username", route(async (req, res) => {
  const email = text(req.body?.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DriverPortalError(400, "Enter your driver account email.");
  limit(req, "recovery", 5, email);
  if (!process.env.RESEND_API_KEY) throw new DriverPortalError(503, "Email recovery is unavailable. Contact dispatch for your username.");
  const driver = await prisma.driver.findUnique({ where: { email } });
  if (driver?.active && driver.status === "ACTIVE") {
    try { await sendEmail({ to: driver.email, department: "operations", subject: "Your Streamline driver username",
      html: emailLayout("Driver username", `<p>Hello ${escapeHtml(driver.name)},</p><p>Your username is <strong>${escapeHtml(driver.username)}</strong>.</p><p><a href="${escapeHtml(portalUrl("/driver/login"))}" style="display:inline-block;background:#006CFF;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700;border-radius:6px;">Sign in to the driver portal</a></p><p>Kind regards,<br/><strong>Operations Team</strong><br/>Streamline Logistics Group</p>`, "operations") }); }
    catch { console.warn("Driver username recovery email could not be delivered."); }
  }
  res.json({ message: "If this email matches an active driver account, check your inbox. If nothing arrives, contact dispatch." });
}));

router.patch("/password", route(async (req, res) => {
  const driver = await signedIn(req);
  limit(req, "change-password", 10, driver.id);
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  if (!currentPassword || currentPassword.length > 1024 || !await bcrypt.compare(currentPassword, driver.password)) {
    throw new DriverPortalError(400, "Your current password is incorrect.");
  }
  const passwordHash = await bcrypt.hash(newPassword(req.body?.password), 12);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driver.id } });
    if (!current?.active || current.status !== "ACTIVE" || current.password !== driver.password) throw new DriverPortalError(409, "Your account changed. Please sign in again.");
    await tx.driver.update({ where: { id: driver.id }, data: { password: passwordHash, sessionToken: null } });
    await tx.driverPortalSession.updateMany({ where: { driverId: driver.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ message: "Password updated. Please sign in again.", requiresSignIn: true });
}));

// Legacy availability URL now maps duty intent; active workload determines AVAILABLE/BUSY.
router.patch("/availability", route(async (req, res) => {
  const driver = await signedIn(req);
  const availability = text(req.body?.availability, 20);
  if (!["AVAILABLE", "BUSY", "OFFLINE"].includes(availability)) throw new DriverPortalError(400, "Invalid availability.");
  const onDuty = availability !== "OFFLINE";
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driver.id} FOR UPDATE`;
    const current = await tx.driver.findUnique({ where: { id: driver.id } });
    if (!current?.active || current.status !== "ACTIVE") throw new DriverPortalError(401, "Driver account is inactive.");
    if (!onDuty && await tx.booking.count({ where: { driverId: driver.id, status: BookingStatus.IN_PROGRESS } })) {
      throw new DriverPortalError(409, "Finish the active job or contact dispatch before going off duty.");
    }
    await tx.driver.update({ where: { id: driver.id }, data: { portalOnDuty: onDuty } });
    await reconcileDriverActivity(tx, driver.id);
    return tx.driver.findUniqueOrThrow({ where: { id: driver.id }, include: { vehicle: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ driver: { ...safeDriver(updated), vehicleId: updated.vehicleId }, message: "Duty status updated." });
}));

export default router;
