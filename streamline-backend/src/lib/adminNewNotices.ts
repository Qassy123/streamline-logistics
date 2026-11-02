import {prisma} from "./prisma";
export async function newNotices(kind:"CUSTOMER"|"BOOKING") {
 const rows=kind==="CUSTOMER"?await prisma.$queryRaw<{id:string;label:string;reference:string;href:string}[]>`SELECT n.id,coalesce(u."companyName",u.name) label,u."accountNumber" reference,'/admin/customers/'||u.id href FROM "AdminNewNotice" n JOIN "User" u ON u.id=n.id WHERE n.kind='CUSTOMER' AND n."checkedAt" IS NULL ORDER BY n."createdAt" DESC`:await prisma.$queryRaw<{id:string;label:string;reference:string;href:string}[]>`SELECT n.id,coalesce(u."companyName",u.name,q."companyName",q."customerName",'Guest') label,b.reference,'/admin/bookings?booking='||b.id href FROM "AdminNewNotice" n JOIN "Booking" b ON b.id=n.id LEFT JOIN "User" u ON u.id=b."userId" LEFT JOIN "Quote" q ON q.id=b."quoteId" WHERE n.kind='BOOKING' AND n."checkedAt" IS NULL ORDER BY n."createdAt" DESC`;
 return rows;
}
export async function checkNewNotice(kind:"CUSTOMER"|"BOOKING",id:string){await prisma.$executeRaw`UPDATE "AdminNewNotice" SET "checkedAt"=now() WHERE kind=${kind} AND id=${id} AND "checkedAt" IS NULL`;}
