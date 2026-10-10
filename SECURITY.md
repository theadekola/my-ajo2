# My Ajo Security Policy

## Reporting vulnerabilities

Please report suspected vulnerabilities **privately** using GitHub's private vulnerability reporting feature for this repository, if enabled. Do not open a public issue containing an exploit, secret or personal information. If private reporting is not enabled, contact the maintainer through https://theadekola.online and request a secure reporting channel before sharing sensitive technical details.

Include the affected component, relevant version or commit, reproduction steps using synthetic data, expected versus observed behaviour, likely impact and a safe contact method. Do not include production member records, credentials or financial details.

## Responsible testing

Do not test against other people's accounts or production financial records. Do not conduct denial-of-service testing, social engineering, bulk scanning, destructive testing or unauthorised data access. Stop and report privately if you encounter sensitive information. Public deployment is not permission to probe the live system.

## Supported versions and response

The current production release and actively maintained `main` branch are the primary targets for security fixes. Historical releases may not receive patches. The maintainer will triage reports and coordinate remediation and disclosure where appropriate; no fixed response-time SLA is promised.

## Implemented application safeguards

The repository documents:

- bcrypt password hashes with a minimum configured work factor of 12 and legacy hash upgrades after login.
- HMAC-SHA-256 storage of OTP values.
- AES-256-GCM encryption for selected sensitive fields, including payment-related identifiers and messages.
- HS256 JWT authentication, short token lifetime, and HttpOnly/Secure cookies.
- CSRF protection and allowlisted CORS origins for authenticated mutations.
- Request throttling, JSON size limits, common HTTP security headers and restricted upload types.

These statements describe documented code-level mechanisms. They are not a claim that the live environment has undergone an independent penetration test.

## Secrets and key management

Generate independent secrets with `npm run secrets:generate` from `server/`. Protect `JWT_SECRET`, `OTP_PEPPER`, `MFA_ENCRYPTION_KEY`, database credentials and provider keys. `MFA_ENCRYPTION_KEY` must be a 64-character hexadecimal value; preserve the correct active key and version when upgrading.

Use a protected secret manager or `/opt/my-ajo/server/.env` with owner-only permissions. Never commit `.env`, Firebase service configuration, keystores, provisioning profiles, uploaded files, database backups or release archives. Keep CI-only values in GitHub Actions secrets. Client Firebase configuration can be extracted from installed applications, so restrict applicable keys and APIs.

If a secret is exposed, revoke or rotate it promptly and assess downstream impact. Removing it from Git history does not invalidate it. Scan current code and reachable history with appropriate secret-scanning tools.

## Database encryption and production requirements

Application-level field encryption does not replace HTTPS/TLS, SQL Server TDE, encrypted backups, least-privilege database access, firewall restrictions, logging, key rotation or tested recovery. The documented target configuration is `DB_ENCRYPT=true` and `DB_TRUST_CERT=false` with a trusted SQL Server certificate.

Before relying on TDE, verify it is enabled for `MyAjoDB` and securely back up its certificate and private key. Keep backups encrypted and test full restoration in a non-production environment.

**Deployment caution:** `deploy/Update-MyAjo.ps1` currently invokes `sqlcmd` with `-C`, which trusts the server certificate for migration connections. Review this difference from the application's strict certificate validation configuration before deployment.

## Existing-database encryption migration

Follow the reviewed migration instructions and back up both the database and current environment before making changes. The repository documents `database/harden-sensitive-data.sql` and an encryption migration procedure. Confirm the actual script and package commands in the checked-out release before executing any migration. Never rotate or discard a field-encryption key until all relevant ciphertext is confirmed readable with the replacement key.

## Operational checks

Verify authentication and session revocation, CSRF/CORS behaviour, community/group authorisation, upload access, notification delivery, database encryption, backup recovery and audit trails in a controlled staging environment. Review privacy and financial regulatory requirements appropriate to the actual service provided.

## Disclosure

Coordinate public disclosure after a fix or agreed mitigation is available. Do not publish proof-of-concept material that would expose live accounts or data.
