import {prisma} from "./prisma";
export async function resolveBookingReference(reference:string){if(/^SL#[0-9]+$/.test(reference))return reference;const rows=await prisma.$queryRaw<{new:string}[]>`SELECT new FROM "November2ReferenceMap" WHERE kind='BOOKING' AND old=${reference} LIMIT 1`;return rows[0]?.new||reference;}
