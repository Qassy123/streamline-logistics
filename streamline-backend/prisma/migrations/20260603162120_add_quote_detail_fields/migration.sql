-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "collectionAddressDetails" JSONB,
ADD COLUMN     "deliveryAddressDetails" JSONB,
ADD COLUMN     "legalEntity" TEXT,
ADD COLUMN     "returnAddress" TEXT,
ADD COLUMN     "tradingName" TEXT;
