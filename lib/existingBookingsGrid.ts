import {calendarInterval} from "./bookingCalendar";
import {dispatchCategory} from "./dispatchCategories";
export const confirmedGridStatuses=["CONFIRMED","ASSIGNED","IN_PROGRESS"] as const;
type Vehicle={id:string;name:string;vehicleType:string;registration?:string|null};
type Booking={id:string;status:string;collectionDate:string;collectionWindow:string;commercialContractShift?:{id:string}|null;estimatedStartTime?:string|null;estimatedEndTime?:string|null;vehicleAvailableAt?:string|null;vehicleId?:string|null;vehicleType?:string|null;vehicle?:Vehicle|null;quote?:{vehicleSize?:string|null}|null;reservation?:{vehicleId?:string|null;status?:string|null;expiresAt?:string|null;reservedUntil?:string|null}|null};
export type GridRow<T,V>={id:string;label:string;vehicle:V|null;items:{booking:T;lane:number;assignment:"assigned"|"reserved"|"unassigned";timed:boolean}[];lanes:number};
export function existingBookingsGrid<T extends Booking,V extends Vehicle>(bookings:T[],vehicles:V[],day:string,now=new Date()):GridRow<T,V>[] {
 const rows=new Map<string,GridRow<T,V>>(vehicles.map(vehicle=>[vehicle.id,{id:vehicle.id,label:vehicle.name,vehicle,items:[],lanes:1}]));
 const unique=[...new Map(bookings.map(booking=>[booking.id,booking])).values()].filter(b=>(confirmedGridStatuses as readonly string[]).includes(b.status));
 for(const booking of unique){
  const interval=calendarInterval(booking,day);if(!interval&&booking.collectionDate.slice(0,10)!==day)continue;
  const actual=booking.vehicle?.id||booking.vehicleId||null,reservation=booking.reservation;
  const hold=reservation&&["ACTIVE","CONFIRMED"].includes(reservation.status||"")&&!(reservation.status==="ACTIVE"&&reservation.expiresAt&&Date.parse(reservation.expiresAt)<=+now)?reservation.vehicleId:null;
  if(booking.commercialContractShift&&!booking.estimatedStartTime){
   const key="contract-untimed";
   let untimed=rows.get(key);
   if(!untimed){untimed={id:key,label:"Time to be confirmed",vehicle:null,items:[],lanes:1};rows.set(key,untimed);}
   untimed.items.push({booking,lane:0,assignment:"unassigned",timed:false});
   continue;
  }
  const id=actual||hold;let row=id?rows.get(id):undefined;
  if(!row){const category=dispatchCategory(booking),key=`unassigned:${category}`;row=rows.get(key);if(!row){row={id:key,label:`Awaiting assignment - ${category}`,vehicle:null,items:[],lanes:1};rows.set(key,row);}}
  row.items.push({booking,lane:0,assignment:row.vehicle?(actual?"assigned":"reserved"):"unassigned",timed:Boolean(interval)});
 }
 for(const row of rows.values()){
  row.items.sort((a,b)=>(calendarInterval(a.booking,day)?.start??0)-(calendarInterval(b.booking,day)?.start??0)||a.booking.id.localeCompare(b.booking.id));
  const ends:number[]=[];
  for(const item of row.items){const interval=calendarInterval(item.booking,day)||{start:0,end:1440};let lane=ends.findIndex(end=>end<=interval.start);if(lane<0)lane=ends.length;ends[lane]=interval.end;item.lane=lane;}
  row.lanes=Math.max(1,ends.length);
 }
 return [...rows.values()];
}
