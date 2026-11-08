BEGIN;
SELECT pg_advisory_xact_lock(73121121);
DO $commercial$
BEGIN
IF to_regclass('"CommercialContract"') IS NULL THEN
-- CreateTable
CREATE TABLE "CommercialContract" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "startsAt" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "collectionAddress" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "purchaseOrder" TEXT,
    "weeklyPattern" JSONB NOT NULL,
    "tariffName" TEXT NOT NULL,
    "fare8Hours" DECIMAL(65,30) NOT NULL,
    "includedMiles8" DECIMAL(65,30) NOT NULL,
    "fare12Hours" DECIMAL(65,30) NOT NULL,
    "includedMiles12" DECIMAL(65,30) NOT NULL,
    "extraMileRate" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialContractShift" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL,
    "guaranteed" BOOLEAN NOT NULL,
    "actualMiles" DECIMAL(65,30),
    "decision" TEXT,

    CONSTRAINT "CommercialContractShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialContractInvoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "CommercialContractInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialContract_requestId_key" ON "CommercialContract"("requestId");

-- CreateIndex
CREATE INDEX "CommercialContract_customerId_idx" ON "CommercialContract"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialContractShift_bookingId_key" ON "CommercialContractShift"("bookingId");

-- CreateIndex
CREATE INDEX "CommercialContractShift_serviceDate_idx" ON "CommercialContractShift"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialContractShift_contractId_serviceDate_key" ON "CommercialContractShift"("contractId", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialContractInvoice_invoiceId_key" ON "CommercialContractInvoice"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialContractInvoice_contractId_month_key" ON "CommercialContractInvoice"("contractId", "month");

-- AddForeignKey
ALTER TABLE "CommercialContract" ADD CONSTRAINT "CommercialContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialContractShift" ADD CONSTRAINT "CommercialContractShift_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CommercialContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialContractShift" ADD CONSTRAINT "CommercialContractShift_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialContractInvoice" ADD CONSTRAINT "CommercialContractInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CommercialContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialContractInvoice" ADD CONSTRAINT "CommercialContractInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

END IF;
END;
$commercial$;
COMMIT;
