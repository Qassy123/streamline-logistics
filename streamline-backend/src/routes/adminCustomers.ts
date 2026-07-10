import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AccountStatus, AccountType, Prisma } from "@prisma/client";
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

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

function isAccountType(value: string): value is AccountType {
  return Object.values(AccountType).includes(value as AccountType);
}

function isAccountStatus(value: string): value is AccountStatus {
  return Object.values(AccountStatus).includes(value as AccountStatus);
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

function customerSelect() {
  return {
    id: true,
    accountNumber: true,
    accountType: true,
    accountStatus: true,
    companyName: true,
    name: true,
    email: true,
    username: true,
    phone: true,
    legalEntity: true,
    tradingName: true,
    companyRegistrationNumber: true,
    vatNumber: true,
    businessType: true,
    industry: true,
    companyWebsite: true,
    firstName: true,
    lastName: true,
    jobTitle: true,
    accountsEmail: true,
    alternativeContactNumber: true,
    mainContactName: true,
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
    estimatedShipmentsPerMonth: true,
    typicalShipmentType: true,
    howDidYouHear: true,
    authorisedToCreateAccount: true,
    acceptedTerms: true,
    acceptedPrivacy: true,
    adminCreated: true,
    internalNote: true,
    createdAt: true,
    updatedAt: true,
    tradeAccount: {
      select: {
        id: true,
        status: true,
        creditLimit: true,
        currentBalance: true,
        paymentTermsDays: true,
        approvedAt: true,
        rejectedAt: true,
        suspendedAt: true,
        reactivatedAt: true,
      },
    },
    _count: {
      select: {
        quotes: true,
        bookings: true,
        invoices: true,
        payments: true,
        savedRoutes: true,
        notes: true,
        documents: true,
      },
    },
  } satisfies Prisma.UserSelect;
}

async function generateAccountNumber() {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const sequence = crypto.randomInt(100000, 1000000);
    const accountNumber = `SL-CUS-${year}-${sequence}`;

    const existing = await prisma.user.findUnique({
      where: {
        accountNumber,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return accountNumber;
    }
  }

  throw new Error("Unable to generate a unique customer account number.");
}

router.get("/", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const page = getPositiveInteger(req.query.page, 1);
    const pageSize = Math.min(
      getPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    const search = getString(req.query.search);
    const accountType = getString(req.query.accountType).toUpperCase();
    const accountStatus = getString(req.query.accountStatus).toUpperCase();

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          companyName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          legalEntity: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          tradingName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          accountsEmail: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          alternativeContactNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          accountNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          vatNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          companyRegistrationNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (accountType && accountType !== "ALL") {
      if (!isAccountType(accountType)) {
        return res.status(400).json({
          error: "Invalid account type filter.",
        });
      }

      where.accountType = accountType;
    }

    if (accountStatus && accountStatus !== "ALL") {
      if (!isAccountStatus(accountStatus)) {
        return res.status(400).json({
          error: "Invalid account status filter.",
        });
      }

      where.accountStatus = accountStatus;
    }

    const [customers, total, typeTotals, statusTotals] = await Promise.all([
      prisma.user.findMany({
        where,
        select: customerSelect(),
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            name: "asc",
          },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({
        where,
      }),
      prisma.user.groupBy({
        by: ["accountType"],
        _count: {
          _all: true,
        },
      }),
      prisma.user.groupBy({
        by: ["accountStatus"],
        _count: {
          _all: true,
        },
      }),
    ]);

    res.json({
      customers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byAccountType: Object.fromEntries(
          typeTotals.map((item) => [item.accountType, item._count._all]),
        ),
        byAccountStatus: Object.fromEntries(
          statusTotals.map((item) => [item.accountStatus, item._count._all]),
        ),
      },
    });
  } catch (error) {
    console.error("Admin customer list error:", error);

    res.status(500).json({
      error: "Unable to load customer accounts.",
    });
  }
});

router.post("/", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const accountTypeValue =
      getString(req.body.accountType).toUpperCase() || AccountType.BUSINESS;

    if (!isAccountType(accountTypeValue)) {
      return res.status(400).json({
        error: "Account type must be PRIVATE, BUSINESS or TRADE.",
      });
    }

    const firstName = getString(req.body.firstName);
    const lastName = getString(req.body.lastName);
    const suppliedName = getString(req.body.name);
    const companyName =
      getOptionalString(req.body.companyName) ||
      getOptionalString(req.body.legalEntity);
    const name =
      suppliedName ||
      `${firstName} ${lastName}`.trim() ||
      companyName ||
      "";

    const email = getString(req.body.email).toLowerCase();
    const accountsEmail =
      getString(req.body.accountsEmail).toLowerCase() || null;
    const phone =
      getOptionalString(req.body.phone) ||
      getOptionalString(req.body.contactNumber);

    if (!name || !email || !phone) {
      return res.status(400).json({
        error: "Customer name, email address and contact number are required.",
      });
    }

    if (
      accountTypeValue !== AccountType.PRIVATE &&
      !companyName
    ) {
      return res.status(400).json({
        error: "Business name is required for business and trade accounts.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "A customer account already exists with this email address.",
      });
    }

    const username = getString(req.body.username).toLowerCase() || null;

    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: {
          username,
        },
        select: {
          id: true,
        },
      });

      if (existingUsername) {
        return res.status(409).json({
          error: "This username is already in use.",
        });
      }
    }

    const password = getString(req.body.password);
    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : null;

    const accountNumber = await generateAccountNumber();

    const customer = await prisma.user.create({
      data: {
        accountNumber,
        accountType: accountTypeValue,
        accountStatus: AccountStatus.ACTIVE,
        companyName,
        name,
        email,
        username,
        phone,
        passwordHash,

        legalEntity:
          getOptionalString(req.body.legalEntity) || companyName,
        tradingName: getOptionalString(req.body.tradingName),
        companyRegistrationNumber: getOptionalString(
          req.body.companyRegistrationNumber,
        ),
        vatNumber: getOptionalString(req.body.vatNumber),
        businessType: getOptionalString(req.body.businessType),
        industry: getOptionalString(req.body.industry),
        companyWebsite: getOptionalString(req.body.companyWebsite),

        firstName: firstName || null,
        lastName: lastName || null,
        jobTitle: getOptionalString(req.body.jobTitle),
        accountsEmail,
        alternativeContactNumber: getOptionalString(
          req.body.alternativeContactNumber,
        ),
        mainContactName:
          getOptionalString(req.body.mainContactName) ||
          name,

        registeredAddressLine1: getOptionalString(
          req.body.registeredAddressLine1,
        ),
        registeredAddressLine2: getOptionalString(
          req.body.registeredAddressLine2,
        ),
        registeredTownCity: getOptionalString(req.body.registeredTownCity),
        registeredCounty: getOptionalString(req.body.registeredCounty),
        registeredPostcode: getOptionalString(req.body.registeredPostcode),
        registeredCountry:
          getOptionalString(req.body.registeredCountry) || "United Kingdom",

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
        howDidYouHear: getOptionalString(req.body.howDidYouHear),

        authorisedToCreateAccount: getBoolean(
          req.body.authorisedToCreateAccount,
        ),
        acceptedTerms: getBoolean(req.body.acceptedTerms),
        acceptedPrivacy: getBoolean(req.body.acceptedPrivacy),

        adminCreated: true,
        internalNote: getOptionalString(req.body.internalNote),

        tradeAccount:
          accountTypeValue === AccountType.TRADE
            ? {
                create: {
                  companyName: companyName || name,
                  tradingName: getOptionalString(req.body.tradingName),
                  companyRegistrationNumber: getOptionalString(
                    req.body.companyRegistrationNumber,
                  ),
                  vatNumber: getOptionalString(req.body.vatNumber),
                  registeredAddressLine1: getOptionalString(
                    req.body.registeredAddressLine1,
                  ),
                  registeredAddressLine2: getOptionalString(
                    req.body.registeredAddressLine2,
                  ),
                  registeredTownCity: getOptionalString(
                    req.body.registeredTownCity,
                  ),
                  registeredCounty: getOptionalString(
                    req.body.registeredCounty,
                  ),
                  registeredPostcode: getOptionalString(
                    req.body.registeredPostcode,
                  ),
                  registeredCountry:
                    getOptionalString(req.body.registeredCountry) ||
                    "United Kingdom",
                  tradingAddressDifferent: getBoolean(
                    req.body.tradingAddressDifferent,
                  ),
                  tradingAddressLine1: getOptionalString(
                    req.body.tradingAddressLine1,
                  ),
                  tradingAddressLine2: getOptionalString(
                    req.body.tradingAddressLine2,
                  ),
                  tradingTownCity: getOptionalString(
                    req.body.tradingTownCity,
                  ),
                  tradingCounty: getOptionalString(
                    req.body.tradingCounty,
                  ),
                  tradingPostcode: getOptionalString(
                    req.body.tradingPostcode,
                  ),
                  tradingCountry: getOptionalString(
                    req.body.tradingCountry,
                  ),
                  accountsContactName:
                    getOptionalString(req.body.mainContactName) || name,
                  accountsEmail,
                  accountsPhone: phone,
                  primaryFirstName: firstName || null,
                  primaryLastName: lastName || null,
                  primaryEmail: email,
                  primaryMobile: phone,
                },
              }
            : undefined,
      },
      select: customerSelect(),
    });

    res.status(201).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Admin customer creation error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A customer record already uses one of these unique values.",
      });
    }

    res.status(500).json({
      error: "Unable to create customer account.",
    });
  }
});

