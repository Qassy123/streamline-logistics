import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

const SESSION_DAYS = 30;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAuthToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.replace("Bearer ", "").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getSessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  return expiresAt;
}

async function getAuthenticatedUser(req: { headers: { authorization?: string } }) {
  const token = getAuthToken(req);

  if (!token) return null;

  const tokenHash = hashToken(token);

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        include: {
          tradeAccount: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.userSession.delete({
        where: {
          id: session.id,
        },
      });
    }

    return null;
  }

  return session.user;
}

function publicUser(user: {
  id: string;
  accountType: "BUSINESS" | "TRADE";
  companyName: string | null;
  name: string;
  email: string;
  phone: string | null;
  legalEntity: string | null;
  tradingName: string | null;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  businessType: string | null;
  industry: string | null;
  companyWebsite: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  accountsEmail: string | null;
  alternativeContactNumber: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredTownCity: string | null;
  registeredCounty: string | null;
  registeredPostcode: string | null;
  registeredCountry: string | null;
  tradingAddressDifferent: boolean;
  tradingAddressLine1: string | null;
  tradingAddressLine2: string | null;
  tradingTownCity: string | null;
  tradingCounty: string | null;
  tradingPostcode: string | null;
  tradingCountry: string | null;
  tradeAccount?: {
    status: string;
    creditLimit: unknown;
    currentBalance: unknown;
    paymentTermsDays: number;
  } | null;
}) {
  return {
    id: user.id,
    accountType: user.accountType,
    companyName: user.companyName,
    name: user.name,
    email: user.email,
    phone: user.phone,

    legalEntity: user.legalEntity,
    tradingName: user.tradingName,
    companyRegistrationNumber: user.companyRegistrationNumber,
    vatNumber: user.vatNumber,
    businessType: user.businessType,
    industry: user.industry,
    companyWebsite: user.companyWebsite,

    firstName: user.firstName,
    lastName: user.lastName,
    jobTitle: user.jobTitle,
    accountsEmail: user.accountsEmail,
    alternativeContactNumber: user.alternativeContactNumber,

    registeredAddressLine1: user.registeredAddressLine1,
    registeredAddressLine2: user.registeredAddressLine2,
    registeredTownCity: user.registeredTownCity,
    registeredCounty: user.registeredCounty,
    registeredPostcode: user.registeredPostcode,
    registeredCountry: user.registeredCountry,

    tradingAddressDifferent: user.tradingAddressDifferent,
    tradingAddressLine1: user.tradingAddressLine1,
    tradingAddressLine2: user.tradingAddressLine2,
    tradingTownCity: user.tradingTownCity,
    tradingCounty: user.tradingCounty,
    tradingPostcode: user.tradingPostcode,
    tradingCountry: user.tradingCountry,

    tradeAccount: user.tradeAccount || null,
  };
}

