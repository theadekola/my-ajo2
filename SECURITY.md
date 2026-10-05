# My Ajo security deployment

## Protected by the application

- Passwords are one-way bcrypt hashes with a minimum work factor of 12. Older hashes are upgraded after a successful login.
- OTP values are stored as HMAC-SHA-256 hashes, not plaintext.
- Phone numbers, addresses, bank/payment identifiers, payment references/notes, payment instructions, and chat messages use AES-256-GCM authenticated encryption.
- JWTs require a strong signing secret, use an explicit HS256 algorithm, and expire after one hour by default.
- Authentication JWTs are delivered only in an HttpOnly, Secure, SameSite=None cookie so the allowlisted Capacitor origins can authenticate. They are never returned to JavaScript or stored in localStorage. CSRF tokens and a strict CORS allowlist protect cookie-authenticated mutations.
- CORS is allowlisted, authentication is throttled, JSON requests are size-limited, and common security headers are set.
- Upload names are random UUIDs and accepted file types are restricted.

## Required secrets

Generate three independent values. Never reuse one value for another purpose:

Run `npm run secrets:generate` inside the server directory, then copy the three generated values into the protected server environment.

Store secrets in the server's secret manager or `/opt/my-ajo/server/.env` with owner-only permissions. Never commit `.env`. `MFA_ENCRYPTION_KEY` must be 64 hexadecimal characters and `MFA_ENCRYPTION_KEY_VERSION=1`.

## Public repository checks

- Keep runtime `.env` files, mobile Firebase configuration, signing keys, provisioning profiles, database backups, uploaded files, and release archives outside Git.
- Store CI-only values in GitHub Actions secrets. Use `ANDROID_GOOGLE_SERVICES_JSON_B64` and `IOS_GOOGLE_SERVICE_INFO_PLIST_B64` for optional Firebase-enabled CI builds.
- Restrict Firebase client API keys by Android package/signing certificate or iOS bundle ID, and enable only the APIs the app needs. Client configuration is extractable from installed apps even when it is not published in source control.
- Run the Security CI workflow before changing repository visibility. It scans complete Git history with Gitleaks.
- If a real secret was ever committed, revoke or rotate it first. Removing or commenting it in the latest commit does not remove it from Git history.
- Use a GitHub `noreply` commit email if personal email privacy is required.

## Existing database migration

1. Back up the SQL database and the current server `.env`.
2. Deploy the new code but do not restart PM2 yet.
3. Add the required secrets and set `DB_ENCRYPT=true`, `DB_TRUST_CERT=false` after installing a trusted SQL Server certificate.
4. Run `database/harden-sensitive-data.sql` against MyAjoDB.
5. Run `npm run migrate:encrypt` once. It encrypts plaintext values transactionally and rotates legacy ciphertext in memory when `LEGACY_DATA_ENCRYPTION_KEY` is temporarily available. It never writes decrypted values to the database.
6. Restart with `pm2 restart all --update-env` and verify `/api/health`.

The migration is idempotent: current `enc:v1:` values are not encrypted twice. Remove `LEGACY_DATA_ENCRYPTION_KEY` after any legacy rotation succeeds; retain the current field key in the secret manager so the application can decrypt active data.

## Infrastructure controls still required

Application encryption is not a substitute for TLS, SQL Server Transparent Data Encryption, encrypted backups, restricted database permissions, firewall rules, audit logs, key rotation, and tested backups. Keep `DB_ENCRYPT=true` and `DB_TRUST_CERT=false` with a trusted SQL Server certificate. Enable TDE on `MyAjoDB` and securely back up its certificate and private key before deployment. Email remains searchable for login and dates remain SQL-native; protect those using SQL Server TDE and encrypted backups.
