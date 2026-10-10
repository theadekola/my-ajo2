# My Ajo

**Rotating savings, organised together.**

**My Ajo** is a live, publicly used platform for organising rotating savings groups, tracking contributions and payouts, and managing group membership and communication. It provides a React web application, an Express API and Capacitor Android/iOS application projects.

- **Live website:** https://www.my-ajo.org
- **Repository:** https://github.com/theadekola/my-ajo2
- **Developer:** Adekola Kazeem Ayannuga, The Adekola Labs
- **Portfolio:** https://theadekola.online
- **Security reporting:** [SECURITY.md](SECURITY.md)
- **Licence:** [LICENSE](LICENSE)

## Application status

My Ajo is deployed and in public use. The codebase is actively maintained, with continued testing, feature development and operational improvements. The presence of a feature, integration or native mobile project in this repository does not establish that it is enabled for every user, approved in an app store, or independently audited.

## What My Ajo does

My Ajo is designed to help savings groups coordinate their activities in one place:

- Create and administer rotating savings groups.
- Manage members, roles and group information.
- Record contributions, payment status and contribution history.
- Organise payout schedules and payout records.
- Support group communication, reminders and notifications.
- Access group information through responsive web and native mobile projects.

**Financial scope:** Savings, payment and payout tracking features must not be interpreted as proof that My Ajo holds customer funds, executes regulated payments, guarantees returns or is licensed as a financial institution. Actual payment-processing arrangements and any applicable regulatory status should be documented separately and accurately.

## Technology stack

| Layer | Technology |
|---|---|
| Web | React 18, React Router 7, Vite 7 |
| Mobile | Capacitor 8, Android and iOS projects |
| API | Node.js 22.12+, Express 5 |
| Database | Microsoft SQL Server |
| Coordination and rate limiting | Optional Redis; SQL Server and in-process fallbacks |
| Authentication | bcryptjs, JWT, secure cookies, CSRF controls |
| Notifications | Email, Web Push and configurable mobile push providers |
| Deployment | PowerShell, SSH, PM2 |

The backend is JavaScript-based; do not describe this repository as a TypeScript backend without a corresponding migration.

## High-level architecture

```text
Web browser / Android / iOS
             |
        HTTPS endpoint
             |
       React client
             |
        Express API
        /        \
   SQL Server   Redis (optional)
        |
  Savings and group records

API -> email / push integrations (when configured)
```

Production topology, hosting details and network boundaries should be verified against the running environment rather than inferred from this diagram.

## Repository layout

```text
client/                   React/Vite app and Capacitor mobile projects
server/                   Express API, scripts and tests
database/                 SQL Server migration and hardening resources
deploy/                   Deployment automation
README.md                 Product and developer documentation
SECURITY.md               Security controls and reporting
LICENSE                   Proprietary source-use terms
```

## Requirements

- Node.js 22.12 or newer and npm.
- Microsoft SQL Server for the API.
- Optional Redis for shared rate limiting, caching and activity coordination. Enable it with `REDIS_ENABLED=true`; without it, the app uses SQL Server and in-process fallbacks. In-process limits and events are not shared across multiple API instances.
- Android Studio and JDK 21 for Android builds.
- macOS and a supported Xcode release for iOS builds.

## Development and validation

From the repository root, use separate terminals for the server and client. Copy `server/.env.example` to `server/.env` and replace placeholders with **development-only** credentials. Do not commit environment files.

**Server:**

```bash
cd server
npm ci
npm run dev
```

**Client (from repository root):**

```bash
cd client
npm ci
npm run dev
```

**Checks (from repository root):**

```bash
cd server
npm ci
npm test
npm run migrate:check
npm audit --audit-level=high

cd ../client
npm ci
npm run build
npm audit --audit-level=high
```

`npm run migrate:check` validates versioned SQL migration files; it does not apply migrations or verify the live database. Run `npm run migrate` against a properly configured development or staging database before using features that require those schema changes. `npm audit` findings require review; they are not automatically evidence of exploitable production vulnerabilities.

Review every pending migration before applying it. In particular, `014_remove_field_encryption.sql` clears profile/bank fields, payment records and messages to remove legacy general-field encryption; it preserves MFA secrets. It is a destructive reset, not a ciphertext conversion. Do not apply it to a live database without a reviewed backup, recovery plan and explicit approval for the data reset.

## Configuration and secrets

