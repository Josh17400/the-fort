# iOS CI (TestFlight from GitHub Actions)

The Fort's iOS app (`native/`, see `native/README.md`) is built and signed on GitHub's macOS
runners, so no Mac is needed. The pipeline is a copy of euchre-unleashed's, and it reuses that
repo's Apple credentials: both apps belong to the same Apple Developer team.

- `.github/workflows/ios.yml` runs the shell tests and the game checks, builds `native/www`, syncs
  Capacitor, then archives and uploads to TestFlight with `fastlane ios beta`. **Every run uploads a
  build**, so trigger it only to ship. The `release` input marks an App Store candidate: that build
  uses the live AdMob units, every other one Google's test units.
- `.github/workflows/ios-mint-cert.yml` mints a new Apple Distribution certificate with
  `fastlane ios mint_cert`. You don't need it to start: see "Renew the distribution certificate".

Both lanes live in `native/ios/fastlane/Fastfile`.

## Repo secrets: copy them from euchre-unleashed

Settings > Secrets and variables > Actions > New repository secret, in `Josh17400/the-fort`.
GitHub never shows a secret's value again, so take each one from where you saved it when you set
up euchre-unleashed (the `.p8` file, the p12 and its password).

| Secret | What | Same value as euchre-unleashed? |
|---|---|---|
| `ASC_KEY_ID`, `ASC_ISSUER_ID` | App Store Connect API key (App Manager role) | yes |
| `ASC_KEY_P8` | that key's `.p8` file, base64 | yes |
| `APPLE_TEAM_ID` | Apple Developer Team ID | yes |
| `IOS_CERT_P12_B64` | the team's Apple Distribution certificate as a password-protected p12, base64 | yes: a team has one distribution cert and both apps sign with it |
| `CERT_EXPORT_PASS` | the password of that p12 | yes |

From Git Bash, with the files at hand:

```
gh secret set ASC_KEY_ID       --repo Josh17400/the-fort --body "<key id>"
gh secret set ASC_ISSUER_ID    --repo Josh17400/the-fort --body "<issuer id>"
gh secret set ASC_KEY_P8       --repo Josh17400/the-fort --body "$(base64 -w0 AuthKey_<key id>.p8)"
gh secret set APPLE_TEAM_ID    --repo Josh17400/the-fort --body "<team id>"
gh secret set IOS_CERT_P12_B64 --repo Josh17400/the-fort --body "$(base64 -w0 dist.p12)"
gh secret set CERT_EXPORT_PASS --repo Josh17400/the-fort --body "<p12 password>"
```

Nothing secret is committed: `native/.gitignore` blocks `*.p8`, `*.p12`, `*.mobileprovision`
and `*.cer`. The AdMob ids and the RevenueCat key in `index.html` are public by design (they ship
inside every app build), so they need no secret.

## Accounts: what exists and what is left

Done (2026-09-27):

- **Bundle id** `com.thefort.game`, registered with Game Center and In-App Purchase.
- **App record** "The Fort: Last Stand" ("The Fort" was taken; the home-screen name is still The
  Fort), Apple ID 6816787587, SKU `thefort001`.
- **AdMob** app "The Fort" with a rewarded and an interstitial unit, and **RevenueCat** project
  "The Fort". Their ids are already in `index.html` `PLAT_IDS` and `Info.plist`
  (`native/README.md`, "Ids and where they live").

Left to do:

1. **In-app purchases.** App Store Connect > The Fort: Last Stand > Monetization > In-App Purchases:
   the seven `fort_*` products in `native/README.md` ("In-app products"), then the same ids in
   RevenueCat. The App Store needs the paid-apps agreement for them to load, even in TestFlight.
   Until then the shop shows but every purchase fails with "not in the App Store yet".
2. **Game Center (optional).** A recurring daily leaderboard for the daily challenge's best wave;
   put its id in `PLAT_IDS.lbDaily`.
3. **AdMob review.** Live units fill only after AdMob approves the App Store listing, which is
   another reason ordinary runs build with test units.

## Ship a build

```
gh workflow run ios.yml --repo Josh17400/the-fort --ref <branch>
gh run watch --repo Josh17400/the-fort
```

GitHub only offers a manual workflow once its file is on the default branch (`main`). After that,
`--ref` builds any branch.

Tick `release` only for the build you will submit to App Review: it switches the game to the live
AdMob units. Every other run uses Google's test units, and its Settings build line says "test ads".

The build number is the GitHub run number, and the Settings screen shows it ("The Fort for iOS ·
v1.0.0 · build N") so a TestFlight report names its binary. "Re-run jobs" keeps that number, so
re-running a run whose upload already reached TestFlight is rejected as a duplicate build; start a
new run instead. The marketing version (`MARKETING_VERSION`) is set in the Xcode project.

## Renew the distribution certificate (yearly)

An Apple Distribution certificate is valid for one year, and The Fort and Euchre Unleashed share
it. When it expires, `ios.yml` fails in the signing step in both repos. To replace it:

1. Revoke the expired certificate at developer.apple.com > Certificates.
2. Run `gh workflow run ios-mint-cert.yml --repo Josh17400/the-fort` and wait for it (or the same
   workflow in euchre-unleashed; either repo can mint it).
3. Download the `dist-cert` artifact within a day (it expires after one), and decrypt it in
   Git Bash with the `CERT_EXPORT_PASS` value:
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -in dist.p12.enc -out dist.p12 -pass pass:<CERT_EXPORT_PASS>
   gh secret set IOS_CERT_P12_B64 --repo Josh17400/the-fort --body "$(base64 -w0 dist.p12)"
   gh secret set IOS_CERT_P12_B64 --repo Josh17400/euchre-unleashed --body "$(base64 -w0 dist.p12)"
   ```
4. Delete `dist.p12` and `dist.p12.enc`, then run `ios.yml`.

Don't run `ios-mint-cert.yml` while the current certificate is valid: Apple caps a team's
distribution certificates, and a new one does nothing for the other repo until its secret is
updated too.

## GitHub Pages

The live game is `index.html` at the repository root, served from `main`. `native/` sits beside it
and changes nothing there: Pages serves those files too (`.nojekyll`), but nothing links to them
and the web page never loads `shell.js` or `capacitor.js`. Without `window.Shell` the web build
behaves exactly as before: no ads, no purchases, localStorage only. `native/www/` and
`native/node_modules/` are gitignored, so the repository holds only sources.

## When a run fails

- **Test step.** `node native/test_shell.cjs` and `node native/check_game.cjs` name the failing
  check. A syntax error in `index.html` shows its line number.
- **Build step: "AdMob app id mismatch".** `PLAT_IDS.admobApp` and `GADApplicationIdentifier`
  differ; set both to the same id.
- **Signing step: no identity or an expired certificate.** Renew the certificate (above), or the
  `IOS_CERT_P12_B64` / `CERT_EXPORT_PASS` pair was copied wrong.
- **Upload: "Could not find app" or 401.** The API key has lost the App Manager role, or a secret
  was rotated without updating it here.
- **Upload: the bundle version already exists.** A re-run reused the run number; start a new run.
- **Runner image.** `ios.yml` pins `runs-on: macos-26`. If GitHub retires that image, move to its
  successor; Capacitor 8 needs Xcode 16.4 or later.
