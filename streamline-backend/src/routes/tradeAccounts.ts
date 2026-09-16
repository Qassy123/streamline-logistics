import { Router } from "express";
import crypto from "crypto";
import {
  AccountStatus,
  AccountType,
  BillingFrequency,
  BillingInvoiceMode,
  BillingPaymentMode,
  Prisma,
  TradeAccountStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const cleanValue = getString(value);
  return cleanValue || null;
}

function getNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function getAuthToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.replace("Bearer ", "").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getAuthenticatedUser(req: {
  headers: { authorization?: string };
}) {
  const token = getAuthToken(req);
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { tradeAccount: true } } },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.userSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function generateAccountNumber(transaction: Prisma.TransactionClient) {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const accountNumber = `SL-CUS-${year}-${crypto.randomInt(100000, 1000000)}`;
    const existing = await transaction.user.findUnique({
      where: { accountNumber },
      select: { id: true },
    });

    if (!existing) return accountNumber;
  }

  throw new Error("Unable to generate a unique customer account number.");
}

function isTradeAccountStatus(value: string): value is TradeAccountStatus {
  return Object.values(TradeAccountStatus).includes(
    value as TradeAccountStatus,
  );
}

function requireAdmin(req: { headers: { [key: string]: unknown } }) {
  const configuredAdminKey = process.env.ADMIN_API_KEY?.trim();
  const suppliedAdminKey = getString(req.headers["x-admin-key"]);

  if (!configuredAdminKey) {
    return {
      authorised: false,
      status: 503,
      error: "Admin API key is not configured.",
    };
  }

  if (!suppliedAdminKey || suppliedAdminKey !== configuredAdminKey) {
    return {
      authorised: false,
      status: 401,
      error: "Admin access denied.",
    };
  }

  return {
    authorised: true,
    status: 200,
    error: "",
  };
}

function tradeAccountSelect() {
  return {
    id: true,
    userId: true,
    status: true,
    companyName: true,
    tradingName: true,
    companyRegistrationNumber: true,
    vatNumber: true,
    dateBusinessEstablished: true,
    businessType: true,
    companyWebsite: true,
    annualTurnover: true,
    registeredAddressLine1: true,
    registeredAddressLine2: true,
    registeredTownCity: true,
    registeredCounty: true,
    registeredPostcode: true,
    registeredCountry: true,
    tradingAddressDifferent: true,
    tradingAddressLine1: true,
    tradingAddressLine2: true,
    tradingTownCity: true,
    tradingCounty: true,
    tradingPostcode: true,
    tradingCountry: true,
    accountsContactName: true,
    accountsJobTitle: true,
    accountsEmail: true,
    accountsPhone: true,
    invoiceDeliveryEmail: true,
    primaryFirstName: true,
    primaryLastName: true,
    primaryPosition: true,
    primaryEmail: true,
    primaryMobile: true,
    requestedCreditLimit: true,
    expectedMonthlySpend: true,
    estimatedShipmentsPerMonth: true,
    preferredPaymentTerms: true,
    serviceSameDayDelivery: true,
    serviceNextDayDelivery: true,
    serviceMultiDrop: true,
    serviceDedicatedVehicles: true,
    creditCheckConsent: true,
    authorisedToApply: true,
    creditSubjectToApproval: true,
    termsAccepted: true,
    privacyAccepted: true,
    creditLimit: true,
    currentBalance: true,
    paymentTermsDays: true,
    billingContactName: true,
    suspensionReason: true,
    rejectionReason: true,
    approvedAt: true,
    rejectedAt: true,
    suspendedAt: true,
    reactivatedAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        accountNumber: true,
        accountType: true,
        accountStatus: true,
        companyName: true,
        name: true,
        email: true,
        phone: true,
        accountsEmail: true,
        mainContactName: true,
        companyRegistrationNumber: true,
        vatNumber: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            quotes: true,
            bookings: true,
            invoices: true,
            payments: true,
          },
        },
      },
    },
  } satisfies Prisma.TradeAccountSelect;
}

