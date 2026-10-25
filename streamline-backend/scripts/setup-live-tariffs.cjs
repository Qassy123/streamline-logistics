// One-time setup for the explicitly approved quote pricing change.
async function setupLiveTariffs(prisma) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(73121025)');
    await tx.$executeRawUnsafe('ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "pricingBreakdown" JSONB');
    const current=await tx.tariffCharge.findFirst({where:{tariffId:null,type:'STOP',active:true},orderBy:[{updatedAt:'desc'},{id:'asc'}]});
    if(current) {
      if(current.amount.toString()!=='45'||current.calculation!=='PER_STOP')await tx.tariffCharge.update({where:{id:current.id},data:{amount:45,calculation:'PER_STOP'}});
    } else await tx.tariffCharge.create({data:{tariffId:null,type:'STOP',name:'Extra stop',calculation:'PER_STOP',amount:45,active:true,vatApplicable:true}});
  });
}
module.exports={setupLiveTariffs};
if(require.main===module) {
  require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
  if(!process.env.DATABASE_URL){console.error('DATABASE_URL is required for the approved quote breakdown and GBP 45 extra-stop setup. No push should be attempted until setup succeeds.');process.exitCode=1;}
  else {const {PrismaClient}=require('@prisma/client');const client=new PrismaClient();setupLiveTariffs(client).then(()=>console.log('Quote breakdown storage and the approved GBP 45 per-extra-stop price are ready. Other prices and charges were left unchanged.')).catch(()=>{console.error('Unable to complete the approved tariff setup. Check database access before pushing.');process.exitCode=1;}).finally(()=>client.$disconnect());}
}