router.post("/business", async (req, res) => {
  try {
    const legalEntity = getString(req.body.legalEntity);
    const firstName = getString(req.body.firstName);
    const lastName = getString(req.body.lastName);
    const email = getString(req.body.email).toLowerCase();
    const mobileNumber = getString(req.body.mobileNumber);
    const password = getString(req.body.password);
    const confirmPassword = getString(req.body.confirmPassword);
    const quoteId = getString(req.body.quoteId);

    if (!legalEntity || !firstName || !lastName || !email || !mobileNumber) {
      return res.status(400).json({
        error: "Please complete all required business account fields.",
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match.",
      });
    }

    if (!req.body.authorisedToCreateAccount) {
      return res.status(400).json({
        error: "You must confirm you are authorised to create this account.",
      });
    }

    if (!req.body.acceptedTerms || !req.body.acceptedPrivacy) {
      return res.status(400).json({
        error: "You must accept the terms and privacy policy.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "An account already exists with this email address.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        accountType: "BUSINESS",

        name: `${firstName} ${lastName}`.trim(),
        email,
        phone: mobileNumber,
        companyName: legalEntity,

        passwordHash,

        legalEntity,
        tradingName: getString(req.body.tradingName) || null,
        companyRegistrationNumber:
          getString(req.body.companyRegistrationNumber) || null,
        vatNumber: getString(req.body.vatNumber) || null,
        businessType: getString(req.body.businessType) || null,
        industry: getString(req.body.industry) || null,
        companyWebsite: getString(req.body.companyWebsite) || null,

        firstName,
        lastName,
        jobTitle: getString(req.body.jobTitle) || null,
        accountsEmail: getString(req.body.accountsEmail).toLowerCase() || null,
        alternativeContactNumber:
          getString(req.body.alternativeContactNumber) || null,

        registeredAddressLine1:
          getString(req.body.registeredAddressLine1) || null,
        registeredAddressLine2:
          getString(req.body.registeredAddressLine2) || null,
        registeredTownCity: getString(req.body.registeredTownCity) || null,
        registeredCounty: getString(req.body.registeredCounty) || null,
        registeredPostcode: getString(req.body.registeredPostcode) || null,
        registeredCountry: getString(req.body.registeredCountry) || null,

        tradingAddressDifferent: Boolean(req.body.tradingAddressDifferent),

        tradingAddressLine1: getString(req.body.tradingAddressLine1) || null,
        tradingAddressLine2: getString(req.body.tradingAddressLine2) || null,
        tradingTownCity: getString(req.body.tradingTownCity) || null,
        tradingCounty: getString(req.body.tradingCounty) || null,
        tradingPostcode: getString(req.body.tradingPostcode) || null,
        tradingCountry: getString(req.body.tradingCountry) || null,

        estimatedShipmentsPerMonth:
          getString(req.body.estimatedShipmentsPerMonth) || null,
        typicalShipmentType: getString(req.body.typicalShipmentType) || null,
        howDidYouHear: getString(req.body.howDidYouHear) || null,

        authorisedToCreateAccount: Boolean(
          req.body.authorisedToCreateAccount
        ),
        acceptedTerms: Boolean(req.body.acceptedTerms),
        acceptedPrivacy: Boolean(req.body.acceptedPrivacy),
      },
    });

    if (quoteId) {
      await prisma.quote.updateMany({
        where: {
          id: quoteId,
        },
        data: {
          userId: user.id,
          legalEntity,
          tradingName: getString(req.body.tradingName) || null,
          companyName: legalEntity,
          customerName: `${firstName} ${lastName}`.trim(),
          customerEmail: email,
          customerPhone: mobileNumber,
        },
      });

      await prisma.booking.updateMany({
        where: {
          quoteId,
        },
        data: {
          userId: user.id,
        },
      });

      await prisma.payment.updateMany({
        where: {
          booking: {
            quoteId,
          },
        },
        data: {
          userId: user.id,
        },
      });

      await prisma.invoice.updateMany({
        where: {
          booking: {
            quoteId,
          },
        },
        data: {
          userId: user.id,
        },
      });
    }

    const token = createSessionToken();

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: getSessionExpiry(),
      },
    });

    res.status(201).json({
      success: true,
      token,
      user: publicUser({
        ...user,
        tradeAccount: null,
      }),
      redirectUrl: quoteId ? "/dashboard" : "/dashboard",
    });
  } catch (error) {
    console.error("Business account registration error:", error);

    res.status(500).json({
      error: "Failed to create business account.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = getString(req.body.email).toLowerCase();
    const password = getString(req.body.password);

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        tradeAccount: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const token = createSessionToken();

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: getSessionExpiry(),
      },
    });

    res.json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Failed to log in.",
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = getAuthToken(req);

    if (token) {
      await prisma.userSession.deleteMany({
        where: {
          tokenHash: hashToken(token),
        },
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      error: "Failed to log out.",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({
      error: "Failed to fetch account.",
    });
  }
});

router.patch("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const firstName = getString(req.body.firstName) || user.firstName || "";
    const lastName = getString(req.body.lastName) || user.lastName || "";
    const legalEntity =
      getString(req.body.legalEntity) || user.legalEntity || user.companyName;
    const phone = getString(req.body.phone) || user.phone;

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: `${firstName} ${lastName}`.trim() || user.name,
        phone,
        companyName: legalEntity || null,

        legalEntity: legalEntity || null,
        tradingName: getString(req.body.tradingName) || null,
        companyRegistrationNumber:
          getString(req.body.companyRegistrationNumber) || null,
        vatNumber: getString(req.body.vatNumber) || null,
        businessType: getString(req.body.businessType) || null,
        industry: getString(req.body.industry) || null,
        companyWebsite: getString(req.body.companyWebsite) || null,

        firstName: firstName || null,
        lastName: lastName || null,
        jobTitle: getString(req.body.jobTitle) || null,
        accountsEmail: getString(req.body.accountsEmail).toLowerCase() || null,
        alternativeContactNumber:
          getString(req.body.alternativeContactNumber) || null,

        registeredAddressLine1:
          getString(req.body.registeredAddressLine1) || null,
        registeredAddressLine2:
          getString(req.body.registeredAddressLine2) || null,
        registeredTownCity: getString(req.body.registeredTownCity) || null,
        registeredCounty: getString(req.body.registeredCounty) || null,
        registeredPostcode: getString(req.body.registeredPostcode) || null,
        registeredCountry: getString(req.body.registeredCountry) || null,

        tradingAddressDifferent: Boolean(req.body.tradingAddressDifferent),

        tradingAddressLine1: getString(req.body.tradingAddressLine1) || null,
        tradingAddressLine2: getString(req.body.tradingAddressLine2) || null,
        tradingTownCity: getString(req.body.tradingTownCity) || null,
        tradingCounty: getString(req.body.tradingCounty) || null,
        tradingPostcode: getString(req.body.tradingPostcode) || null,
        tradingCountry: getString(req.body.tradingCountry) || null,
      },
      include: {
        tradeAccount: true,
      },
    });

    res.json({
      success: true,
      user: publicUser(updatedUser),
    });
  } catch (error) {
    console.error("Update account error:", error);

    res.status(500).json({
      error: "Failed to update account.",
    });
  }
});

export default router;
