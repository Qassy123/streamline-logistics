# Approved admin simplicity changes — 25 October 2026

The user requested a single batch containing only the changes agreed during practical admin testing. This package follows that scope. The user explicitly confirmed the Quotes account layout and correcting misleading audit display. No driver-portal, pricing, invoice-policy, staff-permission, vehicle-data or production provider changes are included.

## Final changes

1. **Quotes in admin navigation and account sections.** The existing quote manager now has an account dropdown (including Guests and an explicit All accounts choice) and three simple section boxes. Current = open quotes for today/earlier; Future = open quotes with a future UK collection date; Completed = booked, cancelled or expired quotes. These definitions are visible under the boxes. Account/group filtering runs before pagination; late responses cannot replace a newly selected account's list. Existing quote management controls remain available. New quote creation stays in Planning.
2. **Both dates in customer Completed Jobs.** Separate Collection date and Completion date columns. Completion uses the first recorded COMPLETED tracking event, falling back to recorded POD delivery time. Legacy completed jobs without either show Not recorded. No timestamps are fabricated from the booking's last update, and no historical data is rewritten.
3. **Reports → Audit History.** Full existing audit page is now accessible inside Reports. Clear category buttons cover the existing record types; search, action/date filters, export and detail links remain. The old /admin/audit-log URL redirects to the new page with its query string.
4. **Correct misleading audit display.** A current booking snapshot no longer says Assigned merely because a driver or van is linked. It is labelled Created/Updated and clearly describes the current booking status. Original tracking/assignment event records remain intact. This is a display correction, not an audit-data rewrite.
5. **Reports → Documents and fetch fix.** The full document manager is under Reports, sharing its section navigation. Its API address now follows the same NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_API_URL / production Railway fallback convention as other admin pages, instead of falling back to localhost:5000 in a deployed website. Existing upload, filtering, associations, file access and authentication remain. The old /admin/documents URL redirects with its query string. No file storage credentials or upload limits changed.
6. **Guest booking history dropdown.** Current/future work stays in the main table. Previous bookings appear in a closed-by-default expandable section with separate pagination. Both lists use the existing row information/search; a search expands history so matches are discoverable. Completed/cancelled/expired jobs and older non-active jobs go into history; a genuinely in-progress older job remains in the main list. No statuses are changed or records archived/deleted.
7. **Drivers dispatch by required van category.** Booking cards are grouped under clear van headings. A Van category filter can load the complete category across pages; it filters on the server before pagination. Categories use the booking requirement before quote/physical-van fallback, and supported legacy labels are grouped consistently. Other vehicle types remain visible in All categories. Existing job selection, driver/van assignment, dispatch reviews and eligibility rules remain. Selecting a new category clears the previously selected job to avoid assigning a hidden selection.
8. **Planning booking error handling.** Expected MOT/availability refusals retain a clear 4xx response and reason instead of being incorrectly labelled 500. Reusing an already-booked guest quote returns a conflict before attempting another booking/reservation. Database unique conflicts also produce a useful refresh/check message. Unexpected server failures remain 500, with details kept in server logs rather than exposed to the website. This does not change MOT dates or bypass compliance.

## What was verified

- All 21 isolated regression suites passed, including 29 focused checks for this batch.
- Full frontend and backend TypeScript checks passed. Backend production JavaScript emitted successfully in the isolated checkout.
- Focused coverage includes account/guest isolation and pagination, quote sections and UK boundaries, guest history, required-van grouping, evidence-backed dates, audit snapshots versus original tracking events, Documents API-address resolution, old URL redirects, navigation and existing dispatch selection controls.
- Existing regression suites continue to cover payment/invoice/driver/booking behaviour. Their failure-scenario messages are intentional tests, not evidence of production errors.
- Frontend production build was attempted with the current application config. This tool environment again refused to create `.next/server/app/(public)/services` (Windows EPERM). The supplied local check/push script runs the normal frontend production build and stops before Git if it fails. No Next configuration changes are included.
- No real emails, uploads, payments, refunds, bookings or vehicle records were created/modified during preparation. Documents upload/download still needs a normal live retest after deployment with a harmless file.
- The exact exception behind the supplied Planning 500 is not available in the screenshot. The confirmed catch-all error-classification defect and duplicate guest-quote conflict are corrected and regression tested. If a genuine 500 remains after deployment, retain its quote reference and Railway log for diagnosis. The screenshot's MOT expiry was 23 October 2027, which is future relative to 25 October 2026; it was not proof of an expired-MOT failure.

## Preserved scope

- Unfinalise remains present and unchanged, with its existing unpaid/no-credit restrictions.
- Pricing amounts/rules, monthly invoice dates, payment/refund rules, staff permissions, customer/driver portal flows, genuine vehicle availability restrictions and existing saved-route behaviour are unchanged.
- No Prisma schema change or database migration is required.
- The comprehensive workbook is parked. Invoice tests remain after the 1 November billing run, pricing tests after tariff finalisation, Read Only tests after a fixture exists, and driver portal testing remains outside this admin batch.

## Apply and push

Use `Push-Approved-Change.ps1` from your normal VS Code PowerShell terminal. It requires main, checks for other staged files, preflights every replacement checksum and original-file baseline, backs up changed originals, applies only manifest files, builds the backend, type-checks the frontend, runs all 21 suites, builds the frontend, stages only manifest paths, commits if needed and pushes origin main. It stops on any failure. `Apply-And-Check.ps1` runs the same apply/check steps without Git.

No database command is required. Wait for both backend (Railway) and frontend deployment before checking the new endpoints/pages.

## Short post-deployment check

- Quotes navigation → choose an account → check the three sections and a second account.
- Customer Completed Jobs → check both labelled dates and the Not recorded fallback on legacy data.
- Reports → switch between Reports, Audit History and Documents. Check audit categories and a completed booking snapshot; upload/open one harmless test document.
- Guest Bookings → current work stays visible; Previous bookings expands and searches correctly.
- Drivers → check required-van sections/category filter, then select a job using the unchanged assignment controls.
- Planning → a genuinely non-compliant test fixture should show the compliance reason and stay blocked. Do not edit a live MOT date or bypass restrictions to manufacture a test.
