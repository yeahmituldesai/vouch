import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { Art } from '../Art';
import { Icon } from '../Icon';
import { collectPayment, Checkout } from '../checkout';
import { inr } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Button, ErrorText, Header, Press, Rise, success, tap } from '../ui';
import type { Idea, RootParams } from '../types';

function Done({ idea, qty, total, onView, onClose }: { idea: Idea; qty: number; total: number; onView: () => void; onClose: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }).start(); success(); }, [v]);
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'center' }}>
      <Animated.View style={{ alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: C.t, alignItems: 'center', justifyContent: 'center', transform: [{ scale: v }], opacity: v }}>
        <Icon name="check" size={44} color="#000" w={2.8} />
      </Animated.View>
      <Rise i={2}>
        <Text style={[T.h1, { textAlign: 'center', fontSize: 30, marginTop: 22 }]}>You’re in.</Text>
        <Text style={[T.sm, { textAlign: 'center', fontSize: 15, lineHeight: 22, marginTop: 8 }]}>Pre-order placed for {idea.name}.{'\n'}{qty} × {inr((idea.pricePaise ?? 0))} = {inr(total)}</Text>
        <Text style={[T.sm, { textAlign: 'center', marginTop: 14, lineHeight: 19 }]}>If the goal is not reached by the deadline, you get a full refund.</Text>
        <View style={{ marginTop: 28 }}><Button title="View my pre-orders" onPress={onView} /><View style={{ height: 10 }} /><Button title="Keep exploring" kind="line" onPress={onClose} /></View>
      </Rise>
    </View>
  );
}

export function PreOrderScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootParams, 'PreOrder'>>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { api<{ idea: Idea }>(`/ideas/${params.id}`).then((r) => setIdea(r.idea)).catch((e) => setErr(e.message)); }, [params.id]);
  if (!idea) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={T.sm}>{err || 'Loading…'}</Text></SafeAreaView>;
  const total = (idea.pricePaise ?? 0) * qty;

  async function pay() {
    if (!idea) return;
    setBusy(true); setErr('');
    try {
      const o = await api<{ order: { id: string; checkout: Checkout } }>(`/ideas/${idea.id}/orders`, { method: 'POST', body: { qty } });
      const p = await collectPayment(o.order.checkout, idea.name);
      await api(`/orders/${o.order.id}/verify`, { method: 'POST', body: p });
      setDone(true);
    } catch (e: any) { setErr(e instanceof ApiError || e instanceof Error ? e.message : 'Payment failed'); }
    setBusy(false);
  }
  if (done) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Done idea={idea} qty={qty} total={total}
    onView={() => { nav.popToTop(); nav.navigate('Tabs'); }} onClose={() => nav.popToTop()} /></SafeAreaView>;

  const Step = ({ d, label }: { d: number; label: string }) => (
    <Press onPress={() => { tap(); setQty((q) => Math.max(1, Math.min(9, q + d))); }} label={label} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.t, fontSize: 22 }}>{d < 0 ? '−' : '+'}</Text>
    </Press>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Pre-order" onBack={() => nav.goBack()} />
      <View style={{ flex: 1, paddingHorizontal: 18 }}>
        <Rise>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.s1, borderColor: C.s3, borderWidth: 1, borderRadius: 20, padding: 12, marginTop: 6 }}>
            <View style={{ width: 64 }}><Art category={idea.category} height={64} radius={14} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: C.t, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{idea.name}</Text><Text style={T.sm}>{idea.owner.name || '@' + idea.owner.handle}</Text><Text style={{ color: C.t, fontWeight: '700', marginTop: 3 }}>{inr((idea.pricePaise ?? 0))}</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.s2, borderRadius: 20 }}><Step d={-1} label="Fewer" /><Text style={{ color: C.t, fontSize: 16, fontWeight: '700', minWidth: 14, textAlign: 'center' }}>{qty}</Text><Step d={1} label="More" /></View>
          </View>
          <View style={{ flexDirection: 'row', padding: 14, borderRadius: 16, backgroundColor: C.s1, borderColor: C.s3, borderWidth: 1, marginTop: 14 }}>
            <Icon name="lock" size={18} />
            <Text style={{ color: '#d1d1d6', fontSize: 13.5, lineHeight: 19, marginLeft: 10, flex: 1 }}>Your payment is held for this idea. If the goal is not reached by the deadline, you get a full refund.</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}><Text style={T.sm}>Subtotal ({qty})</Text><Text style={T.b}>{inr(total)}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}><Text style={T.sm}>Delivery</Text><Text style={T.b}>Free</Text></View>
          <ErrorText text={err} />
        </Rise>
        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: 12 }}><Button title={`Pay ${inr(total)} · UPI`} onPress={pay} loading={busy} /></View>
      </View>
    </SafeAreaView>
  );
}
