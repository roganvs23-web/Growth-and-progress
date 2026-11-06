// Shown when a message or goal touches self-harm, an emergency, risky
// withdrawal or an eating disorder. Works offline; no AI involved.
import React from 'react';
import { Linking, View } from 'react-native';
import { HELPLINES_URL, SAFETY_TEXT, type SafetyTopic } from '../core/safety';
import { Button, Card, Label, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

export default function SafetyCard({ topic, onClose }: { topic: SafetyTopic; onClose?: () => void }) {
  const t = useTheme();
  const { title, body } = SAFETY_TEXT[topic];
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <Card tone="warm" accessibilityRole="alert">
      <Label color={t.warmText}>{title}</Label>
      <Txt>{body}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {topic === 'selfHarm' && <Button title="Call or text 988 (US)" onPress={() => open('tel:988')} style={{ minHeight: 40 }} />}
        {topic === 'emergency' ? (
          <Button title="Call emergency services" onPress={() => open('tel:911')} style={{ minHeight: 40 }} />
        ) : (
          <Button kind={topic === 'selfHarm' ? 'ghost' : 'solid'} title="Find a helpline" onPress={() => open(HELPLINES_URL)} style={{ minHeight: 40 }} />
        )}
        {onClose && <Button kind="ghost" title="Close" onPress={onClose} style={{ minHeight: 40 }} />}
      </View>
    </Card>
  );
}
