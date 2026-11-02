CREATE TABLE IF NOT EXISTS "November2ReferenceMap" (kind text NOT NULL, id text NOT NULL, old text NOT NULL, new text NOT NULL, PRIMARY KEY(kind,id), UNIQUE(kind,old));
-- statement
CREATE SEQUENCE IF NOT EXISTS streamline_account_number;
-- statement
CREATE SEQUENCE IF NOT EXISTS streamline_booking_number;
-- statement
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "November2ReferenceMap" WHERE kind='MIGRATION') THEN
  LOCK TABLE "User", "Booking" IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO "November2ReferenceMap"(kind,id,old,new) SELECT 'ACCOUNT',id,coalesce("accountNumber",id),'SL-'||lpad(n::text,greatest(2,length(n::text)),'0') FROM (SELECT *,row_number() OVER(ORDER BY "createdAt",id) n FROM "User") u;
  INSERT INTO "November2ReferenceMap"(kind,id,old,new) SELECT 'BOOKING',id,reference,'SL#'||lpad(n::text,greatest(3,length(n::text)),'0') FROM (SELECT *,row_number() OVER(ORDER BY "createdAt",id) n FROM "Booking") b;
  UPDATE "User" SET "accountNumber"='NOV2-TEMP-'||id;
  UPDATE "Booking" SET reference='NOV2-TEMP-'||id;
  UPDATE "User" u SET "accountNumber"=m.new FROM "November2ReferenceMap" m WHERE m.kind='ACCOUNT' AND m.id=u.id;
  UPDATE "Booking" b SET reference=m.new FROM "November2ReferenceMap" m WHERE m.kind='BOOKING' AND m.id=b.id;
  UPDATE "InvoiceBooking" b SET "bookingReference"=m.new FROM "November2ReferenceMap" m WHERE m.kind='BOOKING' AND m.id=b."bookingId";
  UPDATE "InvoiceLine" l SET "bookingReference"=m.new,description=replace(l.description,m.old,m.new) FROM "November2ReferenceMap" m WHERE m.kind='BOOKING' AND m.id=l."bookingId";
  PERFORM setval('streamline_account_number',greatest(1,(SELECT count(*) FROM "User")),(SELECT count(*)>0 FROM "User"));
  PERFORM setval('streamline_booking_number',greatest(1,(SELECT count(*) FROM "Booking")),(SELECT count(*)>0 FROM "Booking"));
  INSERT INTO "November2ReferenceMap" VALUES('MIGRATION','done','done','done');
 END IF;
END $$;
-- statement
CREATE OR REPLACE FUNCTION streamline_short_reference() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN
 IF TG_TABLE_NAME='User' THEN n:=nextval('streamline_account_number');NEW."accountNumber":='SL-'||lpad(n::text,greatest(2,length(n::text)),'0');
 ELSE n:=nextval('streamline_booking_number');NEW.reference:='SL#'||lpad(n::text,greatest(3,length(n::text)),'0'); END IF;RETURN NEW;
END $$;
-- statement
DROP TRIGGER IF EXISTS streamline_account_reference ON "User";
-- statement
CREATE TRIGGER streamline_account_reference BEFORE INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION streamline_short_reference();
-- statement
DROP TRIGGER IF EXISTS streamline_booking_reference ON "Booking";
-- statement
CREATE TRIGGER streamline_booking_reference BEFORE INSERT ON "Booking" FOR EACH ROW EXECUTE FUNCTION streamline_short_reference();
-- statement
CREATE TABLE IF NOT EXISTS "AdminNewNotice"(kind text NOT NULL,id text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(),"checkedAt" timestamptz,PRIMARY KEY(kind,id));
-- statement
CREATE OR REPLACE FUNCTION streamline_new_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='User' THEN INSERT INTO "AdminNewNotice"(kind,id) VALUES('CUSTOMER',NEW.id) ON CONFLICT DO NOTHING;
 ELSIF NEW.status IN ('CONFIRMED','ASSIGNED','IN_PROGRESS') THEN
  IF TG_OP='INSERT' THEN INSERT INTO "AdminNewNotice"(kind,id) VALUES('BOOKING',NEW.id) ON CONFLICT DO NOTHING;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO "AdminNewNotice"(kind,id) VALUES('BOOKING',NEW.id) ON CONFLICT DO NOTHING; END IF;
 END IF;RETURN NEW;
END $$;
-- statement
DROP TRIGGER IF EXISTS streamline_customer_notice ON "User";
-- statement
CREATE TRIGGER streamline_customer_notice AFTER INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION streamline_new_notice();
-- statement
DROP TRIGGER IF EXISTS streamline_booking_notice ON "Booking";
-- statement
CREATE TRIGGER streamline_booking_notice AFTER INSERT OR UPDATE OF status ON "Booking" FOR EACH ROW EXECUTE FUNCTION streamline_new_notice();
