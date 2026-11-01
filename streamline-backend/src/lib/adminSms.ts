import { prisma } from "./prisma";
export function smsConfiguration(env:NodeJS.ProcessEnv=process.env){
 const sid=env.TWILIO_ACCOUNT_SID?.trim()||"",token=env.TWILIO_AUTH_TOKEN?.trim()||"",from=env.TWILIO_FROM_NUMBER?.trim()||"";let to=env.ADMIN_SMS_TO?.replace(/[\s()-]/g,"")||"+447301827224";if(/^07\d{9}$/.test(to))to="+44"+to.slice(1);
 return {enabled:env.ADMIN_SMS_ENABLED==="true",ready:/^AC[0-9a-f]{32}$/i.test(sid)&&Boolean(token)&&/^\+[1-9]\d{7,14}$/.test(from)&&/^\+[1-9]\d{7,14}$/.test(to),sid,token,from,to};
}
export async function sendAdminSms(message:string,env:NodeJS.ProcessEnv=process.env){
 const c=smsConfiguration(env);if(!c.enabled||!c.ready)return {kind:"DISABLED" as const};
 try{const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${c.sid}:${c.token}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({To:c.to,From:c.from,Body:message}),signal:AbortSignal.timeout(15000),redirect:"error"});const data=await response.json().catch(()=>null);
 if(response.ok&&typeof data?.sid==="string"&&/^SM[0-9a-f]{32}$/i.test(data.sid))return {kind:"ACCEPTED" as const,providerId:data.sid};
 if(response.status===429)return {kind:"RETRY" as const,error:"SMS provider rate limit."};
 return {kind:response.status>=500||response.ok?"UNCERTAIN" as const:"FAILED" as const,error:`SMS provider returned HTTP ${response.status}.`};
 }catch{return {kind:"UNCERTAIN" as const,error:"SMS provider outcome is unknown; check Twilio before retrying."};}
}
let running=false;
export async function processAdminSms(){
 const c=smsConfiguration();if(running||!c.enabled||!c.ready)return;running=true;
 try{
  const now=new Date(),cutoff=new Date(+now-3600000);
  await prisma.adminSmsOutbox.updateMany({where:{status:"QUEUED",createdAt:{lt:cutoff}},data:{status:"SKIPPED",lastError:"Alert expired before SMS delivery was enabled or available."}});
  await prisma.adminSmsOutbox.updateMany({where:{status:"SENDING",leaseUntil:{lt:now}},data:{status:"UNCERTAIN",lastError:"Interrupted send: check provider records before retrying."}});
  for(let i=0;i<10;i++){
   const row=await prisma.$transaction(async tx=>{const rows=await tx.$queryRaw<{id:string;message:string;attempts:number}[]>`SELECT id,message,attempts FROM "AdminSmsOutbox" WHERE status='QUEUED' AND "nextAttemptAt"<=NOW() ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;if(!rows[0])return null;await tx.adminSmsOutbox.update({where:{id:rows[0].id},data:{status:"SENDING",attempts:{increment:1},leaseUntil:new Date(Date.now()+120000)}});return rows[0];});
   if(!row)break;const result=await sendAdminSms(row.message);if(result.kind==="DISABLED")break;
   const retry=result.kind==="RETRY"&&row.attempts<2;
   await prisma.adminSmsOutbox.update({where:{id:row.id},data:{status:retry?"QUEUED":result.kind==="RETRY"?"FAILED":result.kind,providerId:result.kind==="ACCEPTED"?result.providerId:undefined,lastError:"error"in result?result.error:null,leaseUntil:null,nextAttemptAt:new Date(Date.now()+60000)}});
  }
 }finally{running=false;}
}
