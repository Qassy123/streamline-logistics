import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient, BookingStatus, PODStatus } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

function cleanString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function cloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
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

async function getAssignedBooking(bookingId: string, driverId: string) {
  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      driverId,
    },
    include: {
      pod: true,
    },
  });
}

async function uploadBufferToCloudinary(params: {
  buffer: Buffer;
  bookingId: string;
  type: "signature" | "photo";
  mimetype: string;
}) {
  if (!cloudinaryReady()) {
    throw new Error("Cloudinary is not configured");
  }

  const folder = `streamline-logistics/pod/${params.bookingId}`;
  const dataUri = `data:${params.mimetype};base64,${params.buffer.toString(
    "base64",
  )}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    public_id: `${params.type}-${Date.now()}`,
    overwrite: false,
  });

  return result.secure_url;
}

router.get("/:bookingId", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bookingId = String(req.params.bookingId || "");
    const booking = await getAssignedBooking(bookingId, driver.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json({ pod: booking.pod });
  } catch (error) {
    console.error("Driver POD fetch error:", error);
    return res.status(500).json({ error: "Unable to load proof of delivery" });
  }
});

router.post("/:bookingId/upload", upload.single("file"), async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bookingId = String(req.params.bookingId || "");
    const rawType = req.body?.type;
    const uploadType = Array.isArray(rawType)
      ? cleanString(rawType[0])
      : cleanString(rawType);

    if (uploadType !== "signature" && uploadType !== "photo") {
      return res.status(400).json({
        error: "Upload type must be signature or photo",
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const mimetype = String(req.file.mimetype || "");

    if (!mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    const booking = await getAssignedBooking(bookingId, driver.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const cloudinaryUploadType: "signature" | "photo" =
      uploadType === "signature" ? "signature" : "photo";

    const url = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      bookingId: booking.id,
      type: cloudinaryUploadType,
      mimetype,
    });

    const pod = await prisma.pOD.upsert({
      where: {
        bookingId: booking.id,
      },
      update:
        cloudinaryUploadType === "signature"
          ? {
              signatureUrl: url,
            }
          : {
              photoUrl: url,
            },
      create: {
        bookingId: booking.id,
        status: PODStatus.PENDING,
        ...(cloudinaryUploadType === "signature"
          ? {
              signatureUrl: url,
            }
          : {
              photoUrl: url,
            }),
      },
    });

    return res.json({
      message: "POD file uploaded",
      type: cloudinaryUploadType,
      url,
      pod,
    });
  } catch (error) {
    console.error("Driver POD upload error:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to upload proof of delivery file",
    });
  }
});

router.post("/:bookingId", async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.headers.authorization);

    if (!driver) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bookingId = String(req.params.bookingId || "");
    const recipientName = cleanString(req.body.recipientName);
    const signatureUrl = cleanString(req.body.signatureUrl);
    const photoUrl = cleanString(req.body.photoUrl);
    const notes = cleanString(req.body.notes);

    const booking = await getAssignedBooking(bookingId, driver.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const pod = await prisma.pOD.upsert({
      where: {
        bookingId: booking.id,
      },
      update: {
        recipientName: recipientName || undefined,
        signatureUrl: signatureUrl || undefined,
        photoUrl: photoUrl || undefined,
        notes: notes || undefined,
      },
      create: {
        bookingId: booking.id,
        status: PODStatus.PENDING,
        recipientName: recipientName || undefined,
        signatureUrl: signatureUrl || undefined,
        photoUrl: photoUrl || undefined,
        notes: notes || undefined,
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

    const bookingId = String(req.params.bookingId || "");
    const recipientName = cleanString(req.body.recipientName);
    const signatureUrl = cleanString(req.body.signatureUrl);
    const photoUrl = cleanString(req.body.photoUrl);
    const notes = cleanString(req.body.notes);

    if (!recipientName) {
      return res.status(400).json({ error: "Recipient name is required" });
    }

    const booking = await getAssignedBooking(bookingId, driver.id);

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
          recipientName,
          signatureUrl: signatureUrl || undefined,
          photoUrl: photoUrl || undefined,
          notes: notes || undefined,
          deliveredAt: completedAt,
        },
        create: {
          bookingId: booking.id,
          status: PODStatus.COMPLETED,
          recipientName,
          signatureUrl: signatureUrl || undefined,
          photoUrl: photoUrl || undefined,
          notes: notes || undefined,
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
          driverLocations: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
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
