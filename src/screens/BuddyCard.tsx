// Buddy mode on the Progress tab: invite one friend with a code, see each
// other's streak, send a cheer. Shares only a nickname, the streak and
// whether today is a good day yet.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Share, View } from 'react-native';
import { buddyLine, myBuddyStatus, normalizeCode } from '../core/buddy';
import { ageGroup } from '../core/profile';
import { buddyAvailable, createInvite, joinInvite, leaveBuddy, sendCheer, syncBuddy } from '../buddy/buddyClient';
import { useMomentum } from '../state';
import { Button, Card, Input, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

export default function BuddyCard() {
  const t = useTheme();
  const { state, today, health, setBuddy } = useMomentum();
  const link = state.buddy;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const synced = useRef('');

  const status = state.plan ? myBuddyStatus(state.plan, state.logs, health, today) : null;
  const key = status ? `${status.day}:${status.streak}:${status.todayDone}` : '';

  // Sync when the tab opens and whenever my streak or today's result changes.
  useEffect(() => {
    if (!link || !status || synced.current === `${link.token}:${key}`) return;
    synced.current = `${link.token}:${key}`;
    syncBuddy(link.token, status)
      .then((r) => {
        setBuddy({ ...link, code: r.code, buddy: r.buddy ?? undefined, lastSync: new Date().toISOString() });
        if (r.cheers) setNote(`${r.buddy?.name ?? 'Your buddy'} cheered you on${r.cheers > 1 ? ` ${r.cheers} times` : ''}!`);
      })
      .catch((e) => {
        if (e?.code === 'not_found') {
          setBuddy(undefined); // the buddy left or the invite expired
          setNote('Your buddy link ended. You can start a new one.');
        }
      });
  }, [link?.token, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!buddyAvailable()) return null;
  if (ageGroup(state.profile) === 'child') return null;

  async function run(f: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  const shareCode = (c: string) => Share.share({ message: `Be my Momentum buddy. Open Momentum, go to Progress > Buddy, and enter ${c}. The code works for 48 hours.` }).catch(() => {});

  if (link) {
    return (
      <Card>
        <Label>Buddy</Label>
        {note && <Txt weight="600" style={{ color: t.accent }}>{note}</Txt>}
        {link.buddy ? (
          <>
            <Txt size={17} weight="600">{link.buddy.name}</Txt>
            <Txt>{buddyLine(link.buddy, today)}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button title="Send a cheer" disabled={busy} onPress={() => run(async () => { await sendCheer(link.token); setNote(`Cheer sent to ${link.buddy!.name}.`); })} style={{ minHeight: 40 }} />
              <Button kind="ghost" title="Leave" onPress={() => confirmLeave()} style={{ minHeight: 40 }} />
            </View>
          </>
        ) : (
          <>
            <Txt>Waiting for your friend to join. Send them this code:</Txt>
            <Txt size={26} weight="700" style={{ letterSpacing: 4 }} accessibilityLabel={`Code ${link.code?.split('').join(' ')}`}>{link.code}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {link.code && <Button title="Share code" onPress={() => shareCode(link.code!)} style={{ minHeight: 40 }} />}
              <Button kind="ghost" title="Cancel" onPress={() => run(async () => { await leaveBuddy(link.token); setBuddy(undefined); })} style={{ minHeight: 40 }} />
            </View>
          </>
        )}
        {error && <Txt size={13} style={{ color: t.miss }}>{error}</Txt>}
        <Txt muted size={12}>Your buddy sees your nickname, streak and whether today is a good day yet. Never your health data or habits.</Txt>
      </Card>
    );
  }

  function confirmLeave() {
    Alert.alert('Leave buddy mode?', 'You and your buddy will stop seeing each other’s streaks. This deletes the shared link from the server.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => run(async () => { await leaveBuddy(link!.token); setBuddy(undefined); }) },
    ]);
  }

  const nameOk = name.trim().length > 0;
  return (
    <Card>
      <Label>Buddy</Label>
      <Txt>Pair up with one friend. You'll see each other's streak and can send a cheer. That's all that's shared.</Txt>
      {note && <Txt muted size={13}>{note}</Txt>}
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 20))} placeholder="Your nickname, e.g. Sam" accessibilityLabel="Nickname" />
      {mode === 'join' && <Input value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder="6-letter code" autoCapitalize="characters" accessibilityLabel="Buddy code" />}
      {busy ? (
        <ActivityIndicator color={t.accent} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'join' ? (
            <>
              <Button title="Join" disabled={!nameOk || code.length !== 6} onPress={() => run(async () => { const r = await joinInvite(code, name.trim()); setBuddy({ token: r.token, name: name.trim() }); })} style={{ minHeight: 40 }} />
              <Button kind="ghost" title="Back" onPress={() => setMode('idle')} style={{ minHeight: 40 }} />
            </>
          ) : (
            <>
              <Button title="Invite a friend" disabled={!nameOk} onPress={() => run(async () => { const r = await createInvite(name.trim()); setBuddy({ token: r.token, name: name.trim(), code: r.code }); shareCode(r.code); })} style={{ minHeight: 40 }} />
              <Button kind="ghost" title="I have a code" onPress={() => setMode('join')} style={{ minHeight: 40 }} />
            </>
          )}
        </View>
      )}
      {error && <Txt size={13} style={{ color: t.miss }}>{error}</Txt>}
    </Card>
  );
}
