# Getting Momentum onto TestFlight

Everything in the code is ready. These are the steps only the account owner can do, in order. Time needed is about 1 hour of clicking, plus Apple's approval wait.

## 1. Accounts (you)
- [ ] **Apple Developer Program**, $99/year: https://developer.apple.com/programs/enroll (enroll as an individual unless you have a company). Wait for the approval email.
- [ ] **Expo account**, free: https://expo.dev/signup. This runs the cloud builds, so no Mac is needed.
- [ ] **Anthropic Console account** for the AI coach: https://console.anthropic.com. Add a payment method, create an API key, and **set a monthly spend limit** (Settings > Limits), for example $20 while testing.
- [ ] **Render account** to host the coach server: https://render.com (about $7/month for the plan with a disk).
- [ ] An email address for privacy questions (put it in `PRIVACY.md` where it says `[CONTACT EMAIL]`).

## 2. Host the coach server (about 10 minutes)
1. In Render: New > Blueprint > connect GitHub > pick this repo. It reads `render.yaml`.
2. Paste the Anthropic API key when asked. Render makes `APP_KEY` for you.
3. When it's live, open `https://<your-service>.onrender.com/health`; it should say `{"ok":true}`.

## 3. Build and upload (about 30 minutes, mostly waiting)
On any computer with Node installed, in this repo:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # links the project to your Expo account
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_COACH_URL --value https://<your-service>.onrender.com --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_COACH_KEY --value <APP_KEY from Render> --visibility plaintext
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

EAS asks you to sign in with your Apple ID, then creates the certificates, the App Store Connect app record and the HealthKit capability for you. `--auto-submit` uploads the build to TestFlight when it's done.

If Apple says the bundle ID `app.momentum.coach` is taken, change `ios.bundleIdentifier` in `app.json` (for example `com.<yourname>.momentum`) and run the build again.

## 4. In App Store Connect (about 15 minutes)
- [ ] App name: "Momentum" alone is almost certainly taken. Try "Momentum: AI Habit Coach".
- [ ] Privacy Policy URL: `https://github.com/roganvs23-web/Growth-and-progress/blob/main/PRIVACY.md`
- [ ] App Privacy answers: Health and Fitness data, plus User Content (coach chat). Collected for App Functionality, **not** linked to identity, **not** used for tracking.
- [ ] TestFlight > Internal Testing: add yourself, then install the TestFlight app on your iPhone and open the invite.

Internal testers (up to 100 people on your team) need no review. Inviting outside testers by link needs a short Beta App Review, usually a day.

## Decisions still open before the App Store (not needed for TestFlight)
- Under-13s: block them for v1 (recommended) or use a verified parental consent service.
- Final prices, and switching on subscriptions.
- Teen rules for any EU launch (ask a lawyer).
