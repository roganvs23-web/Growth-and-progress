import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextProps, type ViewProps } from 'react-native';
import { useTheme } from './theme';

export function Txt({ style, muted, size = 15, weight, ...p }: TextProps & { muted?: boolean; size?: number; weight?: '400' | '500' | '600' | '700' }) {
  const t = useTheme();
  return <Text {...p} style={[{ color: muted ? t.muted : t.ink, fontSize: size, fontWeight: weight, lineHeight: size * 1.4 }, style]} />;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Txt size={28} weight="700" style={{ letterSpacing: -0.5, lineHeight: 32 }}>{children}</Txt>;
}

export function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  const t = useTheme();
  return <Txt size={12} weight="600" style={{ color: color ?? t.muted, textTransform: 'uppercase', letterSpacing: 0.7 }}>{children}</Txt>;
}

export function Card({ style, tone = 'plain', ...p }: ViewProps & { tone?: 'plain' | 'warm' | 'hero' }) {
  const t = useTheme();
  const bg = tone === 'warm' ? t.warm : tone === 'hero' ? t.hero : t.card;
  const border = tone === 'warm' ? t.warmLine : tone === 'hero' ? t.hero : t.line;
  return <View {...p} style={[styles.card, { backgroundColor: bg, borderColor: border }, style]} />;
}

export function Button({ title, onPress, kind = 'solid', disabled, style }: { title: string; onPress: () => void; kind?: 'solid' | 'ghost'; disabled?: boolean; style?: ViewProps['style'] }) {
  const t = useTheme();
  const solid = kind === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: solid ? t.ink : 'transparent', borderColor: t.ink, borderWidth: solid ? 0 : 1, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Txt weight="600" style={{ color: solid ? t.bg : t.ink }}>{title}</Txt>
    </Pressable>
  );
}

export function Chip({ title, onPress, selected }: { title: string; onPress: () => void; selected?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? t.accent : t.line, backgroundColor: selected ? t.accentSoft : t.card }]}
    >
      <Txt size={13} weight="500" style={{ color: selected ? t.accentText : t.ink }}>{title}</Txt>
    </Pressable>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Txt size={11} weight="600" style={{ color: t.accentText }}>{children}</Txt>
    </View>
  );
}

export function Input(p: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...p}
      style={[styles.input, { borderColor: t.line, backgroundColor: t.card, color: t.ink }, p.style]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  btn: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