router.get("/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const customer = await prisma.user.findUnique({
      where: {
        id: req.params.id,
      },
      select: {
        ...customerSelect(),
        notes: {
          orderBy: {
            createdAt: "desc",
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
        quotes: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        bookings: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          include: {
            vehicle: true,
            driver: true,
          },
        },
        invoices: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        savedRoutes: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        error: "Customer account not found.",
      });
    }

    res.json({
      customer,
    });
  } catch (error) {
    console.error("Admin customer detail error:", error);

    res.status(500).json({
      error: "Unable to load customer account.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const existingCustomer = await prisma.user.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        tradeAccount: true,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        error: "Customer account not found.",
      });
    }

    const accountTypeValue = getString(req.body.accountType).toUpperCase();
    const accountStatusValue = getString(req.body.accountStatus).toUpperCase();

    if (accountTypeValue && !isAccountType(accountTypeValue)) {
      return res.status(400).json({
        error: "Invalid account type.",
      });
    }

    if (accountStatusValue && !isAccountStatus(accountStatusValue)) {
      return res.status(400).json({
        error: "Invalid account status.",
      });
    }

    const updatedCustomer = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: {
        accountType: accountTypeValue
          ? (accountTypeValue as AccountType)
          : undefined,
        accountStatus: accountStatusValue
          ? (accountStatusValue as AccountStatus)
          : undefined,
        companyName:
          req.body.companyName !== undefined
            ? getOptionalString(req.body.companyName)
            : undefined,
        name:
          req.body.name !== undefined
            ? getString(req.body.name)
            : undefined,
        email:
          req.body.email !== undefined
            ? getString(req.body.email).toLowerCase()
            : undefined,
        username:
          req.body.username !== undefined
            ? getOptionalString(req.body.username)?.toLowerCase() || null
            : undefined,
        phone:
          req.body.phone !== undefined
            ? getOptionalString(req.body.phone)
            : undefined,
        legalEntity:
          req.body.legalEntity !== undefined
            ? getOptionalString(req.body.legalEntity)
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
        businessType:
          req.body.businessType !== undefined
            ? getOptionalString(req.body.businessType)
            : undefined,
        industry:
          req.body.industry !== undefined
            ? getOptionalString(req.body.industry)
            : undefined,
        companyWebsite:
          req.body.companyWebsite !== undefined
            ? getOptionalString(req.body.companyWebsite)
            : undefined,
        firstName:
          req.body.firstName !== undefined
            ? getOptionalString(req.body.firstName)
            : undefined,
        lastName:
          req.body.lastName !== undefined
            ? getOptionalString(req.body.lastName)
            : undefined,
        jobTitle:
          req.body.jobTitle !== undefined
            ? getOptionalString(req.body.jobTitle)
            : undefined,
        accountsEmail:
          req.body.accountsEmail !== undefined
            ? getOptionalString(req.body.accountsEmail)?.toLowerCase() || null
            : undefined,
        alternativeContactNumber:
          req.body.alternativeContactNumber !== undefined
            ? getOptionalString(req.body.alternativeContactNumber)
            : undefined,
        mainContactName:
          req.body.mainContactName !== undefined
            ? getOptionalString(req.body.mainContactName)
            : undefined,
        registeredAddressLine1:
          req.body.registeredAddressLine1 !== undefined
            ? getOptionalString(req.body.registeredAddressLine1)
            : undefined,
        registeredAddressLine2:
          req.body.registeredAddressLine2 !== undefined
            ? getOptionalString(req.body.registeredAddressLine2)
            : undefined,
        registeredTownCity:
          req.body.registeredTownCity !== undefined
            ? getOptionalString(req.body.registeredTownCity)
            : undefined,
        registeredCounty:
          req.body.registeredCounty !== undefined
            ? getOptionalString(req.body.registeredCounty)
            : undefined,
        registeredPostcode:
          req.body.registeredPostcode !== undefined
            ? getOptionalString(req.body.registeredPostcode)
            : undefined,
        registeredCountry:
          req.body.registeredCountry !== undefined
            ? getOptionalString(req.body.registeredCountry)
            : undefined,
        tradingAddressDifferent:
          req.body.tradingAddressDifferent !== undefined
            ? getBoolean(req.body.tradingAddressDifferent)
            : undefined,
        tradingAddressLine1:
          req.body.tradingAddressLine1 !== undefined
            ? getOptionalString(req.body.tradingAddressLine1)
            : undefined,
        tradingAddressLine2:
          req.body.tradingAddressLine2 !== undefined
            ? getOptionalString(req.body.tradingAddressLine2)
            : undefined,
        tradingTownCity:
          req.body.tradingTownCity !== undefined
            ? getOptionalString(req.body.tradingTownCity)
            : undefined,
        tradingCounty:
          req.body.tradingCounty !== undefined
            ? getOptionalString(req.body.tradingCounty)
            : undefined,
        tradingPostcode:
          req.body.tradingPostcode !== undefined
            ? getOptionalString(req.body.tradingPostcode)
            : undefined,
        tradingCountry:
          req.body.tradingCountry !== undefined
            ? getOptionalString(req.body.tradingCountry)
            : undefined,
        estimatedShipmentsPerMonth:
          req.body.estimatedShipmentsPerMonth !== undefined
            ? getOptionalString(req.body.estimatedShipmentsPerMonth)
            : undefined,
        typicalShipmentType:
          req.body.typicalShipmentType !== undefined
            ? getOptionalString(req.body.typicalShipmentType)
            : undefined,
        internalNote:
          req.body.internalNote !== undefined
            ? getOptionalString(req.body.internalNote)
            : undefined,
      },
      select: customerSelect(),
    });

    res.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Admin customer update error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A customer record already uses one of these unique values.",
      });
    }

    res.status(500).json({
      error: "Unable to update customer account.",
    });
  }
});

export default router;