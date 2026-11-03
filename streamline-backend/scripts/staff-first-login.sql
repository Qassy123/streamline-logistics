ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "username" TEXT;
-- statement
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "mustSetup" BOOLEAN NOT NULL DEFAULT false;
-- statement
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");
-- statement
UPDATE "AdminUser" SET "mustSetup" = true WHERE "lastLoginAt" IS NULL AND "username" IS NULL;
-- statement
