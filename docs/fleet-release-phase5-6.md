# Fleet phases 5 and 6 — release package

Prepared 11 October 2026. Phase 5 implementation and Phase 6 automated verification/release preparation are ready. **Live release acceptance is still pending**, as requested. No deployment, production database update, payment, email, GPS collection or retention deletion was performed while preparing this package.

## Behavior

- Drivers enable phone sharing explicitly from an accepted, started job while clocked in to a working activity with its assigned van. Browser permission is required. Fresh updates are sent approximately every 15 seconds.
- Hiding the portal or losing connectivity clears the watcher, its timer and unsent coordinates. Returning does not restart collection. Use **Resume phone sharing**. No GPS is queued for offline replay.
- A break, rest, POA or shift end closes the server sharing session. Returning to work requires enabling it again. Job status, assignments and attendance/pay calculations retain their existing rules.
- GPS readings carry capture time, server receipt time, driver, van and assignment snapshot. A reassignment cannot reuse a previous assignment's point. GPS older than two minutes is stale, even when a later receipt exists.
- Dispatch gets a staff-authenticated map at `/admin/tracking`, with up to 25 active vans per page, booking, driver, next destination, accuracy and capture time. Blue points are recent; amber points are last known. Existing booking tracking tools remain in an expandable section.
- Staff access uses the existing SUPER_ADMIN, OFFICE_MANAGER or DISPATCHER accounts. The map does not accept a customer token or legacy shared admin key.
- Customer account tracking remains restricted to the booking owner. Public share links are booking-specific, read-only and expire after 24 hours. **Create new 24-hour customer link** revokes the previous link and displays the new URL; **Copy link** is a separate action for mobile clipboard compatibility.
- Public links expose only that booking's status, safe visible timeline and latest authorized point. They expose no addresses, driver contact details, location history, account credentials or private delivery evidence. Stopped, off-duty, reassigned, inactive or expired/revoked-driver-session location is hidden from customers.
- Legacy `/driver-tracking/[token]` and `/internal-tracking` pages point to the authenticated portals. They cannot collect or submit GPS anonymously.
- The existing website preview Basic-auth login still gates frontend pages, including tracking links. During preview, test recipients need that existing preview login. Public launch configuration remains a separate release step; backend booking-token validation remains required.
- Arrival times are labeled **planned arrival**. Live ETA and hardware GPS are explicitly unavailable. No new paid service or package is required. The fleet map uses already installed Leaflet and standard OpenStreetMap tiles; existing Google embeds remain optional for customer maps.
- The six-hour rule is preserved: a 09:00 booking/allocation reserves until at least 15:00, or its longer recorded end. This release does not shorten or extend that established minimum.

## Schema and retention

Only additive schema changes:

| Model | Addition | Purpose |
| --- | --- | --- |
| Booking | `trackingShareExpiresAt DateTime?` | Bounded share-link lifetime |
| DriverLocation | `capturedAt DateTime?` | GPS measurement time separate from receipt |
| DriverLocation | `vehicleId String?` | Server-side van snapshot, retained without a destructive FK |
| DriverLocation | `assignedAtSnapshot DateTime?` | Bind GPS to the assignment that produced it |
| DriverLocation | index on bookingId + createdAt | Latest-position queries |

Existing points and booking history are retained. Legacy points without the assignment snapshot are not presented as current GPS; enable sharing to produce a fresh bound point. Old hash-only links require a new expiring link. Existing Phase 2 and Phase 3/4 SQL protections remain in place; **no new custom SQL script is needed**.

Map visibility is limited to points from the last 30 days, and customer views never expose unrestricted history. Raw GPS retention preserves at least 366 days of operational history. Maintenance deletion is **dry-run by default**, limited to old points on COMPLETED/CANCELLED/EXPIRED bookings. Open jobs and configured held bookings are excluded. Bookings, inspections, handovers, photographs, POD, shifts and audit records are never deleted by this script. Any applied GPS pruning records an audit summary and processes at most 10,000 points per run.

Optional backend environment variable: `TRACKING_RETENTION_HOLD_BOOKING_IDS`, a comma-separated list of booking IDs whose GPS must be held. No new required environment variables. Existing API URLs, database, driver/staff authentication, Google map key and Cloudinary configuration remain applicable. Do not reduce required history or run deletion before reviewing company retention/holds. No automatic cleanup scheduler was created.

