import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const router = Router();

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    }

    res.status(201).json({
      success: true,
      userId: user.id,
      redirectUrl: quoteId ? `/payments?quoteId=${quoteId}` : "/payments",
    });
  } catch (error) {
    console.error("Business account registration error:", error);

    res.status(500).json({
      error: "Failed to create business account.",
    });
  }
});

export default router;