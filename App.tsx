import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MomentumProvider, useMomentum } from './src/state';
import Onboarding from './src/screens/Onboarding';
import Today from './src/screens/Today';
import Coach from './src/screens/Coach';
import Progress from './src/screens/Progress';
import You from './src/screens/You';
import AgeGate from './src/screens/AgeGate';
import { needsParentConsent } from './src/core/profile';
import { Txt } from './src/ui/kit';
import { useTheme } from './src/ui/theme';

type Tab = 'today' | 'coach' | 'progress' | 'you';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'coach', label: 'Coach' },
  { id: 'progress', label: 'Progress' },
  { id: 'you', label: 'You' },
];

function Root() {
  const t = useTheme();
  const { ready, state } = useMomentum();
  const [tab, setTab] = useState<Tab>('today');

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} color={t.accent} />;
  // New users (and existing ones from before the age step) answer it once.
  if (!state.profile || needsParentConsent(state.profile)) return <AgeGate />;
  if (!state.plan) return <Onboarding />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'today' && <Today onTalk={() => setTab('coach')} />}
        {tab === 'coach' && <Coach />}
        {tab === 'progress' && <Progress />}
        {tab === 'you' && <You />}
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderColor: t.line, paddingTop: 6, paddingBottom: 8 }}>
        {TABS.map((x) => {
          const on = tab === x.id;
          return (
            <Pressable key={x.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(x.id)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: on ? t.accent : 'transparent' }} />
              <Txt size={12} weight="600" style={{ color: on ? t.ink : t.muted }}>{x.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
    <MomentumProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <StatusBar style="auto" />
        <Root />
      </SafeAreaView>
    </MomentumProvider>
    </SafeAreaProvider>
  );
}
