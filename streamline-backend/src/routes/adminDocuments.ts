import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new Error(
          "Unsupported file type. Upload PDF, image, Word, Excel or text files.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

type DocumentTypeValue = keyof typeof DocumentType;

const documentTypes = Object.values(DocumentType) as DocumentTypeValue[];

function requireAdminKey(
  request: Request,
  response: Response,
  next: () => void,
) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.header("x-admin-key");

  if (!configuredKey) {
    response.status(500).json({
      success: false,
      message: "ADMIN_API_KEY is not configured.",
    });
    return;
  }

  if (!suppliedKey || suppliedKey !== configuredKey) {
    response.status(401).json({
      success: false,
      message: "Unauthorised.",
    });
    return;
  }

  next();
}

router.use(requireAdminKey);

function normaliseString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function isDocumentType(value: unknown): value is DocumentTypeValue {
  return typeof value === "string" && documentTypes.includes(value as DocumentTypeValue);
}

function escapeCloudinaryPublicIdSegment(value: string): string {
  return value
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uploadBufferToCloudinary(
  file: Express.Multer.File,
): Promise<{ secureUrl: string; publicId: string }> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return Promise.reject(
      new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      ),
    );
  }

  const baseName =
    escapeCloudinaryPublicIdSegment(file.originalname) || "document";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "streamline-logistics/documents",
        resource_type: "auto",
        public_id: `${Date.now()}-${baseName}`,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed."));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.end(file.buffer);
  });
}

function extractCloudinaryPublicId(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    const marker = "/upload/";
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    let pathAfterUpload = parsed.pathname.slice(markerIndex + marker.length);
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");
    pathAfterUpload = pathAfterUpload.replace(/\.[^/.]+$/, "");

    return decodeURIComponent(pathAfterUpload);
  } catch {
    return null;
  }
}

const documentInclude = {
  user: {
    select: {
      id: true,
      accountNumber: true,
      name: true,
      companyName: true,
      email: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      email: true,
      licenceNumber: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      name: true,
      registration: true,
      vehicleType: true,
    },
  },
  booking: {
    select: {
      id: true,
      reference: true,
      collectionAddress: true,
      deliveryAddress: true,
    },
  },
  quote: {
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      collectionAddress: true,
      deliveryAddress: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      total: true,
    },
  },
} satisfies Prisma.DocumentInclude;

router.get("/options", async (_request, response) => {
  try {
    const [users, drivers, vehicles, bookings, quotes, invoices] =
      await Promise.all([
        prisma.user.findMany({
          orderBy: [{ companyName: "asc" }, { name: "asc" }],
          take: 250,
          select: {
            id: true,
            accountNumber: true,
            name: true,
            companyName: true,
            email: true,
          },
        }),
        prisma.driver.findMany({
          orderBy: { name: "asc" },
          take: 250,
          select: {
            id: true,
            name: true,
            email: true,
            licenceNumber: true,
          },
        }),
        prisma.vehicle.findMany({
          orderBy: { name: "asc" },
          take: 250,
          select: {
            id: true,
            name: true,
            registration: true,
            vehicleType: true,
          },
        }),
        prisma.booking.findMany({
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            reference: true,
            collectionAddress: true,
            deliveryAddress: true,
          },
        }),
        prisma.quote.findMany({
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            collectionAddress: true,
            deliveryAddress: true,
          },
        }),
        prisma.invoice.findMany({
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
          },
        }),
      ]);

    response.json({
      success: true,
      documentTypes,
      users,
      drivers,
      vehicles,
      bookings,
      quotes,
      invoices,
    });
  } catch (error) {
    console.error("GET /api/admin/documents/options failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load document options.",
    });
  }
});

