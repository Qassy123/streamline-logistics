type QuotePricingInput = {
  deliveryType: string;
  vehicleSize: string;
  distanceMiles?: number | null;
};

const fallbackMilesByService: Record<string, number> = {
  "Same Day Delivery (One Way, Return, Multi Drop)": 50,
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

function getDistanceMiles(input: QuotePricingInput) {
  if (input.distanceMiles && input.distanceMiles > 0) {
    return Number(input.distanceMiles.toFixed(1));
  }

  return fallbackMilesByService[input.deliveryType] ?? 50;
}

export function calculateQuotePrice(input: QuotePricingInput) {
  const distanceMiles = getDistanceMiles(input);
  const pricePerMile = pricePerMileByVehicle[input.vehicleSize] ?? 1.35;
  const multiplier = serviceMultiplier[input.deliveryType] ?? 1;
  const minimumBasePrice = minimumBasePriceByVehicle[input.vehicleSize] ?? 75;

  const mileagePrice = distanceMiles * pricePerMile * multiplier;
  const basePrice = Math.max(Math.round(mileagePrice), minimumBasePrice);

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