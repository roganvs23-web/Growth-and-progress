// Pieces of the Today screen: the morning check-in, habit rows, and the
// focus timer. These make Momentum work fully without a watch.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { DailyHealth, DayLog, Habit } from '../core/types';
import { isHabitDone } from '../core/progress';
import { Button, Card, Chip, Label, Tag, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

const METRIC_UNITS: Record<string, string> = { sleepHours: 'h', steps: ' steps', workoutMinutes: ' min', restingHR: ' bpm', hrvMs: ' ms' };
const FEELINGS = ['Rough', 'Meh', 'OK', 'Good', 'Great'];
const SLEEP_CHOICES = [5, 6, 7, 8, 9];
export const FOCUS_MINUTES = 25;

type Update = (f: (l: DayLog) => DayLog) => void;

/** Shown each morning until answered. Asks about sleep only when the watch did not measure it. */
export function MorningCheckInCard({ askSleep, onDone }: { askSleep: boolean; onDone: (sleepHours: number | undefined, feel: number) => void }) {
  const [sleep, setSleep] = useState<number | undefined>();
  const [feel, setFeel] = useState<number | undefined>();
  const ready = feel !== undefined && (!askSleep || sleep !== undefined);
  return (
    <Card>
      <Label>Morning check-in</Label>
      {askSleep && (
        <>
          <Txt weight="600">How long did you sleep?</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SLEEP_CHOICES.map((n) => (
              <Chip key={n} title={n === 5 ? '5h or less' : n === 9 ? '9h+' : `${n}h`} selected={sleep === n} onPress={() => setSleep(n)} />
            ))}
          </View>
        </>
      )}
      <Txt weight="600">How do you feel?</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FEELINGS.map((f, i) => (
          <Chip key={f} title={f} selected={feel === i + 1} onPress={() => setFeel(i + 1)} />
        ))}
      </View>
      <Button title="Save" onPress={() => ready && onDone(askSleep ? sleep : undefined, feel!)} disabled={!ready} style={{ alignSelf: 'flex-start', minHeight: 44 }} />
    </Card>
  );
}

/** Counter habits counted in focus blocks get a timer. */
export function isFocusHabit(h: Habit) {
  return h.source.kind === 'counter' && (/block|session|pomodoro/i.test(h.source.unit) || /focus|deep work|study/i.test(h.name));
}

export function HabitRow({ habit, log, health, update }: { habit: Habit; log: DayLog | undefined; health: DailyHealth | undefined; update: Update }) {
  const t = useTheme();
  const ok = isHabitDone(habit, log, health);
  const s = habit.source;
  let right: React.ReactNode = null;
  let onPress: (() => void) | undefined;
  let detail = habit.detail;
  const toggleTap = () => update((l) => ({ ...l, taps: { ...l.taps, [habit.id]: !l.taps[habit.id] } }));

  if (s.kind === 'tap') {
    onPress = toggleTap;
    right = <Tag>One tap</Tag>;
  } else if (s.kind === 'counter') {
    const v = log?.counts[habit.id];
    const set = (n: number) => update((l) => ({ ...l, counts: { ...l.counts, [habit.id]: Math.max(0, n) } }));
    right = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Step label="−" a11y={`Less ${s.unit}`} onPress={() => set((v ?? 0) - 1)} />
        <Txt weight="600" style={{ minWidth: 40, textAlign: 'center' }}>{v ?? 0}/{s.target}</Txt>
        <Step label="+" a11y={`More ${s.unit}`} onPress={() => set((v ?? 0) + 1)} />
      </View>
    );
  } else {
    const v = health?.[s.metric];
    if (v === undefined) {
      // No watch reading (no watch, or it missed today): tick it by hand.
      onPress = toggleTap;
      detail = 'No reading yet, tap when done';
      right = <Tag>One tap</Tag>;
    } else {
      right = <Tag>{`${v.toLocaleString()}${METRIC_UNITS[s.metric]}`}</Tag>;
    }
  }

  return (
    <View style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'checkbox' : undefined}
        accessibilityState={{ checked: ok }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: ok ? t.accent : t.muted, backgroundColor: ok ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {ok && <Txt weight="700" style={{ color: t.accentInk }}>✓</Txt>}
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="500">{habit.name}</Txt>
          <Txt muted size={13}>{detail}</Txt>
        </View>
        {right}
      </Pressable>
      {isFocusHabit(habit) && <FocusTimer habit={habit} log={log} update={update} />}
    </View>
  );
}

function Step({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={a11y} accessibilityRole="button" style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={18} weight="600">{label}</Txt>
    </Pressable>
  );
}

/**
 * A focus block. The start time is saved, so the timer survives the app
 * being closed; a local notification fires when the block ends, and the
 * block is counted the next time the app is open.
 */
function FocusTimer({ habit, log, update }: { habit: Habit; log: DayLog | undefined; update: Update }) {
  const t = useTheme();
  const timer = log?.timer?.habitId === habit.id ? log.timer : undefined;
  const [now, setNow] = useState(Date.now());

  const endsAt = timer ? new Date(timer.startedAt).getTime() + timer.minutes * 60_000 : 0;
  const left = Math.max(0, endsAt - now);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (timer && left === 0) {
      update((l) => ({ ...l, timer: undefined, counts: { ...l.counts, [habit.id]: (l.counts[habit.id] ?? 0) + 1 } }));
    }
  }, [timer, left, habit.id, update]);

  async function start() {
    const startedAt = new Date().toISOString();
    setNow(Date.now());
    update((l) => ({ ...l, timer: { habitId: habit.id, startedAt, minutes: FOCUS_MINUTES } }));
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.granted) {
        await Notifications.scheduleNotificationAsync({
          identifier: `focus-${habit.id}`,
          content: { title: 'Focus block done', body: `Nice work. That's one more for "${habit.name}".` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: FOCUS_MINUTES * 60 },
        });
      }
    } catch {
      // Notifications are a bonus; the timer works without them.
    }
  }

  function stop() {
    update((l) => ({ ...l, timer: undefined }));
    Notifications.cancelScheduledNotificationAsync(`focus-${habit.id}`).catch(() => {});
  }

  if (!timer) return <Button kind="ghost" title={`Start a ${FOCUS_MINUTES} min focus block`} onPress={start} style={{ minHeight: 40 }} />;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Txt size={22} weight="700" style={{ color: t.accentText, fontVariant: ['tabular-nums'] }} accessibilityLabel={`${mm} minutes left`}>
        {mm}:{String(ss).padStart(2, '0')}
      </Txt>
      <Txt muted size={13} style={{ flex: 1 }}>Phone down, you've got this.</Txt>
      <Button kind="ghost" title="Stop" onPress={stop} style={{ minHeight: 40 }} />
    </View>
  );
}
