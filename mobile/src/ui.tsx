import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { C, T } from './theme';
import { fmt, initials } from './format';

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** Fades and rises into place. Pass a stagger index for lists. */
export function Rise({ i = 0, children, style }: { i?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 560, delay: Math.min(i, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, i]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** Springy press feedback for any tappable thing. */
export function Press({ onPress, children, style, disabled, label, scale = 0.96 }: { onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; label?: string; scale?: number }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(s, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onPressIn={() => to(scale)} onPressOut={() => to(1)}>
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'white', loading, disabled, style }: { title: string; onPress: () => void; kind?: 'white' | 'dark' | 'line'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === 'white' ? C.t : kind === 'dark' ? C.s2 : 'transparent';
  const fg = kind === 'white' ? '#000' : C.t;
  return (
    <Press onPress={() => { tap(); onPress(); }} disabled={disabled || loading} label={title}
      style={[{ height: 52, borderRadius: 26, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, borderWidth: kind === 'line' ? 1 : 0, borderColor: C.s3 }, style]}>
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{loading ? 'Please wait…' : title}</Text>
    </Press>
  );
}

export function Pill({ label, icon, on, onPress, a11y }: { label: string; icon?: IconName; on?: boolean; onPress?: () => void; a11y?: string }) {
  const fg = on ? '#000' : C.t;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: on ? C.t : C.s2 }}>
      {icon ? <View style={{ marginRight: 5 }}><Icon name={icon} size={15} color={fg} w={2} /></View> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  return onPress ? <Press onPress={onPress} label={a11y ?? label}>{body}</Press> : body;
}

export function Avatar({ name, url, size = 34, square }: { name: string; url?: string | null; size?: number; square?: boolean }) {
  const borderRadius = square ? size * 0.3 : size / 2;
  if (url) {
    return (
      <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius, resizeMode: 'cover' }} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.t, fontSize: size * 0.34, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

export function Bar({ percent, height = 7 }: { percent: number; height?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: Math.max(0, Math.min(100, percent)), duration: 1000, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [v, percent]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.s3, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: C.t, width: v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function CountUp({ value, short, style }: { value: number; short?: boolean; style?: object }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setN(Math.round(x)));
    Animated.timing(v, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style}>{short ? fmt(n) : n}</Text>;
}

export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 52 }}>
      <View style={{ width: 40 }}>
        {onBack ? <Press onPress={onBack} label="Back" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={18} /></Press> : null}
      </View>
      <Text style={{ color: C.t, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Field({ label, style, ...p }: TextInputProps & { label: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginTop: 16 }, style as object]}>
      <Text style={{ color: C.g, fontSize: 12.5, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput {...p} placeholderTextColor={C.dim} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel={label}
        style={{ minHeight: 48, borderRadius: 14, backgroundColor: C.s1, borderWidth: 1, borderColor: focus ? C.t : C.s3, paddingHorizontal: 14, paddingVertical: p.multiline ? 12 : 0, color: C.t, fontSize: 16, textAlignVertical: p.multiline ? 'top' : 'center' }} />
    </View>
  );
}

export const ErrorText = ({ text }: { text?: string }) => (text ? <View style={{ backgroundColor: C.s2, borderRadius: 12, padding: 12, marginTop: 14 }} accessibilityRole="alert"><Text style={{ color: C.t, fontSize: 13.5 }}>{text}</Text></View> : null);

export const Empty = ({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) => (
  <View style={{ alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 }}>
    <Text style={[T.b, { fontSize: 17, fontWeight: '700' }]}>{title}</Text>
    <Text style={[T.sm, { textAlign: 'center', marginTop: 6, lineHeight: 19 }]}>{sub}</Text>
    {action ? <View style={{ marginTop: 20, alignSelf: 'stretch' }}>{action}</View> : null}
  </View>
);
