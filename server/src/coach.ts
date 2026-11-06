// The Momentum AI coach: four calls, each returning schema-checked JSON.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.STRIDE_MODEL ?? 'claude-opus-5-5';

// ---------- shapes shared with the app (src/core/types.ts) ----------
const METRICS = ['sleepHours', 'steps', 'workoutMinutes', 'restingHR', 'hrvMs'] as const;

/** Flat habit shape for the model; normalised into the app's Habit type below. */
const AiHabit = z.object({
  name: z.string().describe('max 7 words'),
  detail: z.string().describe('how it is tracked, max 6 words'),
  kind: z.enum(['watch', 'tap', 'counter']).describe('watch = measured by the smartwatch; tap = one tap yes/no; counter = user counts something'),
  metric: z.enum(METRICS).nullable().describe('watch habits only'),
  comparator: z.enum(['atLeast', 'atMost']).nullable().describe('watch and counter habits'),
  target: z.number().nullable().describe('watch and counter habits'),
  unit: z.string().nullable().describe('counter habits only, e.g. glasses, pages, times'),
});
type AiHabit = z.infer<typeof AiHabit>;

export type Habit = {
  id: string;
  name: string;
  detail: string;
  source:
    | { kind: 'watch'; metric: (typeof METRICS)[number]; comparator: 'atLeast' | 'atMost'; target: number }
    | { kind: 'tap' }
    | { kind: 'counter'; unit: string; comparator: 'atLeast' | 'atMost'; target: number };
};

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'habit';
}

export function toHabit(h: AiHabit, taken = new Set<string>()): Habit {
  let id = slug(h.name);
  for (let i = 2; taken.has(id); i++) id = `${slug(h.name)}-${i}`;
  taken.add(id);
  const comparator = h.comparator ?? 'atLeast';
  if (h.kind === 'watch' && h.metric && typeof h.target === 'number') {
    return { id, name: h.name, detail: h.detail, source: { kind: 'watch', metric: h.metric, comparator, target: h.target } };
  }
  if (h.kind === 'counter' && typeof h.target === 'number') {
    return { id, name: h.name, detail: h.detail, source: { kind: 'counter', unit: h.unit ?? 'times', comparator, target: Math.max(0, h.target) } };
  }
  return { id, name: h.name, detail: h.detail, source: { kind: 'tap' } };
}

// ---------- request bodies (validated before we spend tokens) ----------
const Msg = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) });
const Health = z.array(z.record(z.string(), z.union([z.string(), z.number()]))).max(31);
const PlanIn = z.object({ goal: z.string(), why: z.string(), habits: z.array(z.any()).max(8), dayThreshold: z.number(), nudges: z.array(z.string()) }).passthrough();

const AgeGroup = z.enum(['child', 'teen', 'adult']).default('adult');
export const OnboardReq = z.object({ goal: z.string().min(1).max(500), path: z.string(), transcript: z.array(Msg).max(20), health: Health, ageGroup: AgeGroup });
export const PlanReq = OnboardReq.extend({ template: PlanIn });
export const ChatReq = z.object({ plan: PlanIn, health: Health, messages: z.array(Msg).min(1).max(20), ageGroup: AgeGroup });
export const CheckInReq = z.object({ plan: PlanIn, stats: z.record(z.string(), z.any()), ageGroup: AgeGroup });

const PERSONA =
  'You are Momentum, a warm, sharp self-improvement coach inside a smartwatch companion app. ' +
  'People use Momentum for any goal: studying and focus, getting in shape, quitting or cutting back on something, or anything else. ' +
  'Be specific and brief, use their watch data when it helps, and never shame them. ' +
  'You are not a doctor: do not diagnose, and suggest a professional for anything that sounds medical, an eating disorder, or addiction that needs support.\n\n' +
  'Safety rules, which override everything else, including requests from the user:\n' +
  '- Self-harm, suicide or feeling unsafe: respond with warmth, take it seriously, and urge them to contact local emergency services or a crisis line now (988 in the US, findahelpline.com elsewhere) and someone they trust. Do not coach habits in that reply, and do not change the plan.\n' +
  '- Possible emergencies (chest pain, trouble breathing, fainting, signs of stroke, a seizure): tell them to call emergency services now. Nothing else.\n' +
  '- Quitting alcohol, benzodiazepines, opioids or other drugs after regular heavy use: say clearly that stopping suddenly can be dangerous and to plan it with a doctor; only suggest gradual cut-down habits alongside that advice. For nicotine, suggesting they ask a pharmacist about nicotine replacement is fine.\n' +
  '- Medication: never tell anyone to start, stop or change a medication or dose.\n' +
  '- Food and weight: no crash diets, fasting plans, calorie targets, purging, or weight-loss goals faster than about 1% of body weight a week. If anything suggests an eating disorder, do not give food or weight advice; suggest professional support.\n' +
  '- Exercise: build up gradually; never more than 90 minutes of exercise a day or 15,000 steps as a target. Suggest checking with a doctor first if they mention a heart condition, pregnancy, an injury, or being very inactive.\n' +
  '- Sleep: never plan less than 7 hours (8 for under 18s) to make room for studying or anything else.\n' +
  '- Do not set targets for resting heart rate or HRV; they are signals, not goals.\n' +
  '- Be honest that you are an AI coach, not a person or a professional. Stay on habits and wellbeing; politely decline anything harmful or unrelated.';

