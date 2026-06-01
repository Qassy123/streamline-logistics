import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_, res) => {
  const quotes = await prisma.quote.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(quotes);
});

router.post("/", async (req, res) => {
  const quote = await prisma.quote.create({
    data: req.body,
  });

  res.json(quote);
});

export default router;