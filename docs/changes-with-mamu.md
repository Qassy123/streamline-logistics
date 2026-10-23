# Changes with Mamu — 23 October 2026

Scope: only the eight requests in `changes with mamu.pdf`, plus the user's specific refund and test-data instructions in this chat. No live changes were performed during preparation.

| PDF request | Result |
|---|---|
| Suspend / Reject buttons | Modal feedback is visible and scrolled into view. These decisions submit their own status/reason without unrelated edited fields blocking the decision. Reasons remain required. Suspend applies the existing account/credit hold; Reject keeps its decision email. |
| Downgrade Trade to Business | Explicit action and searchable DOWNGRADED state. Future bookings are pay-now. Earlier Trade bookings/invoices retain their original billing basis and monthly terms. History, balances, payments and approved credit limit are retained. Generic customer editing directs downgrades through this protected action. |
| Admin-created customer password | Creation emails a 24-hour single-use setup link to the registered account email. Only a hash is stored. The profile reports delivery failures and offers resend. The existing reset process changes the password and revokes old sessions. |
| Account name label | Customer detail/edit uses Account/business name. |
| Invoice sidebar dropdowns | Finalised/Issued and Paid/Cleared use initially collapsed native details controls; Pending stays expanded. Historical Trade invoices remain visible following downgrade. |
| Small Van / SWB availability | Read-only live checks found Small Van MOT expiry 30 September 2026 and unfinished On delivery jobs on both vans. The authorised, dated repair below changes only that Small Van test MOT and the pre-existing IN_PROGRESS jobs on those two inspected vans. Operational availability protections remain active. |
| Existing booking changes | Saves addresses, additional stops, collection time, vehicle, references, notes and prices. Route/category changes recalculate mileage and pricing using the existing quote calculator. Explicit manual prices and signed adjustments are supported. Booking, quote, reservation times, pending invoice booking descriptions and refreshed planning grid use the corrected details. Stale editors are rejected. |
| Finalise | Visible progress/errors in the invoice modal. Issuance locks/rechecks the invoice, stores a versioned PDF and returns the saved state; repeated clicks are idempotent. Storage failure retains the draft. Future Trade issue dates still apply. |

## Price changes and refunds

- Trade: update pending financial lines and credit exposure. Issued invoice totals remain immutable: reductions create credit notes; increases create a separate draft charge. The approved credit limit is not changed.
- Business: a reduction of money actually received creates a pending refund request, visible in the booking editor. Saving never automatically refunds a card. An administrator approves the exact amount and original method.
- Stripe approval returns to the original payment intent with a stable idempotency key. Interrupted/pending responses are reconciled through Check / retry on the same request. Successful approval creates the relevant credit record.
- BACS/manual approval creates a manual refund task. Complete the transfer through the original method, then record its reference. No automated bank transfer is sent.
- Additional Business charges update the booking amount; saving does not charge a customer's card automatically.
- A financial change is blocked while an already approved refund is being processed or awaits manual completion.

## Apply and validate

Run `Apply-Changes.ps1`, then `Update-Database-And-Check.ps1` from this package. The first preflights all source/target SHA-256 hashes, backs up originals and preserves literal [id] paths. It stops before copying if the project changed since preparation. The second applies the additive Prisma schema, regenerates the client, builds the backend, checks frontend types, runs all 18 regression suites, builds the frontend, and finally runs the explicitly authorised test-data correction.

The configured backend DATABASE_URL is used. No reset, accept-data-loss flag, forced Git operation or external email/refund is included in these scripts.

`streamline-backend/scripts/mamu-test-availability.cjs` defaults to preview. `--apply` makes the authorised changes. It verifies the exact inspected vehicle IDs/types, changes MOT only if its old date is still 30 September 2026, and only completes IN_PROGRESS jobs created by the fixed 23 October 2026 cutoff with collection before 24 October. It does not complete newer jobs, invent driver proof, change other vans or bypass compliance. Every changed record is audited; reruns do not repeat completed corrections. A six-hour hold or other valid operational restriction can still make a van unavailable.

## Verification performed before delivery

- Prisma schema validation passed against an isolated schema/client; no database connection used.
- Full frontend and backend TypeScript project checks passed; backend production JavaScript emitted successfully.
- All 18 isolated regression suites passed, including 41 new checks for these requests.
- Mock persistence, email, PDF storage and Stripe only; no real refunds, customer emails or live database writes were performed.
- A frontend production build remains a local check in the supplied command: this environment previously blocked Next build output creation with EPERM. Compilation/type checks do not substitute for live acceptance.

## Focused live checks after deployment

1. Give a suspension reason; suspend, verify login/credit hold, reactivate. Reject a test application and verify decision/email feedback.
2. Downgrade a disposable Trade test account: new bookings pay now, old Trade invoices/terms and balances stay accessible.
3. Create a test customer using an inbox you control; follow the setup email, set password and log in. Reusing the link should fail.
4. Expand/collapse Finalised and Paid sidebar sections. Pending stays visible. Confirm the account label.
5. Check Small Van and SWB for a genuinely free future window after the approved repair.
6. Edit a test booking's address/stops/time; compare new mileage, total, quote and planning grid. Test one positive charge and negative reduction.
7. Check Trade exposure changes without changing its approved limit. For paid Business, verify refund is pending until admin approval. Use Stripe test mode for money movement; for BACS record the real manual reference only after transfer.
8. Finalise a valid due Trade draft; verify status and PDF, retry, unfinalise an eligible unpaid invoice and finalise again. Check a future invoice displays the scheduled-date message.
