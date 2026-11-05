# Momentum

An AI coach for any goal that works with any smartwatch. iPhone and Android, built with Expo (React Native, SDK 57) and a small Node server that talks to Claude.

## What works today

- **Onboarding.** Pick a path (Study and focus, Get in shape, Quit or cut back, Something else) or type a goal. The coach asks 3 or 4 questions, then builds a personal plan.
- **Today.** Readiness score from sleep, HRV and resting heart rate. Habits that tick themselves off from watch data, one-tap habits, and counters (including "stay under my limit" for cutting back).
- **Forgiving streaks.** A good day is when you hit enough of your habits. You start with 1 recovery day and earn another every 6 good days (bank up to 2). A missed day spends a recovery day instead of breaking the streak. A low-readiness day is a free rest day. You can also plan a rest day.
- **Coach chat.** Ask anything, or say "this is too much" and the coach changes your plan in place.
- **Weekly check-in.** Numbers are computed on the phone; the coach turns them into three bullets and up to two one-tap plan changes. Works offline with a rule-based version.
- **No watch needed.** Without a watch, the phone's own step count still flows in, a 10-second morning check-in (sleep and how you feel) drives readiness, habits a watch would measure can be ticked by hand, and study habits get a 25-minute focus timer. A watch is an upgrade, not a requirement. Sample data appears only in development builds (Expo Go, simulators), never in the store app.
- **Tough days.** A bad night, feeling rough, or a resting heart rate well above normal lightens the day (about half the habits count as a good day). "I'm sick" makes it a free rest day. Travel mode (suggested automatically after a 2+ hour time zone change) makes missed days free. After 4+ days away, a "welcome back" fresh start restarts the streak but keeps history and the best streak. On quit goals, going over the limit shows a no-shame slip-up card that asks what triggered it; the weekly check-in looks for patterns, like slips after short nights.
- **Several goals.** Up to 3 goals at once (say, finals and cutting back on vaping), up to 8 habits in total. Shared watch habits like sleep serve every goal instead of being duplicated, and the coach balances them.
- **Exam or deadline mode.** Pick a goal and a length (3 days to 2 weeks). Until then only that goal's habits and sleep count toward the streak; the rest are shown as optional.
- **Offline first.** With no coach server configured, the app still runs end to end on templates and rules.

- **Real watch data.** Reads sleep, steps, exercise minutes, resting heart rate and HRV from Apple Health on iPhone and Health Connect on Android. That covers Apple Watch, Galaxy Watch, Pixel Watch, Fitbit, Garmin, Oura, Whoop and most others, because their apps sync into one of the two. Overlapping records (watch plus phone) are de-duplicated.

## Run it

```bash
npm install
npm test            # 32 unit tests for streaks, readiness, templates, check-ins, sleep merging
npm run typecheck
npx expo start      # Expo Go works, with sample watch data
```

Real watch data needs a development build, because Apple Health and Health Connect are native modules that Expo Go does not include:

```bash
npx eas-cli@latest build --profile development --platform ios      # install on your iPhone
npx eas-cli@latest build --profile development --platform android  # install on your Android phone
npx expo start --dev-client
```

On Android the phone needs the Health Connect app (built into Android 14 and later, a free Play Store download before that), and your watch's app must have "sync to Health Connect" turned on.

To turn on the AI coach locally:

```bash
cd server
cp .env.example .env    # add ANTHROPIC_API_KEY
npm install
npm run dev             # http://localhost:8787
```

Then in the app folder create `.env` with `EXPO_PUBLIC_COACH_URL=http://<your computer's LAN IP>:8787` and restart `npx expo start`.

## Layout

```
App.tsx                 tabs: Today, Coach, Progress (onboarding until a plan exists)
src/core/               pure logic, unit tested: types, templates, progress (streaks, readiness), checkin
src/health/             HealthKitSource (iPhone), HealthConnectSource (Android), sample fallback
src/coach/coachClient   calls the server, falls back offline
src/screens/            Onboarding, Today, Coach, Progress
src/ui/                 theme (light and dark) and small component kit
server/                 Node coach server: /v1/onboard, /v1/plan, /v1/chat, /v1/checkin
```

The Claude API key lives only on the server. The phone never holds it.

## Ship it

Builds and store submission run in the cloud with EAS, no Xcode or Android Studio needed:

```bash
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest submit --platform ios      # needs an Apple Developer account
npx eas-cli@latest submit --platform android  # needs a Google Play Console account
```

See `ROADMAP.md` for what is left before a paid launch.
