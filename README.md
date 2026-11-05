# Momentum

An AI coach for any goal that works with any smartwatch. iPhone and Android, built with Expo (React Native, SDK 57) and a small Node server that talks to Claude.

## What works today

- **Onboarding.** Pick a path (Study and focus, Get in shape, Quit or cut back, Something else) or type a goal. The coach asks 3 or 4 questions, then builds a personal plan.
- **Today.** Readiness score from sleep, HRV and resting heart rate. Habits that tick themselves off from watch data, one-tap habits, and counters (including "stay under my limit" for cutting back).
- **Forgiving streaks.** A good day is when you hit enough of your habits. You start with 1 recovery day and earn another every 6 good days (bank up to 2). A missed day spends a recovery day instead of breaking the streak. A low-readiness day is a free rest day. You can also plan a rest day.
- **Coach chat.** Ask anything, or say "this is too much" and the coach changes your plan in place.
- **Weekly check-in.** Numbers are computed on the phone; the coach turns them into three bullets and up to two one-tap plan changes. Works offline with a rule-based version.
- **Offline first.** With no coach server configured, the app still runs end to end on templates and rules.

Watch data currently comes from a realistic sample source so the app runs in Expo Go and simulators. See `src/health/index.ts` for the two adapters (Apple HealthKit, Android Health Connect) that cover nearly every watch.

## Run it

```bash
npm install
npm test            # 11 unit tests for streaks, readiness, templates, check-ins
npm run typecheck
npx expo start      # scan the QR code with Expo Go
```

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
src/health/             HealthSource interface + sample data; native adapters go here
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
