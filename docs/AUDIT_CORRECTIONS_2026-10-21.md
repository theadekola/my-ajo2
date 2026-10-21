# My Ajo2 audit corrections

The 35 source-audit findings are addressed by implementation changes or by removing unsupported capability claims. This does not certify production or app-store readiness.

## Correction map

| Finding | Correction |
| --- | --- |
| F01 | Payment submission clears busy state in `finally`; Pay Again resets receipt/reference/note. |
| F02 | Group Collected uses confirmed amount; expected pot is labelled Cycle target. |
| F03 | Atomic Pending-only contribution review, transactional in-app notification/outbox, 409 on repeated or conflicting review. |
| F04 | Transactional payout, notification, chat and outbox writes; per-actor request keys and payload hashes; one scheduled/paid payout per cycle. |
| F05 | Dedicated authenticator/recovery step-up for payout actions, including SuperAdmin member sessions; enrollment return link. |
| F06 | Quote creation and retrieval require matching public/private conversation audiences; anonymous quote labels; private pin/delete boundaries tightened. |
| F07 | Search and AI facts apply anonymous identity projections and membership scope; activity projection removes third-party identities. |
| F08 | Administration Chat reports queue with review/dismiss/action dispositions and an audit record. |
| F09 | Forced-reset flag checked at login, MFA login and live-session authorization; reset clears the flag and revokes tokens. |
| F10 | Hash-aware Android back/dashboard/minimise handling. |
| F11 | Hash-based invitations plus legacy pathname bootstrap. |
| F12 | Landing section button scrolls without replacing the router fragment. |
| F13 | Same-origin hash destinations for web push; app-level native notification action listeners. |
| F14 | Automatic collection explicitly unavailable; legacy write endpoint rejects with 409 instead of creating a false mandate. Bank transfer remains available. |
| F15 | Shared API loading/error/retry notice, complete-operation timeout, explicit group failure, and partial dashboard results. |
| F16 | Single in-flight notification preference save guarded by a ref and disabled controls. |
| F17 | Independent authoritative unread count, notification pagination and dashboard-cache invalidation after reads; errors preserve previous counts. |
| F18 | Shared action lock/error recovery for approval/rejection, paid transition and notification actions. |
| F19 | Native-capable save/share PDF export for member reports and a consistent native PDF evidence download fallback. |
| F20 | Capacitor-aware recovery-code copy with success/failure feedback. |
| F21 | Database-enforced 30-day profile edit predicate with authoritative saved/next-edit timestamps. |
| F22 | Failed picture uploads restore the saved image; object URLs and input selection are cleaned up. |
| F23 | Weekly/biweekly wait duration uses weeks; member/slot inputs are clamped. |
| F24 | Assigned/recorded payouts reconciled; date-only comparison includes today and excludes paid payouts from Upcoming. |
| F25 | Personal next-payout panel filters by RecipientId. |
| F26 | Initial investigation insertion honours resolved/false-positive/investigating status and resolution timestamp. |
| F27 | Ordinary administrators have a permission-scoped workspace with mandatory MFA for privileged access; owner/peer account controls stay protected. |
| F28 | Support submissions persist a ticket before SMTP delivery; a failed email does not lose the case. |
| F29 | Unsupported offline account-data claims removed. |
| F30 | World-city import removed; supported-country subdivision subset and lazy Auth route replace oversized data loading. |
| F31 | CSRF cache reset at session transitions and a single safe refresh/retry after CSRF rejection. |
| F32 | Deadlines cover uploads, private-file bodies and JSON bodies; caller cancellation is preserved. |
| F33 | Month-end cleanup removes only read notifications older than 90 days. |
| F34 | New groups offer only Fixed order. Payouts enforce next unpaid slot; verified Complete current cycle requires confirmed member amounts and one paid payout, then advances or completes the round. Historical Random/Bidding configurations are not rewritten. |
| F35 | Group amount/member/date/day/order validation; payout amount/charge/date/cycle/key validation; unsupported direct-debit writes rejected. |

## Validation

- Server: 45 passing tests, including request middleware, real Multer multipart handling, mocked financial transaction rollback/retry, privacy boundaries and permission checks.
- Client: 51 passing DOM render and interaction tests covering app routes, Pay Again, failed contribution review and collected totals.
- Web and configured mobile web-asset builds pass. The largest JavaScript chunk is about 256 KB, versus an 8,065 KB data chunk before correction.
- Production dependency audits: zero reported vulnerabilities for client and server at validation time. MSSQL and Multer were upgraded; lockfiles are included.
- Migration checker validates all 12 versioned migration files, including new migration 017. It does not execute SQL against a database.
- Server startup and `/api/health` smoke check pass without a live database.

Financial tests use an injected database adapter and do not prove SQL Server locking behaviour on a live instance. Browser visual tests could not run because the Chromium download failed. DOM tests do not verify layout, safe areas, keyboard behaviour, physical microphones, push delivery, clipboard/file integration or native builds. Run the repository Android/iOS CI jobs and physical-device acceptance checks before release.

## Deployment order

1. Back up the database and current application release.
2. Keep the API stopped while installing the new server and client dependencies with `npm ci`.
3. From `/opt/my-ajo/server`, run `npm run migrate` using the existing deployment configuration. Migration 017 adds `Users.ProfileEditedAt`, payout request-key/hash columns and their filtered unique index, and `PushOutbox`. Do not start this code against the old schema.
4. Build the web client for the web deployment. Build mobile assets separately with `.env.mobile` configured from the example, then synchronize and rebuild native apps. Mobile-built assets must not accidentally replace web deployment configuration.
5. Restart the existing API process using the installation's normal service command. Verify login, OTP/reset, MFA, payout retries, contribution review and notification delivery on staging first.
6. Verify `PushOutbox` delivery/last errors and the SMTP, FCM/APNs and web-push configuration. Push is at-least-once: a delivery interrupted after provider acceptance may repeat, while the financial record remains idempotent.

No VM deployment or live-database migration was performed in this task. Automatic bank collection remains unavailable until a real mandate provider is integrated. Only Fixed payout order is offered for newly created groups.
