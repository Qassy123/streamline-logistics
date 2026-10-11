import express from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateDriver, DriverPortalError, requestId, text } from "../lib/driverPortal";
import { requireStaff } from "../lib/adminAccess";
import { dispatchRoles, staffActor } from "../lib/fleetOperations";
import { takeVehicle, returnVehicle, approveHandover, amendHandover, handoverInclude } from "../lib/vehicleHandovers";
import { evidenceLinks, storeEvidence } from "../lib/operationalEvidence";
import { evidencePack } from "../lib/evidencePack";
import { getReservationWindow } from "../lib/reservationWindow";

export const driverVehicleRecords = express.Router(), adminVehicleRecords = express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:10}});
type Handler=(req:express.Request,res:express.Response)=>Promise<unknown>;
function route(handler:Handler,admin=false):express.RequestHandler{return async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  try{
    if(admin)res.locals.actor=staffActor(await requireStaff(req,[...dispatchRoles]));
    else{const driver=await authenticateDriver(req.headers.authorization);if(!driver)throw new DriverPortalError(401,"Sign in to the driver portal.");res.locals.driver=driver;}
    await handler(req,res);
  }catch(e){if(e instanceof DriverPortalError)return void res.status(e.status).json({error:e.message});
    if(e instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2034","P2010","P2004"].includes(e.code))return void res.status(409).json({error:"This record changed. Refresh and retry with the same request identifier."});
    console.error("Vehicle/evidence record operation failed",e);res.status(500).json({error:"Unable to confirm this update. Keep your draft and retry."});
  }
};}
driverVehicleRecords.get("/",route(async(req,res)=>{
  const driver=res.locals.driver,page=pageNumber(req.query.page),where={driverId:driver.id};
  const [handovers,total,bookings,openHandover]=await Promise.all([prisma.vehicleHandover.findMany({where,include:handoverInclude,orderBy:[{takenAt:"desc"},{id:"asc"}],skip:(page-1)*25,take:25}),prisma.vehicleHandover.count({where}),prisma.booking.findMany({where:{driverId:driver.id,vehicleId:driver.vehicleId||"none",status:{in:["CONFIRMED","ASSIGNED","IN_PROGRESS"]}},select:{id:true,reference:true},orderBy:{collectionDate:"asc"},take:100}),prisma.vehicleHandover.findFirst({where:{driverId:driver.id,returnedAt:null},include:handoverInclude})]);
  res.json(evidenceLinks({handovers,openHandover,bookings,vehicle:driver.vehicle?{id:driver.vehicle.id,name:driver.vehicle.name,registration:driver.vehicle.registration,mileage:driver.vehicle.mileage}:null,page,total,pages:Math.ceil(total/25)}));
}));
driverVehicleRecords.get("/receipt/:requestId",route(async(req,res)=>{
  const handover=await prisma.vehicleHandover.findFirst({where:{driverId:res.locals.driver.id,requestId:requestId(req.params.requestId)},include:handoverInclude});
  res.json({handover:handover?evidenceLinks(handover):null});
}));
driverVehicleRecords.post("/photo",route(async(req,res)=>{
  await new Promise<void>((resolve,reject)=>upload.single("file")(req,res,e=>e?reject(new DriverPortalError(400,"Upload one image no larger than 8 MB.")):resolve()));
  const driverId=res.locals.driver.id,vehicleId=text(req.body.vehicleId,100),handoverId=text(req.body.handoverId,100)||null,purpose=handoverId?"RETURN":"HANDOVER",recordRequestId=requestId(req.body.recordRequestId);
  const permitted=async(tx:Prisma.TransactionClient)=>{
    if(handoverId){const row=await tx.vehicleHandover.findFirst({where:{id:handoverId,driverId,vehicleId,returnedAt:null}});if(!row)throw new DriverPortalError(409,"This return is no longer open for you.");}
    else{const driver=await tx.driver.findUnique({where:{id:driverId},include:{vehicle:true}});if(!driver?.active||driver.vehicleId!==vehicleId||!driver.vehicle?.active)throw new DriverPortalError(409,"This active van is no longer assigned to you.");}
  };
  await prisma.$transaction(permitted);
  const media=await storeEvidence(req.file,{driverId,vehicleId,handoverId,recordRequestId,purpose,kind:"photo",requestId:requestId(req.body.requestId)},`streamline-logistics/handovers/${driverId}/${vehicleId}/${handoverId||"take"}`,permitted);
  res.json({url:media.url,uploadedAt:media.createdAt});
}));
driverVehicleRecords.post("/",route(async(req,res)=>res.json({handover:evidenceLinks(await takeVehicle(res.locals.driver.id,req.body)),message:"Possession recorded. Vehicle assignment stays under dispatch control."})));
driverVehicleRecords.post("/:id/return",route(async(req,res)=>res.json({handover:evidenceLinks(await returnVehicle(res.locals.driver.id,text(req.params.id,100),req.body)),message:"Vehicle returned. Dispatch can receive and approve this record."})));
driverVehicleRecords.get("/:id",route(async(req,res)=>{
  const handover=await prisma.vehicleHandover.findFirst({where:{id:text(req.params.id,100),driverId:res.locals.driver.id},include:handoverInclude});
  if(!handover)throw new DriverPortalError(404,"Handover not found.");res.json({handover:evidenceLinks(handover)});
}));

