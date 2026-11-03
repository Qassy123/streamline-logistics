import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {prisma} from "../lib/prisma";
import {adminSections,adminTokenHash,authenticateAdmin,centralTokenPattern} from "../lib/centralAdmin";
const router=express.Router();
const attempts=new Map<string,{count:number;until:number}>();
const dummy=bcrypt.hashSync(crypto.randomBytes(32).toString("hex"),12);
const safe=(a:{id:string;name:string;email:string;role:string})=>({id:a.id,name:a.name,email:a.email,role:a.role,sections:adminSections(a.role)});
router.post("/login",async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 try{const identifier=String(req.body?.identifier||req.body?.email||"").trim(),password=typeof req.body?.password==="string"?req.body.password:"";
 if(!identifier||identifier.length>254||!password||Buffer.byteLength(password)>72)return void res.status(400).json({error:"Enter your username/email and password."});
 const now=Date.now(),key=crypto.createHash("sha256").update(identifier.toLowerCase()).digest("hex");for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);
 const attempt=attempts.get(key)||{count:0,until:now+15*60000};if(attempt.count>=8||attempts.size>10000)return void res.status(429).json({error:"Too many attempts. Try again in 15 minutes."});attempt.count++;attempts.set(key,attempt);
 const matches=await prisma.adminUser.findMany({where:{OR:[{email:{equals:identifier,mode:"insensitive"}},{name:{equals:identifier,mode:"insensitive"}}]},take:2});
 const admin=matches.length===1?matches[0]:null,valid=await bcrypt.compare(password,admin?.passwordHash||dummy);
 if(!admin?.active||!valid||!adminSections(admin.role).length)return void res.status(401).json({error:"Incorrect username/email or password."});
 const token="as_"+crypto.randomBytes(32).toString("hex"),expiresAt=new Date(now+8*3600000);
 await prisma.$transaction(async tx=>{await tx.adminSession.create({data:{adminId:admin.id,tokenHash:adminTokenHash(token),expiresAt}});await tx.adminUser.update({where:{id:admin.id},data:{lastLoginAt:new Date()}});});
 attempts.delete(key);res.json({token,expiresAt,admin:safe(admin)});
 }catch{res.status(503).json({error:"Unable to sign in. Try again."});}
});
router.get("/me",async(req,res)=>{res.setHeader("Cache-Control","no-store");try{const admin=await authenticateAdmin(req);if(!admin)return void res.status(401).json({error:"Your admin session has expired. Sign in again."});res.json({admin:safe(admin)});}catch{res.status(503).json({error:"Unable to check the admin session."});}});
router.post("/logout",async(req,res)=>{res.setHeader("Cache-Control","no-store");try{const token=/^Bearer (.+)$/.exec(req.headers.authorization||"")?.[1]||"";if(centralTokenPattern.test(token))await prisma.adminSession.deleteMany({where:{tokenHash:adminTokenHash(token)}});res.json({success:true});}catch{res.status(503).json({error:"Unable to confirm sign out. Try again."});}});
export default router;
