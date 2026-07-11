export type QuotePricingInput = {
  deliveryType: string;
  journeyType?: string | null;
  vehicleSize: string;
  distanceMiles?: number | null;
  extraDropCount?: number;
};

export type PricingConfig = {
  fallbackMilesByService: Record<string, number>;
  pricePerMileByVehicle: Record<string, number>;
  serviceMultiplier: Record<string, number>;
  minimumBasePriceByVehicle: Record<string, number>;
  extraDropFeeByVehicle: Record<string, number>;
  returnJourneyMultiplier: number;
  fuelSurchargeRate: number;
  vatRate: number;
  defaultFallbackMiles: number;
  defaultPricePerMile: number;
  defaultMinimumBasePrice: number;
  defaultExtraDropFee: number;
};

export const pricingConfig: PricingConfig = {
  fallbackMilesByService: {
    "Same Day Delivery (One Way, Return, Multi Drop)": 50,
    "Next Day Delivery (One Way, Return, Multi Drop)": 50,
    "Full Day Booking": 150,
    "Half Day Booking": 75,
    "Full Load (One Way, Return, Multi Drop)": 120,
  },

  pricePerMileByVehicle: {
    "Small Van": 1.2,
    "SWB Van": 1.35,
    "LWB Van": 1.55,
    "LWB High Roof Van": 1.55,
    "XLWB High Roof": 1.8,
    "Luton Tail Lift": 2.1,
    "Luton Tail Lift Curtainsider": 2.1,
    Curtainsider: 2.6,
  },

  serviceMultiplier: {
    "Same Day Delivery (One Way, Return, Multi Drop)": 1.25,
    "Next Day Delivery (One Way, Return, Multi Drop)": 1.15,
    "Full Day Booking": 1,
    "Half Day Booking": 1,
    "Full Load (One Way, Return, Multi Drop)": 1.45,
  },

  minimumBasePriceByVehicle: {
    "Small Van": 60,
    "SWB Van": 75,
    "LWB Van": 90,
    "LWB High Roof Van": 90,
    "XLWB High Roof": 110,
    "Luton Tail Lift": 130,
    "Luton Tail Lift Curtainsider": 130,
    Curtainsider: 180,
  },

  extraDropFeeByVehicle: {
    "Small Van": 10,
    "SWB Van": 10,
    "LWB Van": 10,
    "LWB High Roof Van": 10,
    "XLWB High Roof": 15,
    "Luton Tail Lift": 20,
    "Luton Tail Lift Curtainsider": 20,
    Curtainsider: 25,
  },

  returnJourneyMultiplier: 1.9,
  fuelSurchargeRate: 0.08,
  vatRate: 0.2,
  defaultFallbackMiles: 50,
  defaultPricePerMile: 1.35,
  defaultMinimumBasePrice: 75,
  defaultExtraDropFee: 10,
};

function getDistanceMiles(input: QuotePricingInput, config: PricingConfig) {
  if (input.distanceMiles && input.distanceMiles > 0) {
    return Number(input.distanceMiles.toFixed(1));
  }

  return (
    config.fallbackMilesByService[input.deliveryType] ??
    config.defaultFallbackMiles
  );
}

function getJourneyMultiplier(
  input: QuotePricingInput,
  config: PricingConfig,
) {
  if (input.journeyType === "Return") {
    return config.returnJourneyMultiplier;
  }

  return 1;
}

function getExtraDropFee(
  input: QuotePricingInput,
  config: PricingConfig,
) {
  const extraDropCount = input.extraDropCount ?? 0;

  if (extraDropCount <= 0) {
    return 0;
  }

  const feePerDrop =
    config.extraDropFeeByVehicle[input.vehicleSize] ??
    config.defaultExtraDropFee;

  return extraDropCount * feePerDrop;
}

export function calculateQuotePriceWithConfig(
  input: QuotePricingInput,
  config: PricingConfig,
) {
  const distanceMiles = getDistanceMiles(input, config);
  const pricePerMile =
    config.pricePerMileByVehicle[input.vehicleSize] ??
    config.defaultPricePerMile;
  const serviceRateMultiplier =
    config.serviceMultiplier[input.deliveryType] ?? 1;
  const journeyMultiplier = getJourneyMultiplier(input, config);
  const minimumBasePrice =
    config.minimumBasePriceByVehicle[input.vehicleSize] ??
    config.defaultMinimumBasePrice;
  const extraDropPrice = getExtraDropFee(input, config);

  const mileagePrice =
    distanceMiles *
    pricePerMile *
    serviceRateMultiplier *
    journeyMultiplier;

  const basePrice =
    Math.max(Math.round(mileagePrice), minimumBasePrice) + extraDropPrice;

  const fuelSurcharge = Math.round(
    basePrice * config.fuelSurchargeRate,
  );
  const adminPrice = basePrice + fuelSurcharge;
  const vatAmount = Math.round(adminPrice * config.vatRate);
  const totalPrice = adminPrice + vatAmount;

  return {
    distanceMiles,
    basePrice,
    fuelSurcharge,
    adminPrice,
    vatAmount,
    totalPrice,
  };
}

export function calculateQuotePrice(input: QuotePricingInput) {
  return calculateQuotePriceWithConfig(input, pricingConfig);
}