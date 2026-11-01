# Approved changes — 1 November 2026

Source: changes 1st November.pdf, plus the user's subsequent approval that Existing Bookings must include every booking source.

## Included
- Industries added to desktop/mobile public navigation, linking to a directory of existing industry pages.
- Vehicles added to navigation, with Streamline's own existing branded assets, category specifications and two-van comparison. No competitor graphics or specifications were copied.
- Current, Future and Completed booking sections on the customer dashboard, customer Bookings, admin Existing Bookings and each admin customer account. Cancelled/expired records remain available. Active overnight jobs remain Current; future collections later today appear in Future.
- Existing Bookings is global across customer, guest and admin origins, includes unassigned work and paginates the complete result. The existing date-based calendar and management modal remain available. Booking links open the actual record and select its collection date.
- Booking confirmation prefers the business/legal entity name. Authenticated customers can resolve their booking reference without a Stripe session, including Trade Pay Later. The numeric booking reference sequence matcher is corrected.
- After-midnight time choices carry the correct collection date; same-day choices retain the existing two-hour lead time. New quote/booking/checkout operations reject elapsed slots server-side. Date/time checks do not prevent historical booking repricing or retries that retrieve an existing booking.
- Route-sheet PDF downloads in admin Drivers and driver Jobs. Files use the assigned driver's name, date, business/reference, collection and final-arrival estimates and route stops. Driver access is restricted to their own assigned jobs. Arrival uses road travel time, not the six-hour reservation hold. If Maps cannot provide an estimate, the PDF says so rather than inventing one.
- Admin booking SMS queue covering confirmed new bookings, cancellations, operational changes, driver assignments, transit and completion events. Events are recorded transactionally on the Booking table, so all booking origins are covered. Pending payment creation and existing historical records do not generate new-booking alerts.
- SMS destination defaults to 07301827224 (+447301827224), changeable through ADMIN_SMS_TO. New SMS status section sits inside Notifications. Provider acceptance is distinguished from confirmed handset delivery. Uncertain sends are not blindly retried; stale alerts are skipped.
- Removed the separate Payments shortcut from admin home and updated existing Documents/Audit shortcuts to their current Reports locations.

## Excluded by the user
- Timesheet changes: deferred pending the user's examples. Existing driver/payroll/timesheet code is unchanged.
- Customer self-service booking edits: cancelled. Future Bookings tells customers to call 07301827224 for changes or cancellations. No new customer-edit endpoint or button was added.

No price rates, mileage-band policies, billing rules, refund logic, fleet compliance rules or account permissions were changed.

## SMS deployment settings
The implementation uses Twilio's Messages REST API: https://www.twilio.com/docs/messaging/api/message-resource

Set these backend environment variables in Railway, not in frontend/public variables or chat:

ADMIN_SMS_ENABLED=true
ADMIN_SMS_TO=+447301827224
TWILIO_ACCOUNT_SID=<your Twilio account SID>
TWILIO_AUTH_TOKEN=<your Twilio auth token>
TWILIO_FROM_NUMBER=<your SMS-enabled Twilio number in international format>

SMS remains disabled unless explicitly enabled and all provider settings are valid. No live SMS was sent during preparation. Twilio account/phone provisioning and handset delivery must be verified after deployment. Accepted indicates provider acceptance, not delivery to the phone. Notifications shows queued, accepted, failed, uncertain and skipped alerts. Alerts older than one hour are not sent later as a historical backlog.

Setup-Database.ps1 installs only the AdminSmsOutbox table/index and the named Booking SMS trigger, transactionally. It neither backfills existing bookings nor modifies tariffs. DATABASE_URL must already be available from the backend environment/.env, as with the previous approved setup scripts.

## Hero video request — advice only
The PDF asks for a way to obtain a free/low-cost branded 2026 van clip. No replacement video asset was supplied or installed, so the existing hero stays in place.

Runway's free plan offers a one-time 125-credit allowance for trying supported models. Availability, export limits and paid tiers are described by the provider: https://runway.com/pricing and https://help.runwayml.com/hc/en-us/articles/50404627334547-Free-plan-details

Recommended brief: use an approved photo of the desired 2026 van, with the correct Streamline branding, as the image-to-video reference. Request a 5–8-second slow tracking shot with subtle natural movement and no added text. Check the logo closely; correct/overlay it in an editor if generation distorts it. Export a muted looping MP4 for later integration. No video generation, purchase, subscription or website hero change was performed.

## Validation
- Full frontend/backend TypeScript checks and isolated backend JavaScript generation.
- 23 isolated regression suites, including 25 new November checks for account isolation, website-wide booking visibility/pagination, time/date handling, references, route ownership/ETA/PDF, SMS configuration/provider failures/concurrency and database setup.
- Route PDF rendered and visually inspected; extracted text confirms driver, business, reference and estimated times.
- No production records, payments, Maps calls, SMS, Git commits or deployments were performed during preparation.
- The sandbox's normal frontend build encounters a Turbopack child-process error in app/globals.css. The user-side command requires the normal production build to pass before allowing database setup, commit or push.

## Quick checks after deployment
1. Open Industries and Vehicles from both desktop and mobile menus; compare two vans.
2. Place an admin, customer and guest booking for future dates; find each in Existing Bookings → Future. Confirm unassigned bookings remain visible and open the correct record.
3. Check Current/Completed on customer and admin views; ensure another customer's bookings never appear in a customer account.
4. Make a Trade Pay Later booking and check the confirmation reference and business name.
5. Select a late-night time that wraps past midnight; confirm the date and saved booking are tomorrow's. An elapsed time must be rejected.
6. Assign a job to a driver, download that driver's route sheet and check name, reference, collection and final-arrival estimates. A driver must not see another driver's jobs.
7. After configuring Twilio, make one test booking and confirm a single new-booking SMS reaches 07301827224. Review status in Notifications. Check a cancellation, assignment, edit and completion as needed.
8. Confirm there is no customer Edit action and admin home no longer shows the separate Payments shortcut.
