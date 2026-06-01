-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "deliveryType" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "collectionWindow" TEXT NOT NULL,
    "vehicleSize" TEXT NOT NULL,
    "collectionAddress" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "extraDrops" JSONB,
    "finalDeliveryTime" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "companyName" TEXT,
    "distanceMiles" DECIMAL(65,30),
    "basePrice" DECIMAL(65,30),
    "fuelSurcharge" DECIMAL(65,30),
    "adminPrice" DECIMAL(65,30),
    "vatAmount" DECIMAL(65,30),
    "totalPrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
