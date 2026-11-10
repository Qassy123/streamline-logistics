# Ask Streamline

The goal is one assistant for all Streamline admin work. The first integrated build provides navigation for the admin sections each staff member can access and read-only lookups for selected workflows. Keep the feature disabled in production until the full release acceptance criteria below have been met.

The pilot also explains verified procedures for dispatching bookings, consolidating Trade invoices, finalising and sending drafts, recording invoice payments, approving driver timesheets, reviewing commercial weekly mileage, and downloading delivery evidence. The signed-in staff member's permissions filter the available guides. Gemini selects a topic, then the backend returns the matching steps and page link directly. The assistant asks for clarification when the topic is ambiguous and says when a procedure has no verified guide. Extend these guides alongside changes to their admin screens.

## Release coverage

| Admin workflow | Initial build | Required for full release |
| --- | --- | --- |
| Quotes, existing and guest bookings, planning, completed jobs | Planning by day, reference search where allowed, section links | Quote and booking lifecycle, availability and dispatch changes, guest workflows and completed jobs |
| Customers and trade accounts | Reference search where allowed, section links | Account creation and updates, billing settings and trade-account management |
| Commercial tariffs, contracts and rota | Contract review and weekly mileage by exact account reference, section links | Tariff and contract management, shift changes, cancellations, mileage and monthly billing review |
| Invoices and payments | Reference search where allowed, section links | Individual and consolidated invoice preparation, invoice lifecycle, explicit sending and payment allocation |
| Fleet, drivers, hours, tracking and evidence | Fleet and driver summaries, reference search where allowed, section links | Assignments, availability, timesheets, tracking, handovers, defects, documents and evidence |
| Reports, documents, audit, notifications, search, pricing and company settings | Section links | Scoped report and record lookups, exports, updates through approved workflows |
| Staff and permissions | Super Admin-only staff totals and section link | Full staff review and confirmed updates |

Map each action against its existing admin screen and route, including record selection, current role, required form fields, confirmation, business validation and success or failure state. Reuse the existing business endpoint and calculation. For actions that change data, create a short-lived proposal tied to the staff account, record and action, display exact changes, require approval, recheck authorization and record state, and make execution safe against duplicate submissions. Sending an email needs its own explicit action. Keep credentials and document contents out of model prompts. Use test fixtures for the complete matrix before release, including staff roles, concurrent requests, revoked sessions, expired or duplicate approvals, and the shared spending limit.

## Isolated testing

The backend uses the existing admin proxy and session middleware. Gemini calls use Google's HTTPS API. This avoids adding a package dependency while the npm registry is inaccessible from the workspace. The assistant handles one question at a time and uses only a predefined set of read endpoints. Its link is built by the backend.

1. Run the following from `streamline-backend`, with Prisma pointed at a test database.
   ```powershell
   npx.cmd prisma db execute --schema .\prisma\schema.prisma --file .\scripts\admin-assistant.sql
   ```
2. Set `ADMIN_ASSISTANT_GEMINI_KEY` on the test backend with a dedicated Gemini project approved for the data being used. Set `ADMIN_ASSISTANT_ENABLED=true` there. Neither value is public or needed on the frontend. Keep `ADMIN_ASSISTANT_ENABLED` unset on the live backend.
3. Set `NEXT_PUBLIC_ADMIN_ASSISTANT_ENABLED=true` for the test frontend build only. If it is unset, the panel does not mount or send any assistant requests. Start the backend and frontend and sign in on the test site. Ask which bookings need a driver today and compare the answer with Planning. Try a commercial contract lookup with an exact customer account number and month. Verify a Dispatcher cannot retrieve invoices and a regular staff account cannot retrieve Staff and Permissions.
4. Temporarily set `ADMIN_ASSISTANT_MONTHLY_USD=0.001` on the test backend to verify the budget response before any generation call. Unset the override to restore the default.
5. Ask “How do I assign a booking to a driver?” and check the steps against Drivers. From Invoices, ask “Explain this process” and verify it asks which invoice workflow you mean. Check that an account without payroll permissions cannot retrieve the timesheet approval guide.

The first build reserves estimated cost in PostgreSQL before each Gemini call, settles from provider token totals, and retains the reservation if a provider call fails ambiguously. The shared ledger rolls over at the start of each UK calendar month. Its default ceiling is US$14 of estimated model usage to leave room within the £15 planning budget for FX and taxes. It covers calls through the assistant only. Verify provider pricing, billing currency, tax and usage before enabling the live feature. The ledger measures estimated API costs rather than the provider's final sterling invoice.

## Testing with live records

Use a dedicated Gemini project with active Cloud Billing for this UK-facing app. Store the key on the backend as `ADMIN_ASSISTANT_GEMINI_KEY`. The pilot defaults to Super Admin only. Leave `ADMIN_ASSISTANT_ALLOW_STAFF` unset during the live read-only check. For staff-role checks, enable that flag in an isolated environment. Apply the ledger SQL before enabling the backend and frontend flags. Verify the pilot using read-only questions about existing bookings, contracts and invoices and compare the answers with the linked admin pages.
