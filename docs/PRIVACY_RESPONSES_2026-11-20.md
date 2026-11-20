# Account response privacy changes

Default `/api/auth/me`, password login, MFA login, registration and completed social onboarding use an explicit session allowlist. They exclude email, phone, address, date of birth, occupation, bank details, raw system role, protected-account flags and unlisted database fields. Names and avatar information remain for account navigation. Email-verification and MFA status remain because verification prompts and payout/admin gates use them. These booleans are UI hints, not authorization grants.

`Capabilities.canAccessAdmin` and `Capabilities.canDeleteAccount` replace raw account-role/protection flags in member UI. API authorization still derives permissions from the live database account; changing a browser value grants no server access. Privileged administration screens retain their separate permission-controlled records and access endpoint.

`GET /api/auth/me/profile` returns explicitly listed profile fields only to the authenticated, onboarded account. `GET /api/auth/me/bank-details` separately returns that account's bank details. Neither accepts a target user ID. The relevant screen loads these details into component state, without putting them in shared authentication state or browser persistent storage. Failed detail loads block editing. Profile updates no longer modify bank details; the dedicated bank endpoint handles those changes.

Google Analytics script loading/configuration has been removed. Its script and collection domains have been removed from the server CSP. Existing API no-store/private headers and HttpOnly cookie authentication remain in place. No live browser network capture was available, so this verifies repository configuration rather than all externally injected scripts. Check the production reverse proxy, Cloudflare and tag injection separately after deployment.

Anything displayed by a browser remains inspectable by the signed-in user. HTTPS protects it in transit, but cannot hide it from that user's developer tools or an attacker who has stolen their session. Account response minimization does not replace session security, MFA and authorization.

## Deployment

Deploy server and rebuilt web client together. Rebuild and distribute native apps using the updated client because the default session API contract changed. Older installed native clients expect profile fields and raw roles in `/auth/me` and need updating. This correction adds no database migration. Preserve existing environment files and user uploads. The older migration 014 is destructive; do not run unrelated pending migrations as part of this privacy-only update.

After deployment verify login/MFA, profile loading/editing, bank details, protected-account deletion restrictions and admin access. Verify default auth responses omit private fields and no Analytics requests leave the application. This change has not been deployed to the VM by this work.
