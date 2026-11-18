BEGIN;
ALTER TABLE "CommercialTariffRate"
  ADD COLUMN IF NOT EXISTS "overtimePerQuarter" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "overtimePerHour" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "saturdayStartPercent" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "sundayStartPercent" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "bankHolidayStartPercent" DECIMAL(12,2);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "commercialAllocation" JSONB;
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "commercialPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "commercialGroupId" TEXT REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS "commercialEmailStage" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_userId_commercialPeriod_idx" ON "Invoice"("userId", "commercialPeriod");
CREATE INDEX IF NOT EXISTS "Invoice_commercialGroupId_idx" ON "Invoice"("commercialGroupId");
COMMIT;
