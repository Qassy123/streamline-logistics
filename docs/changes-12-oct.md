# Changes requested in the 12 October PDF

Prepared 21 October 2026. These are complete replacement files for the existing project, supplied in six batches of up to five files. Install every batch before generating Prisma Client or restarting the updated backend.

## Requirement coverage

| PDF request | Implementation |
| --- | --- |
| Maintenance must disable quotes completely | Server middleware blocks public and admin quote writes/calculation when Company Info maintenance is enabled. Existing records remain readable. Settings text explains the behavior. |
| Add an unfinalise button | Unfinalise appears in the customer invoice cards and invoice viewer. It returns an unpaid issued invoice to Pending, clears the current PDF link and records an audit. Paid/part-paid/credited invoices cannot use this action. |
| PDF top-right status | Pending drafts show PENDING; finalised, issued and unpaid invoices show UNPAID/DUE; paid invoices show PAID. Website downloads and email attachments render current status rather than a stale stored PDF. |
| Business account invoices due immediately | Business terms and due dates are enforced server-side, shown on the form/profile/PDF, and existing Business invoices can be corrected using the included audited policy SQL. Private account fallback terms are preserved. |
| Trade monthly billing | Eligible Trade bookings are grouped by the UK calendar month in which the booking was made. May bookings create Pending invoices on 1 June, due 15 June. The existing hourly backend scheduler runs the generator, with catch-up after downtime. Retries exclude already invoiced bookings. |
| Trade application terms | Preferred 7/14/30-day selection is removed. A prominent Trade account payment terms box contains both sentences from the PDF verbatim. Staff/customer term labels show the fixed monthly policy. |
| Email Trade approvals/rejections | Status changes save a decision-email outbox entry in the same transaction. Approval and rejection emails are attempted after commit. Failure is visible, remains retryable, and can be retried from the trade account screen or background scheduler. |
| Deleted account starts fresh, historical records kept five years | Deletion saves a restricted account snapshot and five-year retain-until date, revokes login/reset tokens, and removes the live account. Bookings/invoices/payments/quotes remain isolated by archive ID. Registration and quote/checkout replay cannot claim archived records. Email and username can be reused by a new user ID without restoring the old history. |

Monthly invoices enter the office Pending list; this does not automatically email an unfinalised invoice to a customer. Staff still review, finalise and send the invoice through the existing workflow.

## Installation order after all six batches

Run in PowerShell from the actual project. These commands require the project's existing environment configuration. They add schema fields/tables; they do not reset the database.

```powershell
& {
    Set-Location 'C:\Users\qasim\streamline-logistics\streamline-backend'
    npx prisma validate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma validation failed' }
    npx prisma db push
    if ($LASTEXITCODE -ne 0) { throw 'Schema update failed' }
    npx prisma generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed' }
    npx prisma db execute --file .\scripts\changes-12-oct-policy.sql --schema .\prisma\schema.prisma
    if ($LASTEXITCODE -ne 0) { throw 'Existing account policy update failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }

    Set-Location 'C:\Users\qasim\streamline-logistics'
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'Frontend TypeScript failed' }
    node .\release-tests\run.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Regression tests failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend production build failed' }
}
```

If Prisma reports a proposed destructive change, stop and keep the output. Do not use reset or accept-data-loss to install this package. The supplied SQL is transactional and re-runnable: it normalises account policies and logs the previous Business invoice terms before correcting them.

After successful checks, commit/push the intended files and deploy both frontend and backend through the established process. New schema must exist before the new backend handles traffic. Do not deploy a partially copied package.

## Verification completed during preparation

- Additive Prisma schema validated; an isolated Prisma Client was generated.
- Entire frontend and backend checked with the replacement source and new generated types.
- 13 isolated regression suites: 225 checks, including 32 new October policy/route checks.
- Invoice PDFs rendered and inspected for Pending, unpaid, paid and monthly Trade terms; UK June dates display as 1 June and 15 June.
- The isolated frontend production build could not complete because the Windows sandbox denied the native compiler access to its working directory. Run the production build above in the actual repository.
- No production database changes, real customer emails, real payments or deployment were performed during preparation.

## Live checks after deployment

1. Enable Company Info maintenance, save, then try a public quote and an admin quote calculation. Both must be blocked. Disable/save and confirm quoting returns.
2. Open an unpaid issued invoice, click Unfinalise and confirm it returns to Pending. Its preview must say PENDING. Finalise and download again: UNPAID/DUE. Record an appropriate test-mode payment and download again: PAID.
3. Confirm a Business invoice has immediate terms and an issue-date due date, including an invoice corrected by the policy SQL.
4. On a test/staging account, verify a closed calendar month's Trade bookings consolidate into Pending, due on the 15th. Retry processing and confirm no duplicate. Current-month bookings must not be invoiced early.
5. Check the Trade application notice and fixed monthly labels. Approve/reject controlled test applications and verify delivery to the intended test inbox. Test provider failure and Retry decision email.
6. On a disposable test account, note its records, delete it, then register again using the same email/username. The new account must have no archived history or old login/reset access. Office history remains available under the archive ID with a retain-until date five years later.

The restricted archive endpoint is `GET /api/admin/customers/archives/:archiveId`, using existing admin authentication. The deletion response and retained operational records include that archive ID. There is no customer archive access or automatic archive reassociation. No automatic purge was added: retained records must not be removed before their five-year date.

Previously deleted accounts from the old release were not tagged as archives at the time. This update does not guess ownership or silently remove records already attached to a live account; use the disposable deletion/re-registration test to verify the corrected behavior.
