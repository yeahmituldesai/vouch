import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Art } from '../Art';
import { useAuth } from '../auth';
import { C, T } from '../theme';
import { Bar, Button, Press, Rise } from '../ui';

function Splash() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [v]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image source={require('../../assets/logo.png')} resizeMode="contain" accessibilityLabel="Vouch"
        style={{ width: 210, height: 76, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }} />
    </View>
  );
}

const card = { width: '100%' as const, backgroundColor: '#1a1a1c', borderColor: C.s3, borderWidth: 1, borderRadius: 28, padding: 22 };
const SLIDES = [
  { t: 'Post your idea.', s: 'Add your product and a goal. No factory. No stock. Just the idea.' },
  { t: 'People vouch for it.', s: 'Real customers vote and leave honest feedback before you build.' },
  { t: 'Real interest proves it.', s: 'Launch only when enough people show interest. No guesswork.' },
];
function Illustration({ n }: { n: number }) {
  if (n === 0) return (<View style={[card, { width: 230, padding: 14 }]}><Art category="Snacks" height={170} radius={16} /><Text style={[T.b, { fontWeight: '700', marginTop: 12 }]}>Your idea</Text><Text style={T.sm}>Your brand</Text></View>);
  if (n === 1) return (<View style={[card, { alignItems: 'center' }]}><Text style={T.sm}>Vouches over time</Text><View style={{ alignSelf: 'stretch', marginTop: 16 }}><Bar percent={0} /></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 8 }}><Text style={T.sm}>Interest grows</Text><Text style={T.sm}>Honest feedback</Text></View></View>);
  return (<View style={card}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><Text style={{ color: C.t, fontSize: 44, fontWeight: '800', letterSpacing: -1.5 }}>—</Text><Text style={T.sm}>of your goal</Text></View><View style={{ marginTop: 14 }}><Bar percent={0} /></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}><Text style={T.sm}>Track progress</Text><Text style={T.sm}>Before you build</Text></View></View>);
}

export function Onboarding() {
  const { finishOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  useEffect(() => { if (step === 0) { const t = setTimeout(() => setStep(1), 1700); return () => clearTimeout(t); } }, [step]);
  if (step === 0) return <Splash />;
  const n = step - 1;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 }}>
      <View style={{ alignItems: 'flex-end', height: 40, justifyContent: 'center' }}>
        <Press onPress={finishOnboarding} label="Skip"><Text style={{ color: C.g, fontSize: 15, fontWeight: '500' }}>Skip</Text></Press>
      </View>
      <Rise key={n} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Illustration n={n} /></View>
        <Text style={[T.h1, { fontSize: 32 }]}>{SLIDES[n].t}</Text>
        <Text style={[T.sm, { fontSize: 15, lineHeight: 22, marginTop: 8 }]}>{SLIDES[n].s}</Text>
      </Rise>
      <View style={{ flexDirection: 'row', marginVertical: 18 }}>
        {[0, 1, 2].map((k) => <View key={k} style={{ width: k === n ? 20 : 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: k === n ? C.t : C.s3 }} />)}
      </View>
      <View style={{ paddingBottom: 12 }}><Button title={n === 2 ? 'Get started' : 'Continue'} onPress={() => (n === 2 ? finishOnboarding() : setStep(step + 1))} /></View>
    </SafeAreaView>
  );
}
