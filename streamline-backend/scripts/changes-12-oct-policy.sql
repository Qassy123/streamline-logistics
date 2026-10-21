-- Apply AFTER the additive Prisma schema update. No account/history is deleted.
-- This normalises existing account policies and the Business due-date bug shown
-- in the PDF. Existing Trade issued documents keep their historical issue dates.
BEGIN;
UPDATE "BillingProfile" p SET "paymentTermsDays"=0, "paymentMode"='PAY_NOW', "updatedAt"=NOW()
FROM "User" u WHERE u.id=p."userId" AND u."accountType"='BUSINESS';
UPDATE "BillingProfile" p SET "paymentTermsDays"=14, "paymentMode"='PAY_LATER', "invoiceMode"='CONSOLIDATED', "billingFrequency"='MONTHLY', "invoiceDayOfMonth"=1, "invoiceDayOfWeek"=NULL, "updatedAt"=NOW()
FROM "User" u WHERE u.id=p."userId" AND u."accountType"='TRADE';
UPDATE "TradeAccount" SET "paymentTermsDays"=14, "preferredPaymentTerms"='Monthly invoicing on the 1st; payment due by the 15th of the same month', "updatedAt"=NOW();
INSERT INTO "InvoiceAuditEvent" (id,"invoiceId","eventType",description,metadata,"createdAt")
SELECT md5(i.id || clock_timestamp()::text || random()::text),i.id,'PAYMENT_TERMS_CORRECTED','Business invoice corrected to immediate payment under the October changes.',jsonb_build_object('previousDueDate',i."dueDate",'previousPaymentTerms',i."paymentTerms"),NOW()
FROM "Invoice" i JOIN "User" u ON u.id=i."userId"
WHERE u."accountType"='BUSINESS' AND (i."paymentTerms" IS DISTINCT FROM 'Due immediately' OR i."dueDate" IS DISTINCT FROM COALESCE(i."issuedAt",i."finalisedAt",i."createdAt"));
UPDATE "Invoice" i SET "paymentTerms"='Due immediately',"dueDate"=COALESCE(i."issuedAt",i."finalisedAt",i."createdAt"),"updatedAt"=NOW()
FROM "User" u WHERE u.id=i."userId" AND u."accountType"='BUSINESS';
COMMIT;
