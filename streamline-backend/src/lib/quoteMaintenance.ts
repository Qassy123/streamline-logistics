import type { RequestHandler } from "express";
import { prisma } from "./prisma";
export const quoteMaintenance: RequestHandler = async (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { createdAt: "asc" }, select: { websiteDowntime: true } });
    res.setHeader("Cache-Control", "no-store");
    if (settings?.websiteDowntime) { res.status(503).json({ websiteDowntime: true, error: "Online quotes are temporarily disabled. Please contact us for a quote." }); return; }
    next();
  } catch { res.status(503).json({ error: "Unable to check quote availability. Please try again shortly." }); }
};
