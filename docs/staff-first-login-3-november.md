# Approved staff first-login and login-image update

## Changes
New accounts created in Staff & Permissions must choose a personal username and a different password after signing in with the initial password. Other admin pages and management requests are blocked until setup is complete. Username is stored lowercase and unique, accepts 3–30 letters/numbers/dots/underscores/hyphens, and works alongside email for future sign-in. The personal password requires at least 10 characters. Initial credentials stop working after setup. Existing display name, email and assigned role are preserved. Other active sessions and unused staff reset links are revoked on completion. Resetting an account password through Staff & Permissions requires personal setup again.

An additive database update adds username and mustSetup fields. Existing accounts with no prior login are marked for setup. Already-used accounts retain their credentials and access because the system cannot retrospectively distinguish an initial password from a personal password. No existing business records, bookings or invoices are changed.

Staff & Permissions remains visible in navigation. A Super Admin opens it directly; any other signed-in account is redirected to the same login page, asking for Super Admin credentials and returning to that tab. This switches the current login to the authenticated Super Admin account. The backend refuses Permissions reads and writes from every other staff role, including direct requests. Other section permissions remain unchanged.

The login-page van uses its original image proportions in a dedicated image area rather than a cropped full-height background. The rest of the login design is preserved.

## Apply
Run this package's Push-Approved-Change.ps1 from the VS Code terminal. It verifies file baselines, backs up replaced files, applies the scoped files, executes the additive database setup using the existing backend DATABASE_URL, generates the Prisma client and builds the backend, type-checks and builds the frontend, runs regression tests, then commits and pushes only the manifest files. Any failed check stops the push. Both frontend and backend deployments must finish.

The database setup can safely be rerun. It adds only the two staff fields, their unique index and first-login flags for unused accounts. It does not reset the database or renumber records. No live database changes or Git operations were performed while preparing this package.

## Verification
Frontend and backend TypeScript checks and backend JavaScript emission passed. All 26 isolated regression suites passed, including 21 real authentication checks. These exercise pending-account access denial, username conflicts, initial-password reuse rejection, personal username/email login, session revocation, role preservation, Super Admin-only Permissions, cookie protection and the setup gateway. No live accounts or credentials were used. The normal frontend production build runs in the provided command before push and has not been verified in this restricted environment.

After deployment, create a test staff account, sign in using its initial credentials, complete username/password setup, and check login using both the chosen username and email. Confirm the initial password fails. From a non-Super Admin account click Staff & Permissions: sign in as Super Admin and confirm it opens directly on later visits. Check the van image on desktop and the login form on mobile.