For the tile provider's attribution, caching and usage rules, see the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/). The fleet map uses normal browser tile requests, attribution and caching, without offline downloading or prefetching.

## Verification completed here

| Check | Result |
| --- | --- |
| Prisma 6.19.3 schema validation and isolated client generation | PASS |
| Entire frontend plus all replacement/new TypeScript files | PASS |
| Entire backend plus replacement/new TypeScript files | PASS |
| Backend production JavaScript emission into an isolated directory | PASS |
| Attendance/payroll calculations | 15 isolated checks passed |
| Clock-in, breaks, clock-out, retries and staff-role checks | 15 isolated checks passed; break test also confirms sharing closes without auto-resuming |
| Shared six-hour availability | 10 isolated checks passed |
| Handover/return, inspection, ownership and private evidence | 19 isolated checks passed |
| Ordered driver stop/evidence workflow | 37 isolated checks passed |
| GPS, customer ownership, token security, sessions and retention dry-run | 23 isolated checks passed |
| Foreground/offline/device permission and stop/retry behavior | 12 isolated browser-service checks passed |
| Tracking views, stale/expired states and map referrer policy | 9 isolated checks passed |
| Existing postcode/geocode matching | 7 mocked checks passed, no Google API calls |
| Total isolated regression checks | **147 passed across 9 suites** |
| Fleet/customer tracking layouts at 320, 375, 768 and 1280px | 8 viewport checks passed: no horizontal overflow and button targets at least 44px |
| Frontend optimized production build | **Not confirmed here**: Windows sandbox denied native compiler/build filesystem access (EPERM creating Next output/type directories). Run the actual project build below. |

The responsive preview used fixture data and a map placeholder for layout checks, not a connected live map. The tests mock persistence and external services; they do not certify PostgreSQL trigger races, real camera/GPS behavior, Cloudinary delivery or payment/webhook integration.

## Installation and local verification

Copy the full files in six batches (five per batch; last batch three). The companion `FILES.json` lists each exact destination and SHA-256. `Install-Batch.ps1 -Batch N` copies only that batch, creates new directories and backs up existing files under this package's `backups` directory. It performs no Prisma, deployment or git action. Re-copying a batch is safe.

Install **all six batches before** database generation, building or restarting services. The new code expects the new nullable columns and generated Prisma Client.

From VS Code PowerShell, after every file has been copied:

```powershell
Set-Location -LiteralPath 'C:\Users\qasim\streamline-logistics\streamline-backend'
npx prisma validate
npx prisma db push
npx prisma generate
npx tsc --noEmit
npm run build

Set-Location -LiteralPath 'C:\Users\qasim\streamline-logistics'
npx tsc --noEmit
node .\release-tests\run.cjs
npm run build
git status --short
git diff --check
git diff --stat
```

Stop if a check fails and retain the exact output. Do not deploy or push a failing build. The normal default Next/Turbopack production build still needs to pass on the actual project. A previous pre-Phase-5 build passed; it does not count as validation of this package.

Optional retention **preview only**, not needed to release GPS:

```powershell
Set-Location -LiteralPath 'C:\Users\qasim\streamline-logistics\streamline-backend'
node .\scripts\tracking-retention.cjs
```

Deletion requires separately supplying both `--apply` and `--confirm-retention-policy`. This package does not run either flag. Retention maintenance is separate from release installation.

## Live acceptance still outstanding

Use a clearly labeled test booking, assigned test driver and safe test van. Make one change at a time and retain the result; do not make live payments or send customer emails solely to complete this checklist. Use test-mode services/a staging database for destructive, concurrent or financial tests.

