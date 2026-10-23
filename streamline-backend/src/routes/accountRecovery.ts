import crypto from "crypto";
import bcrypt from "bcryptjs";
import {Router} from "express";
import type {Request,Response} from "express";
import {Prisma} from "@prisma/client";
import {prisma} from "../lib/prisma";
import {sendEmail,emailLayout} from "../lib/email";
const router=Router();
const attempts=new Map<string,{count:number;until:number}>();
const hash=(value:string)=>crypto.createHash("sha256").update(value).digest("hex");
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
function limit(req:Request,res:Response,kind:string,email="") {
 const now=Date.now();for(const [key,value] of attempts)if(value.until<=now)attempts.delete(key);
 const keys=[`${kind}:ip:${req.ip}`, ...(email?[`${kind}:email:${hash(email)}`]:[])];
 if(attempts.size>10000||keys.some(key=>(attempts.get(key)?.count||0)>=5)){res.setHeader("Retry-After","900");res.status(429).json({error:"Too many requests. Try again in 15 minutes."});return false;}
 for(const key of keys){const entry=attempts.get(key)||{count:0,until:now+900000};entry.count++;attempts.set(key,entry);}return true;
}
router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});
router.post("/:kind/request",async(req,res)=>{
 try{
  const kind=String(req.params.kind);if(!["customer","staff"].includes(kind))return res.status(404).json({error:"Account type not found."});
  const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"";
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter your account email address."});
  if(!limit(req,res,`request:${kind}`,email))return;
  if(!process.env.RESEND_API_KEY)return res.status(503).json({error:"Email recovery is temporarily unavailable. Contact the office."});
  const account=kind==="customer"?await prisma.user.findFirst({where:{email:{equals:email,mode:"insensitive"},accountStatus:"ACTIVE"}}):await prisma.adminUser.findFirst({where:{email:{equals:email,mode:"insensitive"},active:true}});
  const usernameOnly=req.body?.usernameOnly===true;
  if(account){
   let resetId:string|undefined;
   try{
    let content:string;
    if(usernameOnly){const username="username" in account?account.username:null;content=`<p>Your sign-in email is <strong>${escape(account.email)}</strong>${username?` and your username is <strong>${escape(username)}</strong>`:""}.</p>`;}
    else{
     const token=crypto.randomBytes(32).toString("hex");
     const url=new URL(`/account-recovery?kind=${kind}`,process.env.FRONTEND_URL||"https://streamlinelogisticsgroup.co.uk");url.hash=token;
     if(!["https:","http:"].includes(url.protocol))throw new Error("Invalid frontend URL");
     const reset=await prisma.accountRecoveryToken.create({data:{kind,subjectId:account.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+1800000)}});resetId=reset.id;
     content=`<p><a href="${escape(url.toString())}">Reset your password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request it, ignore this email.</p>`;
    }
    const result=await sendEmail({to:account.email,department:"support",subject:usernameOnly?"Your Streamline sign-in details":"Reset your Streamline password",html:emailLayout("Account recovery",content,"support")});
    if(("skipped" in result&&result.skipped)||("error" in result&&result.error))throw new Error("Email delivery failed");
   }catch{if(resetId)await prisma.accountRecoveryToken.update({where:{id:resetId},data:{usedAt:new Date()}});console.warn("Account recovery email could not be delivered.");}
  }
  res.json({message:"If that email matches an active account, recovery instructions will arrive shortly. Check your spam folder or contact the office if needed."});
 }catch{res.status(500).json({error:"Unable to request recovery. Please try again."});}
});
router.post("/:kind/reset",async(req,res)=>{
 try{
  const kind=String(req.params.kind);if(!["customer","staff"].includes(kind))return res.status(404).json({error:"Account type not found."});
  if(!limit(req,res,`reset:${kind}`))return;
  const token=typeof req.body?.token==="string"?req.body.token:"",password=typeof req.body?.password==="string"?req.body.password:"";
  if(!/^[a-f0-9]{64}$/i.test(token))return res.status(400).json({error:"This reset link is invalid or expired."});
  if(password.length<8||Buffer.byteLength(password)>72)return res.status(400).json({error:"Use a password of at least 8 characters and no more than 72 bytes."});
  const tokenHash=hash(token),passwordHash=await bcrypt.hash(password,12);
  await prisma.$transaction(async tx=>{
   const found=await tx.accountRecoveryToken.findUnique({where:{tokenHash}});
   if(!found||found.kind!==kind)throw new Error("Invalid reset");
   // Serialize every reset for the same account, including different reset links.
   if(kind==="customer")await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${found.subjectId} FOR UPDATE`;
   else await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${found.subjectId} FOR UPDATE`;
   const row=await tx.accountRecoveryToken.findUnique({where:{tokenHash}});
   if(!row||row.usedAt||row.expiresAt<=new Date())throw new Error("Invalid reset");
   if(kind==="customer"){
    const user=await tx.user.findUnique({where:{id:row.subjectId}});if(!user||user.accountStatus!=="ACTIVE")throw new Error("Invalid reset");
    await tx.user.update({where:{id:user.id},data:{passwordHash}});await tx.userSession.deleteMany({where:{userId:user.id}});
    await tx.passwordResetToken.updateMany({where:{userId:user.id,usedAt:null},data:{usedAt:new Date()}});
   }else{
    const admin=await tx.adminUser.findUnique({where:{id:row.subjectId}});if(!admin?.active)throw new Error("Invalid reset");
    await tx.adminUser.update({where:{id:admin.id},data:{passwordHash}});await tx.adminSession.deleteMany({where:{adminId:admin.id}});
   }
   await tx.accountRecoveryToken.updateMany({where:{kind,subjectId:row.subjectId,usedAt:null},data:{usedAt:new Date()}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  res.json({message:"Password updated. Sign in with your new password."});
 }catch{res.status(400).json({error:"This reset link is invalid, expired or already used. Request a new link."});}
});
export default router;
