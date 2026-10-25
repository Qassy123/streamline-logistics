# Saved tariff pricing — 25 October 2026

Approved behavior: quote price is the saved van base fare plus routed miles at the matching saved mileage-band rate. Each extra stop adds GBP 45 before applicable VAT. Other additional charges remain manual.

## Changes
- Live public, Planning, customer and guest quote calculations read the database tariff on every calculation. The default pricing preview does too. No service, return or automatic fuel multiplier is added; road distance includes all route legs.
- A matching mileage band supplies the rate for the full route distance. Where ranges share an endpoint, the band with the higher minimum wins. The same canonical van category accepts legacy vehicle labels.
- The most recently updated active tariff for the selected van category is used. No active tariff or no matching mileage band produces a clear configuration error instead of silently using old code prices.
- Company VAT and the tariff/extra-stop VAT flags are respected, with monetary rounding to pennies.
- Each new calculation saves its exact base, mileage and extra-stop breakdown with the quote. Existing quote totals are not retroactively changed when tariffs are edited. Explicit booking recalculation uses current saved prices.
- Quote forms, Planning summaries, quote details and the quote-specific payment summary show the saved breakdown. Legacy quote records keep their existing stored presentation.
- Pricing save errors appear inside their modal, and repeated clicks while saving are ignored.

## Setup and deployment
Run Push-Approved-Change.ps1 from normal VS Code PowerShell. It checks the entire package baseline, makes backups, applies only listed files, generates Prisma types, builds backend/frontend, and runs all regression suites. After checks pass it runs the approved database setup, then commits and pushes only this package’s files.

The database setup requires DATABASE_URL from the backend environment or streamline-backend/.env. It adds the nullable Quote.pricingBreakdown JSONB column if missing and sets the most recent active global STOP charge to GBP 45 / PER_STOP, or creates one if absent. Other charge records, base fares and mileage-band rates are not changed. Setup is transactional and safely rerunnable; rerunning this batch deliberately enforces the approved GBP 45 stop rate again. No database records were accessed during preparation.

Use Base Fares and Mileage in Pricing / Tariff to edit rates. Make sure an active mileage band covers the journey; the application will no longer substitute hard-coded rates.

## Quick checks after deployment
1. Save a base fare, refresh Pricing / Tariff, and confirm it remains saved.
2. Calculate a quote and check base + (displayed miles × saved matching rate), plus VAT.
3. With Small Van base GBP 30 and rate GBP 1/mile, 100 miles is GBP 130 net / GBP 156 with 20% VAT.
4. Two extra stops add GBP 90 net (GBP 220 net / GBP 264 including 20% VAT for the same example).
5. Change a tariff and calculate a new quote from public, Planning and a customer account. Each new calculation should use that saved rate.
6. No waiting, parking, toll or fuel surcharge should be added automatically.

Validation: full frontend/backend TypeScript checks, generated backend JavaScript and 22 isolated regression suites, including 16 tariff integration checks. No production pricing writes or provider calls occurred during validation. The normal frontend production build is included as a mandatory pre-push check.