router.post("/apply", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "You must be logged in to apply for a trade account.",
      });
    }

    if (
      user.accountType !== AccountType.BUSINESS ||
      user.accountStatus !== AccountStatus.ACTIVE
    ) {
      return res.status(403).json({
        error: "Only an active Business Account can apply for a Trade Account.",
      });
    }

    if (user.tradeAccount) {
      return res.status(409).json({
        error: "A trade account application already exists for this account.",
      });
    }

    const legalEntity =
      getString(req.body.legalEntity) || user.legalEntity || user.companyName || "";
    const firstName = getString(req.body.firstName) || user.firstName || "";
    const lastName = getString(req.body.lastName) || user.lastName || "";
    const email = user.email.toLowerCase();
    const mobileNumber = getString(req.body.mobileNumber) || user.phone || "";
    const accountsEmail =
      getString(req.body.accountsEmail).toLowerCase() ||
      user.accountsEmail?.toLowerCase() ||
      email;
    const invoiceDeliveryEmail =
      getString(req.body.invoiceDeliveryEmail).toLowerCase() || accountsEmail;

    if (!legalEntity || !firstName || !lastName || !email || !mobileNumber) {
      return res.status(400).json({
        error: "Please complete all required trade account fields.",
      });
    }

    if (!isValidEmail(accountsEmail) || !isValidEmail(invoiceDeliveryEmail)) {
      return res.status(400).json({
        error: "Enter valid accounts and invoice delivery email addresses.",
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

    const serviceSameDayDelivery = getBoolean(req.body.serviceSameDayDelivery);
    const serviceNextDayDelivery = getBoolean(req.body.serviceNextDayDelivery);
    const serviceMultiDrop = getBoolean(req.body.serviceMultiDrop);
    const serviceDedicatedVehicles = getBoolean(req.body.serviceDedicatedVehicles);

    if (
      !serviceSameDayDelivery &&
      !serviceNextDayDelivery &&
      !serviceMultiDrop &&
      !serviceDedicatedVehicles
    ) {
      return res.status(400).json({
        error: "Please select at least one service requirement.",
      });
    }

    const requestedCreditLimit = getNumber(req.body.requestedCreditLimit);
    const preferredPaymentTerms = Number(
      getString(req.body.preferredPaymentTerms),
    );

    if (requestedCreditLimit === null || requestedCreditLimit <= 0) {
      return res.status(400).json({
        error: "Please select a requested credit limit.",
      });
    }

    if (![7, 14, 30].includes(preferredPaymentTerms)) {
      return res.status(400).json({
        error: "Please select valid preferred payment terms.",
      });
    }

    const tradeAccount = await prisma.tradeAccount.create({
      data: {
        userId: user.id,
        status: TradeAccountStatus.PENDING,
        companyName: legalEntity,
        tradingName:
          getOptionalString(req.body.tradingName) || user.tradingName || null,
        companyRegistrationNumber:
          getOptionalString(req.body.companyRegistrationNumber) ||
          user.companyRegistrationNumber ||
          null,
        vatNumber: getOptionalString(req.body.vatNumber) || user.vatNumber || null,
        dateBusinessEstablished: getOptionalString(
          req.body.dateBusinessEstablished,
        ),
        businessType:
          getOptionalString(req.body.businessType) || user.businessType || null,
        companyWebsite:
          getOptionalString(req.body.companyWebsite) || user.companyWebsite || null,
        annualTurnover: getOptionalString(req.body.annualTurnover),
        registeredAddressLine1:
          getOptionalString(req.body.registeredAddressLine1) ||
          user.registeredAddressLine1 ||
          null,
        registeredAddressLine2:
          getOptionalString(req.body.registeredAddressLine2) ||
          user.registeredAddressLine2 ||
          null,
        registeredTownCity:
          getOptionalString(req.body.registeredTownCity) ||
          user.registeredTownCity ||
          null,
        registeredCounty:
          getOptionalString(req.body.registeredCounty) ||
          user.registeredCounty ||
          null,
        registeredPostcode:
          getOptionalString(req.body.registeredPostcode) ||
          user.registeredPostcode ||
          null,
        registeredCountry:
          getOptionalString(req.body.registeredCountry) ||
          user.registeredCountry ||
          "United Kingdom",
        tradingAddressDifferent: getBoolean(req.body.tradingAddressDifferent),
        tradingAddressLine1: getOptionalString(req.body.tradingAddressLine1),
        tradingAddressLine2: getOptionalString(req.body.tradingAddressLine2),
        tradingTownCity: getOptionalString(req.body.tradingTownCity),
        tradingCounty: getOptionalString(req.body.tradingCounty),
        tradingPostcode: getOptionalString(req.body.tradingPostcode),
        tradingCountry: getOptionalString(req.body.tradingCountry),
        accountsContactName: getOptionalString(req.body.accountsContactName),
        accountsJobTitle: getOptionalString(req.body.accountsJobTitle),
        accountsEmail,
        accountsPhone:
          getOptionalString(req.body.accountsPhone) || user.phone || null,
        invoiceDeliveryEmail,
        primaryFirstName: firstName,
        primaryLastName: lastName,
        primaryPosition:
          getOptionalString(req.body.jobTitle) || user.jobTitle || null,
        primaryEmail: email,
        primaryMobile: mobileNumber,
        requestedCreditLimit,
        expectedMonthlySpend: getOptionalString(req.body.expectedMonthlySpend),
        estimatedShipmentsPerMonth: getOptionalString(
          req.body.estimatedShipmentsPerMonth,
        ),
        preferredPaymentTerms: String(preferredPaymentTerms),
        serviceSameDayDelivery,
        serviceNextDayDelivery,
        serviceMultiDrop,
        serviceDedicatedVehicles,
        creditCheckConsent: true,
        authorisedToApply: true,
        creditSubjectToApproval: true,
        termsAccepted: true,
        privacyAccepted: true,
        creditLimit: requestedCreditLimit,
        paymentTermsDays: preferredPaymentTerms,
      },
    });

    res.status(201).json({
      success: true,
      userId: user.id,
      tradeAccountId: tradeAccount.id,
      status: tradeAccount.status,
      redirectUrl: "/trade-account-success",
      message: "Trade account application submitted.",
    });
  } catch (error) {
    console.error("Trade account application error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A trade account application already exists for this customer.",
      });
    }

    res.status(500).json({
      error: "Failed to submit trade account application.",
    });
  }
});

