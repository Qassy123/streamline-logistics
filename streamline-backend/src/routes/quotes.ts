import { Router } from "express";
import { prisma } from "../lib/prisma";
import { calculateQuotePrice } from "../lib/pricing";

const router = Router();

router.get("/", async (_, res) => {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(quotes);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch quotes",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch quote",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const price = calculateQuotePrice({
      deliveryType: req.body.deliveryType,
      vehicleSize: req.body.vehicleSize,
    });

    const quote = await prisma.quote.create({
      data: {
        ...req.body,
        status: "priced",
        adminPrice: price.adminPrice,
        vatAmount: price.vatAmount,
        totalPrice: price.totalPrice,
      },
    });

    res.status(201).json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create quote",
    });
  }
});

router.patch("/:id/price", async (req, res) => {
  try {
    const { adminPrice, vatAmount, totalPrice } = req.body;

    const quote = await prisma.quote.update({
      where: {
        id: req.params.id,
      },
      data: {
        adminPrice,
        vatAmount,
        totalPrice,
      },
    });

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update quote price",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const quote = await prisma.quote.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
      },
    });

    res.json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update quote status",
    });
  }
});

export default router;