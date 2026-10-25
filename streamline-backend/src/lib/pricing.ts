import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
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

/** Every live quote reads the saved tariff. Additional charges are manual. */
export async function calculateQuotePrice(input: QuotePricingInput) {
  const aliases: Record<string,string[]> = {
    "Small Van": ["Small Van"], "SWB Van": ["SWB Van"],
    "LWB High Roof Van": ["LWB High Roof Van", "LWB Van"],
    "XLWB High Roof Van": ["XLWB High Roof Van", "XLWB High Roof"],
    "Luton Tail Lift Van": ["Luton Tail Lift Van", "Luton Tail Lift", "Luton Tail Lift Curtainsider"],
  };
  const names=Object.values(aliases).find(values=>values.includes(input.vehicleSize))||[input.vehicleSize];
  const tariff=await prisma.tariff.findFirst({
    where:{active:true,vehicleType:{in:names}},
    orderBy:[{updatedAt:"desc"},{id:"asc"}],
    include:{mileageBands:{orderBy:[{minimumMiles:"desc"},{id:"asc"}]}},
  });
  if(!tariff)throw new Error(`No active tariff is configured for ${input.vehicleSize}. Update Pricing / Tariff before calculating a quote.`);
  const distanceMiles=Number(input.distanceMiles);
  if(input.distanceMiles==null||!Number.isFinite(distanceMiles)||distanceMiles<0)throw new Error("A valid route distance is required to calculate the quote.");
  const distance=new Prisma.Decimal(distanceMiles).toDecimalPlaces(1);
  const band=tariff.mileageBands.find(row=>distance.greaterThanOrEqualTo(row.minimumMiles)&&(row.maximumMiles===null||distance.lessThanOrEqualTo(row.maximumMiles)));
  if(!band)throw new Error(`No mileage band covers ${distance.toString()} miles for ${tariff.vehicleType}. Update Mileage in Pricing / Tariff.`);
  if(tariff.baseFare.lessThan(0)||band.ratePerMile.lessThan(0))throw new Error("The saved tariff contains an invalid negative price.");
  const settings=await prisma.companySettings.findFirst({orderBy:{createdAt:"asc"},select:{vatRate:true}});
  const vatPercent=tariff.vatApplicable?new Prisma.Decimal(settings?.vatRate??20):new Prisma.Decimal(0);
  if(vatPercent.lessThan(0)||vatPercent.greaterThan(100))throw new Error("The saved VAT rate is invalid.");
  const base=tariff.baseFare.toDecimalPlaces(2),mileage=distance.mul(band.ratePerMile).toDecimalPlaces(2);
  const extraDropCount=input.extraDropCount??0;
  if(!Number.isInteger(extraDropCount)||extraDropCount<0||extraDropCount>100)throw new Error("Enter a valid extra stop count.");
  const stopCharge=extraDropCount?await prisma.tariffCharge.findFirst({where:{tariffId:null,type:"STOP",active:true},orderBy:[{updatedAt:"desc"},{id:"asc"}]}):null;
  if(extraDropCount&&(!stopCharge||stopCharge.calculation!=="PER_STOP"))throw new Error("Configure an active per-stop charge in Pricing / Tariff.");
  const stopRate=stopCharge?.amount??new Prisma.Decimal(0),stops=stopRate.mul(extraDropCount).toDecimalPlaces(2);
  if(stopRate.lessThan(0))throw new Error("The saved stop price cannot be negative.");
  const net=base.add(mileage).add(stops);
  const taxable=base.add(mileage).mul(vatPercent).div(100).add(stopCharge?.vatApplicable?stops.mul(new Prisma.Decimal(settings?.vatRate??20)).div(100):0);
  const vat=taxable.toDecimalPlaces(2);
  // Route distance already includes all legs; additional charges other than saved extra stops stay manual.
  return {distanceMiles:distance.toNumber(),basePrice:base.toNumber(),fuelSurcharge:0,adminPrice:net.toNumber(),vatAmount:vat.toNumber(),totalPrice:net.add(vat).toNumber(),pricingBreakdown:{tariffId:tariff.id,baseFare:base.toNumber(),mileageRate:band.ratePerMile.toNumber(),mileagePrice:mileage.toNumber(),extraDropCount,extraStopRate:stopRate.toNumber(),extraStopsPrice:stops.toNumber()}};
}
