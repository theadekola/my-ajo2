# My Ajo

My Ajo is a web and Capacitor mobile application for operating rotating savings groups. The repository contains an Express/MSSQL API, a React client, and native Android and iOS projects.

## Requirements

- Node.js 22.12 or newer
- MSSQL for the API
- Redis for production rate limiting and coordination
- Android Studio with JDK 21 for Android builds
- macOS with the current supported Xcode for iOS builds

## Validate the application

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

Create `client/.env.mobile` from `client/.env.mobile.example`, using only the production HTTPS URL, then synchronize the native projects:

```bash
cd client
npm run cap:sync
```

`client/.env.mobile` is intentionally ignored. Do not force-add it to Git.

## Android release

Download `google-services.json` from the Firebase console into `client/android/app/`; it is intentionally ignored. Create `client/android/keystore.properties` from its example and keep the Firebase file, keystore, and passwords outside Git. Run `npm run cap:android`, build a signed Android App Bundle in Android Studio, and test it through a Play Console internal-testing track. The production Firebase API key must be restricted to `com.myajo.app`, the production signing certificate SHA-1/SHA-256 fingerprints, and required APIs only.

## iOS release

Download `GoogleService-Info.plist` from the Firebase console into `client/ios/App/App/`; it is intentionally ignored. Run `npm run cap:ios` on macOS. In Xcode, select the production Apple team, enable Push Notifications, configure the App Store provisioning profile for `com.myajo.app`, archive the Release configuration, validate it, and upload it to TestFlight. Test on a physical device before App Store submission.

## Production deployment

Use `deploy/Update-MyAjo.ps1`. It validates inputs, excludes secrets/generated artifacts, applies migrations, builds the client, restarts PM2, and checks `/api/health`. Follow [SECURITY.md](SECURITY.md) before any public release.

Never commit environment files, signing keys, provisioning profiles, Firebase configuration or server credentials, uploaded user files, database backups, or release archives.
