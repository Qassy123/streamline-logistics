-- statement
CREATE TABLE IF NOT EXISTS "AdminSmsOutbox" (
 "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL UNIQUE, "bookingId" TEXT NOT NULL,
 "reference" TEXT NOT NULL, "eventType" TEXT NOT NULL, "message" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "attempts" INTEGER NOT NULL DEFAULT 0,
 "providerId" TEXT, "lastError" TEXT, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- statement
CREATE INDEX IF NOT EXISTS "AdminSmsOutbox_status_nextAttemptAt_idx" ON "AdminSmsOutbox"("status","nextAttemptAt");
-- statement
CREATE OR REPLACE FUNCTION streamline_admin_booking_sms() RETURNS trigger AS $$
DECLARE event_name TEXT; event_key TEXT;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status::text IN ('CONFIRMED','ASSIGNED','IN_PROGRESS') THEN event_name:='NEW BOOKING'; ELSE RETURN NEW; END IF;
 ELSE
   IF NEW.status::text='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN event_name:='COMPLETED';
   ELSIF NEW.status::text='CANCELLED' AND OLD.status::text IN ('CONFIRMED','ASSIGNED','IN_PROGRESS') THEN event_name:='CANCELLED';
   ELSIF OLD.status::text='PENDING_PAYMENT' AND NEW.status::text IN ('CONFIRMED','ASSIGNED','IN_PROGRESS') THEN event_name:='NEW BOOKING';
   ELSIF NEW.status::text='IN_PROGRESS' AND OLD.status IS DISTINCT FROM NEW.status THEN event_name:='IN TRANSIT';
   ELSIF NEW."driverId" IS NOT NULL AND OLD."driverId" IS DISTINCT FROM NEW."driverId" THEN event_name:='DRIVER ASSIGNED';
   ELSIF NEW.status::text IN ('CONFIRMED','ASSIGNED','IN_PROGRESS') AND
     ROW(OLD."collectionDate",OLD."collectionWindow",OLD."collectionAddress",OLD."deliveryAddress",OLD."returnAddress",OLD."extraDrops",OLD."totalPrice",OLD."vehicleId")
     IS DISTINCT FROM ROW(NEW."collectionDate",NEW."collectionWindow",NEW."collectionAddress",NEW."deliveryAddress",NEW."returnAddress",NEW."extraDrops",NEW."totalPrice",NEW."vehicleId") THEN event_name:='BOOKING CHANGED';
   ELSE RETURN NEW; END IF;
 END IF;
 event_key:=NEW.id||':'||event_name||':'||md5(clock_timestamp()::text||txid_current()::text||random()::text);
 INSERT INTO "AdminSmsOutbox"("id","eventKey","bookingId","reference","eventType","message","updatedAt")
 VALUES(md5(event_key),event_key,NEW.id,NEW.reference,event_name,
   'Streamline: '||event_name||' '||NEW.reference||'. Collection '||to_char(NEW."collectionDate",'DD Mon YYYY')||' '||NEW."collectionWindow"||'. Check admin for details.',CURRENT_TIMESTAMP);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- statement
DROP TRIGGER IF EXISTS streamline_booking_sms ON "Booking";
-- statement
CREATE TRIGGER streamline_booking_sms AFTER INSERT OR UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION streamline_admin_booking_sms();
