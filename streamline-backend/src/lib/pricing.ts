type QuotePricingInput = {
  deliveryType: string;
  vehicleSize: string;
};

const estimatedMilesByService: Record<string, number> = {
  "Same Day": 50,
  "Full Day Booking": 150,
  "Half Day Booking": 75,
  "Multi Drop": 90,
  "Full Load": 120,
};

const pricePerMileByVehicle: Record<string, number> = {
  "Small Van": 1.2,
  "SWB Van": 1.35,
  "LWB Van": 1.55,
  "XLWB High Roof": 1.8,
  "Luton Tail Lift": 2.1,
  "Curtainsider": 2.6,
};

const serviceMultiplier: Record<string, number> = {
  "Same Day": 1.25,
  "Full Day Booking": 1,
  "Half Day Booking": 1,
  "Multi Drop": 1.35,
  "Full Load": 1.45,
};

export function calculateQuotePrice(input: QuotePricingInput) {
  const distanceMiles = estimatedMilesByService[input.deliveryType] ?? 50;
  const pricePerMile = pricePerMileByVehicle[input.vehicleSize] ?? 1.35;
  const multiplier = serviceMultiplier[input.deliveryType] ?? 1;

  const basePrice = Math.round(distanceMiles * pricePerMile * multiplier);
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