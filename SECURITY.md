# My Ajo Security Policy

## Reporting vulnerabilities

Please report suspected vulnerabilities **privately** using GitHub's private vulnerability reporting feature for this repository, if enabled. Do not open a public issue containing an exploit, secret or personal information. If private reporting is not enabled, contact the maintainer through https://theadekola.online and request a secure reporting channel before sharing sensitive technical details.

Include the affected component, relevant version or commit, reproduction steps using synthetic data, expected versus observed behaviour, likely impact and a safe contact method. Do not include production member records, credentials or financial details.

## Responsible testing

Do not test against other people's accounts or production financial records. Do not conduct denial-of-service testing, social engineering, bulk scanning, destructive testing or unauthorised data access. Stop and report privately if you encounter sensitive information. Public deployment is not permission to probe the live system.

## Supported versions and response

The current production release and actively maintained `main` branch are the primary targets for security fixes. Historical releases may not receive patches. The maintainer will triage reports and coordinate remediation and disclosure where appropriate; no fixed response-time SLA is promised.

## Implemented application safeguards

The current application code implements:

- bcrypt password hashes with a minimum configured work factor of 12 and legacy hash upgrades after login.
- HMAC-SHA-256 storage of OTP values.
- AES-256-GCM encryption specifically for MFA secrets using `MFA_ENCRYPTION_KEY` and its active version.
- HS256 JWT authentication, short token lifetime, and HttpOnly/Secure cookies.
- CSRF protection and allowlisted CORS origins for authenticated mutations.
- Request throttling, JSON size limits, common HTTP security headers and restricted upload types.

These statements describe code-level mechanisms, not an independent penetration test or verification of production configuration. General `encryptValue()` and `decryptValue()` helpers currently return strings without encryption. Member/payment identifiers, messages and other fields passed through those helpers are not encrypted at the application layer. SQL Server TDE, TLS and backup encryption are separate infrastructure controls that must be verified operationally.

Redis is optional and enabled with `REDIS_ENABLED=true`. Without available Redis, the application uses SQL Server and in-process fallbacks. In-process throttling and event delivery are not shared across API instances; assess those limits before operating multiple instances.

## Secrets and key management

Generate independent secrets with `npm run secrets:generate` from `server/`. Protect `JWT_SECRET`, `OTP_PEPPER`, `MFA_ENCRYPTION_KEY`, database credentials and provider keys. `MFA_ENCRYPTION_KEY` must be a 64-character hexadecimal value; preserve the correct active key and version when upgrading.

Use a protected secret manager or `/opt/my-ajo/server/.env` with owner-only permissions. Never commit `.env`, Firebase service configuration, keystores, provisioning profiles, uploaded files, database backups or release archives. Keep CI-only values in GitHub Actions secrets. Client Firebase configuration can be extracted from installed applications, so restrict applicable keys and APIs.

If a secret is exposed, revoke or rotate it promptly and assess downstream impact. Removing it from Git history does not invalidate it. Scan current code and reachable history with appropriate secret-scanning tools.

## Database encryption and production requirements

MFA-secret encryption does not protect general member/payment fields and does not replace HTTPS/TLS, SQL Server TDE, encrypted backups, least-privilege database access, firewall restrictions, logging, key rotation or tested recovery. The target SQL connection configuration is `DB_ENCRYPT=true` and `DB_TRUST_CERT=false` with a trusted SQL Server certificate. SQL connection encryption protects data in transit; it does not enable TDE or encrypt database backups.

Before relying on TDE, verify it is enabled for `MyAjoDB` and securely back up its certificate and private key. Keep backups encrypted and test full restoration in a non-production environment.

**Deployment caution:** `deploy/Update-MyAjo.ps1` currently invokes `sqlcmd` with `-C`, which trusts the server certificate for migration connections. Review this difference from the application's strict certificate validation configuration before deployment.

## Existing-database schema migrations and MFA keys

Back up the database and current environment before applying reviewed schema changes. Run `npm run migrate:check` from `server/` to validate versioned SQL migration files and `npm run migrate` to apply pending versioned schema migrations to the configured database. `database/harden-sensitive-data.sql` is a separate schema-hardening script; it does not establish encryption of stored member/payment fields.

Pending migration `014_remove_field_encryption.sql` is a destructive reset: it clears profile/bank fields and payment/chat data while retaining MFA secrets. It does not decrypt existing general-field ciphertext into usable data. Review its full SQL, verify backups and recovery, and obtain explicit approval for the reset before applying it to a live database. The deployment script runs pending versioned migrations remotely even when its local `-SkipDatabase` switch is selected.

This release has no `migrate:encrypt` package command or supported general-field encryption migration. Do not use the deployment script's legacy `-RunEncryptionMigration` switch, which invokes that missing command. Preserve the existing `MFA_ENCRYPTION_KEY` and version for existing MFA ciphertext. Do not rotate or discard that key until a reviewed migration or recovery process confirms all required MFA secrets remain readable.

## Operational checks

### Dependency audit status

The client dependencies and iOS Swift package pin use Capacitor 8.4.3 to address [GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv). Rebuild and redistribute any Android/iOS app previously built with an affected version; changing repository dependencies alone does not patch installed apps.

As of 10 October 2026, the server lockfile includes `proxy-addr` 2.0.8, which fixes [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). The server audit still reports three moderate findings through the `mssql` / `tedious` / `sprintf-js` dependency chain. [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) currently lists no patched `sprintf-js` version. The reported forced fix downgrades `mssql` to 4.2.0 and is a breaking change; it is not applied by this update. Re-run audits for each release, assess the affected formatting paths, and track upstream remediation. Passing the high-severity CI audit threshold does not mean there are no reported vulnerabilities.

Verify authentication and session revocation, CSRF/CORS behaviour, community/group authorisation, upload access, notification delivery, database encryption, backup recovery and audit trails in a controlled staging environment. Review privacy and financial regulatory requirements appropriate to the actual service provided.

## Disclosure

Coordinate public disclosure after a fix or agreed mitigation is available. Do not publish proof-of-concept material that would expose live accounts or data.
