type QuotePricingInput = {
  deliveryType: string;
  vehicleSize: string;
};

const basePrices: Record<string, number> = {
  "Same Day": 85,
  "Full Day Booking": 350,
  "Half Day Booking": 220,
  "Multi Drop": 120,
  "Full Load": 450,
};

const vehicleMultipliers: Record<string, number> = {
  "Small Van": 1,
  "SWB Van": 1.15,
  "LWB Van": 1.35,
  "XLWB High Roof": 1.55,
  "Luton Tail Lift": 1.9,
  "Curtainsider": 2.4,
};

export function calculateQuotePrice(input: QuotePricingInput) {
  const basePrice = basePrices[input.deliveryType] ?? 100;
  const vehicleMultiplier = vehicleMultipliers[input.vehicleSize] ?? 1;

  const adminPrice = Math.round(basePrice * vehicleMultiplier);
  const vatAmount = Math.round(adminPrice * 0.2);
  const totalPrice = adminPrice + vatAmount;

  return {
    adminPrice,
    vatAmount,
    totalPrice,
  };
}