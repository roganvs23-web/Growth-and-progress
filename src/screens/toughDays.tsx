// Cards for the days that don't go to plan: bad nights, sick days, travel,
// coming back after time away, and slip-ups on quit goals. The tone is
// always the same: no shame, keep going.
import React from 'react';
import { View } from 'react-native';
import type { DayLog, Habit, Plan } from '../core/types';
import type { EasyReason } from '../core/progress';
import { Button, Card, Chip, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

const EASY_TEXT: Record<EasyReason, string> = {
  sick: "You're sick, so today is a rest day. Your streak is safe. Rest, drink water, and see a doctor if it gets worse.",
  travel: 'Travel mode is on. Missed days are free and the plan is lighter while you are away.',
  lowReadiness: 'Short night or a tired body. The plan is lighter today.',
  feelingRough: "Rough morning. We've lightened today's plan.",
  highRestingHR: 'Your resting heart rate is higher than normal, which can be stress or the start of a cold. Take it easy.',
};

export function EasyDayCard({ reason, needed, total }: { reason: EasyReason; needed: number; total: number }) {
  const t = useTheme();
  return (
    <Card tone="warm">
      <Label color={t.warmText}>{reason === 'sick' ? 'Sick day' : reason === 'travel' ? 'Travel mode' : 'Easy day'}</Label>
      <Txt>{EASY_TEXT[reason]}</Txt>
      {reason !== 'sick' && <Txt muted size={13}>Do {needed} of {total} habits and today still counts.</Txt>}
    </Card>
  );
}

export function DayModeButtons({ log, onToggle }: { log: DayLog | undefined; onToggle: (k: 'sick' | 'travel') => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Chip title={log?.sick ? "I'm sick (on)" : "I'm sick"} selected={!!log?.sick} onPress={() => onToggle('sick')} />
      <Chip title={log?.travel ? 'Traveling (on)' : 'Traveling'} selected={!!log?.travel} onPress={() => onToggle('travel')} />
    </View>
  );
}

export function TravelHintCard({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <Card>
      <Label>New time zone</Label>
      <Txt>Looks like you're traveling. Turn on travel mode so a long day or jet lag doesn't break your streak?</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Turn on" onPress={onYes} style={{ minHeight: 40 }} />
        <Button kind="ghost" title="No thanks" onPress={onNo} style={{ minHeight: 40 }} />
      </View>
    </Card>
  );
}

export function WelcomeBackCard({ days, best, onFresh, onDismiss }: { days: number; best: number; onFresh: () => void; onDismiss: () => void }) {
  return (
    <Card>
      <Label>Welcome back</Label>
      <Txt size={17} weight="600">Good to see you again.</Txt>
      <Txt>You've been away {days} days. Life happens. Want a fresh start from today? Your history stays, and your best streak{best ? ` (${best} days)` : ''} is kept.</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Fresh start" onPress={onFresh} style={{ minHeight: 40 }} />
        <Button kind="ghost" title="Not now" onPress={onDismiss} style={{ minHeight: 40 }} />
      </View>
    </Card>
  );
}

export const TRIGGERS = ['Stress', 'Bored', 'Friends', 'Tired', 'After a meal', 'Craving', 'Other'];

/** Habits with a limit ("stay under 5") that the user went over today. */
export function overLimit(plan: Plan, log: DayLog | undefined): Habit[] {
  return plan.habits.filter((h) => h.source.kind === 'counter' && h.source.comparator === 'atMost' && (log?.counts[h.id] ?? 0) > h.source.target);
}

export function SlipUpCard({ habit, log, recoveryLeft, onToggle }: { habit: Habit; log: DayLog | undefined; recoveryLeft: number; onToggle: (trigger: string) => void }) {
  const t = useTheme();
  const picked = new Set(log?.slips ?? []);
  return (
    <Card tone="warm">
      <Label color={t.warmText}>Slipped up</Label>
      <Txt>Over the limit on "{habit.name}" today. That's part of quitting, not the end of it. Tomorrow is a clean slate.</Txt>
      <Txt muted size={13}>
        {recoveryLeft > 0 ? 'A recovery day will cover today, so your streak is safe.' : 'Your streak resets, but your progress and best streak stay.'}
      </Txt>
      <Txt weight="600">What set it off? This helps your coach spot patterns.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TRIGGERS.map((x) => <Chip key={x} title={x} selected={picked.has(x)} onPress={() => onToggle(x)} />)}
      </View>
    </Card>
  );
}
