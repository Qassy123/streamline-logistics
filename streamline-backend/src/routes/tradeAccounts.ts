import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  AccountStatus,
  AccountType,
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
      where: { email },
      include: { tradeAccount: true },
    });

    if (existingUser?.tradeAccount) {
      return res.status(409).json({
        error:
          "A trade account application already exists for this email address.",
      });
    }

    if (existingUser && existingUser.accountType === AccountType.TRADE) {
      return res.status(409).json({
        error: "A trade account already exists with this email address.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user =
      existingUser ||
      (await prisma.user.create({
        data: {
          accountType: AccountType.TRADE,
          accountStatus: AccountStatus.ACTIVE,
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone: mobileNumber,
          companyName: legalEntity,
          passwordHash,
          legalEntity,
          tradingName: getOptionalString(req.body.tradingName),
          companyRegistrationNumber: getOptionalString(
            req.body.companyRegistrationNumber,
          ),
          vatNumber: getOptionalString(req.body.vatNumber),
          businessType: getOptionalString(req.body.businessType),
          companyWebsite: getOptionalString(req.body.companyWebsite),
          firstName,
          lastName,
          jobTitle: getOptionalString(req.body.jobTitle),
          accountsEmail:
            getString(req.body.accountsEmail).toLowerCase() || null,
          registeredAddressLine1: getOptionalString(
            req.body.registeredAddressLine1,
          ),
          registeredAddressLine2: getOptionalString(
            req.body.registeredAddressLine2,
          ),
          registeredTownCity: getOptionalString(
            req.body.registeredTownCity,
          ),
          registeredCounty: getOptionalString(req.body.registeredCounty),
          registeredPostcode: getOptionalString(
            req.body.registeredPostcode,
          ),
          registeredCountry: getOptionalString(
            req.body.registeredCountry,
          ),
          tradingAddressDifferent: getBoolean(
            req.body.tradingAddressDifferent,
          ),
          tradingAddressLine1: getOptionalString(
            req.body.tradingAddressLine1,
          ),
          tradingAddressLine2: getOptionalString(
            req.body.tradingAddressLine2,
          ),
          tradingTownCity: getOptionalString(req.body.tradingTownCity),
          tradingCounty: getOptionalString(req.body.tradingCounty),
          tradingPostcode: getOptionalString(req.body.tradingPostcode),
          tradingCountry: getOptionalString(req.body.tradingCountry),
          estimatedShipmentsPerMonth: getOptionalString(
            req.body.estimatedShipmentsPerMonth,
          ),
          typicalShipmentType: getOptionalString(
            req.body.typicalShipmentType,
          ),
          authorisedToCreateAccount: getBoolean(
            req.body.authorisedToApply,
          ),
          acceptedTerms: getBoolean(req.body.termsAccepted),
          acceptedPrivacy: getBoolean(req.body.privacyAccepted),
        },
      }));

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          accountType: AccountType.TRADE,
          accountStatus: AccountStatus.ACTIVE,
          passwordHash: existingUser.passwordHash
            ? undefined
            : passwordHash,
        },
      });
    }

    const tradeAccount = await prisma.tradeAccount.create({
      data: {
        userId: user.id,
        companyName: legalEntity,
        tradingName: getOptionalString(req.body.tradingName),
        companyRegistrationNumber: getOptionalString(
          req.body.companyRegistrationNumber,
        ),
        vatNumber: getOptionalString(req.body.vatNumber),
        dateBusinessEstablished: getOptionalString(
          req.body.dateBusinessEstablished,
        ),
        businessType: getOptionalString(req.body.businessType),
        companyWebsite: getOptionalString(req.body.companyWebsite),
        annualTurnover: getOptionalString(req.body.annualTurnover),
        registeredAddressLine1: getOptionalString(
          req.body.registeredAddressLine1,
        ),
        registeredAddressLine2: getOptionalString(
          req.body.registeredAddressLine2,
        ),
        registeredTownCity: getOptionalString(
          req.body.registeredTownCity,
        ),
        registeredCounty: getOptionalString(req.body.registeredCounty),
        registeredPostcode: getOptionalString(
          req.body.registeredPostcode,
        ),
        registeredCountry: getOptionalString(
          req.body.registeredCountry,
        ),
        tradingAddressDifferent: getBoolean(
          req.body.tradingAddressDifferent,
        ),
        tradingAddressLine1: getOptionalString(
          req.body.tradingAddressLine1,
        ),
        tradingAddressLine2: getOptionalString(
          req.body.tradingAddressLine2,
        ),
        tradingTownCity: getOptionalString(req.body.tradingTownCity),
        tradingCounty: getOptionalString(req.body.tradingCounty),
        tradingPostcode: getOptionalString(req.body.tradingPostcode),
        tradingCountry: getOptionalString(req.body.tradingCountry),
        accountsContactName: getOptionalString(
          req.body.accountsContactName,
        ),
        accountsJobTitle: getOptionalString(req.body.accountsJobTitle),
        accountsEmail:
          getString(req.body.accountsEmail).toLowerCase() || null,
        accountsPhone: getOptionalString(req.body.accountsPhone),
        invoiceDeliveryEmail:
          getString(req.body.invoiceDeliveryEmail).toLowerCase() || null,
        primaryFirstName: firstName,
        primaryLastName: lastName,
        primaryPosition: getOptionalString(req.body.jobTitle),
        primaryEmail: email,
        primaryMobile: mobileNumber,
        requestedCreditLimit: getNumber(req.body.requestedCreditLimit),
        expectedMonthlySpend: getOptionalString(
          req.body.expectedMonthlySpend,
        ),
        estimatedShipmentsPerMonth: getOptionalString(
          req.body.estimatedShipmentsPerMonth,
        ),
        preferredPaymentTerms: getOptionalString(
          req.body.preferredPaymentTerms,
        ),
        serviceNextDayDelivery: getBoolean(
          req.body.serviceNextDayDelivery,
        ),
        serviceMultiDrop: getBoolean(req.body.serviceMultiDrop),
        serviceDedicatedVehicles: getBoolean(
          req.body.serviceDedicatedVehicles,
        ),
        creditCheckConsent: getBoolean(req.body.creditCheckConsent),
        authorisedToApply: getBoolean(req.body.authorisedToApply),
        creditSubjectToApproval: getBoolean(
          req.body.creditSubjectToApproval,
        ),
        termsAccepted: getBoolean(req.body.termsAccepted),
        privacyAccepted: getBoolean(req.body.privacyAccepted),
        creditLimit: getNumber(req.body.requestedCreditLimit) || 2500,
        paymentTermsDays:
          Number(getString(req.body.preferredPaymentTerms)) || 30,
      },
    });

    res.status(201).json({
      success: true,
      userId: user.id,
      tradeAccountId: tradeAccount.id,
      status: tradeAccount.status,
      redirectUrl:
        "/payment-success?tradeAccountApplication=received",
      message: "Trade account application submitted.",
    });
  } catch (error) {
    console.error("Trade account application error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error:
          "A trade account application already exists for this customer.",
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
          statusTotals.map((item) => [
            item.status,
            item._count._all,
          ]),
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
      return res.status(404).json({
        error: "Trade account not found.",
      });
    }

    const statusValue = getString(req.body.status).toUpperCase();
    const creditLimit = getNumber(req.body.creditLimit);
    const currentBalance = getNumber(req.body.currentBalance);
    const paymentTermsDays = getNumber(req.body.paymentTermsDays);
    const now = new Date();

    if (statusValue && !isTradeAccountStatus(statusValue)) {
      return res.status(400).json({
        error: "Invalid trade-account status.",
      });
    }

    if (
      req.body.creditLimit !== undefined &&
      (creditLimit === null || creditLimit < 0)
    ) {
      return res.status(400).json({
        error: "Credit limit must be zero or greater.",
      });
    }

    if (
      req.body.currentBalance !== undefined &&
      currentBalance === null
    ) {
      return res.status(400).json({
        error: "Current balance must be a valid number.",
      });
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

    const nextStatus = statusValue
      ? (statusValue as TradeAccountStatus)
      : undefined;

    const account = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.tradeAccount.update({
        where: { id: req.params.id },
        data: {
          status: nextStatus,
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
          billingContactName:
            req.body.billingContactName !== undefined
              ? getOptionalString(req.body.billingContactName)
              : undefined,
          accountsEmail:
            req.body.accountsEmail !== undefined
              ? getOptionalString(req.body.accountsEmail)?.toLowerCase() ||
                null
              : undefined,
          accountsPhone:
            req.body.accountsPhone !== undefined
              ? getOptionalString(req.body.accountsPhone)
              : undefined,
          rejectionReason:
            req.body.rejectionReason !== undefined
              ? getOptionalString(req.body.rejectionReason)
              : undefined,
          suspensionReason:
            req.body.suspensionReason !== undefined
              ? getOptionalString(req.body.suspensionReason)
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
        select: tradeAccountSelect(),
      });

      if (nextStatus === TradeAccountStatus.APPROVED) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: {
            accountType: AccountType.TRADE,
            accountStatus: AccountStatus.ACTIVE,
          },
        });
      }

      if (nextStatus === TradeAccountStatus.SUSPENDED) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: { accountStatus: AccountStatus.SUSPENDED },
        });
      }

      if (nextStatus === TradeAccountStatus.REJECTED) {
        await transaction.user.update({
          where: { id: existing.userId },
          data: { accountStatus: AccountStatus.INACTIVE },
        });
      }

      return updated;
    });

    res.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error("Admin trade-account update error:", error);

    res.status(500).json({
      error: "Unable to update trade account.",
    });
  }
});

export default router;