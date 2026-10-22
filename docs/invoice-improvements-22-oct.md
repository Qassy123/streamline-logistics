# Invoice and profile improvements - 22 October 2026

## Included

- Invoice PDFs follow the supplied sketch: SL logo, invoice/status/dates, bill-to/account terms, booking descriptions, quantity/net unit/VAT/gross charges, totals, bank transfer details, amount due and thank-you footer.
- New invoice numbers are short numeric sequences (01, 02, ... 99, 100). They continue the configured next-invoice counter; for example, if it is 14 the next number is 14. Existing invoice numbers, payment references and issued records are preserved. All automated/manual creation paths share atomic counter reservation and skip existing numbers. Credit-note and booking reference formats are unchanged.
- Each consolidated booking shows its own route. PDF details include collection/delivery, ordered extra stops and return, collection date/window, service/vehicle, customer/PO references, load/pallets/fragility/capacity, distance, special instructions, handover contacts/notes and saved quote pricing where available. Existing invoice charges, quantities, discounts, VAT and totals remain authoritative; quote pricing is labelled as reference information, never added to the bill twice. The system cannot reconstruct details that were never saved in an older quote.
- Customer invoice cards and the admin invoice modal consistently use the invoice issue date, with fallbacks for older records.
- Pending invoices are filtered at the customer API boundary and in the customer UI, so customer invoice counts and totals use issued records. Nested public/customer booking payloads also exclude pending invoices. Protected PDF ownership/pending checks remain enforced. Trade credit exposure still includes committed services; it is separate from issued invoice totals.
- The footer stays on the current page. Long descriptions and instructions paginate without dropping content; continuation pages have headers/page numbers. No artificial one-page restriction on long invoices.
- Draft creation wording now describes previous calendar month, issued 1st/due15th.
- Customer Profile has a read-only billing section: account type, accounts email, payment/invoice mode and applicable payment terms. Trade uses the full monthly notice and May/June example; Business is due immediately.

No database schema changes or policy SQL rerun are needed for this package. No live records, payments, emails or deployments were changed during preparation. No website-wide mobile redesign is included; that remains deferred.

## Install

Run Apply-Update.ps1 from this package. It verifies package and existing-file hashes first, backs up replaced files in a timestamped folder under Windows Temp, then copies in groups of at most five files. If it detects intervening edits, it stops before copying anything; retain those edits and reconcile the named file before retrying.

Run the checks and Git commands in COPY-BATCHES.md after copying all groups. Frontend and backend deploy from the same final commit.

## Verification completed here

- Full frontend TypeScript check: zero errors against all project files plus replacements.
- Full backend TypeScript check and JavaScript emit: zero errors.
- 15/15 isolated regression suites passed, including 19 new invoice improvement checks (259 checks total).
- Four synthetic PDF fixtures generated using the real PDFKit renderer. Simple Business and paid invoices: one page each. Fully detailed consolidated: two pages. Stress fixture with 180 instruction lines and a long charge description: five pages, all content preserved. Every rendered page was visually inspected; footer/status/date and content checks also passed.
- A production Next build must still run in the actual checkout using the supplied command; it was not completed in this isolated preparation environment.

The previews use fictional customer and bank details; production PDFs use Company Settings and actual invoice data.

## Live tests still needed after deployment

1. Pending INV-000012 disappears from customer invoice list/count/totals; finalise it and verify it appears; unfinalise it and verify it disappears again.
2. Download simple and consolidated PDFs; check logo, dates, every saved quote detail, charges, footer and page breaks. Existing invoice numbers stay unchanged; create a disposable test invoice to check the next short number.
3. Compare admin customer card, invoice list, modal and PDF issue dates for INV-000012.
4. Check read-only Profile terms for Trade and Business accounts.
5. Deferred acceptance: Trade approval/rejection emails and retry; monthly generation scheduling/duplicate prevention with real PostgreSQL; account deletion/re-registration and archive isolation. These are not claimed as live-tested.
