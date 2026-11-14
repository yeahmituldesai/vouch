import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { inr } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Button, Empty, Pill, Rise, tap } from '../ui';
import { Tile } from './Explore';
import type { Idea, Order } from '../types';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch.example.com';
type Counts = { ideas: number; vouches: number; preorders: number; followers: number };

export function Profile() {
  const nav = useNav();
  const { user, signOut, paymentsEnabled: pays } = useAuth();
  const [tab, setTab] = useState<string>('Ideas');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [vouched, setVouched] = useState<Idea[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wanted, setWanted] = useState<Idea[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a, b, c, d] = await Promise.all([
        api<{ counts: Counts }>('/me'), api<{ ideas: Idea[] }>('/me/ideas'), api<{ ideas: Idea[] }>('/me/vouched'), api<{ orders: Order[] }>('/me/orders'), api<{ ideas: Idea[] }>('/me/wants')]);
      setCounts(m.counts); setIdeas(a.ideas); setVouched(b.ideas); setOrders(c.orders); setWanted(d.ideas);
    } catch { /* keep what we have */ }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function menu() {
    Alert.alert(user?.name || 'Account', undefined, [
      { text: 'Edit profile', onPress: () => nav.navigate('EditProfile') },
      { text: 'Terms', onPress: () => Linking.openURL(`${WEB}/terms`) },
      { text: 'Privacy Policy', onPress: () => Linking.openURL(`${WEB}/privacy`) },
      { text: 'Contact support', onPress: () => Linking.openURL(`${WEB}/support`) },
      { text: 'Sign out', onPress: () => signOut() },
      { text: 'Delete account', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' }]);
  }
  function confirmDelete() {
    Alert.alert('Delete your account?', 'This permanently removes your profile, vouches and feedback. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api('/me', { method: 'DELETE' }); await signOut(); } catch (e) { Alert.alert('Could not delete', e instanceof ApiError ? e.message : 'Try again'); } } }]);
  }
  const list = tab === 'Ideas' ? ideas : tab === 'Interested' ? wanted : vouched;
  const stat = (n: number | undefined, l: string) => (<View style={{ marginRight: 22 }}><Text style={{ color: C.t, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{n ?? 0}</Text><Text style={T.sm}>{l}</Text></View>);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <LinearGradient colors={['#4a4a4c', '#0c0c0d']} style={{ height: 150 }} />
        <View style={{ paddingHorizontal: 18, marginTop: -38 }}>
          <Rise>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ borderWidth: 3, borderColor: C.bg, borderRadius: 26 }}><Avatar name={user?.name || 'Me'} size={78} square /></View>
              <View style={{ flexDirection: 'row' }}><View style={{ marginRight: 8 }}><Pill label="Menu" onPress={menu} /></View><Pill label="New idea" icon="plus" on onPress={() => nav.navigate('Create')} /></View>
            </View>
            <Text style={[T.h1, { fontSize: 24, marginTop: 10 }]}>{user?.name || 'Your name'}</Text>
            <Text style={T.sm}>@{user?.handle}</Text>
            {user?.bio ? <Text style={{ color: '#d1d1d6', fontSize: 14.5, lineHeight: 21, marginTop: 8 }}>{user.bio}</Text> : null}
            <View style={{ flexDirection: 'row', marginTop: 14 }}>{stat(counts?.ideas, 'Ideas')}{stat(counts?.followers, 'Followers')}{stat(counts?.vouches, 'Vouches')}{stat(counts?.preorders, pays ? 'Pre-orders' : 'Interested')}</View>
          </Rise>
          <View style={{ flexDirection: 'row', marginTop: 16, borderBottomWidth: 1, borderBottomColor: C.ln }}>
            {(['Ideas', 'Vouched', pays ? 'Pre-orders' : 'Interested']).map((t) => (
              <Pressable key={t} onPress={() => { tap(); setTab(t); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === t ? C.t : 'transparent' }}>
                <Text style={{ color: tab === t ? C.t : C.dim, fontSize: 14, fontWeight: '600' }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'Pre-orders' ? (
            orders.length ? orders.map((o, i) => (
              <Rise key={o.id} i={i}>
                <Pressable onPress={() => nav.navigate('Idea', { id: o.idea.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ln }}>
                  <View style={{ flex: 1 }}><Text style={{ color: C.t, fontSize: 15, fontWeight: '600' }}>{o.idea.name}</Text><Text style={T.sm}>{o.qty} × · {inr(o.amountPaise)}</Text></View>
                  <Pill label={o.status === 'refunded' ? 'Refunded' : 'Paid'} on={o.status === 'paid'} />
                </Pressable>
              </Rise>
            )) : <Empty title="No pre-orders yet" sub="Pre-order an idea and it will show up here." />
          ) : list.length ? (
            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{list.map((x, i) => <View key={x.id} style={{ width: '48.5%' }}><Tile idea={x} i={i} /></View>)}</View>
          ) : tab === 'Ideas'
            ? <Empty title="No ideas yet" sub="Post your first idea and find out if people want it." action={<Button title="Post an idea" onPress={() => nav.navigate('Create')} />} />
            : tab === 'Interested' ? <Empty title="Nothing here yet" sub="Tap “I’m interested” on an idea and it will show up here." /> : <Empty title="No vouches yet" sub="Tap the check on an idea to vouch for it." />}
        </View>
      </ScrollView>
    </View>
  );
}
