import express from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function publicDriver(driver: any) {
  return {
    id: driver.id,
    name: driver.name,
    username: driver.username,
    email: driver.email,
    phone: driver.phone,
    active: driver.active,
    availability: driver.availability,
    vehicleId: driver.vehicleId,
    vehicle: driver.vehicle ?? null,
    lastLoginAt: driver.lastLoginAt,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

/**
 * LIST DRIVERS
 */
router.get("/", async (_req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        vehicle: true,
      },
    });

    return res.json({
      drivers: drivers.map(publicDriver),
    });
  } catch (error) {
    console.error("Admin list drivers error:", error);
    return res.status(500).json({
      error: "Unable to load drivers",
    });
  }
});

/**
 * CREATE DRIVER
 */
router.post("/", async (req, res) => {
  try {
    const name = cleanString(req.body.name);
    const username = cleanString(req.body.username);
    const email = normalizeEmail(req.body.email);
    const phone = cleanString(req.body.phone);
    const password = cleanString(req.body.password);
    const vehicleId = cleanString(req.body.vehicleId);
    const availability = cleanString(req.body.availability) || "AVAILABLE";

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Name, username, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const existingDriver = await prisma.driver.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingDriver) {
      return res.status(409).json({
        error: "A driver with this username or email already exists",
      });
    }

    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle) {
        return res.status(404).json({
          error: "Vehicle not found",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const driver = await prisma.driver.create({
      data: {
        name,
        username,
        email,
        phone: phone || null,
        password: passwordHash,
        active: true,
        availability,
        vehicleId: vehicleId || null,
      },
      include: {
        vehicle: true,
      },
    });

    return res.status(201).json({
      message: "Driver created",
      driver: publicDriver(driver),
    });
  } catch (error) {
    console.error("Admin create driver error:", error);
    return res.status(500).json({
      error: "Unable to create driver",
    });
  }
});

/**
 * GET DRIVER
 */
router.get("/:id", async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        vehicle: true,
        bookings: {
          orderBy: {
            collectionDate: "desc",
          },
          take: 20,
          include: {
            vehicle: true,
            pod: true,
          },
        },
        locations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }

    return res.json({
      driver: {
        ...publicDriver(driver),
        bookings: driver.bookings,
        locations: driver.locations,
      },
    });
  } catch (error) {
    console.error("Admin get driver error:", error);
    return res.status(500).json({
      error: "Unable to load driver",
    });
  }
});

/**
 * UPDATE DRIVER
 */
router.patch("/:id", async (req, res) => {
  try {
    const existingDriver = await prisma.driver.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existingDriver) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }

    const name = cleanString(req.body.name);
    const username = cleanString(req.body.username);
    const email = normalizeEmail(req.body.email);
    const phone = cleanString(req.body.phone);
    const password = cleanString(req.body.password);
    const availability = cleanString(req.body.availability);
    const vehicleId =
      req.body.vehicleId === null ? null : cleanString(req.body.vehicleId);

    if (username || email) {
      const duplicateDriver = await prisma.driver.findFirst({
        where: {
          id: {
            not: existingDriver.id,
          },
          OR: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });

      if (duplicateDriver) {
        return res.status(409).json({
          error: "A driver with this username or email already exists",
        });
      }
    }

    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle) {
        return res.status(404).json({
          error: "Vehicle not found",
        });
      }
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (availability) updateData.availability = availability;
    if (req.body.vehicleId === null || vehicleId) updateData.vehicleId = vehicleId;

    if (typeof req.body.active === "boolean") {
      updateData.active = req.body.active;
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters",
        });
      }

      updateData.password = await bcrypt.hash(password, 12);
      updateData.sessionToken = null;
    }

    const driver = await prisma.driver.update({
      where: {
        id: existingDriver.id,
      },
      data: updateData,
      include: {
        vehicle: true,
      },
    });

    return res.json({
      message: "Driver updated",
      driver: publicDriver(driver),
    });
  } catch (error) {
    console.error("Admin update driver error:", error);
    return res.status(500).json({
      error: "Unable to update driver",
    });
  }
});

/**
 * DEACTIVATE DRIVER
 */
router.delete("/:id", async (req, res) => {
  try {
    const existingDriver = await prisma.driver.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existingDriver) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }

    const driver = await prisma.driver.update({
      where: {
        id: existingDriver.id,
      },
      data: {
        active: false,
        availability: "OFFLINE",
        sessionToken: null,
      },
      include: {
        vehicle: true,
      },
    });

    return res.json({
      message: "Driver deactivated",
      driver: publicDriver(driver),
    });
  } catch (error) {
    console.error("Admin deactivate driver error:", error);
    return res.status(500).json({
      error: "Unable to deactivate driver",
    });
  }
});

export default router;
