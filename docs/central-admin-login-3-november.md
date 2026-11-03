# Central admin login — 3 November 2026

## Approved scope
Replace admin keys and repeated Fleet/Driver Hours sign-ins with one secure admin login. Following the owner's clarification, retain Staff & Permissions account creation and assigned roles. Super Admin has full access. Existing administrator accounts, passwords, features and business data are retained. Customer and driver login systems remain unchanged.

## Login and access
Visit `/admin/login` and use an existing Staff & Permissions account's email and password. An unambiguous staff name also works as the username; use email if names overlap. The shared session covers admin navigation, Fleet, Driver Hours, downloads and management requests. Super Admin creates and manages staff in the existing Permissions screen. Each request checks the current active account and role; disabling an account, revoking a session or changing its role takes effect at the service. Permission denial does not ask staff to sign in again.

Sessions expire after eight hours and are stored in a Secure, HttpOnly, SameSite Strict cookie in production. Browser scripts do not receive the session token. Mutations require the same origin. Logout revokes the server session and clears the cookie. Invalid, disabled, expired and unavailable sessions cannot authorize requests. Legacy admin keys and older staff session tokens no longer grant access. Existing legacy storage is cleared at login. Some existing internal `adminKey` prop names remain as non-secret readiness flags; requests strip key and caller-supplied bearer headers and use the cookie gateway.

The public site's existing preview gate is retained; admin login, admin pages and staff password recovery bypass it so administrators have only one sign-in. The login and protected pages use the current branding.

## Background work
Existing invoice reminder and monthly billing workers now invoke the same existing service functions directly, rather than calling an HTTP endpoint using an admin key. Their schedules, calculation and billing rules are unchanged.

## Apply and deployment
Run `Push-Approved-Change.ps1` from this package. It checks that the existing backend database has an active Super Admin before applying anything. This is a read-only check; it creates no users and changes no passwords. If none exists, create the main Super Admin through the current Staff & Permissions page first. The existing backend DATABASE_URL and dependencies must already be available.

The package validates original file checksums, rejects files changed since preparation, backs up replaced files, builds the backend, type-checks the frontend, runs the regression suites and runs the normal frontend production build. Only after all checks pass does it commit the listed files and push main. Unrelated staged files cause it to stop. Both Railway backend and frontend deployments must finish before using the new login. No database migration, reset, new environment secret or account renumbering is required.

## Verification
Frontend and backend TypeScript checks passed. Backend JavaScript emission passed. All 26 isolated regression suites passed, including 18 real central-authentication checks: existing credentials and unique names, staff creation followed by login, roles, Read Only mutations, expired/revoked/disabled sessions, old-key rejection, cookie security, same-origin enforcement, proxy path checks, binary downloads, logout and unchanged customer/driver authentication boundaries.

The dedicated authentication suite exercises the implementation using isolated persistence. Existing business tests use a test-only authenticated-request fixture; that fixture is never imported by production code. No live credentials, accounts or business records were used or changed. The normal frontend production build must pass in the supplied command before push; it was not completed in this restricted environment. After deployment, check your existing Super Admin login, navigation between Fleet/Driver Hours/Permissions without another login, a restricted staff account, a download, and logout.
