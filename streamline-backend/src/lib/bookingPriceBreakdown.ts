type Quote={pricingBreakdown?:unknown;basePrice?:unknown;fuelSurcharge?:unknown;adminPrice?:unknown;distanceMiles?:unknown;discountAmount?:unknown;vatAmount?:unknown;totalPrice?:unknown};
export function bookingPriceBreakdown(booking:{totalPrice:unknown;quote?:Quote|null}){
 const n=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0,round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
 const q=booking.quote,s=q?.pricingBreakdown,details=s&&typeof s==="object"&&!Array.isArray(s)?s as Record<string,unknown>:null;
 const total=round(n(booking.totalPrice)),quotedTotal=n(q?.totalPrice),quotedVat=n(q?.vatAmount);
 const taxRatio=quotedTotal-quotedVat>0?quotedVat/(quotedTotal-quotedVat):0.2;
 const subtotal=round(total/(1+taxRatio)),vat=round(total-subtotal),discount=n(q?.discountAmount);
 const base=n(details?.baseFare??q?.basePrice),mileage=n(details?.mileagePrice??q?.fuelSurcharge),stops=n(details?.extraStopsPrice??Math.max(0,n(q?.adminPrice)-base-mileage));
 const adjustment=round(subtotal-base-mileage-stops+discount);
 return {base,mileage,stops,miles:n(q?.distanceMiles),mileageRate:n(details?.mileageRate??(n(q?.distanceMiles)>0?mileage/n(q?.distanceMiles):0)),stopRate:n(details?.extraStopRate),stopCount:n(details?.extraDropCount),discount,adjustment,subtotal,vat,total,vatRate:round(taxRatio*100),known:Boolean(q)};
}
