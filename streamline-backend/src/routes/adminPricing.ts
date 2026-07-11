import { Router } from "express";
import {
  calculateQuotePriceWithConfig,
  pricingConfig,
  PricingConfig,
  QuotePricingInput,
} from "../lib/pricing";

const router = Router();

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function cloneConfig(): PricingConfig {
  return JSON.parse(JSON.stringify(pricingConfig)) as PricingConfig;
}

function validateConfig(config: PricingConfig) {
  const errors: string[] = [];

  const validateRecord = (
    label: string,
    record: Record<string, number>,
    minimum = 0,
  ) => {
    Object.entries(record).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value < minimum) {
        errors.push(`${label} for "${key}" must be ${minimum} or greater.`);
      }
    });
  };

  validateRecord(
    "Fallback mileage",
    config.fallbackMilesByService,
    0,
  );
  validateRecord(
    "Price per mile",
    config.pricePerMileByVehicle,
    0,
  );
  validateRecord(
    "Service multiplier",
    config.serviceMultiplier,
    0,
  );
  validateRecord(
    "Minimum base price",
    config.minimumBasePriceByVehicle,
    0,
  );
  validateRecord(
    "Extra-drop fee",
    config.extraDropFeeByVehicle,
    0,
  );

  if (
    !Number.isFinite(config.returnJourneyMultiplier) ||
    config.returnJourneyMultiplier < 1
  ) {
    errors.push("Return journey multiplier must be 1 or greater.");
  }

  if (
    !Number.isFinite(config.fuelSurchargeRate) ||
    config.fuelSurchargeRate < 0 ||
    config.fuelSurchargeRate > 1
  ) {
    errors.push("Fuel surcharge rate must be between 0 and 1.");
  }

  if (
    !Number.isFinite(config.vatRate) ||
    config.vatRate < 0 ||
    config.vatRate > 1
  ) {
    errors.push("VAT rate must be between 0 and 1.");
  }

  return errors;
}

function normaliseRecord(
  value: unknown,
  fallback: Record<string, number>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const parsed = Number(item);
      return [key, Number.isFinite(parsed) ? parsed : fallback[key] ?? 0];
    }),
  );
}

function buildConfigFromBody(body: Record<string, unknown>): PricingConfig {
  const current = cloneConfig();

  return {
    fallbackMilesByService: normaliseRecord(
      body.fallbackMilesByService,
      current.fallbackMilesByService,
    ),
    pricePerMileByVehicle: normaliseRecord(
      body.pricePerMileByVehicle,
      current.pricePerMileByVehicle,
    ),
    serviceMultiplier: normaliseRecord(
      body.serviceMultiplier,
      current.serviceMultiplier,
    ),
    minimumBasePriceByVehicle: normaliseRecord(
      body.minimumBasePriceByVehicle,
      current.minimumBasePriceByVehicle,
    ),
    extraDropFeeByVehicle: normaliseRecord(
      body.extraDropFeeByVehicle,
      current.extraDropFeeByVehicle,
    ),
    returnJourneyMultiplier:
      getNumber(body.returnJourneyMultiplier) ??
      current.returnJourneyMultiplier,
    fuelSurchargeRate:
      getNumber(body.fuelSurchargeRate) ??
      current.fuelSurchargeRate,
    vatRate: getNumber(body.vatRate) ?? current.vatRate,
    defaultFallbackMiles:
      getNumber(body.defaultFallbackMiles) ??
      current.defaultFallbackMiles,
    defaultPricePerMile:
      getNumber(body.defaultPricePerMile) ??
      current.defaultPricePerMile,
    defaultMinimumBasePrice:
      getNumber(body.defaultMinimumBasePrice) ??
      current.defaultMinimumBasePrice,
    defaultExtraDropFee:
      getNumber(body.defaultExtraDropFee) ??
      current.defaultExtraDropFee,
  };
}

router.get("/", (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  res.json({
    config: cloneConfig(),
    vehicleTypes: Object.keys(pricingConfig.pricePerMileByVehicle),
    serviceTypes: Object.keys(pricingConfig.serviceMultiplier),
    persistence: {
      mode: "source-controlled",
      message:
        "Pricing is stored in src/lib/pricing.ts. Changes must be committed and deployed.",
    },
  });
});

router.post("/preview", (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  try {
    const input: QuotePricingInput = {
      deliveryType: getString(req.body.deliveryType),
      journeyType: getString(req.body.journeyType) || null,
      vehicleSize: getString(req.body.vehicleSize),
      distanceMiles: getNumber(req.body.distanceMiles),
      extraDropCount: getNumber(req.body.extraDropCount) ?? 0,
    };

    if (!input.deliveryType || !input.vehicleSize) {
      return res.status(400).json({
        error: "Delivery type and vehicle size are required.",
      });
    }

    const config = req.body.config
      ? buildConfigFromBody(req.body.config)
      : cloneConfig();

    const errors = validateConfig(config);

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Pricing configuration is invalid.",
        errors,
      });
    }

    res.json({
      result: calculateQuotePriceWithConfig(input, config),
    });
  } catch (error) {
    console.error("Pricing preview error:", error);

    res.status(500).json({
      error: "Unable to calculate pricing preview.",
    });
  }
});

router.post("/validate", (req, res) => {
  const admin = requireAdmin(req);

  if (!admin.authorised) {
    return res.status(admin.status).json({
      error: admin.error,
    });
  }

  const config = buildConfigFromBody(req.body || {});
  const errors = validateConfig(config);

  res.status(errors.length > 0 ? 400 : 200).json({
    valid: errors.length === 0,
    errors,
    config,
  });
});

export default router;