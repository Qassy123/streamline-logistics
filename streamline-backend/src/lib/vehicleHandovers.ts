import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { capturedDate, DriverPortalError, requestId, text, ukDateKey } from "./driverPortal";
import { fleetTransaction, type FleetActor, vanCategories } from "./fleetOperations";
import { requireUploaded } from "./operationalEvidence";

export const inspectionItems = ["TYRES","LIGHTS","MIRRORS","WINDSCREEN_WIPERS","BRAKES","STEERING","FLUIDS","BODYWORK","DOORS","LOAD_AREA","LOAD_SECURITY","TAIL_LIFT","OTHER_SAFETY"] as const;
export const optionalInspectionItems = ["TAIL_LIFT","OTHER_SAFETY"];
export function inspectionPayload(body: Record<string, unknown>, vehicleType?: string) {
  const raw = body.items;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new DriverPortalError(400, "Complete every inspection item.");
  const items: Record<string,string> = {};
  const required = body.checklistVersion === 2 ? inspectionItems : ["TYRES","LIGHTS","BRAKES","MIRRORS","FLUIDS","LOAD_SECURITY","BODYWORK"];
  for (const key of required) {
    const value = (raw as Record<string,unknown>)[key];
    if (!["PASS","DEFECT",...(optionalInspectionItems.includes(key) && !(key==="TAIL_LIFT" && vehicleType==="Luton Tail Lift Van") ? ["NA"] : [])].includes(String(value))) throw new DriverPortalError(400, `Complete ${key.replace(/_/g," ").toLowerCase()}.`);
    items[key] = String(value);
  }
  if (typeof body.unsafeToDrive !== "boolean") throw new DriverPortalError(400, "Confirm whether the van is safe to drive.");
  const hasDefect = Object.values(items).includes("DEFECT") || body.unsafeToDrive;
  const severity = hasDefect ? text(body.severity,20) || (body.unsafeToDrive ? "SAFETY_CRITICAL" : "MINOR") : "NONE";
  if (hasDefect && !["MINOR","MAJOR","SAFETY_CRITICAL"].includes(severity)) throw new DriverPortalError(400, "Choose defect severity.");
  const unsafeToDrive = !!body.unsafeToDrive || severity === "SAFETY_CRITICAL";
  const notes = text(body.notes,4000);
  if (hasDefect && !notes) throw new DriverPortalError(400, "Describe the defect.");
  return { items, hasDefect: !!hasDefect, severity, unsafeToDrive, notes: notes || null };
}
export function mileage(value: unknown) {
  if (value === null || value === undefined || value === "" || !Number.isInteger(Number(value)) || Number(value)<0 || Number(value)>10_000_000) throw new DriverPortalError(400,"Enter valid mileage.");
  return Number(value);
}
function photos(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length>8 || value.some(v=>typeof v!=="string" || v.length>2000)) throw new DriverPortalError(400,"Include between one and eight condition photos.");
  return value as string[];
}
function condition(value: unknown) {
  const result = text(value,20);
  if (!["GOOD","DAMAGE","DEFECT"].includes(result)) throw new DriverPortalError(400,"Choose the vehicle condition.");
  return result;
}
function fuel(value: unknown) {
  const result = text(value,20);
  if (result && !["EMPTY","QUARTER","HALF","THREE_QUARTERS","FULL","NOT_RECORDED"].includes(result)) throw new DriverPortalError(400,"Choose a valid fuel level.");
  return result || null;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function audit(tx: Prisma.TransactionClient, actor: FleetActor, id: string, action: string, reason: string, oldValue: unknown, newValue: unknown) {
  await tx.auditLog.create({data:{adminId:actor.id || null,entityType:"VehicleHandover",entityId:id,action,reason,oldValue:json(oldValue),newValue:json(newValue)}});
}
async function defect(tx: Prisma.TransactionClient, row: {id:string;vehicleId:string;driverId:string;registrationSnapshot:string|null}, notes: string, unsafe: boolean, photoUrls:string[], at: Date | null, prefix:string) {
  if (!notes && !unsafe) return;
  await tx.driverVehicleCheck.create({data:{vehicleId:row.vehicleId,driverId:row.driverId,requestId:`${prefix}-${row.id}`,checkDate:ukDateKey(at||new Date()),registrationSnapshot:row.registrationSnapshot,items:{HANDOVER:"DEFECT"},notes,hasDefect:true,unsafeToDrive:unsafe,severity:unsafe?"SAFETY_CRITICAL":"MINOR",photoUrls,capturedAt:at}});
  await tx.driverPortalNotification.create({data:{driverId:row.driverId,dedupeKey:`${prefix}-${row.id}`,title:unsafe?"Unsafe vehicle defect — do not drive":"Handover defect reported",body:notes||"Contact dispatch before using this van."}});
}
export async function takeVehicle(driverId:string, body:Record<string,unknown>) {
  const retry = requestId(body.requestId), vehicleId=text(body.vehicleId,100), startingMileage=mileage(body.startingMileage), vehicleCondition=condition(body.condition), photoUrls=photos(body.photoUrls), capturedAt=capturedDate(body.capturedAt);
  const existingDamage=text(body.existingDamage,4000), defects=text(body.defects,4000), notes=text(body.notes,4000), bookingId=text(body.bookingId,100)||null;
  if (typeof body.unsafeToDrive!=="boolean" || body.unsafeToDrive && !defects || vehicleCondition==="DAMAGE" && !existingDamage || vehicleCondition==="DEFECT" && !defects) throw new DriverPortalError(400,"Describe the damage or defect and confirm whether the van is safe.");
  return fleetTransaction({label:`Driver ${driverId}`},"Vehicle taken into possession",async tx=>{
    const prior=await tx.vehicleHandover.findUnique({where:{driverId_requestId:{driverId,requestId:retry}}});
    if(prior){if(prior.vehicleId!==vehicleId || prior.startingMileage!==startingMileage || prior.condition!==vehicleCondition || prior.existingDamage!==(existingDamage||null) || prior.defects!==(defects||null) || prior.notes!==(notes||null) || prior.bookingId!==bookingId || prior.unsafeToDrive!==body.unsafeToDrive || JSON.stringify(prior.photoUrls)!==JSON.stringify(photoUrls))throw new DriverPortalError(409,"This request belongs to another handover.");return prior;}
    const driver=await tx.driver.findUnique({where:{id:driverId},include:{vehicle:true}});
    if(!driver?.active || driver.status!=="ACTIVE" || driver.vehicleId!==vehicleId || !driver.vehicle?.active || !vanCategories.includes(driver.vehicle.vehicleType as typeof vanCategories[number]))throw new DriverPortalError(409,"Dispatch must assign this active van to you first.");
    if(await tx.vehicleHandover.findFirst({where:{returnedAt:null,OR:[{driverId},{vehicleId}]}}))throw new DriverPortalError(409,"Return the open handover before recording another possession.");
    if(driver.vehicle.mileage!=null && startingMileage<driver.vehicle.mileage)throw new DriverPortalError(409,"Starting mileage is lower than the recorded vehicle mileage. Ask dispatch to review it.");
    const booking=bookingId?await tx.booking.findFirst({where:{id:bookingId,driverId,vehicleId,status:{in:["CONFIRMED","ASSIGNED","IN_PROGRESS"]}}}):null;
    if(bookingId&&!booking)throw new DriverPortalError(409,"Choose an open booking assigned to you and this van.");
    await requireUploaded(tx,photoUrls,{driverId,vehicleId,purpose:"HANDOVER",handoverId:null,recordRequestId:retry});
    const row=await tx.vehicleHandover.create({data:{driverId,vehicleId,bookingId,requestId:retry,registrationSnapshot:driver.vehicle.registration,driverNameSnapshot:driver.name,bookingReferenceSnapshot:booking?.reference||null,startingMileage,condition:vehicleCondition,existingDamage:existingDamage||null,defects:defects||null,unsafeToDrive:body.unsafeToDrive as boolean,photoUrls,notes:notes||null,fuelLevel:fuel(body.fuelLevel),capturedAt,recordedBy:driver.name}});
    await tx.vehicle.update({where:{id:vehicleId},data:{mileage:startingMileage}});
    await defect(tx,row,defects,body.unsafeToDrive as boolean,photoUrls,capturedAt,"handover-defect");
    await audit(tx,{label:driver.name},row.id,"HANDOVER_TAKEN",notes||"Driver confirmed possession",null,row);
    return row;
  });
}
export async function returnVehicle(driverId:string,id:string,body:Record<string,unknown>){
  const retry=requestId(body.requestId),endingMileage=mileage(body.endingMileage),returnCondition=condition(body.condition),photoUrls=photos(body.photoUrls),capturedAt=capturedDate(body.capturedAt),newDamage=text(body.newDamage,4000),incidents=text(body.incidents,4000),defects=text(body.defects,4000),notes=text(body.notes,4000);
  if(typeof body.unsafeToDrive!=="boolean" || body.unsafeToDrive&&!defects || returnCondition==="DAMAGE"&&!newDamage || returnCondition==="DEFECT"&&!defects)throw new DriverPortalError(400,"Describe new damage or defects and confirm whether the van is safe.");
  return fleetTransaction({label:`Driver ${driverId}`},"Vehicle returned",async tx=>{
    const row=await tx.vehicleHandover.findFirst({where:{id,driverId}});
    if(!row)throw new DriverPortalError(404,"Handover not found.");
    if(row.returnedAt){if(row.returnRequestId===retry){if(row.endingMileage!==endingMileage || row.returnCondition!==returnCondition || row.newDamage!==(newDamage||null) || row.returnNotes!==(notes||null) || JSON.stringify(row.returnPhotoUrls)!==JSON.stringify(photoUrls))throw new DriverPortalError(409,"This return request already contains different details.");return row;}throw new DriverPortalError(409,"This vehicle has already been returned. Dispatch can record an audited correction.");}
    if(row.version!==Number(body.version))throw new DriverPortalError(409,"This handover changed. Refresh before returning the van.");
    if(endingMileage<row.startingMileage)throw new DriverPortalError(400,"Return mileage cannot be lower than starting mileage.");
    if(capturedAt && capturedAt < (row.capturedAt||row.takenAt))throw new DriverPortalError(400,"Return capture time cannot be before possession.");
    if(await tx.booking.findFirst({where:{driverId,vehicleId:row.vehicleId,status:"IN_PROGRESS"}}))throw new DriverPortalError(409,"Complete the active delivery or ask dispatch to reassign it before returning the van.");
    await requireUploaded(tx,photoUrls,{driverId,vehicleId:row.vehicleId,purpose:"RETURN",handoverId:id,recordRequestId:retry});
    const updated=await tx.vehicleHandover.update({where:{id},data:{status:"RETURNED",version:{increment:1},returnRequestId:retry,returnedAt:new Date(),returnCapturedAt:capturedAt,endingMileage,returnCondition,returnPhotoUrls:photoUrls,newDamage:newDamage||null,incidents:[incidents,defects&&`Defects: ${defects}`].filter(Boolean).join("\n")||null,returnFuelLevel:fuel(body.fuelLevel),returnNotes:notes||null,returnedBy:row.driverNameSnapshot}});
    const van=await tx.vehicle.findUnique({where:{id:row.vehicleId}});
    // A reassigned van can be returned; an older return cannot move today's mileage backwards.
    if(van && (van.mileage==null || endingMileage>van.mileage))await tx.vehicle.update({where:{id:van.id},data:{mileage:endingMileage}});
    await defect(tx,row,defects,body.unsafeToDrive as boolean,photoUrls,capturedAt,"return-defect");
    await audit(tx,{label:row.driverNameSnapshot},id,"HANDOVER_RETURNED",notes||"Driver confirmed return",row,updated);
    return updated;
  });
}
export async function approveHandover(id:string,body:Record<string,unknown>,actor:FleetActor){
  const reason=text(body.reason,4000);if(reason.length<5)throw new DriverPortalError(400,"Record a receiving/review note.");
  return fleetTransaction(actor,reason,async tx=>{
    const row=await tx.vehicleHandover.findUnique({where:{id}});if(!row)throw new DriverPortalError(404,"Handover not found.");
    if(row.approvedAt)return row;
    if(!row.returnedAt || row.version!==Number(body.version))throw new DriverPortalError(409,"Review a returned handover at its current version.");
    const updated=await tx.vehicleHandover.update({where:{id},data:{status:"APPROVED",version:{increment:1},approvedAt:new Date(),approvedBy:actor.label,receivedBy:actor.label,approvalNotes:reason}});
    await audit(tx,actor,id,"HANDOVER_APPROVED",reason,row,updated);return updated;
  });
}
export async function amendHandover(id:string,body:Record<string,unknown>,actor:FleetActor){
  const reason=text(body.reason,4000),correction=text(body.correction,8000),retry=requestId(body.requestId);
  if(reason.length<5||correction.length<5)throw new DriverPortalError(400,"Record the correction and why it is needed.");
  return fleetTransaction(actor,reason,async tx=>{
    const row=await tx.vehicleHandover.findUnique({where:{id}});if(!row)throw new DriverPortalError(404,"Handover not found.");
    const prior=await tx.vehicleHandoverAmendment.findUnique({where:{requestId:retry}});
    if(prior){if(prior.handoverId!==id||prior.reason!==reason||prior.correction!==correction)throw new DriverPortalError(409,"This request belongs to a different correction.");return prior;}
    const amendment=await tx.vehicleHandoverAmendment.create({data:{handoverId:id,requestId:retry,actor:actor.label,reason,correction}});
    await audit(tx,actor,id,"HANDOVER_AMENDMENT",reason,null,amendment);return amendment;
  });
}
export const handoverInclude={amendments:{orderBy:{createdAt:"asc" as const}}} satisfies Prisma.VehicleHandoverInclude;