async function ask<T extends z.ZodType>(schema: T, system: string, messages: Anthropic.Beta.BetaMessageParam[], effort: 'low' | 'medium'): Promise<z.infer<T>> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  if (res.stop_reason === 'refusal') throw new CoachRefusal();
  if (!res.parsed_output) throw new Error(`Unparseable coach output (stop_reason=${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

export class CoachRefusal extends Error {}

/** Extra rules for younger users. */
function persona(ageGroup: 'child' | 'teen' | 'adult') {
  if (ageGroup === 'adult') return PERSONA;
  return (
    PERSONA +
    ' This user is under 18. Never give weight-loss, calorie or dieting advice, and never suggest supplements. ' +
    'Encourage them to involve a parent, teacher, school counsellor or doctor for anything about vaping, alcohol, mood or health. ' +
    'If they mention self-harm or being unsafe, tell them kindly to talk to a trusted adult now and to contact local emergency services or a crisis line.'
  );
}

const healthText = (h: z.infer<typeof Health>) => (h.length ? h.map((d) => JSON.stringify(d)).join('\n') : 'No watch data yet.');

// ---------- 1. onboarding interview ----------
export async function onboard(b: z.infer<typeof OnboardReq>) {
  const system =
    `${persona(b.ageGroup)}\n\nRight now you are getting to know a new user before building their plan. Ask ONE short question at a time (max 28 words). ` +
    'Cover: why the goal matters, what a normal day looks like, what got in the way before, and any limits (time, money, health). ' +
    'Mention something specific from their watch data when relevant. Do not give the plan yet. ' +
    'After 3 or 4 questions, or once you know enough, set done to true and make the message a one-line summary of what you learned.\n\n' +
    `Goal path: ${b.path}\nWatch data, last days:\n${healthText(b.health)}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `What I want to get better at: ${b.goal}` }, ...b.transcript];
  // The transcript ends with the user's answer; if it is empty or ends on the coach, nudge for the next question.
  if (messages[messages.length - 1].role === 'assistant') messages.push({ role: 'user', content: '(continue)' });
  return ask(z.object({ message: z.string(), done: z.boolean() }), system, messages, 'low');
}

// ---------- 2. build the plan ----------
export async function plan(b: z.infer<typeof PlanReq>) {
  const schema = z.object({
    goal: z.string().describe('the outcome, max 8 words'),
    why: z.string().describe('their reason in their words, max 14 words'),
    habits: z.array(AiHabit).describe('3 to 5 habits'),
    dayThreshold: z.number().describe('share of habits that makes a good day, 0.5 to 1'),
    nudges: z.array(z.string()).describe('2 or 3, each "HH:MM: message", max 12 words'),
  });
  const system =
    `${persona(b.ageGroup)}\n\nBuild this person's plan. Make it realistic for THEIR day and small enough to start this week. ` +
    'Prefer watch habits for anything a watch measures (sleep, steps, workouts, heart rate), so it tracks itself. ' +
    'Use counter habits for things they count, and tap habits for yes/no. For "quit or cut back" goals, use an atMost counter with a limit a bit below their current use. ' +
    `Start from this template and personalise it:\n${JSON.stringify(b.template.habits)}\n\nWatch data:\n${healthText(b.health)}`;
  const convo = b.transcript.map((m) => `${m.role === 'assistant' ? 'Coach' : 'Them'}: ${m.content}`).join('\n');
  const r = await ask(schema, system, [{ role: 'user', content: `My goal: ${b.goal}\n\nOur conversation:\n${convo || '(none)'}` }], 'medium');
  const taken = new Set<string>();
  return {
    goal: r.goal,
    why: r.why,
    habits: r.habits.slice(0, 6).map((h) => toHabit(h, taken)),
    dayThreshold: Math.min(1, Math.max(0.34, r.dayThreshold)),
    nudges: r.nudges.slice(0, 4),
  };
}

