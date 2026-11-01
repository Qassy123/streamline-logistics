import PDFDocument from "pdfkit";
import { prisma } from "./prisma";
import { getReservationWindow } from "./reservationWindow";
import { calculateGoogleRoute,geocodeGoogleAddress } from "./googleMaps";
import { DriverPortalError,ukDateKey } from "./driverPortal";
export const sheetTime=(v:Date|string|null)=>v?new Date(v).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):"Not recorded";
export async function sheetPdf(title:string,subtitle:string,rows:{title:string;lines:string[]}[]) {
 return new Promise<Buffer>((resolve,reject)=>{const doc=new PDFDocument({size:"A4",margin:42,info:{Title:title}}),chunks:Buffer[]=[];doc.on("data",(b:Buffer)=>chunks.push(b));doc.on("error",reject);doc.on("end",()=>resolve(Buffer.concat(chunks)));
 const heading=()=>{doc.fillColor("#071D49").font("Helvetica-Bold").fontSize(19).text("Streamline Logistics Group");doc.fontSize(15).text(title);doc.font("Helvetica").fontSize(10).fillColor("#475569").text(subtitle);doc.moveDown();};heading();
 for(const row of rows){const height=25+row.lines.reduce((n,line)=>n+doc.fontSize(10).heightOfString(line,{width:510})+5,0);if(doc.y+Math.min(height,650)>doc.page.height-55){doc.addPage();heading();}doc.font("Helvetica-Bold").fontSize(12).fillColor("#071D49").text(row.title);doc.font("Helvetica").fontSize(10).fillColor("#334155");for(const line of row.lines)doc.text(line,{paragraphGap:5});doc.moveDown();}if(!rows.length)doc.text("No records for this period.");doc.end();});
}
export function pdfResult(filename:string,buffer:Buffer){return {filename:filename.replace(/[^a-zA-Z0-9_.-]/g,"_"),mimeType:"application/pdf",base64:buffer.toString("base64")};}
export async function routeSheetData(driverId:string,date?:string){
 const day=date||ukDateKey(new Date());if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(+new Date(day))||new Date(day).toISOString().slice(0,10)!==day)throw new DriverPortalError(400,"Choose a valid route-sheet date.");
 const driver=await prisma.driver.findUnique({where:{id:driverId},select:{id:true,name:true}});if(!driver)throw new DriverPortalError(404,"Driver not found.");
 const from=new Date(day+"T00:00:00Z"),until=new Date(+from+86400000);
 const jobs=await prisma.booking.findMany({where:{driverId,archivedCustomerId:null,collectionDate:{gte:from,lt:until},status:{in:["CONFIRMED","ASSIGNED","IN_PROGRESS","COMPLETED"]}},include:{quote:true,user:{select:{companyName:true,name:true}},vehicle:{select:{name:true,registration:true}},driverStops:{orderBy:{sequence:"asc"}}},orderBy:[{estimatedStartTime:"asc"},{collectionWindow:"asc"},{id:"asc"}],take:101});
 if(jobs.length>100)throw new DriverPortalError(400,"This route sheet exceeds 100 jobs. Contact dispatch.");
 const rows=[];
 for(const job of jobs){
  let collection:Date|null=null;try{collection=job.estimatedStartTime||getReservationWindow(job.collectionDate,job.collectionWindow).reservedFrom;}catch{}
  let arrival:Date|null=null;const fallback=[job.collectionAddress,job.deliveryAddress,...(Array.isArray(job.extraDrops)?job.extraDrops.flatMap(drop=>drop&&typeof drop==="object"&&"address"in drop&&typeof drop.address==="string"?[drop.address]:[]):[]),...((job.quote?.journeyType==="Return"||job.journeyType==="Return")&&job.returnAddress?[job.returnAddress]:[])];
  const addresses=job.driverStops.length?job.driverStops.map(s=>s.address):fallback;
  try{const points=await Promise.all(addresses.map(address=>geocodeGoogleAddress(address,"Route-sheet address")));const route=await calculateGoogleRoute(points.map(p=>p.coordinates));if(collection)arrival=new Date(+collection+route.durationMinutes*60000);}catch{}
  rows.push({title:job.reference,lines:[`Customer: ${job.user?.companyName||job.quote?.companyName||job.user?.name||job.quote?.customerName||"Guest"}`,`Vehicle: ${job.vehicle?.registration||job.vehicle?.name||"Not recorded"}`,`Estimated collection: ${sheetTime(collection)}`,`Estimated arrival (final stop): ${arrival?sheetTime(arrival):"Unavailable - confirm with dispatch"}`,...addresses.map((address,index)=>`${index===0?"Collection":"Stop "+index}: ${address}`)]});
 }
 return {driver,day,rows};
}
export async function routeSheet(driverId:string,date?:string){
 const {driver,day,rows}=await routeSheetData(driverId,date);
 const pdf=await sheetPdf(`Route sheet - ${driver.name}`,`${day} | Generated ${sheetTime(new Date())}. Times are estimates; arrival excludes loading and waiting.`,rows);
 return pdfResult(`${driver.name}-${day}-route-sheet.pdf`,pdf);
}
