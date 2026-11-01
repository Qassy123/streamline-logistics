import type { Prisma } from "@prisma/client";
export function bookingSectionWhere(section:string,now=new Date()):Prisma.BookingWhereInput {
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).reduce((p,v)=>({...p,[v.type]:v.value}),{} as Record<string,string>);
 const day=new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`),next=new Date(+day+86400000);
 const future:Prisma.BookingWhereInput={OR:[{estimatedStartTime:{gt:now}},{estimatedStartTime:null,OR:[{collectionDate:{gte:next}},{collectionDate:{gte:day,lt:next},collectionWindow:{gt:`${parts.hour}:${parts.minute}~`}}]}]};
 if(section==="COMPLETED")return {status:"COMPLETED"};
 if(section==="FUTURE")return {status:{in:["CONFIRMED","ASSIGNED","PENDING_PAYMENT"]},AND:[future]};
 if(section==="CURRENT")return {OR:[{status:"IN_PROGRESS"},{status:{in:["CONFIRMED","ASSIGNED","PENDING_PAYMENT"]},NOT:future}]};
 return {};
}
