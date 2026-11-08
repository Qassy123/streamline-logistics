BEGIN;

SELECT pg_advisory_xact_lock(73121120);

CREATE TABLE IF NOT EXISTS "CommercialTariff" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "CommercialTariffRate" (
  "tariffId" TEXT NOT NULL REFERENCES "CommercialTariff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "vehicleType" TEXT NOT NULL,
  "fare8Hours" DECIMAL(12,2) NOT NULL CHECK ("fare8Hours" >= 0),
  "includedMiles8" DECIMAL(12,2) NOT NULL CHECK ("includedMiles8" >= 0),
  "fare12Hours" DECIMAL(12,2) NOT NULL CHECK ("fare12Hours" >= 0),
  "includedMiles12" DECIMAL(12,2) NOT NULL CHECK ("includedMiles12" >= 0),
  "extraMileRate" DECIMAL(12,2) NOT NULL CHECK ("extraMileRate" >= 0),
  PRIMARY KEY ("tariffId", "vehicleType")
);

CREATE TABLE IF NOT EXISTS "CommercialTariffAssignment" (
  "customerId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tariffId" TEXT NOT NULL REFERENCES "CommercialTariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommercialTariffAssignment_tariffId_idx" ON "CommercialTariffAssignment"("tariffId");

INSERT INTO "CommercialTariff" ("id", "name", "nameKey") VALUES
  ('commercial-bronze', 'Bronze', 'bronze'),
  ('commercial-gold', 'Gold', 'gold'),
  ('commercial-premium', 'Premium', 'premium')
ON CONFLICT ("nameKey") DO NOTHING;

COMMIT;
