# CleanHub Mobile Install And Distribution

## Android APK/AAB

1. Inject signing secrets through local shell or CI secret variables.
2. Select environment and version:

```bash
CLEANHUB_MOBILE_ENV=staging
CLEANHUB_MOBILE_VERSION=0.1.0
CLEANHUB_MOBILE_BUILD_NUMBER=1
```

3. Build signed artifacts:

```bash
pnpm --filter @cleanhub/mobile package:android
```

4. Distribute the AAB through Google Play/internal testing when available, or distribute the signed APK to approved testers only.

## iOS TestFlight

1. Install Apple Distribution certificate and provisioning profile in the macOS keychain/CI runner.
2. Export required variables:

```bash
CLEANHUB_IOS_TEAM_ID=TEAMID1234
CLEANHUB_IOS_BUNDLE_ID=com.cleanhub.app
CLEANHUB_IOS_PROVISIONING_PROFILE="CleanHub App Store"
CLEANHUB_IOS_EXPORT_METHOD=app-store-connect
CLEANHUB_MOBILE_ENV=staging
CLEANHUB_MOBILE_VERSION=0.1.0
CLEANHUB_MOBILE_BUILD_NUMBER=1
```

3. Build the IPA:

```bash
pnpm --filter @cleanhub/mobile package:ios
```

4. Upload `release/mobile/ios/export` through Transporter or CI, then add internal TestFlight testers.

## Environment Confirmation

Before sending a build to testers, confirm:

- API base URL matches the intended dev/staging/prod target.
- App version and build number match release notes.
- Minimum supported version is not higher than the build being distributed.
- Update URL points to the correct APK/TestFlight/install entry.

## Rollback

Android rollback uses the previous signed APK/AAB or a staged rollout halt. iOS rollback uses TestFlight build expiration/removal and re-promoting the previous accepted build when available.