router.get("/admin", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const page = getPositiveInteger(req.query.page, 1);
    const pageSize = Math.min(
      getPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const search = getString(req.query.search);
    const status = getString(req.query.status).toUpperCase();

    const where: Prisma.TradeAccountWhereInput = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { tradingName: { contains: search, mode: "insensitive" } },
        {
          companyRegistrationNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        { vatNumber: { contains: search, mode: "insensitive" } },
        { accountsEmail: { contains: search, mode: "insensitive" } },
        { primaryEmail: { contains: search, mode: "insensitive" } },
        {
          user: {
            is: {
              name: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          user: {
            is: {
              accountNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      if (!isTradeAccountStatus(status)) {
        return res.status(400).json({
          error: "Invalid trade-account status filter.",
        });
      }

      where.status = status;
    }

    const [accounts, total, statusTotals] = await Promise.all([
      prisma.tradeAccount.findMany({
        where,
        select: tradeAccountSelect(),
        orderBy: [{ createdAt: "desc" }, { companyName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tradeAccount.count({ where }),
      prisma.tradeAccount.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    res.json({
      accounts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus: Object.fromEntries(
          statusTotals.map((item) => [item.status, item._count._all]),
        ),
      },
    });
  } catch (error) {
    console.error("Admin trade-account list error:", error);

    res.status(500).json({
      error: "Unable to load trade accounts.",
    });
  }
});

router.get("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const account = await prisma.tradeAccount.findUnique({
      where: { id: req.params.id },
      select: tradeAccountSelect(),
    });

    if (!account) {
      return res.status(404).json({
        error: "Trade account not found.",
      });
    }

    res.json({ account });
  } catch (error) {
    console.error("Admin trade-account detail error:", error);

    res.status(500).json({
      error: "Unable to load trade account.",
    });
  }
});

router.patch("/admin/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({ error: admin.error });
  }

  try {
    const existing = await prisma.tradeAccount.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Trade account not found." });
    }

    const statusValue = getString(req.body.status).toUpperCase();
    const nextStatus = statusValue
      ? (statusValue as TradeAccountStatus)
      : undefined;
    const creditLimit = getNumber(req.body.creditLimit);
    const currentBalance = getNumber(req.body.currentBalance);
    const paymentTermsDays = getNumber(req.body.paymentTermsDays);
    const rejectionReason = getString(req.body.rejectionReason);
    const suspensionReason = getString(req.body.suspensionReason);
    const accountsEmail = getString(req.body.accountsEmail).toLowerCase();
    const invoiceDeliveryEmail = getString(
      req.body.invoiceDeliveryEmail,
    ).toLowerCase();
    const now = new Date();

    if (statusValue && !isTradeAccountStatus(statusValue)) {
      return res.status(400).json({ error: "Invalid trade-account status." });
    }

    if (
      req.body.creditLimit !== undefined &&
      (creditLimit === null || creditLimit < 0)
    ) {
      return res
        .status(400)
        .json({ error: "Credit limit must be zero or greater." });
    }

    if (req.body.currentBalance !== undefined && currentBalance === null) {
      return res
        .status(400)
        .json({ error: "Current balance must be a valid number." });
    }

    if (
      req.body.paymentTermsDays !== undefined &&
      (paymentTermsDays === null ||
        paymentTermsDays < 0 ||
        !Number.isInteger(paymentTermsDays))
    ) {
      return res.status(400).json({
        error: "Payment terms must be a whole number of days.",
      });
    }

    if (accountsEmail && !isValidEmail(accountsEmail)) {
      return res
        .status(400)
        .json({ error: "Enter a valid accounts email address." });
    }

    if (invoiceDeliveryEmail && !isValidEmail(invoiceDeliveryEmail)) {
      return res.status(400).json({
        error: "Enter a valid invoice delivery email address.",
      });
    }

    if (
      nextStatus === TradeAccountStatus.REJECTED &&
      rejectionReason.length < 5
    ) {
      return res.status(400).json({
        error: "A rejection reason of at least 5 characters is required.",
      });
    }

    if (
      nextStatus === TradeAccountStatus.SUSPENDED &&
      suspensionReason.length < 5
    ) {
      return res.status(400).json({
        error: "A suspension reason of at least 5 characters is required.",
      });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.tradeAccount.update({
        where: { id: req.params.id },
        data: {
          status: nextStatus,
          companyName:
            req.body.companyName !== undefined
              ? getString(req.body.companyName)
              : undefined,
          tradingName:
            req.body.tradingName !== undefined
              ? getOptionalString(req.body.tradingName)
              : undefined,
          companyRegistrationNumber:
            req.body.companyRegistrationNumber !== undefined
              ? getOptionalString(req.body.companyRegistrationNumber)
              : undefined,
          vatNumber:
            req.body.vatNumber !== undefined
              ? getOptionalString(req.body.vatNumber)
              : undefined,
          billingContactName:
            req.body.billingContactName !== undefined
              ? getOptionalString(req.body.billingContactName)
              : undefined,
          accountsContactName:
            req.body.accountsContactName !== undefined
              ? getOptionalString(req.body.accountsContactName)
              : undefined,
          accountsJobTitle:
            req.body.accountsJobTitle !== undefined
              ? getOptionalString(req.body.accountsJobTitle)
              : undefined,
          accountsEmail:
            req.body.accountsEmail !== undefined
              ? accountsEmail || null
              : undefined,
          accountsPhone:
            req.body.accountsPhone !== undefined
              ? getOptionalString(req.body.accountsPhone)
              : undefined,
          invoiceDeliveryEmail:
            req.body.invoiceDeliveryEmail !== undefined
              ? invoiceDeliveryEmail || null
              : undefined,
          creditLimit:
            req.body.creditLimit !== undefined
              ? (creditLimit as number)
              : undefined,
          currentBalance:
            req.body.currentBalance !== undefined
              ? (currentBalance as number)
              : undefined,
          paymentTermsDays:
            req.body.paymentTermsDays !== undefined
              ? (paymentTermsDays as number)
              : undefined,
          rejectionReason:
            nextStatus === TradeAccountStatus.REJECTED
              ? rejectionReason
              : req.body.rejectionReason !== undefined
                ? getOptionalString(req.body.rejectionReason)
                : undefined,
          suspensionReason:
            nextStatus === TradeAccountStatus.SUSPENDED
              ? suspensionReason
              : req.body.suspensionReason !== undefined
                ? getOptionalString(req.body.suspensionReason)
                : undefined,
          creditFacilityOnHold:
            nextStatus === TradeAccountStatus.APPROVED
              ? false
              : nextStatus === TradeAccountStatus.SUSPENDED
                ? true
                : undefined,
          creditHoldReason:
            nextStatus === TradeAccountStatus.APPROVED
              ? null
              : nextStatus === TradeAccountStatus.SUSPENDED
                ? suspensionReason
                : undefined,
          approvedAt:
            nextStatus === TradeAccountStatus.APPROVED ? now : undefined,
          rejectedAt:
            nextStatus === TradeAccountStatus.REJECTED ? now : undefined,
          suspendedAt:
            nextStatus === TradeAccountStatus.SUSPENDED ? now : undefined,
          reactivatedAt:
            nextStatus === TradeAccountStatus.APPROVED &&
            existing.status === TradeAccountStatus.SUSPENDED
              ? now
              : undefined,
        },
      });

      const commonUserData = {
        companyName:
          req.body.companyName !== undefined
            ? getString(req.body.companyName)
            : undefined,
        legalEntity:
          req.body.companyName !== undefined
            ? getString(req.body.companyName)
            : undefined,
        tradingName:
          req.body.tradingName !== undefined
            ? getOptionalString(req.body.tradingName)
            : undefined,
        companyRegistrationNumber:
          req.body.companyRegistrationNumber !== undefined
            ? getOptionalString(req.body.companyRegistrationNumber)
            : undefined,
        vatNumber:
          req.body.vatNumber !== undefined
            ? getOptionalString(req.body.vatNumber)
            : undefined,
        accountsEmail:
          req.body.accountsEmail !== undefined
            ? accountsEmail || null
            : undefined,
        mainContactName:
          req.body.billingContactName !== undefined
            ? getOptionalString(req.body.billingContactName)
            : undefined,
      } satisfies Prisma.UserUpdateInput;

      if (nextStatus === TradeAccountStatus.APPROVED) {
        const accountNumber =
          existing.user.accountNumber ||
          (await generateAccountNumber(transaction));
        await transaction.user.update({
          where: { id: existing.userId },
          data: {
            ...commonUserData,
            accountNumber,
            accountType: AccountType.TRADE,
            accountStatus: AccountStatus.ACTIVE,
          },
        });

        const approvedCreditLimit =
          req.body.creditLimit !== undefined
            ? (creditLimit as number)
            : Number(existing.creditLimit);
        const approvedPaymentTerms =
          req.body.paymentTermsDays !== undefined
            ? (paymentTermsDays as number)
            : existing.paymentTermsDays;
        const approvedAccountsEmail =
          req.body.accountsEmail !== undefined
            ? accountsEmail || existing.accountsEmail || existing.user.accountsEmail
            : existing.accountsEmail || existing.user.accountsEmail;

        await transaction.billingProfile.upsert({
          where: { userId: existing.userId },
          update: {
            paymentMode: BillingPaymentMode.PAY_LATER,
            paymentTermsDays: approvedPaymentTerms,
            accountsEmail: approvedAccountsEmail || null,
            creditLimit: approvedCreditLimit,
            creditFacilityOnHold: false,
            holdReason: null,
          },
          create: {
            userId: existing.userId,
            paymentMode: BillingPaymentMode.PAY_LATER,
            invoiceMode: BillingInvoiceMode.PER_BOOKING,
            billingFrequency: BillingFrequency.PER_BOOKING,
            paymentTermsDays: approvedPaymentTerms,
            accountsEmail: approvedAccountsEmail || null,
            creditLimit: approvedCreditLimit,
            creditFacilityOnHold: false,
          },
        });
      } else if (nextStatus === TradeAccountStatus.SUSPENDED) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: { ...commonUserData, accountStatus: AccountStatus.SUSPENDED },
        });
        await transaction.billingProfile.updateMany({
          where: { userId: existing.userId },
          data: {
            creditFacilityOnHold: true,
            holdReason: suspensionReason,
          },
        });
      } else if (nextStatus === TradeAccountStatus.REJECTED) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: {
            ...commonUserData,
            accountType: AccountType.BUSINESS,
            accountStatus: AccountStatus.ACTIVE,
          },
        });
        await transaction.billingProfile.updateMany({
          where: { userId: existing.userId },
          data: {
            paymentMode: BillingPaymentMode.PAY_NOW,
            creditFacilityOnHold: false,
            holdReason: null,
          },
        });
      } else {
        await transaction.user.update({
          where: { id: existing.userId },
          data: commonUserData,
        });
      }
    });

    const account = await prisma.tradeAccount.findUnique({
      where: { id: req.params.id },
      select: tradeAccountSelect(),
    });

    res.json({ success: true, account });
  } catch (error) {
    console.error("Admin trade-account update error:", error);
    res.status(500).json({ error: "Unable to update trade account." });
  }
});

export default router;
