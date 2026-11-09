BEGIN;
ALTER TABLE "CommercialContract" ADD COLUMN IF NOT EXISTS "weeklyMileageFrom" TIMESTAMP(3);
ALTER TABLE "CommercialContractShift"
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedMiles" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "hoursOverride" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "CommercialContractWeeklyMileage" (
  "contractId" TEXT NOT NULL REFERENCES "CommercialContract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "actualMiles" DECIMAL(65,30) NOT NULL CHECK ("actualMiles" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("contractId", "weekStart")
);
COMMIT;
