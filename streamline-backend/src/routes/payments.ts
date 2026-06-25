import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

const router = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is missing from environment variables");
}

const stripe = new Stripe(stripeSecretKey);

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { quoteId } = req.body;

    if (!quoteId) {
      return res.status(400).json({
        error: "quoteId is required",
      });
    }

    const quote = await prisma.quote.findUnique({
      where: {
        id: quoteId,
      },
    });

    if (!quote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    if (!quote.totalPrice) {
      return res.status(400).json({
        error: "Quote has no total price",
      });
    }

    const totalAmountPence = Math.round(Number(quote.totalPrice) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: quote.customerEmail,
      success_url: `${frontendUrl}/payment-success?quoteId=${quote.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payments?quoteId=${quote.id}&cancelled=true`,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: totalAmountPence,
            product_data: {
              name: "Streamline Logistics Delivery Booking",
              description: `Quote reference: ${quote.id}`,
              metadata: {
                quoteId: quote.id,
              },
            },
          },
        },
      ],
      metadata: {
        quoteId: quote.id,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
      },
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe checkout session error:", error);

    res.status(500).json({
      error: "Failed to create checkout session",
    });
  }
});

export default router;
