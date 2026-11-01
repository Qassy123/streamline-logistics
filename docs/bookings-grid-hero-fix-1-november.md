# Approved booking grid correction and hero animation

Existing Bookings uses its existing dated vehicle grid. The separate all-source table and extra lists beneath the calendar are removed. Customer, guest and admin confirmed bookings are loaded across all result pages. Confirmed bookings remain visible while Assigned or On Delivery. Pending-payment, completed, cancelled and expired records are excluded from this view.

An assigned van determines the row. A valid reserved van is shown on its physical row with an awaiting-assignment label; this does not assign the van. Jobs without a known van appear in category-based awaiting-assignment rows within the same grid. Overlapping blocks use separate lanes. Overnight blocks, date navigation and booking management remain available.

The homepage retains its existing branded van image, text and links. A slow CSS pan and zoom provides free animation with Pause/Resume. Reduced-motion preferences disable animation. No video, new image asset or paid service is introduced.

No database migration, pricing change, SMS setting change, or live booking update is included.

Apply-And-Check.ps1 verifies source baselines, copies only the manifested files, builds the backend, checks frontend types, runs all release suites, and builds the frontend. Push-Approved-Change.ps1 runs these checks before committing only this package and pushing main. Originals are backed up in the package. The actual project remains untouched until the user runs the script.