The tracked `server/.env.example` documents required and optional variables. Key settings include `JWT_SECRET`, `OTP_PEPPER`, `MFA_ENCRYPTION_KEY`, `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_CERT`, `ALLOWED_ORIGINS` and `APP_BASE_URL`.

Generate independent secrets with:

```bash
cd server
npm run secrets:generate
```

Store production secrets in a protected secret manager or a permissions-restricted server environment file. Preserve the active `MFA_ENCRYPTION_KEY` and its version during upgrades so existing encrypted MFA secrets remain readable. Never expose private keys, member data, bank identifiers or backups in commits or issue reports.

The current general-field helpers return strings without encryption. Payment identifiers, messages and other fields passed through those helpers are not protected by application-level AES encryption. AES-256-GCM is implemented specifically for MFA secrets. SQL Server TDE and encrypted backups must be configured and verified separately; their status cannot be inferred from this repository.

## Android build and release

Create `client/.env.mobile` from `client/.env.mobile.example` with the approved HTTPS API endpoint. Keep the file untracked. Obtain `google-services.json` from Firebase for the configured Android app and place it in `client/android/app/`. Keep signing credentials and `keystore.properties` out of Git.

```bash
cd client
npm ci
npm run cap:android
```

Open Android Studio, create a signed Android App Bundle, and validate it on a test track and real devices. A native project in this repository does not by itself indicate a public Play Store release.

## iOS build and release

On macOS, provide the appropriate `GoogleService-Info.plist` at `client/ios/App/App/`, configure signing, provisioning and push-notification entitlements, then run:

```bash
cd client
npm ci
npm run cap:ios
```

Use Xcode to archive and validate the build and TestFlight for device testing. Confirm actual App Store distribution separately.

## Production deployment

The repository includes `deploy/Update-MyAjo.ps1`. It validates deployment parameters, prepares an archive, uploads code over SSH, applies selected SQL migrations, installs dependencies, builds the frontend, restarts PM2 and checks `/api/health`.

**Important:** The script requires parameters including `AppHost`, `DbHost`, `AppUser` and `DbUser`, plus a database password unless `-SkipDatabase` is specified. Review its parameters and migration scripts before execution. It defaults to `https://www.my-ajo.org` as `PublicOrigin`.

Do not use the legacy `-RunEncryptionMigration` switch in this release: it invokes `npm run migrate:encrypt`, which is not defined in `server/package.json`. The supported versioned schema migration command is `npm run migrate`; it does not encrypt existing member or payment fields.

The script runs `npm run migrate` on the application host, including pending migration 014 if it has not been recorded as applied. Review the destructive reset described above before any production deployment; `-SkipDatabase` skips the local SQL steps but does not skip this remote migration command.

```powershell
Get-Help ./deploy/Update-MyAjo.ps1 -Detailed
# Review arguments and use -WhatIf before any live deployment.
```

The deployment script currently passes `-C` to `sqlcmd`, which trusts the SQL Server certificate for those migration connections. This differs from the application's documented `DB_TRUST_CERT=false` setting. Review and correct the certificate trust approach before relying on the deployment workflow in a hardened environment.

The script creates a timestamped application backup under `/tmp` on the application host. Restrict access, establish retention and off-server backup procedures, and confirm that the backup does not unintentionally expose secrets. Database backups and restore testing must be managed separately.

## Security and privacy

The application implements bcrypt password hashing, HMAC-hashed OTPs, AES-256-GCM encryption of MFA secrets, cookie-based JWT authentication, CSRF controls, CORS restrictions and upload validation. General member/payment fields and chat messages are not encrypted by the current general-field helpers. Secure cookies depend on configuration; trusted SQL TLS certificates, SQL Server Transparent Data Encryption, encrypted backups, firewall rules and key management must be configured and verified in the running environment.

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting and operational requirements. Do not use real member records for tests or screenshots.

## Ongoing maintenance

My Ajo is live and in use. Continued engineering work includes functional and mobile testing, notification reliability, payment-record reconciliation, accessibility, monitoring, backup recovery exercises and security reviews. These areas of improvement do not imply that the entire application is unavailable.

## Project ownership and licence

Developed and maintained by **Adekola Kazeem Ayannuga** through **The Adekola Labs**.

My Ajo is proprietary software. Public source availability permits viewing and study only within the terms of the [LICENSE](LICENSE); it does not grant permission to copy, modify, deploy, redistribute or commercially exploit the software. Third-party dependencies remain subject to their own licences.

For licensing enquiries: https://theadekola.online

---

**My Ajo: Rotating savings, organised together.**