router.get("/", async (request, response) => {
  try {
    const page = parsePositiveInteger(request.query.page, 1, 100000);
    const pageSize = parsePositiveInteger(request.query.pageSize, 20, 100);
    const search = normaliseString(request.query.search);
    const type = normaliseString(request.query.type);
    const entity = normaliseString(request.query.entity);

    if (type && !isDocumentType(type)) {
      response.status(400).json({
        success: false,
        message: "Invalid document type.",
      });
      return;
    }

    const where: Prisma.DocumentWhereInput = {};

    if (type) {
      where.type = type as DocumentType;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        {
          user: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { accountNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          driver: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { licenceNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          vehicle: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { registration: { contains: search, mode: "insensitive" } },
                { vehicleType: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          booking: {
            is: {
              reference: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          invoice: {
            is: {
              invoiceNumber: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          quote: {
            is: {
              OR: [
                { customerName: { contains: search, mode: "insensitive" } },
                { customerEmail: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    switch (entity) {
      case "CUSTOMER":
        where.userId = { not: null };
        break;
      case "DRIVER":
        where.driverId = { not: null };
        break;
      case "VEHICLE":
        where.vehicleId = { not: null };
        break;
      case "BOOKING":
        where.bookingId = { not: null };
        break;
      case "QUOTE":
        where.quoteId = { not: null };
        break;
      case "INVOICE":
        where.invoiceId = { not: null };
        break;
      case "GENERAL":
      case undefined:
        break;
      default:
        response.status(400).json({
          success: false,
          message: "Invalid entity filter.",
        });
        return;
    }

    if (entity === "GENERAL") {
      where.AND = [
        { userId: null },
        { driverId: null },
        { vehicleId: null },
        { bookingId: null },
        { quoteId: null },
        { invoiceId: null },
      ];
    }

    const [documents, total, typeGroups] = await Promise.all([
      prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
      prisma.document.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
    ]);

    const summary = {
      total: await prisma.document.count(),
      customer: await prisma.document.count({ where: { userId: { not: null } } }),
      driver: await prisma.document.count({ where: { driverId: { not: null } } }),
      vehicle: await prisma.document.count({ where: { vehicleId: { not: null } } }),
      booking: await prisma.document.count({ where: { bookingId: { not: null } } }),
      invoice: await prisma.document.count({ where: { invoiceId: { not: null } } }),
      byType: Object.fromEntries(
        typeGroups.map((group) => [group.type, group._count._all]),
      ),
    };

    response.json({
      success: true,
      documents,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary,
    });
  } catch (error) {
    console.error("GET /api/admin/documents failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load documents.",
    });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: request.params.id },
      include: documentInclude,
    });

    if (!document) {
      response.status(404).json({
        success: false,
        message: "Document not found.",
      });
      return;
    }

    response.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("GET /api/admin/documents/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load the document.",
    });
  }
});

router.post("/", upload.single("file"), async (request, response) => {
  let uploadedPublicId: string | null = null;

  try {
    if (!request.file) {
      response.status(400).json({
        success: false,
        message: "Select a file to upload.",
      });
      return;
    }

    if (!isDocumentType(request.body.type)) {
      response.status(400).json({
        success: false,
        message: "Select a valid document type.",
      });
      return;
    }

    const name =
      normaliseString(request.body.name) || request.file.originalname;
    const notes = normaliseNullableString(request.body.notes);

    const userId = normaliseNullableString(request.body.userId);
    const driverId = normaliseNullableString(request.body.driverId);
    const vehicleId = normaliseNullableString(request.body.vehicleId);
    const bookingId = normaliseNullableString(request.body.bookingId);
    const quoteId = normaliseNullableString(request.body.quoteId);
    const invoiceId = normaliseNullableString(request.body.invoiceId);

    const linkedIds = [
      userId,
      driverId,
      vehicleId,
      bookingId,
      quoteId,
      invoiceId,
    ].filter((value) => typeof value === "string" && value.length > 0);

    if (linkedIds.length > 1) {
      response.status(400).json({
        success: false,
        message: "A document can be linked to only one record at a time.",
      });
      return;
    }

    const uploaded = await uploadBufferToCloudinary(request.file);
    uploadedPublicId = uploaded.publicId;

    const document = await prisma.document.create({
      data: {
        type: request.body.type as DocumentType,
        name,
        fileUrl: uploaded.secureUrl,
        mimeType: request.file.mimetype,
        fileSize: request.file.size,
        notes,
        userId,
        driverId,
        vehicleId,
        bookingId,
        quoteId,
        invoiceId,
        uploadedByAdminId:
          normaliseNullableString(request.body.uploadedByAdminId) ?? null,
      },
      include: documentInclude,
    });

    response.status(201).json({
      success: true,
      document,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("Cloudinary cleanup failed", cleanupError);
      }
    }

    console.error("POST /api/admin/documents failed", error);

    if (error instanceof multer.MulterError) {
      response.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "The file exceeds the 15 MB upload limit."
            : error.message,
      });
      return;
    }

    response.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to upload document.",
    });
  }
});

router.patch("/:id", async (request, response) => {
  try {
    const existing = await prisma.document.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Document not found.",
      });
      return;
    }

    if (request.body.type !== undefined && !isDocumentType(request.body.type)) {
      response.status(400).json({
        success: false,
        message: "Invalid document type.",
      });
      return;
    }

    const document = await prisma.document.update({
      where: { id: request.params.id },
      data: {
        name: normaliseString(request.body.name),
        type:
          request.body.type !== undefined
            ? (request.body.type as DocumentType)
            : undefined,
        notes: normaliseNullableString(request.body.notes),
      },
      include: documentInclude,
    });

    response.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("PATCH /api/admin/documents/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to update document.",
    });
  }
});

router.delete("/:id", async (request, response) => {
  try {
    const existing = await prisma.document.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Document not found.",
      });
      return;
    }

    await prisma.document.delete({
      where: { id: request.params.id },
    });

    const publicId = extractCloudinaryPublicId(existing.fileUrl);

    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
          invalidate: true,
        });

        await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
          invalidate: true,
        });
      } catch (cloudinaryError) {
        console.error(
          "Document record deleted, but Cloudinary deletion failed",
          cloudinaryError,
        );
      }
    }

    response.json({
      success: true,
      message: "Document deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/documents/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete document.",
    });
  }
});

export default router;