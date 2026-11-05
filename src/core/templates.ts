// Starting plans for each launch path. The AI coach personalises these during
// onboarding; if the coach is unreachable, the template is used as-is so the
// app always works.
import type { GoalPath, Habit, Plan, DayKey } from './types';

export interface GoalTemplate {
  path: GoalPath;
  title: string;
  blurb: string;
  examples: string[];
  habits: Habit[];
  dayThreshold: number;
  nudges: string[];
}

export const TEMPLATES: Record<GoalPath, GoalTemplate> = {
  focus: {
    path: 'focus',
    title: 'Study and focus',
    blurb: 'Better sleep, deep work blocks, less phone.',
    examples: ['Study for my exams', 'Focus at work', 'Stop procrastinating'],
    dayThreshold: 0.67,
    habits: [
      { id: 'sleep7', name: 'Sleep 7+ hours', detail: 'Auto from watch', source: { kind: 'watch', metric: 'sleepHours', comparator: 'atLeast', target: 7 } },
      { id: 'deep', name: 'Deep work blocks', detail: '25 min each, aim for 3', source: { kind: 'counter', unit: 'blocks', comparator: 'atLeast', target: 3 } },
      { id: 'phonebed', name: 'Phone away by 23:00', detail: 'One tap at night', source: { kind: 'tap' } },
    ],
    nudges: ['22:45: Phone on the charger, outside the bedroom', '09:00: Start your first focus block'],
  },
  fitness: {
    path: 'fitness',
    title: 'Get in shape',
    blurb: 'Move daily, train a few times a week, recover well.',
    examples: ['Run a 5k', 'Lose some weight', 'Get stronger'],
    dayThreshold: 0.67,
    habits: [
      { id: 'steps8k', name: '8,000 steps', detail: 'Auto from watch', source: { kind: 'watch', metric: 'steps', comparator: 'atLeast', target: 8000 } },
      { id: 'workout20', name: '20 min workout', detail: 'Auto from watch', source: { kind: 'watch', metric: 'workoutMinutes', comparator: 'atLeast', target: 20 } },
      { id: 'sleep7', name: 'Sleep 7+ hours', detail: 'Auto from watch', source: { kind: 'watch', metric: 'sleepHours', comparator: 'atLeast', target: 7 } },
      { id: 'water', name: 'Drink water', detail: 'Glasses, aim for 6', source: { kind: 'counter', unit: 'glasses', comparator: 'atLeast', target: 6 } },
    ],
    nudges: ['07:30: Quick walk before you start the day', '18:00: Workout window, even 20 minutes counts'],
  },
  quit: {
    path: 'quit',
    title: 'Quit or cut back',
    blurb: 'Track use, handle cravings, watch your body recover.',
    examples: ['Cut back on vaping', 'Drink less alcohol', 'Quit sugar'],
    dayThreshold: 0.5,
    habits: [
      { id: 'uses', name: 'Stay under my limit', detail: 'Count each time, limit 5', source: { kind: 'counter', unit: 'times', comparator: 'atMost', target: 5 } },
      { id: 'craving', name: 'Ride out one craving', detail: 'Tap after a 5 min wait', source: { kind: 'tap' } },
      { id: 'walk', name: '6,000 steps', detail: 'Auto from watch', source: { kind: 'watch', metric: 'steps', comparator: 'atLeast', target: 6000 } },
    ],
    nudges: ['15:00: Craving check, drink water and wait 5 minutes', '21:00: Log today honestly, no judgement'],
  },
  custom: {
    path: 'custom',
    title: 'Something else',
    blurb: 'Tell your coach in your own words.',
    examples: ['Read more books', 'Spend less time on my phone', 'Learn guitar'],
    dayThreshold: 0.5,
    habits: [
      { id: 'main', name: 'Do the main thing', detail: 'One tap', source: { kind: 'tap' } },
      { id: 'sleep7', name: 'Sleep 7+ hours', detail: 'Auto from watch', source: { kind: 'watch', metric: 'sleepHours', comparator: 'atLeast', target: 7 } },
    ],
    nudges: ['20:00: Did you do the main thing today?'],
  },
};

export function planFromTemplate(path: GoalPath, goal: string, why: string, today: DayKey): Plan {
  const t = TEMPLATES[path];
  return {
    path,
    goal: goal || t.title,
    why,
    habits: t.habits.map((h) => ({ ...h, source: { ...h.source } })),
    dayThreshold: t.dayThreshold,
    nudges: [...t.nudges],
    createdAt: today,
  };
}

/** Rough path guess from free text, used before the coach is reachable. */
export function guessPath(text: string): GoalPath {
  const s = text.toLowerCase();
  if (/(quit|stop|cut (back|down)|vap|smok|drink less|alcohol|sugar|porn|gambl)/.test(s)) return 'quit';
  if (/(run|5k|10k|gym|fit|shape|weight|strong|muscle|marathon|exercise|workout)/.test(s)) return 'fitness';
  if (/(study|focus|exam|procrastinat|work|concentrat|productiv|school|homework)/.test(s)) return 'focus';
  return 'custom';
}