| Area | Test and expected result | Current evidence |
| --- | --- | --- |
| Driver authentication | Signed-out job routes denied; disabled and expired sessions denied; logout closes device collection; customer location hidden when no valid driver session remains | Automated; live recheck pending |
| Staff authentication | Dispatcher can view map; accounts-only role denied; expired staff session clears protected view | Automated; live recheck pending |
| Customer authentication | Account A cannot view account B's tracking, bookings, invoices or private evidence | Tracking automated; full account/invoice live checks pending |
| Clock-in/break/rest/clock-out | Start shift without a van, several breaks, resume, rest/POA, shift end; active delivery prevents clock-out; server intervals retained | Automated; live recheck pending |
| Overnight/DST and payroll | Overnight shift and rate/week boundary; attendance/work/pay stay separate; approved timesheet/CSV totals match and corrections retained | Calculation tests passed; payroll approval/export live checks pending |
| Allocation and reservations | 09:00–10:00 holds to 15:00 across quote/planning; 15:00 boundary releases; cancellation releases its own hold; longer end remains blocked | Automated and prior six-hour screenshot test; fresh concurrent database test pending |
| Conflict/maintenance/unsafe hold | Two simultaneous overlapping writes admit one; maintenance/unsafe defect blocks quotes, assignment and planning; resolve only the test hold through dispatch | Unsafe Fleet hold seen in prior screenshots; concurrency/resolve pilot pending |
| Handover/return | Take and return with photos/mileage/fuel; prevent duplicate open possession and lower mileage; dispatch approves; audited correction retains original | Prior user screenshots confirmed normal flow; automated regression passed |
| Daily inspections | All required results; saved draft; normal submission green receipt; safety-critical brakes hold; dispatch acknowledgement then separate resolution | Normal receipt and unsafe hold confirmed in screenshots; draft/retry/resolve live checks pending |
| Collection/delivery evidence | Complete collection with goods photos, each drop with photo/name/signature, damaged/refused exception reviewed before completion; wrong driver/stop/upload denied | Automated; **Phase 4 live pilot was postponed** |
| Private photo links and evidence PDF | Authorized signed photo opens; unauthorized/expired link fails; original evidence and review history retained in PDF | Automated ownership tests; actual photo/PDF pilot pending |
| Phone GPS | Safely parked: enable permission on real phone and started job; position/accuracy/capture time appear on staff map and customer views | Automated service/state tests; real GPS pilot pending |
| GPS stop/stale/background | Stop hides customer point; hiding/offline clears watcher; foreground requires Resume; last-known point becomes stale after two minutes without new capture; break/rest ends session | Automated; real Chrome/Safari/Android/iOS pilot pending |
| GPS assignment/session boundaries | Reassign van/driver, revoke/expire driver session or disable account; old point must not appear as current location on the new assignment/customer view | Automated; live recheck pending |
| Private share link | Copy new 24-hour URL; only its booking shown; wrong token/ref fail; rotate revokes old URL; expired URL has no map/history; link cannot submit GPS | Automated; real link/clipboard pilot pending |
| Website preview access | Open the frontend tracking URL with the existing preview login; verify the approved launch configuration before using links with real customers | Existing Basic-auth middleware retained; launch acceptance pending |
| Fleet map and customer maps | Blue versus amber markers, popup, accuracy circle, pan/zoom, pagination, planned arrival label; OSM attribution visible; existing Google key or fallback link works | Layout checks only; connected map pilot pending |
| Quotes/postcodes | Existing exact postcode route/distance and pricing; date/window or load changes recalculate; no unavailable van can be reserved | Postcode/availability mocked tests passed; full quote-to-booking live check pending |
| Stripe/payments | Staging/test-mode success, failure, cancellation and duplicate webhook; one booking/payment/reservation and matching total; no live charge | Not run here; credentials/test-mode acceptance pending |
| Invoices | One authorized invoice with matching amount and tax; duplicate webhook does not duplicate invoice; PDF/export/download permissions correct | Not run here; staging acceptance pending |
| Dashboards/navigation | Driver mobile Menu/all six destinations and bottom navigation, Today job state, admin/customer booking status, notifications and timesheets remain usable | Existing mobile navigation preserved; new tracking responsive checks passed; full live smoke pending |
| Database protections | Confirm existing Phase 2/3/4 triggers and indexes remain; competing assignment/evidence retries behave under PostgreSQL, not only mocks | Existing SQL was executed successfully in prior user terminal; post-install verification pending |
| Retention | Dry-run lists only closed-job points older than 366 days; configured held booking excluded; apply tested only on disposable data with audit | Dry-run mocked test passed; production deletion not run |

## Release decision

The source package and automated verification are complete. **Phase 6 final release sign-off remains open until the actual frontend build and the outstanding live/staging acceptance tests pass.** No automatic deployment or push was performed. Record acceptance results, then use the project's normal approved release process.

If rollback is needed before accepting the release, restore the backed-up source (or known-good git commit), regenerate the matching Prisma Client and rebuild. The nullable additive columns may remain in the database; do not drop history to roll back the application. Do not replace the existing Phase 2/3/4 SQL protections with an older schema/reset.
