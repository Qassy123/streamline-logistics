-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "accuracyConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactPreference" TEXT,
ADD COLUMN     "fragileGoods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loadDescription" TEXT,
ADD COLUMN     "loadingHelp" TEXT,
ADD COLUMN     "palletCount" INTEGER,
ADD COLUMN     "tailLiftRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weightKg" INTEGER;
