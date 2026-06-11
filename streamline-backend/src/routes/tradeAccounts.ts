import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const router = Router();

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

router.post("/apply", async (req, res) => {
  try {
    const legalEntity = getString(req.body.legalEntity);
    const firstName = getString(req.body.firstName);
    const lastName = getString(req.body.lastName);
    const email = getString(req.body.email).toLowerCase();
    const mobileNumber = getString(req.body.mobileNumber);
    const password = getString(req.body.password);
    const confirmPassword = getString(req.body.confirmPassword);

    if (!legalEntity || !firstName || !lastName || !email || !mobileNumber) {
      return res.status(400).json({
        error: "Please complete all required trade account fields.",
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

    if (!req.body.authorisedToApply) {
      return res.status(400).json({
        error: "You must confirm you are authorised to apply for credit.",
      });
    }

    if (!req.body.creditCheckConsent) {
      return res.status(400).json({
        error: "You must consent to credit checks where necessary.",
      });
    }

    if (!req.body.creditSubjectToApproval) {
      return res.status(400).json({
        error: "You must confirm credit facilities are subject to approval.",
      });
    }

    if (!req.body.termsAccepted || !req.body.privacyAccepted) {
      return res.status(400).json({
        error: "You must accept the terms and privacy policy.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        tradeAccount: true,
      },
    });

    if (existingUser?.tradeAccount) {
      return res.status(409).json({
        error: "A trade account application already exists for this email address.",
      });
    }

    if (existingUser && existingUser.accountType === "TRADE") {
      return res.status(409).json({
        error: "A trade account already exists with this email address.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user =
      existingUser ||
      (await prisma.user.create({
        data: {
          accountType: "TRADE",

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
          companyWebsite: getString(req.body.companyWebsite) || null,

          firstName,
          lastName,
          jobTitle: getString(req.body.jobTitle) || null,
          accountsEmail: getString(req.body.accountsEmail).toLowerCase() || null,

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

          authorisedToCreateAccount: Boolean(req.body.authorisedToApply),
          acceptedTerms: Boolean(req.body.termsAccepted),
          acceptedPrivacy: Boolean(req.body.privacyAccepted),
        },
      }));

    if (existingUser && !existingUser.passwordHash) {
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          accountType: "TRADE",
          passwordHash,
        },
      });
    }

    if (existingUser && existingUser.accountType !== "TRADE") {
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          accountType: "TRADE",
        },
      });
    }

    const tradeAccount = await prisma.tradeAccount.create({
      data: {
        userId: user.id,

        companyName: legalEntity,
        tradingName: getString(req.body.tradingName) || null,
        companyRegistrationNumber:
          getString(req.body.companyRegistrationNumber) || null,
        vatNumber: getString(req.body.vatNumber) || null,
        dateBusinessEstablished:
          getString(req.body.dateBusinessEstablished) || null,
        businessType: getString(req.body.businessType) || null,
        companyWebsite: getString(req.body.companyWebsite) || null,
        annualTurnover: getString(req.body.annualTurnover) || null,

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

        accountsContactName: getString(req.body.accountsContactName) || null,
        accountsJobTitle: getString(req.body.accountsJobTitle) || null,
        accountsEmail: getString(req.body.accountsEmail).toLowerCase() || null,
        accountsPhone: getString(req.body.accountsPhone) || null,
        invoiceDeliveryEmail:
          getString(req.body.invoiceDeliveryEmail).toLowerCase() || null,

        primaryFirstName: firstName,
        primaryLastName: lastName,
        primaryPosition: getString(req.body.jobTitle) || null,
        primaryEmail: email,
        primaryMobile: mobileNumber,

        requestedCreditLimit: getNumber(req.body.requestedCreditLimit),
        expectedMonthlySpend: getString(req.body.expectedMonthlySpend) || null,
        estimatedShipmentsPerMonth:
          getString(req.body.estimatedShipmentsPerMonth) || null,
        preferredPaymentTerms:
          getString(req.body.preferredPaymentTerms) || null,

        serviceNextDayDelivery: Boolean(req.body.serviceNextDayDelivery),
        serviceMultiDrop: Boolean(req.body.serviceMultiDrop),
        serviceDedicatedVehicles: Boolean(req.body.serviceDedicatedVehicles),

        creditCheckConsent: Boolean(req.body.creditCheckConsent),
        authorisedToApply: Boolean(req.body.authorisedToApply),
        creditSubjectToApproval: Boolean(req.body.creditSubjectToApproval),
        termsAccepted: Boolean(req.body.termsAccepted),
        privacyAccepted: Boolean(req.body.privacyAccepted),

        creditLimit: getNumber(req.body.requestedCreditLimit) || 2500,
        paymentTermsDays: Number(getString(req.body.preferredPaymentTerms)) || 30,
      },
    });

    res.status(201).json({
      success: true,
      userId: user.id,
      tradeAccountId: tradeAccount.id,
      status: tradeAccount.status,
      redirectUrl: "/payment-success?tradeAccountApplication=received",
      message: "Trade account application submitted.",
    });
  } catch (error) {
    console.error("Trade account application error:", error);

    res.status(500).json({
      error: "Failed to submit trade account application.",
    });
  }
});

export default router;