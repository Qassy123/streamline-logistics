import express from "express";
import { PrismaClient, BookingStatus, PODStatus } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

async function getAuthenticatedDriver(authHeader: string | undefined) {
  const token = getBearerToken(authHeader);

  if (!token) return null;

  return prisma.driver.findFirst({
    where: {
      sessionToken: token,
      active: true,
    },
    include: {
      vehicle: true,
    },
  });
}

router.get("/:bookingId", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { bookingId } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
      include: {
        pod: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json({ pod: booking.pod });
  } catch (error) {
    console.error("Driver POD fetch error:", error);
    return res.status(500).json({ error: "Unable to load proof of delivery" });
  }
});

router.post("/:bookingId", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { bookingId } = req.params;
    const { recipientName, signatureUrl, photoUrl } = req.body;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const pod = await prisma.pOD.upsert({
      where: {
        bookingId: booking.id,
      },
      update: {
        recipientName:
          typeof recipientName === "string" ? recipientName.trim() : undefined,
        signatureUrl:
          typeof signatureUrl === "string" ? signatureUrl.trim() : undefined,
        photoUrl: typeof photoUrl === "string" ? photoUrl.trim() : undefined,
      },
      create: {
        bookingId: booking.id,
        status: PODStatus.PENDING,
        recipientName:
          typeof recipientName === "string" ? recipientName.trim() : undefined,
        signatureUrl:
          typeof signatureUrl === "string" ? signatureUrl.trim() : undefined,
        photoUrl: typeof photoUrl === "string" ? photoUrl.trim() : undefined,
      },
    });

    return res.json({
      message: "Proof of delivery saved",
      pod,
    });
  } catch (error) {
    console.error("Driver POD save error:", error);
    return res.status(500).json({ error: "Unable to save proof of delivery" });
  }
});

router.post("/:bookingId/complete", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { bookingId } = req.params;
    const { recipientName, signatureUrl, photoUrl } = req.body;

    if (!recipientName || typeof recipientName !== "string") {
      return res.status(400).json({ error: "Recipient name is required" });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        driverId: driver.id,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const completedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const pod = await tx.pOD.upsert({
        where: {
          bookingId: booking.id,
        },
        update: {
          status: PODStatus.COMPLETED,
          recipientName: recipientName.trim(),
          signatureUrl:
            typeof signatureUrl === "string" ? signatureUrl.trim() : undefined,
          photoUrl: typeof photoUrl === "string" ? photoUrl.trim() : undefined,
          deliveredAt: completedAt,
        },
        create: {
          bookingId: booking.id,
          status: PODStatus.COMPLETED,
          recipientName: recipientName.trim(),
          signatureUrl:
            typeof signatureUrl === "string" ? signatureUrl.trim() : undefined,
          photoUrl: typeof photoUrl === "string" ? photoUrl.trim() : undefined,
          deliveredAt: completedAt,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          status: BookingStatus.COMPLETED,
          trackingEndedAt: booking.trackingEndedAt || completedAt,
          trackingEvents: {
            create: {
              status: BookingStatus.COMPLETED,
              title: "Delivered",
              description: "Proof of delivery has been completed.",
              userVisible: true,
            },
          },
        },
        include: {
          vehicle: true,
          pod: true,
          trackingEvents: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      return {
        pod,
        booking: updatedBooking,
      };
    });

    return res.json({
      message: "Delivery completed",
      pod: result.pod,
      booking: result.booking,
    });
  } catch (error) {
    console.error("Driver POD complete error:", error);
    return res.status(500).json({ error: "Unable to complete delivery" });
  }
});

export default router;