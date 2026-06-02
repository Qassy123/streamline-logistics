import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const vehicles = [
  {
    name: "Small Van 1",
    vehicleType: "Small Van",
  },
  {
    name: "SWB Van 1",
    vehicleType: "SWB Van",
  },
  {
    name: "LWB Van 1",
    vehicleType: "LWB Van",
  },
  {
    name: "XLWB High Roof 1",
    vehicleType: "XLWB High Roof",
  },
  {
    name: "Luton Tail Lift 1",
    vehicleType: "Luton Tail Lift",
  },
  {
    name: "Curtainsider 1",
    vehicleType: "Curtainsider",
  },
];

async function main() {
  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        name: vehicle.name,
      },
      update: {
        vehicleType: vehicle.vehicleType,
        active: true,
      },
      create: {
        name: vehicle.name,
        vehicleType: vehicle.vehicleType,
        active: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Vehicle seed completed");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });