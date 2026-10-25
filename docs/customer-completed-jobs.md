# Approved Completed Jobs workflow move - 25 October 2026

Explicit approved scope: move Completed Jobs into every admin customer record and remove the separate top-level tab. The user chose the admin customer record, not the customer dashboard, and confirmed: Yes, implement that.

Workflow: Existing Customers -> select customer -> View completed jobs. The panel initially shows Completed jobs. Its existing Open jobs / Cancelled jobs / All outcomes filters preserve the previous review workflow within this customer. Staff can use Open jobs to confirm completed work or cancel eligible unfinished work, with the existing reason and financial/terminal-state rules.

The list is queried and paginated for the selected customer at the database boundary; it is not limited to the twenty bookings in the general customer summary. Empty accounts show a clear empty state. Reference search, refresh, automatic fifteen-second/focus refresh and pagination remain customer-scoped. Customer context is also checked before a review action. An old /admin/completed-jobs page link redirects to customer selection. The customer dashboard is unchanged.

This batch does not fix or implement workbook issue groups R01-R13, change pricing, invoice timing, refunds, password setup, maps or grid timing, and does not migrate or edit database records. Existing completion/cancellation rules are retained. No production changes, payments or emails were performed while preparing this batch.

Validation: all 19 isolated regression suites passed, including 17 new customer-scoping/component-simulation checks; complete frontend/backend TypeScript checks passed and backend production JavaScript emitted successfully. Frontend production build is included in the local apply/check command because this environment previously blocked Next output creation with EPERM. Live acceptance remains required after deployment.

Apply only with Apply-And-Check.ps1. It preflights all checksums before copying, backs up originals, builds the backend, checks frontend types, runs the full regression runner and builds the frontend. No database update is needed. Push-Approved-Change.ps1 stages only manifest paths, commits and pushes after checks, stopping on any failure.

Focused acceptance:
1. Open two different customers from Existing Customers. View completed jobs in each and verify no cross-customer job/total.
2. Open a new/empty account and see the explicit empty message.
3. Default filter shows completed work. Use Open jobs for an eligible test job, record a reason and confirm it; refresh Completed jobs and check the same customer.
4. Verify reference search/pagination beyond twenty records and automatic refresh of a driver's completion.
5. Check the global Completed Jobs tab is gone; the old page URL returns to Existing Customers.
6. Existing final outcomes, payment guards, reason validation, invoices, holds and customer-dashboard behaviour retain their existing rules.

Approval rule: all other application/system changes require the user's explicit approval of the specific scope. A failed test or suggestion in a document is not implementation permission.
