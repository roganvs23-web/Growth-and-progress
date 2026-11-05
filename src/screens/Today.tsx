import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { DayLog } from '../core/types';
import { completion, computeStreak, dayThresholdFor, daysAway, easyDayReason, freshStart, readiness, LOW_READINESS } from '../core/progress';
import { fromDayKey } from '../core/dates';
import { useMomentum } from '../state';
import { Button, Card, Label, Txt } from '../ui/kit';
import { MorningCheckInCard } from './todayParts';
import { AddGoalCard, CrunchCard, GoalSections } from './goalsParts';
import { goalsOf } from '../core/goals';
import { DayModeButtons, EasyDayCard, overLimit, SlipUpCard, TravelHintCard, WelcomeBackCard } from './toughDays';
import { useTheme } from '../ui/theme';

const FEEL_WORDS = ['', 'rough', 'meh', 'OK', 'good', 'great'];

export default function Today({ onTalk }: { onTalk: () => void }) {
  const t = useTheme();
  const { state, today, health, updateLog, reset, mode, setPlan, travelHint, dismissTravelHint } = useMomentum();
  const [hideWelcome, setHideWelcome] = useState(false);
  const plan = state.plan!;
  const log = state.logs[today];
  const h = health[today];
  const score = readiness(today, health);
  const streak = computeStreak(plan, state.logs, health, today);
  const { done, total } = completion(plan, log, h, today);
  const resting = !!log?.plannedRest;
  const updateToday = useCallback((f: (l: DayLog) => DayLog) => updateLog(today, f), [updateLog, today]);
  // Measured sleep comes from the watch; if it's missing we ask in the morning check-in.
  const measuredSleep = h?.sleepHours !== undefined && log?.morning?.sleepHours === undefined;
  const showCheckIn = !log?.morning;
  const easy = easyDayReason(today, health, state.logs);
  const needed = Math.ceil(dayThresholdFor(plan, !!easy, today) * total - 1e-9);
  const away = daysAway(state.logs, today);
  const showWelcome = !hideWelcome && away !== null && away >= 4 && plan.restartedAt !== today;
  const noWatchToday = mode === 'watch' && h?.restingHR === undefined && h?.hrvMs === undefined && (log?.morning?.sleepHours !== undefined || h?.sleepHours === undefined);
  const slips = overLimit(plan, log);
  const toggleMode = (k: 'sick' | 'travel') => updateToday((l) => ({ ...l, [k]: !l[k] }));

  let vitals: string | null = null;
  if (h && mode === 'watch') vitals = `Slept ${h.sleepHours ?? '?'}h · HR ${h.restingHR ?? '?'} · HRV ${h.hrvMs ?? '?'}ms`;
  else if (h && (h.sleepHours !== undefined || h.feel !== undefined)) vitals = [h.sleepHours !== undefined ? `Slept about ${h.sleepHours}h` : null, h.feel ? `feeling ${FEEL_WORDS[h.feel]}` : null].filter(Boolean).join(' · ');
  const sourceLine = mode === 'watch' ? 'From your watch' : mode === 'sample' ? 'Sample data (development build)' : 'From your check-in and phone';

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
          <Txt weight="600" style={{ color: t.heroInk }}>{score === undefined ? 'Do your morning check-in' : score < LOW_READINESS ? 'Take it easy today' : score < 70 ? 'Steady day' : 'Ready to push'}</Txt>
          {vitals && <Txt size={13} style={{ color: t.heroMuted }}>{vitals}</Txt>}
          <Txt size={12} style={{ color: t.heroMuted }}>{sourceLine}</Txt>
        </View>
      </Card>

      {showWelcome && (
        <WelcomeBackCard
          days={away!}
          best={streak.best}
          onFresh={() => setPlan(freshStart(plan, state.logs, health, today))}
          onDismiss={() => setHideWelcome(true)}
        />
      )}

      {travelHint && !log?.travel && (
        <TravelHintCard onYes={() => { updateToday((l) => ({ ...l, travel: true })); dismissTravelHint(); }} onNo={dismissTravelHint} />
      )}

      {noWatchToday && (
        <Card>
          <Txt size={14}>No watch data yet today. Forgot it or battery died? No problem: your check-in and taps count instead.</Txt>
        </Card>
      )}

      {showCheckIn && (
        <MorningCheckInCard
          askSleep={!measuredSleep}
          onDone={(sleepHours, feel) => updateToday((l) => ({ ...l, morning: { sleepHours, feel } }))}
        />
      )}

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

      <DayModeButtons log={log} onToggle={toggleMode} />
      {easy && <EasyDayCard reason={easy} needed={needed} total={total} />}

      <View style={{ gap: 4 }}>
        <Label>{goalsOf(plan).length > 1 ? 'Your goals' : 'Your goal'}</Label>
        {goalsOf(plan).map((g) => <Txt key={g.id} size={17} weight="600">{g.title}</Txt>)}
        {!!plan.why && goalsOf(plan).length === 1 && <Txt muted size={13}>{plan.why}</Txt>}
      </View>

      <CrunchCard plan={plan} today={today} setPlan={setPlan} />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt size={20} weight="700">Today</Txt>
          <Txt muted size={13}>{resting || log?.sick ? 'Rest day, streak is safe' : `${done} of ${total} done${easy ? ` · ${needed} needed` : ''}`}</Txt>
        </View>
        <GoalSections plan={plan} day={today} log={log} health={h} update={updateToday} setPlan={setPlan} />
        <AddGoalCard plan={plan} setPlan={setPlan} />
      </View>

      {slips.map((hb) => (
        <SlipUpCard
          key={hb.id}
          habit={hb}
          log={log}
          recoveryLeft={streak.recoveryLeft}
          onToggle={(x) => updateToday((l) => {
            const cur = new Set(l.slips ?? []);
            if (cur.has(x)) cur.delete(x); else cur.add(x);
            return { ...l, slips: [...cur] };
          })}
        />
      ))}

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
}
