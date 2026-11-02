# Approved 2 November changes

Scope follows the nine-page user PDF and the explicit confirmation to renumber both existing and new records.

1. Existing Customers and Existing Bookings have red new-record navigation badges and a review list with Mark checked, using the same polling/review pattern as invoices. Checking persists on the server. Existing records are not backfilled into new-record notifications.
2. Existing accounts are renumbered SL-01, SL-02 and existing bookings SL#001, SL#002 in creation order. Future inserts use database sequence triggers across customer registration, guest checkout and admin creation. Values grow beyond two/three digits without truncation. A retained database reference map records every old/new pair; linked invoice-booking/line references are updated. Old issued PDF files and historical audit text remain records of what was originally issued. Existing tracking links resolve through the mapping while keeping token checks.
3. Invoice service descriptions no longer show automatic fuel surcharge text. Live pricing already excludes automatic fuel. Only a manually added invoice charge can introduce a fuel-charge line. Existing issued financial amounts are not silently changed.
4. The malformed A characters shown in the account dropdown and mileage breakdown are repaired.
5. Existing Bookings details show the customer's two-hour collection window; the grid keeps the six-hour vehicle hold. Planning's Financial / operational status and Existing Bookings details have full saved-rate breakdowns with subtotal, VAT and total, including discounts and price adjustments.
6. Customer booking confirmation and payment-received messages have separate persistent send checks guarded by transaction locks and provider idempotency keys. Paid Business invoice PDF is attached to the payment-received email. Explicit provider failures remain retryable; the test suite sends nothing externally.
7. Planning creation and editing offer the same active, date-valid, global/customer-specific discount rules used by invoices. Selection is validated server-side and changes flow through existing repricing, Trade balance and Business refund-review rules.
8. Invoice body order: customer details; service details; ordered route details; base fare unit price; per-mile unit price and distance; per-stop unit price and count; manually added charges/discounts; subtotal excluding VAT; VAT; total including VAT. Existing company header and payment details remain. New quote snapshots retain journey duration for service details; older records with no recorded duration do not invent one.

## Apply / push

Run Push-Approved-Change.ps1 from the package. It checks main and rejects unrelated staged files; validates source hashes; backs up and applies only manifested files; builds the backend; checks frontend types; runs release tests; runs the normal frontend production build; then runs Setup-Database.ps1 and commits/pushes only approved paths. Setup uses the existing backend DATABASE_URL without displaying credentials. The database update is transactional and guarded against renumbering a second time. No emails or SMS are sent by setup. Do not run prisma db push or reset.

The user-visible reference numbers change as explicitly approved. Database IDs, booking schedules, prices, payments and account relationships are preserved. The approved renumbering mapping remains available in November2ReferenceMap. No hero/video, driver portal, tariff-rate, monthly billing-date or unrelated UI change is included.

## Verification

Frontend/backend TypeScript and isolated regression suites, including dedicated 2 November checks. Invoice PDF rendered and visually inspected with real PDFKit. Live PostgreSQL trigger execution and deployed emails/notifications remain acceptance checks after the user applies the package. Production frontend build is enforced by the supplied script; the sandbox Turbopack build restriction remains unchanged.
