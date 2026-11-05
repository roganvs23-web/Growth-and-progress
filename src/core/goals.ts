// More than one goal at once (for example studying and quitting vaping), and
// exam or deadline mode, where one goal takes priority for a while.
import type { Crunch, DayKey, Goal, GoalPath, Habit, Plan } from './types';
import { TEMPLATES } from './templates';
import { addDays } from './dates';

export const MAX_GOALS = 3;
export const MAX_HABITS = 8;

export function goalsOf(plan: Plan): Goal[] {
  return [{ id: 'main', path: plan.path, title: plan.goal, why: plan.why }, ...(plan.goals ?? [])];
}

export function habitsForGoal(plan: Plan, goalId: string): Habit[] {
  return plan.habits.filter((h) => (h.goalId ?? 'main') === goalId);
}

/**
 * Adds a goal with its template habits. Watch habits the plan already has
 * (same metric) are shared, not duplicated, so "sleep 7+ hours" serves both.
 * Keeps the whole plan to MAX_HABITS by trimming the new goal's extras.
 */
export function addGoal(plan: Plan, path: GoalPath, title: string, why = ''): Plan {
  const goals = plan.goals ?? [];
  if (goals.length + 1 >= MAX_GOALS) return plan;
  let n = 2;
  while (goals.some((g) => g.id === `g${n}`)) n++;
  const id = `g${n}`;
  const haveMetrics = new Set(plan.habits.flatMap((h) => (h.source.kind === 'watch' ? [h.source.metric] : [])));
  const room = Math.max(1, MAX_HABITS - plan.habits.length);
  const fresh = TEMPLATES[path].habits
    .filter((h) => !(h.source.kind === 'watch' && haveMetrics.has(h.source.metric)))
    .slice(0, room)
    .map((h) => ({ ...h, id: `${id}-${h.id}`, goalId: id, source: { ...h.source } }));
  return {
    ...plan,
    goals: [...goals, { id, path, title: title.trim() || TEMPLATES[path].title, why }],
    habits: [...plan.habits, ...fresh],
  };
}

export function removeGoal(plan: Plan, goalId: string): Plan {
  if (goalId === 'main') return plan;
  return {
    ...plan,
    goals: (plan.goals ?? []).filter((g) => g.id !== goalId),
    habits: plan.habits.filter((h) => h.goalId !== goalId),
    crunch: plan.crunch?.goalId === goalId ? undefined : plan.crunch,
  };
}

/** The goal exam mode should favour: a study/focus goal if there is one. */
export function defaultCrunchGoal(plan: Plan): string {
  return goalsOf(plan).find((g) => g.path === 'focus')?.id ?? 'main';
}

export function startCrunch(plan: Plan, label: string, days: number, today: DayKey, goalId = defaultCrunchGoal(plan)): Plan {
  const crunch: Crunch = { label: label.trim() || 'Exam', until: addDays(today, Math.max(1, days) - 1), goalId, startedAt: today };
  return { ...plan, crunch };
}

export function endCrunch(plan: Plan): Plan {
  return { ...plan, crunch: undefined };
}
