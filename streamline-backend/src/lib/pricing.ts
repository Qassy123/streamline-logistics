type QuotePricingInput = {
  deliveryType: string;
  journeyType?: string | null;
  vehicleSize: string;
  distanceMiles?: number | null;
  extraDropCount?: number;
};

const fallbackMilesByService: Record<string, number> = {
  "Same Day Delivery (One Way, Return, Multi Drop)": 50,
  "Next Day Delivery (One Way, Return, Multi Drop)": 50,
  "Full Day Booking": 150,
  "Half Day Booking": 75,
  "Full Load (One Way, Return, Multi Drop)": 120,
};

const pricePerMileByVehicle: Record<string, number> = {
  "Small Van": 1.2,
  "SWB Van": 1.35,
  "LWB Van": 1.55,
  "LWB High Roof Van": 1.55,
  "XLWB High Roof": 1.8,
  "Luton Tail Lift": 2.1,
  "Luton Tail Lift Curtainsider": 2.1,
  Curtainsider: 2.6,
};

const serviceMultiplier: Record<string, number> = {
  "Same Day Delivery (One Way, Return, Multi Drop)": 1.25,
  "Next Day Delivery (One Way, Return, Multi Drop)": 1.15,
  "Full Day Booking": 1,
  "Half Day Booking": 1,
  "Full Load (One Way, Return, Multi Drop)": 1.45,
};

const minimumBasePriceByVehicle: Record<string, number> = {
  "Small Van": 60,
  "SWB Van": 75,
  "LWB Van": 90,
  "LWB High Roof Van": 90,
  "XLWB High Roof": 110,
  "Luton Tail Lift": 130,
  "Luton Tail Lift Curtainsider": 130,
  Curtainsider: 180,
};

const extraDropFeeByVehicle: Record<string, number> = {
  "Small Van": 10,
  "SWB Van": 10,
  "LWB Van": 10,
  "LWB High Roof Van": 10,
  "XLWB High Roof": 15,
  "Luton Tail Lift": 20,
  "Luton Tail Lift Curtainsider": 20,
  Curtainsider: 25,
};

function getDistanceMiles(input: QuotePricingInput) {
  if (input.distanceMiles && input.distanceMiles > 0) {
    return Number(input.distanceMiles.toFixed(1));
  }

  return fallbackMilesByService[input.deliveryType] ?? 50;
}

function getJourneyMultiplier(input: QuotePricingInput) {
  if (input.journeyType === "Return") {
    return 1.9;
  }

  return 1;
}

function getExtraDropFee(input: QuotePricingInput) {
  const extraDropCount = input.extraDropCount ?? 0;

  if (extraDropCount <= 0) {
    return 0;
  }

  const feePerDrop = extraDropFeeByVehicle[input.vehicleSize] ?? 10;

  return extraDropCount * feePerDrop;
}

export function calculateQuotePrice(input: QuotePricingInput) {
  const distanceMiles = getDistanceMiles(input);
  const pricePerMile = pricePerMileByVehicle[input.vehicleSize] ?? 1.35;
  const serviceRateMultiplier = serviceMultiplier[input.deliveryType] ?? 1;
  const journeyMultiplier = getJourneyMultiplier(input);
  const minimumBasePrice = minimumBasePriceByVehicle[input.vehicleSize] ?? 75;
  const extraDropPrice = getExtraDropFee(input);

  const mileagePrice =
    distanceMiles * pricePerMile * serviceRateMultiplier * journeyMultiplier;

  const basePrice =
    Math.max(Math.round(mileagePrice), minimumBasePrice) + extraDropPrice;

  const fuelSurcharge = Math.round(basePrice * 0.08);
  const adminPrice = basePrice + fuelSurcharge;
  const vatAmount = Math.round(adminPrice * 0.2);
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