function pageNumber(value:unknown){const n=value==null?1:Number(value);if(!Number.isInteger(n)||n<1||n>10000)throw new DriverPortalError(400,"Invalid page.");return n;}
function dateRange(req:express.Request){
  const parse=(value:unknown)=>{const s=text(value,10);if(!s)return null;const d=new Date(s+"T00:00:00Z");if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw new DriverPortalError(400,"Invalid date filter.");return getReservationWindow(s,"00:00-02:00").reservedFrom;};
  const from=parse(req.query.from),until=parse(req.query.until);if(from&&until&&until<=from)throw new DriverPortalError(400,"Until must be after From (Until is excluded).");
  return from||until?{...(from?{gte:from}:{}),...(until?{lt:until}:{})}:undefined;
}
adminVehicleRecords.get("/handovers",route(async(req,res)=>{
  const q=text(req.query.q,100),status=text(req.query.status,20),page=pageNumber(req.query.page),range=dateRange(req);
  if(status&&!["OPEN","RETURNED","APPROVED"].includes(status))throw new DriverPortalError(400,"Invalid handover status.");
  const where:Prisma.VehicleHandoverWhereInput={...(status?{status}:{}),...(range?{takenAt:range}:{}),...(text(req.query.vehicleId,100)?{vehicleId:text(req.query.vehicleId,100)}:{}),...(q?{OR:[{driverNameSnapshot:{contains:q,mode:"insensitive"}},{registrationSnapshot:{contains:q,mode:"insensitive"}},{bookingReferenceSnapshot:{contains:q,mode:"insensitive"}},{vehicle:{name:{contains:q,mode:"insensitive"}}}]}:{})};
  const [records,total]=await Promise.all([prisma.vehicleHandover.findMany({where,include:handoverInclude,orderBy:[{takenAt:"desc"},{id:"asc"}],take:25,skip:(page-1)*25}),prisma.vehicleHandover.count({where})]);res.json(evidenceLinks({records,total,page,pages:Math.ceil(total/25)}));
},true));
adminVehicleRecords.post("/handovers/:id/approve",route(async(req,res)=>res.json({record:evidenceLinks(await approveHandover(text(req.params.id,100),req.body,res.locals.actor))}),true));
adminVehicleRecords.post("/handovers/:id/amend",route(async(req,res)=>res.json({amendment:await amendHandover(text(req.params.id,100),req.body,res.locals.actor)}),true));
adminVehicleRecords.get("/inspections",route(async(req,res)=>{
  const q=text(req.query.q,100),page=pageNumber(req.query.page),range=dateRange(req),status=text(req.query.status,20);
  if(status&&!["OPEN","RESOLVED","UNSAFE","PASS"].includes(status))throw new DriverPortalError(400,"Invalid inspection status.");
  const where:Prisma.DriverVehicleCheckWhereInput={...(range?{createdAt:range}:{}),...(text(req.query.vehicleId,100)?{vehicleId:text(req.query.vehicleId,100)}:{}),...(status==="OPEN"?{hasDefect:true,resolvedAt:null}:status==="UNSAFE"?{unsafeToDrive:true,resolvedAt:null}:status==="RESOLVED"?{resolvedAt:{not:null}}:status==="PASS"?{hasDefect:false}:{}),...(q?{OR:[{driver:{name:{contains:q,mode:"insensitive"}}},{vehicle:{registration:{contains:q,mode:"insensitive"}}},{vehicle:{name:{contains:q,mode:"insensitive"}}}]}:{})};
  const [records,total]=await Promise.all([prisma.driverVehicleCheck.findMany({where,include:{driver:{select:{name:true}},vehicle:{select:{name:true,registration:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}],take:25,skip:(page-1)*25}),prisma.driverVehicleCheck.count({where})]);res.json(evidenceLinks({records,total,page,pages:Math.ceil(total/25)}));
},true));
adminVehicleRecords.get("/incidents",route(async(req,res)=>{
  const q=text(req.query.q,100),page=pageNumber(req.query.page),range=dateRange(req),status=text(req.query.status,20);
  if(status&&!["OPEN","RESOLVED"].includes(status))throw new DriverPortalError(400,"Invalid incident status.");
  const where:Prisma.DriverIncidentWhereInput={...(range?{createdAt:range}:{}),...(status==="OPEN"?{resolvedAt:null}:status==="RESOLVED"?{resolvedAt:{not:null}}:{}),...(q?{OR:[{driver:{name:{contains:q,mode:"insensitive"}}},{booking:{reference:{contains:q,mode:"insensitive"}}}]}:{})};
  const [records,total]=await Promise.all([prisma.driverIncident.findMany({where,include:{driver:{select:{name:true}},booking:{select:{reference:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}],take:25,skip:(page-1)*25}),prisma.driverIncident.count({where})]);res.json(evidenceLinks({records,total,page,pages:Math.ceil(total/25)}));
},true));
const evidenceInclude={driver:{select:{id:true,name:true}},vehicle:{select:{id:true,name:true,registration:true}},pod:true,driverStops:{orderBy:{sequence:"asc" as const},include:{evidence:true}},driverIncidents:{orderBy:{createdAt:"desc" as const}},evidenceUploads:{orderBy:{createdAt:"asc" as const},select:{id:true,stopId:true,driverId:true,purpose:true,kind:true,createdAt:true,bytes:true,mimeType:true}}} satisfies Prisma.BookingInclude;
adminVehicleRecords.get("/evidence",route(async(req,res)=>{
  const q=text(req.query.q,100),page=pageNumber(req.query.page),range=dateRange(req);
  const where:Prisma.BookingWhereInput={...(range?{collectionDate:{...(text(req.query.from)?{gte:new Date(text(req.query.from)+"T00:00:00Z")}:{}),...(text(req.query.until)?{lt:new Date(text(req.query.until)+"T00:00:00Z")}:{} )}}:{}),...(q?{reference:{contains:q,mode:"insensitive"}}:{}),OR:[{pod:{isNot:null}},{driverStops:{some:{evidence:{isNot:null}}}}]};
  const [records,total]=await Promise.all([prisma.booking.findMany({where,select:{id:true,reference:true,status:true,collectionDate:true,driver:{select:{name:true}},vehicle:{select:{registration:true}},_count:{select:{driverStops:true,evidenceUploads:true}}},orderBy:[{collectionDate:"desc"},{id:"asc"}],take:25,skip:(page-1)*25}),prisma.booking.count({where})]);res.json({records,total,page,pages:Math.ceil(total/25)});
},true));
adminVehicleRecords.get("/evidence/:id",route(async(req,res)=>{
  const booking=await prisma.booking.findUnique({where:{id:text(req.params.id,100)},include:evidenceInclude});if(!booking)throw new DriverPortalError(404,"Booking not found.");
  // Deliberately project operational fields; payment/customer credentials never enter the evidence view.
  const record={id:booking.id,reference:booking.reference,status:booking.status,collectionDate:booking.collectionDate,collectionWindow:booking.collectionWindow,collectionAddress:booking.collectionAddress,deliveryAddress:booking.deliveryAddress,driver:booking.driver,vehicle:booking.vehicle,pod:booking.pod,stops:booking.driverStops,incidents:booking.driverIncidents,uploads:booking.evidenceUploads};
  res.json({record:evidenceLinks(record)});
},true));
adminVehicleRecords.get("/evidence/:id/pack",route(async(req,res)=>{
  const booking=await prisma.booking.findUnique({where:{id:text(req.params.id,100)},include:evidenceInclude});if(!booking)throw new DriverPortalError(404,"Booking not found.");
  const result=await evidencePack(booking);
  res.json({filename:`${booking.reference.replace(/[^a-zA-Z0-9_-]/g,"_")}-evidence.pdf`,mimeType:"application/pdf",base64:result.toString("base64")});
},true));
