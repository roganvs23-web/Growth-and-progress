// The "You" tab: privacy controls, export and delete, plan and pricing.
import React from 'react';
import { Alert, Linking, Platform, ScrollView, Share, Switch, View } from 'react-native';
import type { WatchMetric } from '../core/types';
import { ageGroup, COACH_ON, coachAllowed, PRICING, priceTier } from '../core/profile';
import { coachAvailable } from '../coach/coachClient';
import { useMomentum } from '../state';
import { Button, Card, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

export const PRIVACY_URL = 'https://github.com/roganvs23-web/Growth-and-progress/blob/main/PRIVACY.md';

const METRICS: { id: WatchMetric; label: string }[] = [
  { id: 'sleepHours', label: 'Sleep' },
  { id: 'steps', label: 'Steps' },
  { id: 'workoutMinutes', label: 'Workouts' },
  { id: 'restingHR', label: 'Resting heart rate' },
  { id: 'hrvMs', label: 'Heart rate variability (HRV)' },
];

export default function You() {
  const t = useTheme();
  const { state, privacy, setPrivacy, setProfile, exportData, reset, healthSourceName } = useMomentum();
  const tier = priceTier(state.profile);
  const price = PRICING[tier];
  const group = ageGroup(state.profile);

  function Row({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Txt>{label}</Txt>
          {hint && <Txt muted size={12}>{hint}</Txt>}
        </View>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent }} accessibilityLabel={label} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 24, gap: 16 }}>
      <Txt size={20} weight="700">You</Txt>

      <Card>
        <Label>Privacy: what Momentum may use</Label>
        <Txt muted size={13}>Reading from {healthSourceName}. Only daily totals are used, never minute-by-minute data. Switching something off removes it from readiness, habits and the coach right away.</Txt>
        {METRICS.map((m) => (
          <Row key={m.id} label={m.label} value={privacy.metrics[m.id]} onChange={(v) => setPrivacy({ ...privacy, metrics: { ...privacy.metrics, [m.id]: v } })} />
        ))}
        <Row
          label="AI coach"
          value={coachAllowed(privacy)}
          onChange={(v) => setPrivacy({ ...privacy, coach: v, coachAskedAt: privacy.coachAskedAt ?? new Date().toISOString(), coachConsentAt: v ? new Date().toISOString() : undefined })}
          hint={coachAllowed(privacy) ? COACH_ON : 'Off: plans and weekly check-ins use built-in rules, nothing leaves your phone.'}
        />
        {!coachAvailable() && coachAllowed(privacy) && <Txt muted size={12}>The coach server isn't set up in this build, so nothing is sent anyway.</Txt>}
        <Button
          kind="ghost"
          title={Platform.OS === 'ios' ? 'Change Apple Health access' : 'Change Health Connect access'}
          onPress={() => Linking.openSettings().catch(() => {})}
          style={{ alignSelf: 'flex-start', minHeight: 40 }}
        />
      </Card>

      <Card>
        <Label>Your data</Label>
        <Txt muted size={13}>Everything lives on this phone. Export it any time, or delete it for good.</Txt>
        <Txt size={14} style={{ color: t.accent }} accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>Read the privacy policy</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button kind="ghost" title="Export my data" onPress={() => Share.share({ title: 'Momentum data', message: exportData() }).catch(() => {})} style={{ minHeight: 40 }} />
          <Button
            kind="ghost"
            title="Delete all my data"
            onPress={() =>
              Alert.alert('Delete everything?', 'Your plan, history, check-ins, chat and settings are erased from this phone. This cannot be undone. Health data in Apple Health or Health Connect is not touched.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: reset },
              ])
            }
            style={{ minHeight: 40 }}
          />
        </View>
      </Card>

      <Card>
        <Label>Your plan</Label>
        <Txt>
          {price.label}: ${price.monthly.toFixed(2)}/month or ${price.yearly.toFixed(2)}/year
        </Txt>
        {group === 'adult' && state.profile && (
          <Row label="I'm a student" value={!!state.profile.student} onChange={(v) => setProfile({ ...state.profile!, student: v })} hint="Student pricing. We may ask for proof later." />
        )}
        {group !== 'adult' && <Txt muted size={13}>Under 18: a parent or guardian completes the purchase. The coach never gives diet or weight-loss advice.</Txt>}
        <Txt muted size={12}>Subscriptions aren't switched on yet.</Txt>
      </Card>
    </ScrollView>
  );
}
