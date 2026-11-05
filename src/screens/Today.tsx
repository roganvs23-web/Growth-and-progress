import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import type { Habit } from '../core/types';
import { completion, computeStreak, isHabitDone, readiness, LOW_READINESS } from '../core/progress';
import { fromDayKey } from '../core/dates';
import { useMomentum } from '../state';
import { Button, Card, Label, Tag, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

const METRIC_UNITS: Record<string, string> = { sleepHours: 'h', steps: ' steps', workoutMinutes: ' min', restingHR: ' bpm', hrvMs: ' ms' };

export default function Today({ onTalk }: { onTalk: () => void }) {
  const t = useTheme();
  const { state, today, health, updateLog, reset, healthSourceName } = useMomentum();
  const plan = state.plan!;
  const log = state.logs[today];
  const h = health[today];
  const score = readiness(today, health);
  const streak = computeStreak(plan, state.logs, health, today);
  const { done, total } = completion(plan, log, h);
  const resting = !!log?.plannedRest;

  function toggleRest() {
    if (resting) return updateLog(today, (l) => ({ ...l, plannedRest: false }));
    if (streak.recoveryLeft <= 0) {
      Alert.alert('No recovery days left', `Hit ${streak.hitsToNextRecovery} more days to earn one.`);
      return;
    }
    updateLog(today, (l) => ({ ...l, plannedRest: true }));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Txt muted size={13}>{fromDayKey(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</Txt>
          <Txt size={26} weight="700">Your day</Txt>
        </View>
      </View>

      <Card tone="hero" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 8, borderColor: score !== undefined && score < LOW_READINESS ? t.warmText : t.ring, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={26} weight="700" style={{ color: t.heroInk }} accessibilityLabel={`Readiness ${score ?? 'unknown'} out of 100`}>{score ?? '--'}</Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Label color={t.heroMuted}>Readiness</Label>
          <Txt weight="600" style={{ color: t.heroInk }}>{score === undefined ? 'No watch data yet' : score < LOW_READINESS ? 'Take it easy today' : score < 70 ? 'Steady day' : 'Ready to push'}</Txt>
          {h && <Txt size={13} style={{ color: t.heroMuted }}>Slept {h.sleepHours ?? '?'}h · HR {h.restingHR ?? '?'} · HRV {h.hrvMs ?? '?'}ms</Txt>}
          <Txt size={12} style={{ color: t.heroMuted }}>From {healthSourceName}</Txt>
        </View>
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt size={24} weight="700">{streak.current} day streak</Txt>
          <Txt muted size={13}>
            {streak.recoveryLeft} recovery day{streak.recoveryLeft === 1 ? '' : 's'} banked
            {streak.hitsToNextRecovery ? ` · next in ${streak.hitsToNextRecovery} good days` : ''}
          </Txt>
        </View>
        <Button kind="ghost" title={resting ? 'Undo rest' : 'Rest today'} onPress={toggleRest} style={{ minHeight: 40 }} />
      </Card>

      <View style={{ gap: 4 }}>
        <Label>Your goal</Label>
        <Txt size={17} weight="600">{plan.goal}</Txt>
        {!!plan.why && <Txt muted size={13}>{plan.why}</Txt>}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt size={20} weight="700">Today</Txt>
          <Txt muted size={13}>{resting ? 'Rest day, streak is safe' : `${done} of ${total} done`}</Txt>
        </View>
        {plan.habits.map((habit) => (
          <HabitRow key={habit.id} habit={habit} />
        ))}
      </View>

      {score !== undefined && score < LOW_READINESS && (
        <Card tone="warm">
          <Label color={t.warmText}>Coach tip</Label>
          <Txt>Your body is asking for recovery. If today slips, it will not break your streak.</Txt>
        </Card>
      )}

      <Card tone="warm">
        <Label color={t.warmText}>Not working?</Label>
        <Txt>Tell your coach and it will reshape your plan.</Txt>
        <Button kind="ghost" title="Talk it through" onPress={onTalk} style={{ alignSelf: 'flex-start', minHeight: 44 }} />
      </Card>

      {plan.nudges.length > 0 && (
        <Card>
          <Label>Nudges</Label>
          {plan.nudges.map((n, i) => <Txt key={i} size={14}>• {n}</Txt>)}
        </Card>
      )}

      <Button
        kind="ghost"
        title="Start over with a new goal"
        onPress={() => Alert.alert('Start over?', 'This clears your plan and history on this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Start over', style: 'destructive', onPress: reset }])}
        style={{ alignSelf: 'center' }}
      />
    </ScrollView>
  );

  function HabitRow({ habit }: { habit: Habit }) {
    const ok = isHabitDone(habit, log, h);
    const s = habit.source;
    let right: React.ReactNode = null;
    let onPress: (() => void) | undefined;

    if (s.kind === 'tap') {
      onPress = () => updateLog(today, (l) => ({ ...l, taps: { ...l.taps, [habit.id]: !l.taps[habit.id] } }));
      right = <Tag>One tap</Tag>;
    } else if (s.kind === 'counter') {
      const v = log?.counts[habit.id];
      const set = (n: number) => updateLog(today, (l) => ({ ...l, counts: { ...l.counts, [habit.id]: Math.max(0, n) } }));
      right = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Step label="−" a11y={`Less ${s.unit}`} onPress={() => set((v ?? 0) - 1)} />
          <Txt weight="600" style={{ minWidth: 40, textAlign: 'center' }}>{v ?? 0}/{s.target}</Txt>
          <Step label="+" a11y={`More ${s.unit}`} onPress={() => set((v ?? 0) + 1)} />
        </View>
      );
    } else {
      const v = h?.[s.metric];
      right = <Tag>{v === undefined ? 'Waiting for watch' : `${v.toLocaleString()}${METRIC_UNITS[s.metric]}`}</Tag>;
    }

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'checkbox' : undefined}
        accessibilityState={{ checked: ok }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 58 }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: ok ? t.accent : t.muted, backgroundColor: ok ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {ok && <Txt weight="700" style={{ color: t.accentInk }}>✓</Txt>}
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="500">{habit.name}</Txt>
          <Txt muted size={13}>{habit.detail}</Txt>
        </View>
        {right}
      </Pressable>
    );
  }

  function Step({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={a11y} accessibilityRole="button" style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={18} weight="600">{label}</Txt>
      </Pressable>
    );
  }
}
