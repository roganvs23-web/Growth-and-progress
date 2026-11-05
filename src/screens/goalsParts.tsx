// Today screen pieces for several goals and for exam or deadline mode.
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { DailyHealth, DayKey, DayLog, GoalPath, Plan } from '../core/types';
import { activeHabits, crunchOn } from '../core/progress';
import { addGoal, endCrunch, goalsOf, habitsForGoal, MAX_GOALS, removeGoal, startCrunch } from '../core/goals';
import { daysBetween } from '../core/dates';
import { TEMPLATES } from '../core/templates';
import { Button, Card, Chip, Input, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { HabitRow } from './todayParts';

type Update = (f: (l: DayLog) => DayLog) => void;

/** Habits grouped by goal; in exam mode the others are shown as optional. */
export function GoalSections({ plan, day, log, health, update, setPlan }: { plan: Plan; day: DayKey; log: DayLog | undefined; health: DailyHealth | undefined; update: Update; setPlan: (p: Plan) => void }) {
  const goals = goalsOf(plan);
  const counting = new Set(activeHabits(plan, day).map((h) => h.id));
  const crunch = crunchOn(plan, day);
  const optional = plan.habits.filter((h) => !counting.has(h.id));

  if (goals.length === 1 && !crunch) {
    return <>{plan.habits.map((h) => <HabitRow key={h.id} habit={h} log={log} health={health} update={update} />)}</>;
  }
  return (
    <>
      {goals.map((g) => {
        const hs = habitsForGoal(plan, g.id).filter((h) => counting.has(h.id));
        if (!hs.length) return null;
        return (
          <View key={g.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{g.title}</Label>
              {g.id !== 'main' && (
                <Txt
                  muted
                  size={12}
                  accessibilityRole="button"
                  onPress={() => Alert.alert('Remove this goal?', `"${g.title}" and its habits will be removed. History stays.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => setPlan(removeGoal(plan, g.id)) }])}
                >
                  Remove
                </Txt>
              )}
            </View>
            {hs.map((h) => <HabitRow key={h.id} habit={h} log={log} health={health} update={update} />)}
          </View>
        );
      })}
      {optional.length > 0 && (
        <View style={{ gap: 8, opacity: 0.75 }}>
          <Label>Optional until {plan.crunch?.label ?? 'the deadline'} is done</Label>
          {optional.map((h) => <HabitRow key={h.id} habit={h} log={log} health={health} update={update} />)}
        </View>
      )}
    </>
  );
}

const PATHS: GoalPath[] = ['focus', 'fitness', 'quit', 'custom'];

export function AddGoalCard({ plan, setPlan }: { plan: Plan; setPlan: (p: Plan) => void }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<GoalPath | null>(null);
  const [title, setTitle] = useState('');
  if (goalsOf(plan).length >= MAX_GOALS) return null;
  if (!open) return <Button kind="ghost" title="Add another goal" onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start', minHeight: 40 }} />;
  return (
    <Card>
      <Label>Add another goal</Label>
      <Txt muted size={13}>Up to {MAX_GOALS} goals. Your coach keeps the total small, and shared habits like sleep count for both.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PATHS.map((p) => <Chip key={p} title={TEMPLATES[p].title} selected={path === p} onPress={() => setPath(p)} />)}
      </View>
      <Input value={title} onChangeText={setTitle} placeholder="In your words, e.g. Quit vaping by summer" accessibilityLabel="New goal" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Add goal" disabled={!path} onPress={() => { setPlan(addGoal(plan, path!, title)); setOpen(false); setPath(null); setTitle(''); }} style={{ minHeight: 40 }} />
        <Button kind="ghost" title="Cancel" onPress={() => setOpen(false)} style={{ minHeight: 40 }} />
      </View>
    </Card>
  );
}

const LENGTHS = [{ label: '3 days', days: 3 }, { label: '1 week', days: 7 }, { label: '2 weeks', days: 14 }];

export function CrunchCard({ plan, today, setPlan }: { plan: Plan; today: DayKey; setPlan: (p: Plan) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(7);
  const goals = goalsOf(plan);
  const [goalId, setGoalId] = useState(goals.find((g) => g.path === 'focus')?.id ?? 'main');

  if (crunchOn(plan, today)) {
    const c = plan.crunch!;
    const left = daysBetween(today, c.until).length;
    return (
      <Card tone="warm">
        <Label color={t.warmText}>{c.label} mode</Label>
        <Txt>{left === 1 ? 'Last day. You have prepared for this.' : `${left} days to go.`} Only "{goals.find((g) => g.id === c.goalId)?.title}" and sleep count toward your streak; everything else is optional.</Txt>
        <Button kind="ghost" title="End early" onPress={() => setPlan(endCrunch(plan))} style={{ alignSelf: 'flex-start', minHeight: 40 }} />
      </Card>
    );
  }
  if (!open) return <Button kind="ghost" title="Exam or deadline coming up?" onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start', minHeight: 40 }} />;
  return (
    <Card>
      <Label>Exam or deadline mode</Label>
      <Txt muted size={13}>One goal takes priority. Other habits ease off and won't break your streak. Sleep still counts.</Txt>
      <Input value={label} onChangeText={setLabel} placeholder="What is it? e.g. Finals" accessibilityLabel="Exam or deadline name" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LENGTHS.map((l) => <Chip key={l.days} title={l.label} selected={days === l.days} onPress={() => setDays(l.days)} />)}
      </View>
      {goals.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {goals.map((g) => <Chip key={g.id} title={g.title} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Start" onPress={() => { setPlan(startCrunch(plan, label, days, today, goalId)); setOpen(false); }} style={{ minHeight: 40 }} />
        <Button kind="ghost" title="Cancel" onPress={() => setOpen(false)} style={{ minHeight: 40 }} />
      </View>
    </Card>
  );
}
