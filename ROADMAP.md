# Road to a paid launch

## Done (v0.1)
- Expo app for iPhone and Android: onboarding, Today, Coach, Progress
- Goal templates for the four launch paths
- Forgiving streaks with earned recovery days and low-readiness rest days
- Weekly AI check-in with one-tap plan changes, offline fallback
- Coach server with schema-checked JSON, input validation, basic rate limit
- Unit tests for the core logic; iOS and Android bundles build

## Next, in order
1. **Real watch data.** Add the HealthKit adapter (iOS) and Health Connect adapter (Android) in `src/health/`. Needs a development build (`eas build --profile development`).
2. **Deploy the coach server** (Fly.io, Render or Railway) with `ANTHROPIC_API_KEY` as a secret, and set `EXPO_PUBLIC_COACH_URL` in EAS.
3. **Accounts and sync.** Sign in with Apple and Google, back up the plan and history to the server so a new phone restores it. Replace the per-IP rate limit with per-account limits.
4. **Subscriptions.** Free trial then monthly or yearly plan, through App Store and Google Play billing (RevenueCat is the usual shortcut). Gate the AI coach and check-ins behind it; keep tracking free.
5. **Nudges as real notifications.** Schedule the plan's nudges with `expo-notifications` (already installed), and send a reminder when the weekly check-in is ready.
6. **Watch app.** A small complication or tile showing streak and readiness (Apple Watch first, then Wear OS).
7. **Store listing.** Icon, screenshots, privacy policy (health data is sensitive: explain that only daily summaries go to the coach), App Store and Play review.

## Decisions for Rogan
- Price: suggested $7.99/month or $49.99/year with a 7-day free trial.
- App name and bundle id: currently "Stride" and `app.stride.coach`.
- Apple Developer ($99/year) and Google Play Console ($25 once) accounts, in your name or a company's.
