import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { RouteProp, useRoute } from '@react-navigation/native';
import { api } from '../api';
import { Icon } from '../Icon';
import { useAuth } from '../auth';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Bar, CountUp, Header, Rise } from '../ui';
import type { Idea, RootParams } from '../types';

const AC = Animated.createAnimatedComponent(Circle);
const R = 52, CIRC = 2 * Math.PI * R;
const VERDICT = { strong: 'Strong demand', growing: 'Growing demand', early: 'Early signals' } as const;
const NOTE = {
  strong: 'Most people who vouched also committed. This idea is ready for a first production batch.',
  growing: 'Interest is building. Share the idea to reach the goal before the deadline.',
  early: 'Not enough signals yet. Share your idea link to collect your first vouches.',
} as const;

export function DemandScreen() {
  const nav = useNav();
  const { paymentsEnabled: pays } = useAuth();
  const { params } = useRoute<RouteProp<RootParams, 'Demand'>>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { api<{ idea: Idea }>(`/ideas/${params.id}`).then((r) => setIdea(r.idea)).catch(() => nav.goBack()); }, [params.id, nav]);
  useEffect(() => { if (idea) Animated.timing(v, { toValue: idea.demand.score / 100, duration: 1300, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [idea, v]);
  if (!idea) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;
  const d = idea.demand;
  const Row = ({ l, p }: { l: string; p: number }) => (<View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.ln }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Text style={T.b}>{l}</Text><Text style={{ color: C.t, fontWeight: '700' }}>{p}</Text></View><Bar percent={p} height={5} /></View>);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Demand report" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Rise>
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={160} height={160} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
                <Circle cx="60" cy="60" r={R} stroke={C.s3} strokeWidth={9} fill="none" />
                <AC cx="60" cy="60" r={R} stroke="#fff" strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] }) as any} transform="rotate(-90 60 60)" />
              </Svg>
              <CountUp value={d.score} style={{ color: C.t, fontSize: 46, fontWeight: '800', letterSpacing: -2 }} />
              <Text style={T.sm}>out of 100</Text>
            </View>
            <Text style={[T.h2, { marginTop: 14 }]}>{VERDICT[d.verdict]}</Text>
            <Text style={[T.sm, { marginTop: 4 }]} numberOfLines={1}>{idea.name} · {idea.stats.vouches} vouches · {idea.stats.preorders} {pays ? 'pre-orders' : 'interested'}</Text>
          </View>
          <View style={{ marginTop: 20 }}><Row l="Interest" p={d.interest} /><Row l={pays ? 'Willingness to pay' : 'Interested'} p={d.pay} /><Row l={pays ? 'Vouch to pre-order' : 'Vouch to interest'} p={d.conv} /></View>
          <View style={{ flexDirection: 'row', padding: 14, borderRadius: 16, backgroundColor: C.s1, borderWidth: 1, borderColor: C.s3, marginTop: 18 }}>
            <Icon name="check" size={18} /><Text style={{ color: '#d1d1d6', fontSize: 14, lineHeight: 20, marginLeft: 10, flex: 1 }}>{NOTE[d.verdict]}</Text>
          </View>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}
