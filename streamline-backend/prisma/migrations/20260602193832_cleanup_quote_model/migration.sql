/*
  Warnings:

  - You are about to drop the column `finalDeliveryTime` on the `Quote` table. All the data in the column will be lost.
  - You are about to drop the column `loadingHelp` on the `Quote` table. All the data in the column will be lost.
  - You are about to drop the column `tailLiftRequired` on the `Quote` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `Quote` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "finalDeliveryTime",
DROP COLUMN "loadingHelp",
DROP COLUMN "tailLiftRequired",
DROP COLUMN "weightKg";
