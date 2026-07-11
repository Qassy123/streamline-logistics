import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

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

function normalisePositiveInteger(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a whole number of zero or more.`);
  }

  return parsed;
}

function normaliseDecimal(
  value: unknown,
  fieldName: string,
): Prisma.Decimal | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid number of zero or more.`);
  }

  return new Prisma.Decimal(parsed);
}

const settingsSelect = {
  id: true,
  companyName: true,
  companyAddress: true,
  telephone: true,
  email: true,
  website: true,
  companyRegistrationNumber: true,
  vatNumber: true,
  bankName: true,
  bankAccountName: true,
  sortCode: true,
  accountNumber: true,
  invoicePrefix: true,
  nextInvoiceNumber: true,
  paymentTermsDays: true,
  vatRate: true,
  currency: true,
  footerMessage: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySettingsSelect;

async function getOrCreateSettings() {
  const existing = await prisma.companySettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: settingsSelect,
  });

  if (existing) {
    return existing;
  }

  return prisma.companySettings.create({
    data: {
      companyName: "Streamline Logistics Group",
      invoicePrefix: "INV",
      nextInvoiceNumber: 1,
      paymentTermsDays: 30,
      vatRate: new Prisma.Decimal(20),
      currency: "GBP",
    },
    select: settingsSelect,
  });
}

router.get("/", async (_request, response) => {
  try {
    const settings = await getOrCreateSettings();

    response.json({
      success: true,
      settings: {
        ...settings,
        vatRate: settings.vatRate.toString(),
      },
      environment: {
        cloudinaryConfigured: Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET,
        ),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        adminKeyConfigured: Boolean(process.env.ADMIN_API_KEY),
        databaseConfigured: Boolean(process.env.DATABASE_URL),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/settings failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load company settings.",
    });
  }
});

router.patch("/", async (request, response) => {
  try {
    const existing = await getOrCreateSettings();

    const companyName =
      request.body.companyName !== undefined
        ? normaliseString(request.body.companyName)
        : undefined;

    if (request.body.companyName !== undefined && !companyName) {
      response.status(400).json({
        success: false,
        message: "Company name is required.",
      });
      return;
    }

    const invoicePrefix =
      request.body.invoicePrefix !== undefined
        ? normaliseString(request.body.invoicePrefix)?.toUpperCase()
        : undefined;

    if (request.body.invoicePrefix !== undefined && !invoicePrefix) {
      response.status(400).json({
        success: false,
        message: "Invoice prefix is required.",
      });
      return;
    }

    const currency =
      request.body.currency !== undefined
        ? normaliseString(request.body.currency)?.toUpperCase()
        : undefined;

    if (currency && currency.length !== 3) {
      response.status(400).json({
        success: false,
        message: "Currency must be a three-letter code such as GBP.",
      });
      return;
    }

    const nextInvoiceNumber = normalisePositiveInteger(
      request.body.nextInvoiceNumber,
      "Next invoice number",
    );
    const paymentTermsDays = normalisePositiveInteger(
      request.body.paymentTermsDays,
      "Payment terms",
    );
    const vatRate = normaliseDecimal(request.body.vatRate, "VAT rate");

    const updated = await prisma.companySettings.update({
      where: { id: existing.id },
      data: {
        companyName,
        companyAddress: normaliseNullableString(request.body.companyAddress),
        telephone: normaliseNullableString(request.body.telephone),
        email: normaliseNullableString(request.body.email),
        website: normaliseNullableString(request.body.website),
        companyRegistrationNumber: normaliseNullableString(
          request.body.companyRegistrationNumber,
        ),
        vatNumber: normaliseNullableString(request.body.vatNumber),
        bankName: normaliseNullableString(request.body.bankName),
        bankAccountName: normaliseNullableString(request.body.bankAccountName),
        sortCode: normaliseNullableString(request.body.sortCode),
        accountNumber: normaliseNullableString(request.body.accountNumber),
        invoicePrefix,
        nextInvoiceNumber,
        paymentTermsDays,
        vatRate,
        currency,
        footerMessage: normaliseNullableString(request.body.footerMessage),
        logoUrl: normaliseNullableString(request.body.logoUrl),
      },
      select: settingsSelect,
    });

    await prisma.auditLog.create({
      data: {
        action: "COMPANY_SETTINGS_UPDATED",
        entityType: "CompanySettings",
        entityId: updated.id,
        oldValue: {
          companyName: existing.companyName,
          companyAddress: existing.companyAddress,
          telephone: existing.telephone,
          email: existing.email,
          website: existing.website,
          companyRegistrationNumber: existing.companyRegistrationNumber,
          vatNumber: existing.vatNumber,
          bankName: existing.bankName,
          bankAccountName: existing.bankAccountName,
          sortCode: existing.sortCode,
          accountNumber: existing.accountNumber,
          invoicePrefix: existing.invoicePrefix,
          nextInvoiceNumber: existing.nextInvoiceNumber,
          paymentTermsDays: existing.paymentTermsDays,
          vatRate: existing.vatRate.toString(),
          currency: existing.currency,
          footerMessage: existing.footerMessage,
          logoUrl: existing.logoUrl,
        },
        newValue: {
          companyName: updated.companyName,
          companyAddress: updated.companyAddress,
          telephone: updated.telephone,
          email: updated.email,
          website: updated.website,
          companyRegistrationNumber: updated.companyRegistrationNumber,
          vatNumber: updated.vatNumber,
          bankName: updated.bankName,
          bankAccountName: updated.bankAccountName,
          sortCode: updated.sortCode,
          accountNumber: updated.accountNumber,
          invoicePrefix: updated.invoicePrefix,
          nextInvoiceNumber: updated.nextInvoiceNumber,
          paymentTermsDays: updated.paymentTermsDays,
          vatRate: updated.vatRate.toString(),
          currency: updated.currency,
          footerMessage: updated.footerMessage,
          logoUrl: updated.logoUrl,
        },
        reason: normaliseString(request.body.reason),
      },
    });

    response.json({
      success: true,
      settings: {
        ...updated,
        vatRate: updated.vatRate.toString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/settings failed", error);

    response.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update company settings.",
    });
  }
});

export default router;