import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { WEB } from '../config';
import { ago, fmt, inr } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Button, Empty, Pill, Rise, tap } from '../ui';
import { Icon } from '../Icon';
import { Tile } from './Explore';
import type { Idea, Order, User } from '../types';

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
  async function shareProfile() {
    try { await Share.share({ message: `Check out ${user?.name || ''} on Vouch\n${WEB}/u/${user?.handle}` }); } catch { /* ignore */ }
  }

  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
  const tabLabels = ['Posts', 'Vouched', pays ? 'Pre-orders' : 'Interested'];

  // X-style interaction row for a single profile post.
  const PostRow = ({ idea }: { idea: Idea }) => {
    return (
      <Pressable onPress={() => nav.navigate('Idea', { id: idea.id })} accessibilityRole="button" accessibilityLabel={idea.name}
        style={{ flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.ln }}>
        <Avatar name={idea.owner.name || idea.owner.handle} url={idea.owner.avatarUrl} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: C.t, fontSize: 14, fontWeight: '600' }}>{idea.owner.name || '@' + idea.owner.handle}<Text style={{ color: C.g, fontWeight: '400', marginLeft: 4 }}> · {ago(idea.createdAt)}</Text></Text>
          <Text style={{ color: C.t, fontSize: 15, fontWeight: '700', marginTop: 3 }}>{idea.name}</Text>
          <Text numberOfLines={2} style={{ color: '#d1d1d6', fontSize: 14, lineHeight: 20, marginTop: 2 }}>{idea.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
            <Pressable onPress={() => nav.navigate('Comments', { id: idea.id, name: idea.name })} accessibilityLabel="Reply" style={{ marginRight: 16 }}>
              <Icon name="chat" size={20} color={C.g} w={2} />
              <Text style={{ color: C.g, fontSize: 13, marginTop: 2 }}>{fmt(idea.stats.comments)}</Text>
            </Pressable>
            <Pressable onPress={() => vouchAction(idea.id)} accessibilityLabel={idea.viewer.vouched ? 'Liked' : 'Like'} style={{ marginRight: 16 }}>
              <Icon name="vouch" size={20} color={idea.viewer.vouched ? '#ff3b30' : C.g} w={2} />
              <Text style={{ color: idea.viewer.vouched ? '#ff3b30' : C.g, fontSize: 13, marginTop: 2 }}>{fmt(idea.stats.vouches)}</Text>
            </Pressable>
            <Pressable onPress={() => Share.share({ message: `Would you buy ${idea.name}? Vouch for it on Vouch.\n${WEB}/i/${idea.id}` }) } accessibilityLabel="Share" style={{ marginRight: 16 }}>
              <Icon name="share" size={20} color={C.g} w={2} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  function vouchAction(id: string) {
    tap();
    api<{ vouched: boolean; count: number }>(`/ideas/${id}/vouch`, { method: 'POST' })
      .then((r) => {
        const patch = (list: Idea[]) => list.map((x) => (x.id === id ? { ...x, viewer: { ...x.viewer, vouched: r.vouched }, stats: { ...x.stats, vouches: r.count } } : x));
        setIdeas(patch); setVouched(patch); setWanted(patch);
      })
      .catch(() => Alert.alert('Could not vouch', 'Try again'));
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {/* X-style header: title bar for your own profile (a tab root, so no back arrow). */}
        <View style={{ backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <Text style={{ color: C.t, fontSize: 18, fontWeight: '600', marginLeft: 6 }}>{user?.name || 'Profile'}</Text>
        </View>

        {/* Banner */}
        {user?.bannerUrl ? (
          <Image source={{ uri: user.bannerUrl }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#1a1a1c', '#0c0c0d']} style={{ height: 150 }} />
        )}

        {/* Header action row: avatar + Edit profile + share + more */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: -24 }}>
          <View style={{ borderWidth: 3, borderColor: C.bg, borderRadius: 40, overflow: 'hidden' }}>
            <Avatar name={user?.name || 'Me'} url={user?.avatarUrl} size={78} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={shareProfile} accessibilityLabel="Share profile" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.ln, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Icon name="share" size={18} color={C.t} w={2} />
            </Pressable>
            <Pressable onPress={() => nav.navigate('EditProfile')} accessibilityLabel="Edit profile" style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.ln }}>
              <Text style={{ color: C.t, fontSize: 14, fontWeight: '700' }}>Edit profile</Text>
            </Pressable>
            <Pressable onPress={menu} accessibilityLabel="More" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
              <Icon name="more" size={18} color={C.t} w={2} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={{ color: C.t, fontSize: 22, fontWeight: '800' }}>{user?.name || 'Your name'}</Text>
          {user?.role && user.role !== 'member' ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.s2 }}>
              <Text style={{ color: C.dim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{user.role}</Text>
            </View>
          ) : null}
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 3 }}>@{user?.handle}</Text>
          {user?.bio ? <Text style={{ color: '#d1d1d6', fontSize: 14.5, lineHeight: 21, marginTop: 8 }}>{user.bio}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {user?.location ? <Text style={[T.sm, { marginRight: 12 }]}>📍 {user.location}</Text> : null}
            {user?.website ? <Text style={[T.sm, { marginRight: 12, color: C.t }]}>🔗 {user.website}</Text> : null}
            {joined ? <Text style={T.sm}>🗓 Joined {joined}</Text> : null}
          </View>

          {/* Stats: Following · Followers */}
          <View style={{ flexDirection: 'row', marginTop: 13 }}>
            <Pressable onPress={() => nav.navigate('Following', { id: user!.id, name: user!.name })} style={{ marginRight: 26 }}>
              <Text style={{ color: C.t, fontWeight: '800' }}>{counts?.following ?? 0}</Text>
              <Text style={{ color: C.dim, fontSize: 14 }}>Following</Text>
            </Pressable>
            <Pressable onPress={() => nav.navigate('Followers', { id: user!.id, name: user!.name })}>
              <Text style={{ color: C.t, fontWeight: '800' }}>{counts?.followers ?? 0}</Text>
              <Text style={{ color: C.dim, fontSize: 14 }}>Followers</Text>
            </Pressable>
          </View>

          {/* X-style tabs: equal width, active underline */}
          <View style={{ flexDirection: 'row', marginTop: 16, borderBottomWidth: 2, borderBottomColor: C.ln, height: 40 }}>
            {tabLabels.map((t) => (
              <Pressable key={t} onPress={() => { tap(); setTab(t === 'Pre-orders' ? 'Pre-orders' : t); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t || (t === 'Pre-orders' && tab === 'Pre-orders') }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: (tab === t || (t === 'Pre-orders' && tab === 'Pre-orders')) ? C.t : 'transparent' }}>
                <Text style={{ color: (tab === t || (t === 'Pre-orders' && tab === 'Pre-orders')) ? C.t : C.dim, fontSize: 14, fontWeight: '700' }}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
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
            (tab === 'Posts' ? ideas : tab === 'Vouched' ? vouched : wanted).map((x, i) => (
              <Rise key={x.id} i={i}><PostRow idea={x} /></Rise>
            ))
          ) : (
            <Empty
              title={tab === 'Posts' ? 'No posts yet' : tab === 'Vouched' ? 'No vouches yet' : 'Nothing marked yet'}
              sub={tab === 'Posts' ? 'Post your first idea and find out if people want it.' : tab === 'Vouched' ? 'Vouch for an idea you would buy and it will show up here.' : 'Tap "I\'m interested" on an idea and it will show up here.'}
              action={tab === 'Posts' ? <Button title="Post an idea" onPress={() => nav.navigate('Create')} /> : undefined}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}