import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {prisma} from "../lib/prisma";
import {adminSections,adminTokenHash,authenticateAdmin,centralTokenPattern} from "../lib/centralAdmin";
const router=express.Router();
const attempts=new Map<string,{count:number;until:number}>();
const dummy=bcrypt.hashSync(crypto.randomBytes(32).toString("hex"),12);
const safe=(a:{id:string;name:string;email:string;role:string;username?:string|null;mustSetup?:boolean})=>({id:a.id,name:a.name,email:a.email,role:a.role,username:a.username??null,mustSetup:Boolean(a.mustSetup),sections:adminSections(a.role)});
router.post("/login",async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 try{const identifier=String(req.body?.identifier||req.body?.email||"").trim(),password=typeof req.body?.password==="string"?req.body.password:"";
 if(!identifier||identifier.length>254||!password||Buffer.byteLength(password)>72)return void res.status(400).json({error:"Enter your username/email and password."});
 const now=Date.now(),key=crypto.createHash("sha256").update(identifier.toLowerCase()).digest("hex");for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);
 const attempt=attempts.get(key)||{count:0,until:now+15*60000};if(attempt.count>=8||attempts.size>10000)return void res.status(429).json({error:"Too many attempts. Try again in 15 minutes."});attempt.count++;attempts.set(key,attempt);
 let matches=await prisma.adminUser.findMany({where:{OR:[{email:{equals:identifier,mode:"insensitive"}},{username:{equals:identifier,mode:"insensitive"}}]},take:2});
 if(!matches.length)matches=await prisma.adminUser.findMany({where:{username:null,name:{equals:identifier,mode:"insensitive"}},take:2});
 const admin=matches.length===1?matches[0]:null,valid=await bcrypt.compare(password,admin?.passwordHash||dummy);
 if(!admin?.active||!valid||!adminSections(admin.role).length)return void res.status(401).json({error:"Incorrect username/email or password."});
 const token="as_"+crypto.randomBytes(32).toString("hex"),expiresAt=new Date(now+8*3600000);
 await prisma.$transaction(async tx=>{await tx.adminSession.create({data:{adminId:admin.id,tokenHash:adminTokenHash(token),expiresAt}});await tx.adminUser.update({where:{id:admin.id},data:{lastLoginAt:new Date()}});});
 attempts.delete(key);res.json({token,expiresAt,admin:safe(admin)});
 }catch{res.status(503).json({error:"Unable to sign in. Try again."});}
});
router.get("/me",async(req,res)=>{res.setHeader("Cache-Control","no-store");try{const admin=await authenticateAdmin(req);if(!admin)return void res.status(401).json({error:"Your admin session has expired. Sign in again."});res.json({admin:safe(admin)});}catch{res.status(503).json({error:"Unable to check the admin session."});}});
router.post("/logout",async(req,res)=>{res.setHeader("Cache-Control","no-store");try{const token=/^Bearer (.+)$/.exec(req.headers.authorization||"")?.[1]||"";if(centralTokenPattern.test(token))await prisma.adminSession.deleteMany({where:{tokenHash:adminTokenHash(token)}});res.json({success:true});}catch{res.status(503).json({error:"Unable to confirm sign out. Try again."});}});
router.post("/setup",async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 try{
  const admin=await authenticateAdmin(req);if(!admin)return void res.status(401).json({error:"Sign in with your initial password first."});
  if(!admin.mustSetup)return void res.status(409).json({error:"Your account setup is already complete."});
  const username=typeof req.body?.username==="string"?req.body.username.trim().toLowerCase():"",password=typeof req.body?.password==="string"?req.body.password:"";
  if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username))return void res.status(400).json({error:"Use 3–30 letters, numbers, dots, underscores or hyphens for your username."});
  if(password.length<10||Buffer.byteLength(password)>72)return void res.status(400).json({error:"Use a password of at least 10 characters and no more than 72 bytes."});
  if(await bcrypt.compare(password,admin.passwordHash))return void res.status(400).json({error:"Choose a different password from your initial password."});
  const passwordHash=await bcrypt.hash(password,12),token=/^Bearer (as_[a-f0-9]{64})$/.exec(req.headers.authorization||"")?.[1]||"";
  const updated=await prisma.$transaction(async tx=>{
   const result=await tx.adminUser.updateMany({where:{id:admin.id,active:true,mustSetup:true,passwordHash:admin.passwordHash},data:{username,passwordHash,mustSetup:false}});
   if(result.count!==1)throw Error("SETUP_CHANGED");
   await tx.adminSession.deleteMany({where:{adminId:admin.id,tokenHash:{not:adminTokenHash(token)}}});
   await tx.accountRecoveryToken.updateMany({where:{kind:"staff",subjectId:admin.id,usedAt:null},data:{usedAt:new Date()}});
   return tx.adminUser.findUniqueOrThrow({where:{id:admin.id}});
  });
  res.json({admin:safe(updated)});
 }catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return void res.status(409).json({error:"That username is already taken. Choose another."});if(error instanceof Error&&error.message==="SETUP_CHANGED")return void res.status(409).json({error:"Your account changed. Sign in again to continue."});res.status(503).json({error:"Unable to save your account setup. Try again."});}
});
export default router;
