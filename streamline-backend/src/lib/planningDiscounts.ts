import {prisma} from "./prisma";
export async function planningDiscounts(customerId:string|null){const now=new Date();return prisma.discountRule.findMany({where:{active:true,AND:[{OR:[{startsAt:null},{startsAt:{lte:now}}]},{OR:[{endsAt:null},{endsAt:{gte:now}}]},{OR:[{customerId:null},...(customerId?[{customerId}]:[])]}]},orderBy:{name:"asc"}});}
