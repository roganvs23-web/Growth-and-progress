# Road to a paid launch

## Done (v0.1)
- Expo app for iPhone and Android: onboarding, Today, Coach, Progress
- Goal templates for the four launch paths
- Forgiving streaks with earned recovery days and low-readiness rest days
- Weekly AI check-in with one-tap plan changes, offline fallback
- Coach server with schema-checked JSON, input validation, basic rate limit
- Unit tests for the core logic; iOS and Android bundles build
- Real watch data from Apple Health and Health Connect
- Phone-only mode: morning check-in, hand-ticked habits, focus timer; no sample data in production
- Tough days: easy days, sick and travel modes, welcome-back fresh start, slip-up reset with triggers
- Up to 3 goals at once; exam and deadline mode
- Privacy: per-metric switches, AI coach on/off, export and delete my data (You tab)
- Age check by birth year, teen-safe coach rules, student and teen pricing hooks
- Buddy mode: invite code, shared streaks and cheers (server endpoints under /v1/buddy)

## Next, in order
1. **Test real watch data on devices.** Install a development build on an iPhone with Apple Watch and an Android phone with a Galaxy or Pixel watch, and compare numbers with the Health apps.
2. **Deploy the coach server** (Fly.io, Render or Railway) with `ANTHROPIC_API_KEY` as a secret, and set `EXPO_PUBLIC_COACH_URL` in EAS. For buddy mode, mount a small volume and set `BUDDY_DATA_FILE` (for example `/data/buddies.json`) so pairs survive restarts. Run one instance until buddy storage moves to a database (step 3).
3. **Accounts and sync.** Sign in with Apple and Google, back up the plan and history to the server so a new phone restores it. Replace the per-IP rate limit with per-account limits, and move buddy pairs into the same database.
4. **Subscriptions.** Free trial then monthly or yearly plan, through App Store and Google Play billing (RevenueCat is the usual shortcut). Gate the AI coach and check-ins behind it; keep tracking free.
5. **Nudges as real notifications.** Schedule the plan's nudges with `expo-notifications` (already installed), and send a reminder when the weekly check-in is ready.
6. **Watch app.** A small complication or tile showing streak and readiness (Apple Watch first, then Wear OS).
7. **Store listing.** Icon, screenshots, privacy policy (health data is sensitive: explain that only daily summaries go to the coach), App Store and Play review.

## Decisions for Rogan
- Price: suggested $7.99/month or $49.99/year with a 7-day free trial; student and teen $3.99/month or $24.99/year (placeholders in `src/core/profile.ts`).
- Under-13s: the parent step is a placeholder, not verified consent (COPPA in the US). Either set the minimum age to 13 and block younger users, or use a verified-consent service before launch. Recommended: block under-13s for v1.
- Teens 13 to 17: GDPR sets the consent age between 13 and 16 depending on the EU country; a lawyer should confirm before launching in Europe.
- Student proof: honor system for now; a service like UNiDAYS or SheerID can verify later.
- App name and bundle id: currently "Momentum" and `app.momentum.coach`.
- Apple Developer ($99/year) and Google Play Console ($25 once) accounts, in your name or a company's.
