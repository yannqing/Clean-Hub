# CleanHub Mobile Release Configuration

## Scope

This document covers the `apps/mobile` Capacitor shell and the `apps/mobile-web` static web bundle used by Android and iOS builds.

## Environments

Mobile builds use build-time variables because `apps/mobile-web` is exported to static assets before Capacitor syncs native projects.

| Environment | `CLEANHUB_MOBILE_ENV` | Default API base URL |
| --- | --- | --- |
| Dev | `dev` | `http://localhost:4000` |
| Staging | `staging` | `https://staging-api.cleanhub.local` |
| Production | `prod` | `https://api.cleanhub.local` |

Override defaults with:

```bash
CLEANHUB_MOBILE_API_BASE_URL=https://api.example.com
CLEANHUB_MOBILE_VERSION=0.1.0
CLEANHUB_MOBILE_BUILD_NUMBER=1
CLEANHUB_MOBILE_MIN_SUPPORTED_VERSION=0.1.0
CLEANHUB_MOBILE_UPDATE_URL=https://example.com/mobile
```

## Build And Sync

```bash
pnpm --filter @cleanhub/mobile sync:env
```

Optional platform sync:

```bash
node scripts/mobile/sync-mobile.mjs android
node scripts/mobile/sync-mobile.mjs ios
```

The command builds `@cleanhub/mobile-web` with `NEXT_PUBLIC_*` values and then runs `cap sync`.

## Version And Update Strategy

The mobile web bundle records:

- `NEXT_PUBLIC_MOBILE_APP_VERSION`
- `NEXT_PUBLIC_MOBILE_BUILD_NUMBER`
- `NEXT_PUBLIC_MOBILE_MIN_SUPPORTED_VERSION`
- `NEXT_PUBLIC_MOBILE_UPDATE_URL`

If `appVersion < minSupportedVersion`, `apps/mobile-web/src/components/mobile-update-required.tsx` blocks normal app usage and links to the configured update URL. Raise `CLEANHUB_MOBILE_MIN_SUPPORTED_VERSION` only after a replacement APK/TestFlight build is available.

## Android Signing

Use environment variables or CI secrets:

```bash
CLEANHUB_ANDROID_KEYSTORE_PATH=/secure/path/cleanhub-release.keystore
CLEANHUB_ANDROID_KEYSTORE_PASSWORD=...
CLEANHUB_ANDROID_KEY_ALIAS=cleanhub-release
CLEANHUB_ANDROID_KEY_PASSWORD=...
CLEANHUB_MOBILE_ENV=staging
CLEANHUB_MOBILE_VERSION=0.1.0
CLEANHUB_MOBILE_BUILD_NUMBER=1
pnpm --filter @cleanhub/mobile package:android
```

The Gradle release signing config reads these values at build time. Keystores and real passwords must remain outside the repository.

## iOS TestFlight

Run on macOS with Xcode:

```bash
CLEANHUB_IOS_TEAM_ID=TEAMID1234
CLEANHUB_IOS_BUNDLE_ID=com.cleanhub.app
CLEANHUB_IOS_PROVISIONING_PROFILE="CleanHub App Store"
CLEANHUB_IOS_SIGNING_CERTIFICATE="Apple Distribution"
CLEANHUB_IOS_EXPORT_METHOD=app-store-connect
CLEANHUB_MOBILE_ENV=staging
CLEANHUB_MOBILE_VERSION=0.1.0
CLEANHUB_MOBILE_BUILD_NUMBER=1
pnpm --filter @cleanhub/mobile package:ios
```

Certificates, private keys, and provisioning profiles are injected by the developer keychain or CI. The script archives with `xcodebuild`, exports an IPA to `release/mobile/ios/export`, then the release owner uploads it to TestFlight through Transporter or CI.

## Push Notifications (FCM)

Mobile push uses Firebase Cloud Messaging (HTTP v1) for both Android and iOS. Without the configuration below the app still builds and runs; push deliveries stay queued and retry until the backend credentials are configured.

### Firebase project

Create one Firebase project per environment (dev/staging/prod), register the Android app (`com.cleanhub.app`) and the iOS app with the matching bundle id.

### Android

Download `google-services.json` from the Firebase console and place it at:

```text
apps/mobile/android/app/google-services.json
```

The Gradle config applies the `com.google.gms.google-services` plugin only when this file exists, so local builds without credentials keep working. Do not commit `google-services.json` to the repository; inject it via CI secrets during release builds.

### iOS

In Xcode enable the `Push Notifications` capability (plus `Background Modes > Remote notifications`) for the App target, create an APNs auth key in the Apple Developer portal, and upload it to the Firebase project (Project settings -> Cloud Messaging -> APNs authentication key).

### Backend credentials

The API sends pushes through the FCM HTTP v1 endpoint using a Firebase service account (Project settings -> Service accounts -> Generate new private key). Configure `apps/api` with:

```bash
FCM_PROJECT_ID=...
FCM_CLIENT_EMAIL=...
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the private key on one line with literal `\n` escapes. Optional tuning variables (`PUSH_DELIVERY_DISABLED`, `PUSH_DELIVERY_BATCH_SIZE`, `PUSH_DELIVERY_RETRY_BASE_SECONDS`, `PUSH_DELIVERY_RETRY_MAX_SECONDS`) are documented in `.env.example`. Tenants opt in through `notification_configs` rows with `channel = 'push'`; see `packages/db/src/seeds/notification-defaults.sql` for the demo tenant examples.

## Release Gate

Before distribution:

```bash
pnpm --filter @cleanhub/mobile-web typecheck
pnpm --filter @cleanhub/mobile-web lint
pnpm --filter @cleanhub/mobile typecheck
pnpm --filter @cleanhub/mobile lint
```

Also complete the mobile QA checklist in `docs/05-qa/test-plans/CleanHub移动端发布测试计划.md` and the device acceptance checklist in `docs/06-delivery/acceptance/CleanHub移动端真机验收清单.md`.
