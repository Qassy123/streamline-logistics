import dotenv from "dotenv";
import path from "path";
import { PrismaClient, VehicleStatus } from "@prisma/client";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const prisma = new PrismaClient();

type CanonicalVehicle = {
  currentNames: string[];
  currentTypes: string[];
  name: string;
  vehicleType: string;
};

const CANONICAL_VEHICLES: CanonicalVehicle[] = [
  {
    currentNames: ["Small Van 1", "Small Van"],
    currentTypes: ["Small Van"],
    name: "Small Van",
    vehicleType: "Small Van",
  },
  {
    currentNames: ["SWB Van 1", "SWB Van"],
    currentTypes: ["SWB Van"],
    name: "SWB Van",
    vehicleType: "SWB Van",
  },
  {
    currentNames: ["LWB High Roof Van", "LWB High Roof Van 1", "LWB Van"],
    currentTypes: ["LWB High Roof Van", "LWB Van"],
    name: "LWB High Roof Van",
    vehicleType: "LWB High Roof Van",
  },
  {
    currentNames: [
      "XLWB High Roof Van",
      "XLWB High Roof Van 1",
      "XLWB High Roof",
    ],
    currentTypes: ["XLWB High Roof Van", "XLWB High Roof"],
    name: "XLWB High Roof Van",
    vehicleType: "XLWB High Roof Van",
  },
  {
    currentNames: [
      "Luton Tail Lift Van",
      "Luton Tail Lift Van 1",
      "Luton Tail Lift",
    ],
    currentTypes: ["Luton Tail Lift Van", "Luton Tail Lift"],
    name: "Luton Tail Lift Van",
    vehicleType: "Luton Tail Lift Van",
  },
];

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from streamline-backend/.env");
  }

  const currentVehicles = await prisma.vehicle.findMany({
    orderBy: [{ vehicleType: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          bookings: true,
          reservations: true,
          drivers: true,
          documents: true,
        },
      },
    },
  });

  console.log("\nCurrent fleet records:\n");

  for (const vehicle of currentVehicles) {
    console.log({
      id: vehicle.id,
      name: vehicle.name,
      vehicleType: vehicle.vehicleType,
      vehicleCategory: vehicle.vehicleCategory,
      active: vehicle.active,
      status: vehicle.status,
      links: vehicle._count,
    });
  }

  console.log(
    APPLY
      ? "\nAPPLY MODE: changes will be written in one database transaction.\n"
      : "\nDRY RUN: no database changes will be made.\n",
  );

  const plannedChanges: Array<{
    id: string;
    fromName: string;
    toName: string;
    fromType: string;
    toType: string;
    action: string;
  }> = [];

  for (const target of CANONICAL_VEHICLES) {
    const matches = currentVehicles.filter(
      (vehicle) =>
        target.currentNames.includes(vehicle.name) ||
        target.currentTypes.includes(vehicle.vehicleType),
    );

    if (matches.length === 0) {
      console.warn(`Missing fleet record for ${target.name}.`);
      continue;
    }

    if (matches.length > 1) {
      throw new Error(
        `Safety stop: multiple records match ${target.name}. No changes were made.`,
      );
    }

    const vehicle = matches[0];

    plannedChanges.push({
      id: vehicle.id,
      fromName: vehicle.name,
      toName: target.name,
      fromType: vehicle.vehicleType,
      toType: target.vehicleType,
      action: "NORMALISE",
    });
  }

  const curtainsiders = currentVehicles.filter(
    (vehicle) =>
      vehicle.name.toLowerCase().includes("curtainsider") ||
      vehicle.vehicleType.toLowerCase().includes("curtainsider"),
  );

  for (const vehicle of curtainsiders) {
    plannedChanges.push({
      id: vehicle.id,
      fromName: vehicle.name,
      toName: vehicle.name,
      fromType: vehicle.vehicleType,
      toType: vehicle.vehicleType,
      action: "DEACTIVATE_AND_HIDE",
    });
  }

  console.log("Planned changes:\n");
  console.table(plannedChanges);

  if (!APPLY) {
    console.log(
      "\nDry run complete. Review the table above. Run again with --apply only when it looks correct.",
    );
    return;
  }

  await prisma.$transaction(async (transaction) => {
    for (const target of CANONICAL_VEHICLES) {
      const matches = currentVehicles.filter(
        (vehicle) =>
          target.currentNames.includes(
            vehicle.name as (typeof target.currentNames)[number],
          ) ||
          target.currentTypes.includes(
            vehicle.vehicleType as (typeof target.currentTypes)[number],
          ),
      );

      if (matches.length !== 1) {
        throw new Error(
          `Safety stop inside transaction: expected exactly one record for ${target.name}.`,
        );
      }

      await transaction.vehicle.update({
        where: {
          id: matches[0].id,
        },
        data: {
          name: target.name,
          vehicleType: target.vehicleType,
          vehicleCategory: target.vehicleType,
        },
      });
    }

    for (const vehicle of curtainsiders) {
      await transaction.vehicle.update({
        where: {
          id: vehicle.id,
        },
        data: {
          active: false,
          status: VehicleStatus.INACTIVE,
          maintenanceNotes: vehicle.maintenanceNotes
            ? `${vehicle.maintenanceNotes}\n\nLegacy Curtainsider record retained for historical links and removed from the active catalogue.`
            : "Legacy Curtainsider record retained for historical links and removed from the active catalogue.",
        },
      });
    }
  });

  const finalVehicles = await prisma.vehicle.findMany({
    orderBy: [{ active: "desc" }, { vehicleType: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      vehicleType: true,
      vehicleCategory: true,
      active: true,
      status: true,
    },
  });

  console.log("\nFleet cleanup completed successfully:\n");
  console.table(finalVehicles);
}

main()
  .catch((error) => {
    console.error("\nFleet cleanup failed. The transaction was rolled back.\n");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });