export type BookingSection="CURRENT"|"FUTURE"|"COMPLETED"|"CLOSED";
type Booking={status:string;collectionDate:string;collectionWindow:string;estimatedStartTime?:string|null};
function ukParts(now:Date){return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).reduce((parts,item)=>({...parts,[item.type]:item.value}),{} as Record<string,string>);}
export function bookingSection(booking:Booking,now=new Date()):BookingSection{
 if(booking.status==="COMPLETED")return "COMPLETED";
 if(["CANCELLED","EXPIRED"].includes(booking.status))return "CLOSED";
 if(booking.status==="IN_PROGRESS")return "CURRENT";
 if(booking.estimatedStartTime&&Number.isFinite(+new Date(booking.estimatedStartTime)))return +new Date(booking.estimatedStartTime)>+now?"FUTURE":"CURRENT";
 const p=ukParts(now),today=`${p.year}-${p.month}-${p.day}`,day=booking.collectionDate.slice(0,10),time=booking.collectionWindow.split("-")[0];
 return day>today||day===today&&time>`${p.hour}:${p.minute}`?"FUTURE":"CURRENT";
}
