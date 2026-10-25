# Returned testing workbook: approved fault fixes — 25 October 2026

Scope: the user explicitly approved fixing faults in the returned Detailed System Testing Workbook, then resuming the remaining tests. Blank, joint, unclear and date-dependent tests are not treated as confirmed faults. Username selection and the proposed office quote-to-email-to-payment workflow are excluded. No production database records, provider settings, payments, refunds or customer emails were changed during preparation.

## Changes and evidence

| Workbook cases | Result in this batch | Evidence / live retest |
| --- | --- | --- |
| WEB-05 | Payments information now uses the website navy/blue styling, responsive cards, clear Business and monthly Trade terms, invoice links and contact details. Quote-specific checkout is preserved. | Render check passed. Open the footer Payments link on desktop and mobile. |
| ACC-06 note | A suspended login explains the restriction after a correct password. Existing authenticated sessions receive a suspension notice; the quote form checks account status before mounting. | Correct/incorrect password, existing-session and quote-gate checks passed. Retest with a disposable suspended customer. |
| ACC-09 | Used/expired/wrong-account password links are validated before password fields appear. Existing transactional single-use reset protection remains enforced. | Backend replay/expiry/inactive tests and rendered form checks passed. Username selection is not included. |
| ACC-11 note | Signed-in mobile menu includes Dashboard and Logout, using the header's existing authentication state. Signed-out menu includes Login and Create Account. | Both menu render states passed. Retest the real mobile menu after login/logout. |
| TRA-05 | Explicit Retry decision email can create a missing older approval/rejection notification without changing account status. Retry failures are visible; an empty queue no longer claims emails were sent. | Isolated retry, duplicate protection, provider success/failure and existing approval/rejection checks passed. No customer email was actually sent. |
| TRA-06 | Suspension and reactivation now have their own queued, escaped messages. Real status transitions create one notification; saving the same status does not create another. | Transition, content and retry checks passed. Check delivery using a controlled test account after deployment. |
| TRA-08 | Dashboard and checkout explicitly say Trade credit is on hold, show the recorded reason and a contact route. Pay Later stays unavailable; Pay Now remains available where already allowed. | Render and account-response checks passed. Server credit enforcement is preserved. |
| TRA-09 note | Downgraded Business accounts receive an explicit downgrade/pay-before-confirmation notice instead of application under review. Rejected/suspended accounts also receive their correct status. | Rendered status checks passed; genuine pending applications retain the review message. |
| ADR-02/03/04 | Current address resolution already handles both pharmacy variants and Kiosk 1 through exact matching premises/parent sites. No new address fallback was added. Full entered delivery text remains unchanged. | Read-only Google calls resolved all three addresses; a pharmacy route returned 36.4 miles. Address regression checks passed. The deployed calculator rejected the available local admin credential (401), so saved-record/live-site acceptance remains to be repeated. |
| PLAN-02/03/04/05, EDIT-02/03/04/05/07, FLEET-05 note | Both calendar queries include overnight holds even when legacy end timestamps are short or missing. Both grids display the full minimum six-hour hold across dates, retain longer saved holds and label overnight times clearly. Reservation duration is now six elapsed hours in every host timezone, including DST changes. | Winter/summer, missing/short/inverted timestamps, longer holds, midnight boundaries and both UK DST changes passed. In ordinary winter time, 22:00 ends at 04:00 the following day. Clock-change nights still reserve six actual hours. |
| EDIT-01 | Existing booking edit repricing was already present and is retained. Corrected addresses/mileage/total and revised reservation times are returned together. Calendar carryover/display fixes above apply to the edited record. | Address repricing, failed-lookup rollback and combined reprice/22:00-to-04:00 save checks passed. A real saved booking still needs an end-to-end deployed retest; do not assume the workbook failure passed merely from mocks. |

The separately approved Completed Jobs move is carried forward unchanged in this package so it can be committed together if still pending. It stays inside every admin customer record; its former top-level tab stays removed.

## Verification completed

- 20/20 isolated regression suites passed: 352 checks, including 37 new workbook fault checks and two additional booking edit regressions.
- Full frontend and backend TypeScript checks: zero errors. Backend production JavaScript emitted successfully in the isolated verification checkout.
- Google geocoding and a route were checked read-only. No quote/booking was saved by those checks.
- Resend domain inspection was rejected (403); this does not establish whether production email delivery is configured correctly. A provider acceptance mock is not proof of inbox delivery.
- The frontend production build was attempted with the current application config. Windows refused to create `.next/server/app/(public)/services` with EPERM. The local apply/check script runs the normal production build and stops before Git if it fails. No Next config changes are included.
- No schema change or database migration is required for this batch. Decision types use the existing string field.

## Retest these faults first after deployment

Use disposable customer accounts and bookings. Use a controlled inbox for emails; do not send tests to real customers. Do not move the production clock or bypass monthly invoice dates.

1. **Payments and mobile navigation:** open footer Payments; check layout and links. On a mobile-width screen, log in and open Dashboard from the menu. Log out and confirm the signed-out links return.
2. **Suspension and password links:** suspend a test customer, try a correct-password login and an already-open session's quote link. Confirm the suspension/contact message appears before quote fields. Use a fresh password link once, then reopen the original email link; no password form should open.
3. **Trade emails:** approve/reject separate test applications; suspend/reactivate a test Trade account with a reason. Confirm each message arrives with the correct status. For an older decision with no notification, use Retry decision email. Record the visible error if delivery fails; do not flip the status repeatedly to force email.
4. **Credit hold and downgrade:** hold test Trade credit and inspect dashboard/checkout. Confirm an explicit hold heading and reason; Pay Later must stay blocked. Downgrade a separate test account and confirm the Business notice replaces under review, while historical invoices remain accessible.
5. **Overnight grids and fleet availability:** schedule an ordinary winter-date booking at 22:00. On that date check the block to midnight; on the next date check its carryover to 04:00 in both Planning and Existing Bookings. Attempt an overlapping use of the same vehicle before 04:00; it must be blocked. Verify availability from the release time, subject to other genuine holds/compliance. Leave vehicle/MOT restrictions intact.
6. **Booking edits and addresses:** on a disposable booking change the delivery to a materially different valid address. Save/reopen and compare address, mileage, total, quote and grid. Move it to 22:00 and verify the next day's carryover. Repeat the two pharmacy variants and Kiosk 1 from the workbook, retaining the full address text. A deliberately unmatched address must show an error and leave the saved booking unchanged.

Once these fault retests pass, resume the separate Tests To Complete Together PDF. Leave the excluded new features for separate approval.

## Apply, check and Git

Package scripts preflight every destination hash, back up changed originals and stop if a file changed since preparation. Only manifest paths can be staged. Other already-staged files are left alone and cause the push script to stop for review. Do not use `git add .` for this batch.

- `Apply-And-Check.ps1`: apply approved replacements, build backend, type-check frontend, run all regression suites, build frontend. No Git push.
- `Push-Approved-Change.ps1`: require main and a scoped index, run the complete apply/check sequence, stage manifest paths, commit if needed and push origin main. It stops on any error.

Do not push until the local build/check command completes. No database command is needed.
