import {prisma} from "./prisma";
export async function bookingEmailOnce(bookingId:string,type:"BOOKING_CONFIRMATION"|"PAYMENT_RECEIVED",recipient:string,subject:string,send:()=>Promise<unknown>){
 const failure=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bookingId+":"+type},0))`;
  if(await tx.emailLog.findFirst({where:{bookingId,type,status:{in:["PENDING","SENT"]}}}))return null;
  const log=await tx.emailLog.create({data:{bookingId,type,recipient,subject,status:"PENDING"}});
  let definiteFailure=false;
  try{const result=await send() as {skipped?:boolean;error?:unknown;data?:{id?:string}|null};
   if(result?.skipped||result?.error){definiteFailure=true;throw Error("Email provider did not accept the message.");}
   await tx.emailLog.update({where:{id:log.id},data:{status:"SENT",sentAt:new Date(),providerMessageId:result?.data?.id||null}});return null;
  }catch(e){await tx.emailLog.update({where:{id:log.id},data:{status:definiteFailure?"FAILED":"PENDING",errorMessage:e instanceof Error?e.message:"Email failed"}});return e instanceof Error?e.message:"Email failed";}
 },{timeout:60000});
 if(failure)throw Error(failure);
}
