# Kiosk address routing fix

The screenshot error was reproduced against live Google geocoding. Collection 427 Belchers Lane, Birmingham B9 5SY is an exact rooftop match. Kiosk 1, Carters Square, Uttoxeter ST14 7FN returns a partial, site-level match, rejected by the existing address validator. Postcodes4u lookup itself succeeds.

Removing only the separate kiosk line produces an exact Google match for the same parent site and postcode. The live two-stop route between the visible collection and that site computes 36.6 miles. This is a routing check, not a generated quote or a price; any additional stops change the full journey.

The fix retries one parent-premises query only when a separate leading unit/kiosk/shop/suite/flat/apartment line cannot be matched. It retains the complete original address on the quote, booking and delivery details. The retry requires an exact UK postcode and a non-partial Google building/named-site match; postcode/street centres, approximate matches and wrong postcodes/countries are rejected. Ordinary street numbers are never stripped. Provider failures are not disguised as address corrections.

Quote and distance errors now name Collection, Delivery, Return or the numbered Additional stop. No database, pricing formula, stop ordering or frontend changes are required.

Validation: all 17 isolated release suites pass, including eight targeted mocked-provider checks, existing postcode-matching regression checks, full backend TypeScript compilation, and verification of the new helper against captured live Google geocoding/routing responses. Live checks did not create bookings, quotes, payments or emails.

After the backend deployment completes, reload the quote, keep the full Kiosk 1 address, and calculate it again. Also check an ordinary numbered street address, an extra stop and an invalid postcode. Invalid addresses must still identify the relevant stop.
