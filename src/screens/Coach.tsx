import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { CoachMessage } from '../core/types';
import { chat, CoachError } from '../coach/coachClient';
import { recentHealth, useMomentum } from '../state';
import { Button, Chip, Input, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { safetyCheck, type SafetyTopic } from '../core/safety';
import SafetyCard from './SafetyCard';

const STARTERS = ['This plan feels like too much', 'Add a habit for drinking water', 'Why is my readiness what it is?', 'Make it harder'];

export function Bubble({ m }: { m: CoachMessage }) {
  const t = useTheme();
  if (m.role === 'note') {
    return (
      <View style={{ alignSelf: 'center', backgroundColor: t.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '92%' }}>
        <Txt size={12} style={{ color: t.accentText }}>{m.content}</Txt>
      </View>
    );
  }
  const mine = m.role === 'user';
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '84%',
        backgroundColor: mine ? t.accent : t.card,
        borderColor: t.line,
        borderWidth: mine ? 0 : 1,
        borderRadius: 16,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Txt style={{ color: mine ? t.accentInk : t.ink }}>{m.content}</Txt>
    </View>
  );
}

export default function Coach() {
  const t = useTheme();
  const { state, health, addChat, applyChange } = useMomentum();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [safety, setSafety] = useState<SafetyTopic | null>(null);
  const scroll = useRef<ScrollView>(null);

  async function send(v = text.trim()) {
    if (!v || busy || !state.plan) return;
    setText('');
    const userMsg: CoachMessage = { role: 'user', content: v };
    addChat(userMsg);
    const topic = safetyCheck(v);
    if (topic) setSafety(topic); // shown right away, before and whatever the coach replies
    setBusy(true);
    try {
      const r = await chat(state.plan, recentHealth(health), [...state.chat, userMsg]);
      const out: CoachMessage[] = [{ role: 'assistant', content: r.reply }];
      if (r.changes && (r.changes.addHabits?.length || r.changes.removeHabitIds?.length || r.changes.dayThreshold)) {
        applyChange(r.changes);
        out.push({ role: 'note', content: `Updated your app: ${r.changes.summary}` });
      }
      addChat(...out);
    } catch (e) {
      addChat({ role: 'note', content: e instanceof CoachError ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: 18, paddingBottom: 12, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
        <Txt size={20} weight="700">Coach</Txt>
        <Txt muted size={13}>Ask anything, or tell it to change your app</Txt>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {state.chat.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && <ActivityIndicator color={t.accent} style={{ alignSelf: 'flex-start' }} />}
        {safety && <SafetyCard topic={safety} onClose={() => setSafety(null)} />}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
        {STARTERS.map((s) => <Chip key={s} title={s} onPress={() => send(s)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
        <Input value={text} onChangeText={setText} onSubmitEditing={() => send()} placeholder="e.g. swap the step goal for meditation" style={{ flex: 1 }} returnKeyType="send" accessibilityLabel="Message your coach" />
        <Button title="Send" onPress={() => send()} disabled={busy || !text.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}
