import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { CoachMessage, GoalPath } from '../core/types';
import { TEMPLATES, guessPath, planFromTemplate } from '../core/templates';
import { buildPlan, onboardTurn, CoachError } from '../coach/coachClient';
import { recentHealth, useMomentum } from '../state';
import { Bubble } from './Coach';
import { Button, Card, Chip, Input, Label, Title, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

const PATHS: GoalPath[] = ['focus', 'fitness', 'quit', 'custom'];

export default function Onboarding() {
  const t = useTheme();
  const { health, today, setPlan, addChat, connectWatch } = useMomentum();
  const [step, setStep] = useState<'goal' | 'talk'>('goal');
  const [path, setPath] = useState<GoalPath | null>(null);
  const [goal, setGoal] = useState('');
  const [talk, setTalk] = useState<CoachMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const chosenPath = path ?? guessPath(goal);

  async function ask(transcript: CoachMessage[]) {
    setBusy(true);
    setError(null);
    try {
      const r = await onboardTurn(goal, chosenPath, transcript, recentHealth(health));
      setTalk([...transcript, { role: 'assistant', content: r.message }]);
      if (r.done) setDone(true);
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  async function start() {
    if (!goal.trim() && !path) return;
    if (!goal.trim()) setGoal(TEMPLATES[chosenPath].title);
    setStep('talk');
    setBusy(true);
    await connectWatch(); // asks for Apple Health / Health Connect access
    setBusy(false);
    ask([]);
  }

  function send() {
    const v = answer.trim();
    if (!v || busy) return;
    setAnswer('');
    const next: CoachMessage[] = [...talk, { role: 'user', content: v }];
    setTalk(next);
    ask(next);
  }

  async function build() {
    setBusy(true);
    setError(null);
    const base = planFromTemplate(chosenPath, goal.trim(), '', today);
    try {
      const draft = await buildPlan(goal.trim(), chosenPath, talk, recentHealth(health), base);
      setPlan(draft ? { ...base, ...draft, path: chosenPath, createdAt: today } : base);
    } catch {
      // Coach unreachable: start with the template, the coach can adjust later.
      setPlan(base);
    }
    addChat({ role: 'assistant', content: 'Your plan is ready. Tell me any time something is not working and I will change it.' });
    setBusy(false);
  }

  if (step === 'goal') {
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Txt size={22} weight="700">Momentum</Txt>
        <Title>What do you want to get better at?</Title>
        <Txt muted>Pick a path or say it in your own words. Your coach asks a few questions, then builds your app around you.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PATHS.map((p) => (
            <Chip key={p} title={TEMPLATES[p].title} selected={path === p} onPress={() => setPath(path === p ? null : p)} />
          ))}
        </View>
        {path && <Txt muted size={13}>{TEMPLATES[path].blurb} For example: {TEMPLATES[path].examples.join(', ')}.</Txt>}
        <Label>Your goal</Label>
        <Input
          value={goal}
          onChangeText={setGoal}
          multiline
          placeholder="e.g. I want to stop staying up so late and actually focus when I study"
          style={{ minHeight: 88, textAlignVertical: 'top' }}
          accessibilityLabel="Your goal"
        />
        <Button title="Start with my coach" onPress={start} disabled={!goal.trim() && !path} />
        <Card>
          <Txt muted size={13}>No watch needed. Momentum uses your phone's step count and a 10-second morning check-in. Got a watch? When you start, allow {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'} and it also reads your sleep, workouts and heart data (Apple Watch, Galaxy, Pixel, Fitbit, Garmin and more). Only daily totals are used.</Txt>
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
        <Txt weight="600">Getting to know you</Txt>
        <Txt muted size={13} numberOfLines={1}>{goal}</Txt>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {talk.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && <ActivityIndicator color={t.accent} style={{ alignSelf: 'flex-start' }} />}
        {error && <Bubble m={{ role: 'note', content: error }} />}
      </ScrollView>
      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
        {!done && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input value={answer} onChangeText={setAnswer} onSubmitEditing={send} placeholder="Type your answer" style={{ flex: 1 }} returnKeyType="send" accessibilityLabel="Your answer" />
            <Button title="Send" onPress={send} disabled={busy || !answer.trim()} />
          </View>
        )}
        {(done || talk.filter((m) => m.role === 'assistant').length >= 2) && (
          <Button title={busy ? 'Building your app...' : 'Build my app'} onPress={build} disabled={busy} kind={done ? 'solid' : 'ghost'} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
