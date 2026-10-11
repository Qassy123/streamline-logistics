import PDFDocument from "pdfkit";
import { v2 as cloudinary } from "cloudinary";
import { DriverPortalError } from "./driverPortal";

type Evidence={recipientName:string|null;signatureUrl:string|null;photoUrls:string[];notes:string|null;goodsCondition?:string|null;damageNotes?:string|null;outcome:string;reviewStatus:string;exceptionReason:string|null;reviewNotes:string|null;capturedAt:Date|null;receivedAt:Date};
type PackBooking={reference:string;status:string;collectionDate:Date;collectionWindow:string;collectionAddress:string;deliveryAddress:string;driver:{name:string}|null;vehicle:{name:string;registration:string|null}|null;driverStops:{id:string;label:string;type:string;address:string;completedAt:Date|null;evidence:Evidence|null}[];driverIncidents:{notes:string;photoUrls:string[];createdAt:Date;reason:string}[];pod:{recipientName:string|null;signatureUrl:string|null;photoUrl:string|null;notes:string|null;deliveredAt:Date|null}|null;evidenceUploads:{stopId:string|null;kind:string;purpose:string;createdAt:Date}[]};
const time=(d:Date|null)=>d?d.toLocaleString("en-GB",{timeZone:"Europe/London"}):"Not recorded";
async function imageBuffer(value:string){
  let source:URL;try{source=new URL(value);}catch{throw new DriverPortalError(400,"Invalid stored photo address.");}
  if(source.protocol!=="https:"||source.hostname!=="res.cloudinary.com"||source.username||source.password||!source.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/image/`))throw new DriverPortalError(400,"Evidence pack contains an unsupported photo address.");
  // PDFKit accepts JPEG/PNG. Cloudinary converts other supported formats without making them public.
  const match=source.pathname.match(/\/image\/(upload|authenticated)\/(?:v\d+\/)?(streamline-logistics\/pod\/.*)\.[a-zA-Z0-9]+$/);if(!match)throw new DriverPortalError(400,"Evidence image is outside the booking evidence folder.");
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
  // This signed transformation is fetched only by the backend and is never sent to customers.
  const link=cloudinary.url(match[2],{secure:true,resource_type:"image",type:match[1],sign_url:match[1]==="authenticated",format:"jpg",quality:"auto",width:1600,crop:"limit"});
  const response=await fetch(link,{signal:AbortSignal.timeout(12000),redirect:"error"});
  if(!response.ok)throw new Error("Storage did not return the image.");
  if(Number(response.headers.get("content-length")||0)>8*1024*1024)throw new Error("Stored image is too large.");
  const reader=response.body?.getReader();if(!reader)throw new Error("Image response was empty.");const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8*1024*1024)throw new Error("Stored image is too large.");chunks.push(part.value);}}finally{await reader.cancel();}
  return Buffer.concat(chunks);
}
export async function evidencePack(booking:PackBooking){
  const images=booking.driverStops.flatMap(stop=>stop.evidence?[...stop.evidence.photoUrls,...(stop.evidence.signatureUrl?[stop.evidence.signatureUrl]:[])]:[]).concat(booking.driverIncidents.flatMap(i=>i.photoUrls));
  if(!booking.driverStops.some(s=>s.evidence)&&booking.pod)images.push(...[booking.pod.photoUrl,booking.pod.signatureUrl].filter((s):s is string=>!!s));
  if(images.length>80)throw new DriverPortalError(409,"This booking has more than 80 images. Download its individual evidence records from the viewer.");
  const doc=new PDFDocument({size:"A4",margin:44,compress:true}),chunks:Buffer[]=[];
  const finished=new Promise<Buffer>((resolve,reject)=>{doc.on("data",b=>chunks.push(b));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  const line=(title:string,value:unknown)=>{if(doc.y>730)doc.addPage();doc.fontSize(10).fillColor("#071D49").text(`${title}: ${value??"Not recorded"}`,{width:505});doc.moveDown(0.4);};
  doc.fontSize(20).fillColor("#071D49").text("Streamline Logistics");doc.fontSize(15).text("Delivery evidence pack");doc.moveDown();
  line("Booking",booking.reference);line("Status",booking.status);line("Generated",time(new Date()));line("Collection",`${booking.collectionDate.toISOString().slice(0,10)} / ${booking.collectionWindow}`);line("Collection address",booking.collectionAddress);line("Delivery address",booking.deliveryAddress);line("Driver",booking.driver?.name);line("Vehicle",`${booking.vehicle?.name||"Not recorded"} / ${booking.vehicle?.registration||"Not recorded"}`);
  let totalBytes=0;
  async function picture(url:string,label:string){
    doc.addPage();doc.fontSize(12).text(label);doc.moveDown();
    try{const bytes=await imageBuffer(url);totalBytes+=bytes.length;if(totalBytes>32*1024*1024)throw new DriverPortalError(409,"Evidence pack exceeds 32 MB. Download photos individually from the viewer.");doc.image(bytes,44,doc.y,{fit:[505,620],align:"center"});}
    catch(e){if(e instanceof DriverPortalError&&e.status===409)throw e;line("Image unavailable", "Open this photo in the authenticated evidence viewer. The stored record is retained.");}
  }
  try{
    for(const stop of booking.driverStops){doc.addPage();doc.fontSize(16).text(`${stop.label} - ${stop.type}`);line("Address",stop.address);line("Completed",time(stop.completedAt));const ev=stop.evidence;if(!ev){line("Evidence","No stop evidence recorded (historic records remain unchanged).");continue;}line("Captured",time(ev.capturedAt));line("Received",time(ev.receivedAt));line("Recipient",ev.recipientName);line("Outcome",ev.outcome);line("Goods condition",ev.goodsCondition);line("Damage",ev.damageNotes);line("Notes",ev.notes);line("Exception",ev.exceptionReason);line("Review",ev.reviewStatus);line("Dispatch review",ev.reviewNotes);
      for(const upload of booking.evidenceUploads.filter(u=>u.stopId===stop.id))line(`${upload.purpose} ${upload.kind} uploaded`,time(upload.createdAt));
      for(const [i,url] of ev.photoUrls.entries())await picture(url,`${booking.reference}: ${stop.label} photo ${i+1}`);if(ev.signatureUrl)await picture(ev.signatureUrl,`${booking.reference}: ${stop.label} recipient signature`);
    }
    for(const incident of booking.driverIncidents){doc.addPage();line("Incident",incident.reason);line("Recorded",time(incident.createdAt));line("Details",incident.notes);for(const [i,url]of incident.photoUrls.entries())await picture(url,`Incident photo ${i+1}`);}
    if(booking.pod){doc.addPage();line("Historic / booking POD recipient",booking.pod.recipientName);line("Delivered",time(booking.pod.deliveredAt));line("POD notes",booking.pod.notes);if(!booking.driverStops.some(s=>s.evidence)){if(booking.pod.photoUrl)await picture(booking.pod.photoUrl,"Historic POD photo");if(booking.pod.signatureUrl)await picture(booking.pod.signatureUrl,"Historic POD signature");}}
    doc.end();return await finished;
  }catch(e){doc.destroy();void finished.catch(()=>undefined);throw e;}
}
