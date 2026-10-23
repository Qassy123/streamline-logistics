# Business address matching correction

## Confirmed failure and scoped correction

The reported address was `Carters Pharmacy, 2 Carters Square, Uttoxeter, Staffordshire, ST14 7FN`. Live Google Geocoding returned partial GEOMETRIC_CENTER results for both the car park and pharmacy. Changing the input to include Unit 2 still produced partial results. The previous matcher rejected them and its parent-site retry only recognised a leading standalone unit/kiosk line.

After the full address fails validation, the corrected matcher recognises a separate business name followed by a numbered premises, unit or street line, and retries the business name with the exact original postcode. Google resolves `Carters Pharmacy, ST14 7FN` to the pharmacy as a non-partial named establishment at that postcode. The same rule handles other eligible business addresses; no pharmacy names or coordinates are hardcoded in production code.

The fallback requires a non-partial named business, GB, exact original postcode and suitable location precision. It rejects partial/wrong-postcode/other-country/street/postcode-only/approximate results. Numbered residential streets cannot be converted into business lookups. Existing kiosk/unit parent-site behaviour remains covered by regressions. Invalid oversized addresses are rejected before any provider call.

Only the map query is simplified. Original collection/delivery/stop text stays on the quote and booking, including the business name, unit/building number, street and delivery instructions.

## Verification

- Reproduced the original and Unit 2 variant through the live Google API using existing configuration.
- Ran the patched TypeScript module against live Google Geocoding: both exact input strings resolved to the pharmacy, not the car park.
- Live Google Routes successfully calculated a road route from the test Birmingham collection address to that pharmacy.
- 16 address-routing checks passed, including replay of the observed mixed pharmacy/car-park response and all 8 prior address-routing checks.
- All 18 isolated regression suites passed.
- Full frontend/backend TypeScript checks and backend JavaScript compilation passed.
- No booking changes, payment/refund actions, customer emails or live deployment were performed during verification.

## Apply

Run this package's `Apply-And-Check.ps1` in VS Code PowerShell. It preflights package/target checksums, backs up replaced files, installs only the two source/test files and this note, builds the backend and runs the existing full regression runner. Then commit the manifest paths and push normally. No database update or schema change is needed.
