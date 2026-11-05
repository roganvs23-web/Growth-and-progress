import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { computeStreak } from '../core/progress';
import { weekStats } from '../core/checkin';
import { fromDayKey, weekStart } from '../core/dates';
import { weeklyCheckIn } from '../coach/coachClient';
import { useMomentum } from '../state';
import { Button, Card, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';
import BuddyCard from './BuddyCard';

export default function Progress() {
  const t = useTheme();
  const { state, today, health, addCheckIn, applyChange, addChat } = useMomentum();
  const plan = state.plan!;
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const streak = computeStreak(plan, state.logs, health, today);
  const stats = weekStats(plan, state.logs, health, today);
  const last14 = streak.days.slice(-14);
  const checkIn = state.checkIns.find((c) => c.weekOf === weekStart(today));
  const color = { hit: t.accent, rest: t.ring, miss: t.miss, pending: t.line } as const;

  async function runCheckIn() {
    setBusy(true);
    addCheckIn(await weeklyCheckIn(plan, stats));
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, gap: 16 }}>
      <Txt size={20} weight="700">Progress</Txt>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Current streak" value={`${streak.current}`} />
        <Stat label="Best streak" value={`${streak.best}`} />
        <Stat label="Recovery days" value={`${streak.recoveryLeft}`} />
      </View>

      <Card>
        <Txt weight="600">Last 14 days</Txt>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }} accessibilityLabel={`${last14.filter((d) => d.outcome === 'hit').length} good days in the last ${last14.length}`}>
          {last14.map((d) => (
            <View key={d.day} style={{ alignItems: 'center', gap: 4, width: 20 }}>
              <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: color[d.outcome], opacity: d.outcome === 'rest' ? 0.6 : 1 }} />
              <Txt muted size={10}>{fromDayKey(d.day).toLocaleDateString(undefined, { weekday: 'narrow' })}</Txt>
            </View>
          ))}
        </View>
        <Txt muted size={12}>Teal: good day · Light: rest or recovery day · Red: streak broke</Txt>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Avg sleep" value={stats.avgSleep !== undefined ? `${stats.avgSleep.toFixed(1)}h` : '--'} />
        <Stat label="Avg steps" value={stats.avgSteps !== undefined ? Math.round(stats.avgSteps).toLocaleString() : '--'} />
      </View>

      <Card>
        <Txt weight="600">Habits this week</Txt>
        {stats.habits.map((h) => (
          <View key={h.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt size={14}>{h.name}</Txt>
              <Txt muted size={13}>{h.doneDays}/{stats.days}</Txt>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.line }}>
              <View style={{ height: 6, borderRadius: 3, width: `${Math.round(h.rate * 100)}%`, backgroundColor: t.accent }} />
            </View>
          </View>
        ))}
      </Card>

      <BuddyCard />

      <Card>
        <Label>Weekly check-in</Label>
        {!checkIn && <Txt muted size={13}>Your coach reads your week and your watch data, then tells you what it noticed and suggests one or two changes.</Txt>}
        {checkIn?.bullets.map((b, i) => <Txt key={i}>• {b}</Txt>)}
        {checkIn?.suggestions
          .filter((s) => !dismissed.has(s.summary))
          .map((s) => (
            <Card key={s.summary} tone="warm">
              <Txt weight="500">{s.summary}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Apply" onPress={() => { applyChange(s); addChat({ role: 'note', content: `Weekly check-in: ${s.summary}` }); setDismissed(new Set(dismissed).add(s.summary)); }} style={{ minHeight: 40 }} />
                <Button kind="ghost" title="Skip" onPress={() => setDismissed(new Set(dismissed).add(s.summary))} style={{ minHeight: 40 }} />
              </View>
            </Card>
          ))}
        {busy ? <ActivityIndicator color={t.accent} /> : <Button title={checkIn ? 'Refresh check-in' : 'Get my weekly check-in'} onPress={runCheckIn} style={{ alignSelf: 'flex-start' }} />}
      </Card>
    </ScrollView>
  );

  function Stat({ label, value }: { label: string; value: string }) {
    return (
      <Card style={{ flex: 1 }}>
        <Txt muted size={12}>{label}</Txt>
        <Txt size={22} weight="700">{value}</Txt>
      </Card>
    );
  }
}
