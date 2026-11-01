import { getReservationWindow } from "./reservationWindow";
export function assertFutureCollection(date:Date|string,window:string,now=new Date()) {
 if(!(date instanceof Date)&&typeof date!=="string")throw Object.assign(new Error("Choose a valid collection date and time."),{name:"CollectionScheduleError"});
 const day=typeof date==="string"?date.slice(0,10):date.toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-4]):[0-5]\d$/.test(window)||!Number.isFinite(+new Date(day))||new Date(day).toISOString().slice(0,10)!==day)throw Object.assign(new Error("Choose a valid collection date and time."),{name:"CollectionScheduleError"});
 const start=getReservationWindow(day,window).reservedFrom;
 if(start<=now)throw Object.assign(new Error("This collection time has passed. Select a future collection date and time."),{name:"CollectionScheduleError"});
 return start;
}
