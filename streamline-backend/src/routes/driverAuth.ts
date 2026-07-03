import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

/**
 * DRIVER LOGIN
 * Supports email or username.
 */
router.post("/login", async (req, res) => {
  try {
    const { login, password } = req.body;

    const cleanedLogin = typeof login === "string" ? login.trim() : "";
    const cleanedPassword = typeof password === "string" ? password : "";

    if (!cleanedLogin || !cleanedPassword) {
      return res.status(400).json({
        error: "Login and password are required",
      });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        OR: [
          { email: cleanedLogin.toLowerCase() },
          { username: cleanedLogin },
        ],
      },
      include: {
        vehicle: true,
      },
    });

    if (!driver || !driver.active) {
      return res.status(401).json({
        error: "Invalid login details",
      });
    }

    const passwordValid = await bcrypt.compare(cleanedPassword, driver.password);

    if (!passwordValid) {
      return res.status(401).json({
        error: "Invalid login details",
      });
    }

    const token = createSessionToken();

    const updatedDriver = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        sessionToken: token,
        lastLoginAt: new Date(),
      },
      include: {
        vehicle: true,
      },
    });

    return res.json({
      message: "Login successful",
      token,
      driver: {
        id: updatedDriver.id,
        name: updatedDriver.name,
        username: updatedDriver.username,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        active: updatedDriver.active,
        availability: updatedDriver.availability,
        vehicleId: updatedDriver.vehicleId,
        vehicle: updatedDriver.vehicle,
      },
    });
  } catch (error) {
    console.error("Driver login error:", error);
    return res.status(500).json({
      error: "Driver login failed",
    });
  }
});

/**
 * GET CURRENT DRIVER
 */
router.get("/me", async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        sessionToken: token,
        active: true,
      },
      include: {
        vehicle: true,
      },
    });

    if (!driver) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    return res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        username: driver.username,
        email: driver.email,
        phone: driver.phone,
        active: driver.active,
        availability: driver.availability,
        vehicleId: driver.vehicleId,
        vehicle: driver.vehicle,
      },
    });
  } catch (error) {
    console.error("Driver me error:", error);
    return res.status(500).json({
      error: "Unable to fetch driver",
    });
  }
});

/**
 * DRIVER LOGOUT
 */
router.post("/logout", async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    await prisma.driver.updateMany({
      where: { sessionToken: token },
      data: { sessionToken: null },
    });

    return res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Driver logout error:", error);
    return res.status(500).json({
      error: "Logout failed",
    });
  }
});

/**
 * FORGOT USERNAME
 * Temporary direct response.
 * Replace with email delivery when email templates are implemented.
 */
router.post("/forgot-username", async (req, res) => {
  try {
    const { email } = req.body;

    const cleanedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanedEmail) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { email: cleanedEmail },
    });

    if (!driver || !driver.active) {
      return res.json({
        message: "If this email exists, username recovery instructions will be sent.",
      });
    }

    return res.json({
      message: "Username found",
      username: driver.username,
    });
  } catch (error) {
    console.error("Driver forgot username error:", error);
    return res.status(500).json({
      error: "Username recovery failed",
    });
  }
});

/**
 * UPDATE DRIVER AVAILABILITY
 */
router.patch("/availability", async (req, res) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { availability } = req.body;

    const allowedAvailability = ["AVAILABLE", "BUSY", "OFFLINE"];

    if (!allowedAvailability.includes(availability)) {
      return res.status(400).json({
        error: "Invalid availability",
      });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        sessionToken: token,
        active: true,
      },
    });

    if (!driver) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: driver.id },
      data: { availability },
      include: {
        vehicle: true,
      },
    });

    return res.json({
      message: "Availability updated",
      driver: {
        id: updatedDriver.id,
        name: updatedDriver.name,
        username: updatedDriver.username,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        active: updatedDriver.active,
        availability: updatedDriver.availability,
        vehicleId: updatedDriver.vehicleId,
        vehicle: updatedDriver.vehicle,
      },
    });
  } catch (error) {
    console.error("Driver availability error:", error);
    return res.status(500).json({
      error: "Unable to update availability",
    });
  }
});

export default router;
