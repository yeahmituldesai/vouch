import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
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
import type { Idea, Order, User } from '../types';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch.example.com';
type Counts = { ideas: number; vouches: number; preorders: number; followers: number; following: number; unread?: number };

export function Profile() {
  const nav = useNav();
  const { user, signOut, paymentsEnabled: pays } = useAuth();
  const [tab, setTab] = useState<string>('Posts');
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
      { text: 'Settings', onPress: () => nav.navigate('Settings') },
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
  const list = tab === 'Posts' ? ideas : tab === 'Vouched' ? vouched : tab === 'Interested' ? wanted : ideas;
  const stat = (n: number | undefined, l: string, onPress?: () => void) => (
    <Pressable onPress={onPress} style={{ marginRight: 22 }}>
      <Text style={{ color: C.t, fontSize: 15, fontWeight: '700' }}>{n ?? 0} <Text style={{ color: C.dim, fontWeight: '400', fontSize: 14 }}>{l}</Text></Text>
    </Pressable>
  );

  async function shareProfile() {
    try { await Share.share({ message: `Check out ${user?.name || ''} on Vouch\n${WEB}/u/${user?.handle}` }); } catch { /* ignore */ }
  }

  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {/* Banner */}
        {user?.bannerUrl ? (
          <Image source={{ uri: user.bannerUrl }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#1a1a1c', '#0c0c0d']} style={{ height: 150 }} />
        )}
        {/* Header action row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: -24 }}>
          <View style={{ borderWidth: 3, borderColor: C.bg, borderRadius: 40, overflow: 'hidden' }}>
            {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: 78, height: 78, borderRadius: 39 }} /> : <Avatar name={user?.name || 'Me'} size={78} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={shareProfile} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.ln, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Text style={{ color: C.t, fontSize: 16 }}>↗</Text>
            </Pressable>
            <Pressable onPress={() => nav.navigate('EditProfile')} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.ln }}>
              <Text style={{ color: C.t, fontSize: 14, fontWeight: '700' }}>Edit profile</Text>
            </Pressable>
            <Pressable onPress={menu} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
              <Text style={{ color: C.t, fontSize: 18 }}>⋯</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[T.h1, { fontSize: 22 }]}>{user?.name || 'Your name'}</Text>
            {user?.role && user.role !== 'member' ? (
              <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.s2 }}>
                <Text style={{ color: C.dim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{user.role}</Text>
              </View>
            ) : null}
          </View>
          <Text style={T.sm}>@{user?.handle}</Text>
          {user?.bio ? <Text style={{ color: '#d1d1d6', fontSize: 14.5, lineHeight: 21, marginTop: 8 }}>{user.bio}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {user?.location ? <Text style={[T.sm, { marginRight: 12 }]}>📍 {user.location}</Text> : null}
            {user?.website ? <Text style={[T.sm, { marginRight: 12, color: C.t }]}>🔗 {user.website}</Text> : null}
            {joined ? <Text style={T.sm}>🗓 Joined {joined}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {stat(counts?.following, 'Following', () => nav.navigate('Following', { id: user!.id, name: user!.name }))}
            {stat(counts?.followers, 'Followers', () => nav.navigate('Followers', { id: user!.id, name: user!.name }))}
          </View>

          <View style={{ flexDirection: 'row', marginTop: 16, borderBottomWidth: 1, borderBottomColor: C.ln }}>
            {(['Posts', 'Vouched', pays ? 'Pre-orders' : 'Interested']).map((t) => (
              <Pressable key={t} onPress={() => { tap(); setTab(t === 'Pre-orders' ? 'Pre-orders' : t); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t || (t === 'Pre-orders' && tab === 'Pre-orders') }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: (tab === t || (t === 'Pre-orders' && tab === 'Pre-orders')) ? C.t : 'transparent' }}>
                <Text style={{ color: (tab === t || (t === 'Pre-orders' && tab === 'Pre-orders')) ? C.t : C.dim, fontSize: 14, fontWeight: '600' }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {(tab === 'Pre-orders') ? (
            orders.length ? orders.map((o, i) => (
              <Rise key={o.id} i={i}>
                <Pressable onPress={() => nav.navigate('Idea', { id: o.idea.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ln }}>
                  <View style={{ flex: 1 }}><Text style={{ color: C.t, fontSize: 15, fontWeight: '600' }}>{o.idea.name}</Text><Text style={T.sm}>{o.qty} × · {inr(o.amountPaise)}</Text></View>
                  <Pill label={o.status === 'refunded' ? 'Refunded' : 'Paid'} on={o.status === 'paid'} />
                </Pressable>
              </Rise>
            )) : <Empty title="No pre-orders yet" sub="Pre-order an idea and it will show up here." />
          ) : (tab === 'Posts' ? ideas : tab === 'Vouched' ? vouched : wanted).length ? (
            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{(tab === 'Posts' ? ideas : tab === 'Vouched' ? vouched : wanted).map((x, i) => <View key={x.id} style={{ width: '48.5%' }}><Tile idea={x} i={i} /></View>)}</View>
          ) : (
            <Empty title="Nothing here yet" sub="Post your first idea and find out if people want it." action={<Button title="Post an idea" onPress={() => nav.navigate('Create')} />} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}