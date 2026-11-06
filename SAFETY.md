# Keeping Momentum users safe

What protects users today, and what still needs a decision. Reviewed 6 November 2026 against the App Store Review Guidelines (1.2, 1.4.1, 5.1.1–5.1.3), Google Play's Health apps and Health Connect policies, and US children's privacy rules (COPPA).

## In the app now
| Risk | Protection |
|---|---|
| Someone mentions self-harm, suicide or not being safe | A help card appears straight away, on the phone, even offline or with the AI coach off: emergency number, 988 (US), findahelpline.com. The coach is told to stop coaching and point to help. |
| Possible medical emergency (chest pain, can't breathe, fainting) | Same: an "emergency" card with a call button; the coach only says to call emergency services. |
| Quitting alcohol, benzodiazepines or opioids cold turkey | A card explains withdrawal can be dangerous and to plan it with a doctor; the coach only suggests gradual cut-down alongside that. |
| Eating disorder signs | A support card; the coach gives no food, calorie or weight advice. |
| Risky AI-made plans | Every plan is clamped on the phone, whatever the AI says: sleep at least 7 hours (8 for under 18s), steps at most 15,000 (12,000), workouts at most 90 minutes (60). No targets on heart rate or HRV. |
| Diet and medication advice | The coach never gives crash diets, fasting plans or calorie targets, never more than about 1% body weight a week, and never tells anyone to change a medication. Under 18s get no weight-loss advice at all. |
| Medical claims | "Not a medical device" notice in onboarding and in You > Health and safety (Apple 1.4.1). Readiness is described as an estimate. |
| Data sent to AI | Asked before anything is sent; Anthropic is named; off means nothing leaves the phone (Apple 5.1.2). |
| Health data | Daily totals only, per-metric switches, never used for ads, never stored on the server, export and delete in the app (Apple 5.1.3). |
| Buddy mode (the only thing one user shows another) | Pairing only by a code you choose to share, no search, no messages. Nicknames are filtered. Leaving ends the link for good (acts as a block). Off for under 13s. |
| Server abuse | Rate limit per device, optional app key, request size limit, spend limit in the Anthropic Console. |

## Still to decide or do (Rogan)
1. **Under 13s.** Recommended: block them for v1. The parent step is not verified consent under COPPA, and Apple treats apps that knowingly allow under 13s strictly.
2. **Contact email** for PRIVACY.md. Apple also asks for a contact for reporting problems in apps where users see each other's content (buddy nicknames).
3. **Subscriptions (when switched on).** Show the price, length, free-trial end and "cancels any time in Settings" before purchase; use Apple and Google billing only. FTC and EU rules require cancelling to be as easy as signing up.
4. **Android (Google Play).** Health Connect apps must fill in the Health apps declaration and show a privacy policy screen when Health Connect asks; do this before the Play Store build.
5. **EU launch.** Check the teen consent age with a lawyer (13 to 16 depending on the country).
6. **Crisis numbers outside the US.** The card links to findahelpline.com, which covers most countries. If you launch in one country first, we can add its numbers directly.
