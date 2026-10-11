// Dry-run by default. This operates only on raw GPS, never bookings, evidence, shifts or audit history.
const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'..','.env')});
const {PrismaClient}=require('@prisma/client'),prisma=new PrismaClient();
const days=366,cutoff=new Date(Date.now()-days*86400000);
const held=(process.env.TRACKING_RETENTION_HOLD_BOOKING_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
const args=new Set(process.argv.slice(2)),apply=args.has('--apply');
const where={createdAt:{lt:cutoff},booking:{status:{in:['COMPLETED','CANCELLED','EXPIRED']}},...(held.length?{bookingId:{notIn:held}}:{})};
(async()=>{
 if(apply&&!args.has('--confirm-retention-policy'))throw Error('Deletion requires both --apply and --confirm-retention-policy after reviewing retention and holds.');
 const count=await prisma.driverLocation.count({where});
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',olderThan:cutoff.toISOString(),minimumHistoryDays:days,eligibleClosedJobPoints:count,heldBookingCount:held.length},null,2));
 if(!apply){console.log('No data deleted. Review company retention requirements and held bookings before applying.');return;}
 // A bounded batch keeps maintenance transactions short. Re-run until eligibleClosedJobPoints is zero.
 const ids=await prisma.driverLocation.findMany({where,select:{id:true},orderBy:{createdAt:'asc'},take:10000});
 if(!ids.length)return;
 const result=await prisma.$transaction(async tx=>{
   const deleted=await tx.driverLocation.deleteMany({where:{...where,id:{in:ids.map(p=>p.id)}}});
   await tx.auditLog.create({data:{action:'TRACKING_RETENTION_PRUNE',entityType:'DriverLocation',entityId:'retention',reason:'Operator confirmed raw GPS retention policy; closed bookings only; configured holds excluded.',newValue:{deleted:deleted.count,cutoff:cutoff.toISOString(),minimumHistoryDays:days,heldBookingCount:held.length}}});
   return deleted.count;
 });
 console.log('Deleted '+result+' eligible raw GPS points; audit retained.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
