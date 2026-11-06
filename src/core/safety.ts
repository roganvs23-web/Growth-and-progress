// Safety checks that run on the phone, so they work with or without the AI
// coach and cannot be talked around by a prompt.
import type { Habit, Plan } from './types';
import type { AgeGroup } from './profile';

export type SafetyTopic = 'selfHarm' | 'emergency' | 'withdrawal' | 'eating';

// Kept deliberately broad: a false alarm shows a helpful card, a miss shows nothing.
const PATTERNS: [SafetyTopic, RegExp][] = [
  ['selfHarm', /\b(suicid\w*|kill(ing)? my ?self|end (it all|my life)|want(ed)? to die|don'?t want to (be alive|live|wake up)|self[- ]?harm\w*|cut(ting)? my ?self|hurt(ing)? my ?self|no reason to live|better off dead|overdos\w*)\b/i],
  ['emergency', /\b(chest pains?|can'?t breathe|cannot breathe|trouble breathing|passed out|fainted|heart attack|stroke|seizure|numb(ness)? (in|on) (my )?(face|arm)|someone (is )?hurting me|not safe at home)\b/i],
  ['withdrawal', /\b(alcohol|drinking(?! (coffee|soda|tea|energy|pop|juice|water|milk))|booze|benzo\w*|xanax|valium|klonopin|ativan|opioids?|opiates?|heroin|fentanyl|oxy\w*|methadone|sleeping pills|painkillers)\b.*\b(quit|stop|cold turkey|cut (back|down)|withdraw\w*|detox|shak\w*|sweat\w*)\b|\b(quit|stop|cold turkey|cut (back|down)|detox)\b.*\b(alcohol|drinking(?! (coffee|soda|tea|energy|pop|juice|water|milk))|booze|benzo\w*|xanax|valium|klonopin|ativan|opioids?|opiates?|heroin|fentanyl|oxy\w*|methadone)\b|\b(delirium tremens|the shakes|dts)\b/i],
  ['eating', /\b(anorexi\w*|bulimi\w*|binge?(ing)? and purg\w*|purg(e|ing)|make myself (throw up|sick|vomit)|starv(e|ing) myself|not eating (for|at all)|eating disorder|laxatives? to lose)\b/i],
];

/** The most urgent safety topic in a message, if any. */
export function safetyCheck(text: string): SafetyTopic | null {
  for (const [topic, re] of PATTERNS) if (re.test(text)) return topic;
  return null;
}

export const SAFETY_TEXT: Record<SafetyTopic, { title: string; body: string }> = {
  selfHarm: {
    title: "You don't have to handle this alone",
    body: "If you might act on thoughts of hurting yourself, call your local emergency number now. In the US you can call or text 988 any time. Elsewhere, findahelpline.com lists free, confidential lines in your country. Talking to someone you trust helps too.",
  },
  emergency: {
    title: 'This could be urgent',
    body: 'Chest pain, trouble breathing, fainting, sudden numbness or not being safe are emergencies. Call your local emergency number now (911 in the US, 999 in the UK, 112 in most of Europe). Momentum can’t help with this, but they can.',
  },
  withdrawal: {
    title: 'Talk to a doctor before you stop',
    body: 'Stopping alcohol, benzodiazepines (like Xanax or Valium) or opioids suddenly after regular heavy use can cause dangerous withdrawal, including seizures. A doctor or a local support service can help you cut down safely. If you have shakes, confusion or a seizure, get emergency help.',
  },
  eating: {
    title: 'Support for eating and body image',
    body: 'What you describe can be part of an eating disorder, which is common and treatable. Please talk to a doctor or someone you trust. findahelpline.com lists eating disorder support in your country. Momentum won’t give calorie or weight goals here.',
  },
};

export const HELPLINES_URL = 'https://findahelpline.com';

/** Safe ranges for habits measured by the watch. AI-made plans are clamped into these. */
export function safeWatchTarget(metric: string, comparator: 'atLeast' | 'atMost', target: number, age: AgeGroup): number | null {
  const minor = age !== 'adult';
  const clamp = (lo: number, hi: number) => Math.min(hi, Math.max(lo, target));
  switch (metric) {
    case 'sleepHours':
      // "Sleep at least X": never ask for less than healthy, or an impossible amount.
      return comparator === 'atLeast' ? clamp(minor ? 8 : 7, minor ? 10 : 9) : null;
    case 'steps':
      return comparator === 'atLeast' ? clamp(1000, minor ? 12000 : 15000) : null;
    case 'workoutMinutes':
      return comparator === 'atLeast' ? clamp(5, minor ? 60 : 90) : null;
    default:
      // Resting heart rate and HRV are signals, not things to push on. No targets.
      return null;
  }
}

/** Makes any plan (from templates, the AI coach or a check-in) stay inside safe limits. */
export function sanitizePlan(plan: Plan, age: AgeGroup): Plan {
  const habits: Habit[] = [];
  for (const h of plan.habits) {
    if (h.source.kind !== 'watch') {
      habits.push(h);
      continue;
    }
    const target = safeWatchTarget(h.source.metric, h.source.comparator, h.source.target, age);
    if (target === null) continue; // drop unsafe or meaningless targets
    habits.push(target === h.source.target ? h : { ...h, name: h.name.replace(String(h.source.target), String(target)), source: { ...h.source, target } });
  }
  const changed = habits.length !== plan.habits.length || habits.some((h, i) => h !== plan.habits[i]);
  return changed ? { ...plan, habits } : plan;
}
