import { Prisma } from "@prisma/client";
import { Router, type ErrorRequestHandler } from "express";
import { centralAdminAccess } from "../lib/centralAdmin";
import { prisma } from "../lib/prisma";

const router = Router();

const vehicleTypes = ["Small Van", "SWB Van", "LWB High Roof Van", "XLWB High Roof Van", "Luton Tail Lift Van"];
const tariffOption = { id: true, name: true } as const;

function decimalInput(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) return null;
  return new Prisma.Decimal(text);
}

router.use((req, res, next) => {
  const admin = centralAdminAccess(req);
  if (!admin.authorised) return res.status(admin.status).json({ error: admin.error });
  next();
});

router.get("/options", async (_req, res) => {
  const tariffs = await prisma.commercialTariff.findMany({ select: tariffOption, orderBy: { name: "asc" } });
  res.json({ tariffs });
});

router.get("/", async (_req, res) => {
  const tariffs = await prisma.commercialTariff.findMany({
    select: { ...tariffOption, rates: true },
    orderBy: { name: "asc" },
  });
  res.json({ tariffs, vehicleTypes });
});

router.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 60) return res.status(400).json({ error: "Enter a tariff name of up to 60 characters." });
  try {
    const tariff = await prisma.commercialTariff.create({
      data: { name, nameKey: name.toLowerCase() },
      select: { ...tariffOption, rates: true },
    });
    res.status(201).json({ tariff });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "A commercial tariff already has that name." });
    }
    throw error;
  }
});

router.put("/:id/rates", async (req, res) => {
  const { id } = req.params;
  const vehicleType = req.body?.vehicleType;
  if (!vehicleTypes.includes(vehicleType)) return res.status(400).json({ error: "Select a valid van type." });

  const fare8Hours = decimalInput(req.body.fare8Hours);
  const includedMiles8 = decimalInput(req.body.includedMiles8);
  const fare12Hours = decimalInput(req.body.fare12Hours);
  const includedMiles12 = decimalInput(req.body.includedMiles12);
  const extraMileRate = decimalInput(req.body.extraMileRate);
  if (!fare8Hours || !includedMiles8 || !fare12Hours || !includedMiles12 || !extraMileRate) {
    return res.status(400).json({ error: "Enter both shift fares, both included mileages and the extra mileage rate. Use zero where applicable." });
  }

  const tariff = await prisma.commercialTariff.findUnique({ where: { id }, select: { id: true } });
  if (!tariff) return res.status(404).json({ error: "Commercial tariff not found." });

  const values = { fare8Hours, includedMiles8, fare12Hours, includedMiles12, extraMileRate };
  const rate = await prisma.commercialTariffRate.upsert({
    where: { tariffId_vehicleType: { tariffId: id, vehicleType } },
    create: { tariffId: id, vehicleType, ...values },
    update: values,
  });
  res.json({ rate });
});

const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  console.error("Commercial tariffs error:", error);
  res.status(500).json({ error: "Unable to manage commercial tariffs." });
};
router.use(handleError);

export default router;
