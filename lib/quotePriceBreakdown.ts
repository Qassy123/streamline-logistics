type Price = {distanceMiles?: unknown; basePrice?: unknown; fuelSurcharge?: unknown; adminPrice?: unknown; pricingBreakdown?: unknown};
export function quotePriceBreakdown(price: Price | null | undefined) {
  const number=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
  const saved=price?.pricingBreakdown;
  const snapshot=saved&&typeof saved==="object"&&!Array.isArray(saved)?saved as Record<string,unknown>:null;
  const baseFare=number(snapshot?.baseFare??price?.basePrice);
  // Existing quotes keep their stored presentation. Newly priced quotes use their saved rate snapshot.
  const mileagePrice=number(snapshot?.mileagePrice??price?.fuelSurcharge);
  return {baseFare,mileagePrice,mileageRate:snapshot?number(snapshot.mileageRate):number(price?.distanceMiles)>0?mileagePrice/number(price?.distanceMiles):0,extraStopsPrice:snapshot?number(snapshot.extraStopsPrice):Math.max(0,number(price?.adminPrice)-baseFare-mileagePrice)};
}
