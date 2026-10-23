# October 23 requested changes and reported defects

This batch implements the five requirements in changes 23rd oct.pdf and the actionable notes in the supplied completed test checklist. It keeps Business checkout payment requirements intact. The source files are staged for copying into the existing project; no deployment or live database operation was run by Codex.

## Implemented behaviour

| Request or checklist reference | Result |
| --- | --- |
| PDF Business invoices; NEW-09/10 missing invoices | A verified, fully paid checkout creates a PAID receipt after the payment is recorded. Receipt, financial lines and allocation commit together. Retries reuse the receipt. Business customer invoice access returns paid receipts only; the customer record has a Paid Invoices box without Pending/Issued workflows. Unpaid Business manual drafts are rejected. |
| PDF monthly completed-job policy | The monthly Trade generator includes COMPLETED bookings only. Cancelled, expired, pending-payment and open jobs are excluded. Driver completion uses the same Booking status displayed in the new Completed Jobs tab. |
| NEW-07 Trade dates; user clarification | Bookings made in October are invoiced 1 November, due 15 November; November bookings are invoiced 1 December, due 15 December, through all months and year rollover. The automatic cycle uses the existing booking-created calendar month in Europe/London. A manual Trade invoice derives these dates from its supply month. Business receipts are generated immediately after successful payment. |
| PDF completed jobs | The new admin tab shows shared job outcomes, searches references/accounts and refreshes every 15 seconds and on focus. Admin can confirm completion or cancel an uncompleted job with an audit reason. It does not invent driver signatures/photos. Completion retains the six-hour vehicle hold; cancellation releases the reservation. |
| PDF invoice notifications | Invoice-tab count and account-specific notices identify unchecked drafts. Mark checked persists a timestamp, removes the notice and records an audit event. Merely viewing does not dismiss it. Reopening or changing draft financial details clears the check. Finalising removes the notice. |
| PDF saved routes | Customers can rename their own saved routes. Searchable dropdowns show named routes on the customer quote form, Saved Routes page and admin customer quote form. Staff lookup is scoped to the selected customer; rename is scoped to the signed-in owner. |
| PDF expired tax/MOT | Expired MOT/tax or expiry before a reservation ends blocks the vehicle, with explicit reasons. The admin planning override cannot bypass expiry. Existing due-soon warnings remain available. |
| NEW-13 | Removed the Create Draft Invoice button; Manual Invoice remains. Automatic monthly Trade generation remains active. |
| WEB-04 / WEB-09 | Public service copy and index show Same Day, Next Day and Multi-Drop. Footer service pages use the current blue identity and working quote route. Unsupported full-load/full-day/half-day service URLs redirect to Same Day. The footer Payments link opens a payment information page; quote-specific checkout still works. |
| MAI-06 revised instruction | Maintenance blocks customer quote writes and public entry. Valid admin-key or authorised staff requests can still generate quotes. A client-supplied bypass flag cannot grant access. |
| CON-07 confirmed phone | Company phone is 07301827224 throughout source content. The supplied SQL updates the existing CompanySettings telephone used by settings-driven pages and PDFs. Email/address are preserved. |
| ACC-13 | Customer and staff email recovery support password reset and sign-in reminders. Password-reset credentials are random, hashed at rest, time-limited, single-use and scoped to account type. Reset checks account activity and revokes sessions and other reset links. Driver recovery already exists and is preserved. Recovery links are available on active sign-in screens. |

## Invoice timing and existing records

A new Trade booking will not immediately create an invoice in the admin invoice list. It becomes eligible after its booking month closes and after its job is marked completed. The recurring monthly scheduler and catch-up processing remain responsible for generation. Checked drafts still need finalising; a future-dated Trade invoice cannot be finalised/sent before its scheduled issue date.

The update does not invent payments, rename issued invoice numbers, erase historical invoices, or rewrite previously issued financial history. If an older Business invoice is missing despite a successful test payment, record its booking/payment reference so the payment ledger can be checked. Never mark an old invoice paid solely to change its display.

## Schema and application

Additive Prisma changes: nullable Invoice.checkedAt and a separate AccountRecoveryToken table. Existing fields/history are retained. Run the supplied database/test script against the existing configured DATABASE_URL, then deploy the code. The company-phone SQL changes only CompanySettings.telephone.

Email recovery uses the existing RESEND_API_KEY, sender configuration and FRONTEND_URL. Its live delivery still needs a controlled inbox check. Shared admin API keys are configuration credentials, not password accounts; their existing Railway configuration remains the recovery/rotation mechanism.

## Validation performed in isolation

- All 16 regression suites pass, including 23 new October 23 behaviour checks and an additional Business paid-receipt list check. Persistence, payment providers and email delivery are mocked.
- Full frontend/backend TypeScript checks report no errors; backend JavaScript compiles in an isolated output directory.
- Prisma schema validation and isolated client generation pass.
- Production Next build could not finish in this execution environment: filesystem EPERM while creating .next/server/app directories. A shorter build path and disabling the build worker did not resolve the restriction. The source project was not changed to work around it. Run the included normal production build locally before pushing.
- No live payments, emails, booking changes, schema pushes or deployments were performed.

## Focused operator retest after deployment

| Check | Expected |
| --- | --- |
| Business test checkout | One receipt appears directly in Paid Invoices, totals/payment allocation agree, customer can download it. Refreshing confirmation creates no second receipt. |
| October/November Trade dates | October completed work is 1 Nov / 15 Nov; November completed work is 1 Dec / 15 Dec. Business is detected automatically and remains immediate paid receipt handling. |
| Manual Trade invoice | Selecting Trade and an October supply date sets 1 Nov and 15 Nov; trying different input dates cannot create a past due date. Future issue cannot be finalised early. |
| Completed job states | Admin completion and driver completion appear on the same tab; cancellation excludes open work from monthly generation; cancelled/unfinished jobs do not invoice. |
| Invoice review | Open a notice, verify it stays; Mark checked removes it across refresh; financial edit/unfinalise makes it require checking again. Account link opens the correct account. |
| Saved routes | Rename two routes, search by name, load one on customer and admin forms. Another customer cannot rename/access it. |
| Expired compliance | Expired MOT and expired tax both block admin booking/assignment even with override; the error identifies which expired. |
| Maintenance | Customer quote entry/writes block; authenticated admin quote calculation succeeds. Restore the intended maintenance setting afterwards. |
| Footer/contact | All three service links work, Payments opens without quote ID, quote-specific checkout still loads, company phone is 07301827224 including a freshly rendered PDF. |
| Recovery | Controlled customer/staff inboxes receive links; reset revokes sessions; used/expired/wrong-account-type links fail. Existing driver recovery still works. |

## Tests deliberately deferred by the user

NEW-15 is a scheduling reminder, not a reported defect: assign a later date/owner for the still-unperformed live tests. TRA-07 approval-email delivery, TRA-10 repeated-decision email behaviour, REL-10 rollback rehearsal, REL-12 real payment checks after launch, deletion/re-registration and full production monthly-generation/concurrency acceptance remain deferred. They are not marked Passed by the isolated regression results. The supplied completed checklist itself is unchanged.