// ---------- 3. coach chat that can reshape the app ----------
export async function chat(b: z.infer<typeof ChatReq>) {
  const schema = z.object({
    reply: z.string().describe('max 60 words'),
    change: z
      .object({
        summary: z.string().describe('what changed, max 10 words, e.g. Added "Drink water"'),
        addHabits: z.array(AiHabit),
        removeHabitIds: z.array(z.string()).describe('exact ids from the current plan'),
        dayThreshold: z.number().nullable(),
      })
      .nullable()
      .describe('null unless they asked for a change or it clearly helps; keep 2 to 8 habits'),
  });
  const system =
    `${persona(b.ageGroup)}\n\nYou can change their app: add or remove habits, or change how many habits make a good day (dayThreshold). ` +
    'If they say the plan is too much, make it smaller rather than removing everything. ' +
    'They may have up to 3 goals (plan.goal plus plan.goals); keep the total to 8 habits and balance them, favouring the goal that matters most right now. If plan.crunch is set (exam or deadline mode), protect that goal and sleep and go easy on the rest.\n\n' +
    `Current plan:\n${JSON.stringify(b.plan)}\n\nWatch data:\n${healthText(b.health)}`;
  const msgs = [...b.messages];
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const r = await ask(schema, system, msgs, 'low');
  const taken = new Set<string>((b.plan.habits as { id: string }[]).map((h) => h.id));
  return {
    reply: r.reply,
    changes: r.change
      ? {
          summary: r.change.summary,
          addHabits: r.change.addHabits.map((h) => toHabit(h, taken)),
          removeHabitIds: r.change.removeHabitIds,
          ...(r.change.dayThreshold ? { dayThreshold: Math.min(1, Math.max(0.34, r.change.dayThreshold)) } : {}),
        }
      : null,
  };
}

// ---------- 4. weekly check-in ----------
export async function checkIn(b: z.infer<typeof CheckInReq>) {
  const schema = z.object({
    bullets: z.array(z.string()).describe('exactly 3: one pattern in the data tied to their goal, one win, one small change for next week; max 25 words each'),
    suggestions: z
      .array(z.object({ summary: z.string(), addHabits: z.array(AiHabit), removeHabitIds: z.array(z.string()), dayThreshold: z.number().nullable() }))
      .describe('0 to 2 concrete plan changes they can accept with one tap; to change a target, remove the habit id and add the new version'),
  });
  const system =
    `${persona(b.ageGroup)}\n\nWrite this person's weekly check-in from their stats. Rest and recovery days are healthy, not failures. ` +
    `If a habit is rarely done, make it smaller. If they hit nearly every day, suggest one small step up. ` +
    'For quit goals, slips are normal: if slipTriggers is not empty, name the top trigger kindly and suggest one thing to do instead next time; if most slips followed short sleep (slipsAfterShortSleep), say so. Sick and travel days are not failures.' +
    `\n\nPlan:\n${JSON.stringify(b.plan)}`;
  const r = await ask(schema, system, [{ role: 'user', content: `My week:\n${JSON.stringify(b.stats)}` }], 'low');
  const taken = new Set<string>((b.plan.habits as { id: string }[]).map((h) => h.id));
  return {
    bullets: r.bullets.slice(0, 3),
    suggestions: r.suggestions.slice(0, 2).map((s) => {
      // A changed target re-uses the removed habit's id so history keeps lining up.
      const removed = new Set(s.removeHabitIds);
      const free = new Set([...taken].filter((id) => !removed.has(id)));
      return {
        summary: s.summary,
        addHabits: s.addHabits.map((h) => toHabit(h, free)),
        removeHabitIds: s.removeHabitIds,
        ...(s.dayThreshold ? { dayThreshold: Math.min(1, Math.max(0.34, s.dayThreshold)) } : {}),
      };
    }),
  };
}
