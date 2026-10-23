// Explicitly authorised test-data repair, limited to the two inspected vans and pre-existing jobs.
const SMALL="cmpx1u1za0000q4q881iqlivq",SWB="cmpx1u20x0001q4q89b1ywa2w";
const cutoff=new Date("2026-10-23T18:00:00Z"),futureMot=new Date("2027-10-23T00:00:00Z");
async function correctTestAvailability(db,apply=false){
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73121002)`;
  const vans=await tx.vehicle.findMany({where:{id:{in:[SMALL,SWB]}}});
  if(vans.length!==2||vans.find(v=>v.id===SMALL)?.vehicleType!=="Small Van"||vans.find(v=>v.id===SWB)?.vehicleType!=="SWB Van")throw Error("The inspected test vans do not match. No changes applied.");
  const jobs=await tx.booking.findMany({where:{vehicleId:{in:[SMALL,SWB]},status:"IN_PROGRESS",createdAt:{lte:cutoff},collectionDate:{lt:new Date("2026-10-24T00:00:00Z")}}});
  const small=vans.find(v=>v.id===SMALL),changeMot=small.motExpiry?.toISOString().slice(0,10)==="2026-09-30";
  const plan={applied:apply,mot:changeMot?{vehicleId:SMALL,oldExpiry:small.motExpiry,newExpiry:futureMot}:null,jobs:jobs.map(j=>({id:j.id,reference:j.reference,vehicleId:j.vehicleId,oldStatus:j.status,newStatus:"COMPLETED"}))};
  if(!apply)return plan;
  const reason="User confirmed these test jobs had finished and authorised a future Small Van test MOT date (23 October 2026).";
  if(changeMot){await tx.vehicle.update({where:{id:SMALL},data:{motExpiry:futureMot}});await tx.auditLog.create({data:{action:"AUTHORISED_TEST_MOT_CORRECTION",entityType:"Vehicle",entityId:SMALL,reason,oldValue:{motExpiry:small.motExpiry.toISOString()},newValue:{motExpiry:futureMot.toISOString()}}});}
  for(const job of jobs){await tx.booking.update({where:{id:job.id},data:{status:"COMPLETED",trackingEndedAt:new Date(),trackingEvents:{create:{status:"COMPLETED",title:"Finished test job corrected by admin",description:reason,userVisible:false}}}});await tx.auditLog.create({data:{action:"AUTHORISED_TEST_JOB_COMPLETED",entityType:"Booking",entityId:job.id,reason,oldValue:{status:job.status},newValue:{status:"COMPLETED"}}});}
  return plan;
 },{timeout:30000});
}
module.exports={correctTestAvailability};
if(require.main===module){require("dotenv").config();const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();correctTestAvailability(db,process.argv.includes("--apply")).then(plan=>console.log(JSON.stringify(plan,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());}
