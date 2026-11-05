// First screen for new users: year of birth (we never ask for a full date),
// student status for pricing, and a parent step for under-13s.
// See src/core/profile.ts for the legal notes: the parent step is a
// placeholder, not verified consent.
import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { ageGroup, MIN_AGE, type Profile } from '../core/profile';
import { useMomentum } from '../state';
import { Button, Card, Input, Label, Title, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

export default function AgeGate() {
  const t = useTheme();
  const { state, setProfile } = useMomentum();
  const [year, setYear] = useState('');
  const [student, setStudent] = useState(false);
  const [pending, setPending] = useState<Profile | null>(state.profile ?? null);
  const [parentEmail, setParentEmail] = useState('');
  const [agree, setAgree] = useState(false);

  const now = new Date().getFullYear();
  const y = Number(year);
  const valid = /^\d{4}$/.test(year) && y > now - 110 && y <= now - 5;

  if (pending && ageGroup(pending) === 'child') {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail.trim());
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Title>Ask a parent or guardian</Title>
        <Txt>You need to be at least {MIN_AGE} to use Momentum on your own. Hand the phone to a parent or guardian for this step.</Txt>
        <Card>
          <Label>For the parent or guardian</Label>
          <Txt size={14}>Momentum is a habit coach. It can read daily step, sleep and heart totals from this phone's health app, if you allow it, and uses an AI coach. Nothing is shared with other users, and you can delete everything at any time from the You tab.</Txt>
          <Input value={parentEmail} onChangeText={setParentEmail} placeholder="Your email" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Parent email" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch value={agree} onValueChange={setAgree} trackColor={{ true: t.accent }} accessibilityLabel="I agree" />
            <Txt size={14} style={{ flex: 1 }}>I am this child's parent or guardian and I agree to them using Momentum.</Txt>
          </View>
          <Button title="Continue" disabled={!emailOk || !agree} onPress={() => setProfile({ ...pending, parentConsent: { email: parentEmail.trim(), at: new Date().toISOString() } })} />
        </Card>
        <Button kind="ghost" title="Back" onPress={() => setPending(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Txt size={22} weight="700">Momentum</Txt>
      <Title>First, what year were you born?</Title>
      <Txt muted>So the coach talks to you the right way, and to offer student and teen pricing. Only the year is stored, on this phone.</Txt>
      <Input value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 2007" keyboardType="number-pad" accessibilityLabel="Year of birth" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Switch value={student} onValueChange={setStudent} trackColor={{ true: t.accent }} accessibilityLabel="I'm a student" />
        <Txt>I'm a student</Txt>
      </View>
      <Button
        title="Continue"
        disabled={!valid}
        onPress={() => {
          const p: Profile = { birthYear: y, student };
          if (ageGroup(p) === 'child') setPending(p);
          else setProfile(p);
        }}
      />
    </ScrollView>
  );
}
