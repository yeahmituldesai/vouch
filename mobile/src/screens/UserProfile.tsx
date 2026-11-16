import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { WEB } from '../config';
import { ago, fmt } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Empty, Pill, Rise, tap } from '../ui';
import { Icon } from '../Icon';
import type { Idea, User } from '../types';

export function UserProfile() {
  const nav = useNav();
  const route = useRoute<any>();
  const params = route.params as { id?: string; handle?: string };
  const { user: me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [counts, setCounts] = useState<any>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const path = params.id ? `/users/${params.id}` : `/users/by-handle/${params.handle}`;
      const u = await api<{ user: User; counts: any; viewer: { following: boolean } }>(path);
      const i = await api<{ ideas: Idea[] }>(`/users/${u.user.id}/ideas`);
      setUser(u.user); setCounts(u.counts); setFollowing(u.viewer.following); setIdeas(i.ideas); setErr('');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not load'); }
    setRefreshing(false);
  }, [params.id, params.handle]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFollow() {
    if (!user) return;
    tap();
    try { const r = await api<{ following: boolean; followers: number }>(`/users/${user.id}/follow`, { method: 'POST' }); setFollowing(r.following); setCounts((c: any) => c ? { ...c, followers: r.followers } : c); }
    catch (e) { Alert.alert('Could not follow', e instanceof ApiError ? e.message : 'Try again'); }
  }
  async function block() {
    if (!user) return;
    Alert.alert(`Block ${user.name || ''}?`, 'You will no longer see their ideas.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => { try { await api(`/users/${user.id}/block`, { method: 'POST' }); nav.goBack(); } catch (e) { Alert.alert('Could not block', e instanceof ApiError ? e.message : 'Try again'); } } }]);
  }
  async function shareProfile() {
    if (!user) return;
    try { await Share.share({ message: `Check out ${user.name} on Vouch\n${WEB}/u/${user.handle}` }); } catch { /* ignore */ }
  }
  function vouchAction(ideaId: string) {
    tap();
    api<{ vouched: boolean; count: number }>(`/ideas/${ideaId}/vouch`, { method: 'POST' })
      .then((r) => setIdeas((l) => l.map((x) => (x.id === ideaId ? { ...x, viewer: { ...x.viewer, vouched: r.vouched }, stats: { ...x.stats, vouches: r.count } } : x))))
      .catch(() => Alert.alert('Could not vouch', 'Try again'));
  }

  if (!user) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={T.sm}>{err || 'Loading…'}</Text>
      <View style={{ marginTop: 20, alignSelf: 'stretch' }}><Pressable onPress={() => nav.goBack()} style={{ height: 52, borderRadius: 26, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.t }}>Go back</Text></Pressable></View>
    </SafeAreaView>
  );

  const isSelf = me?.id === user.id;
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;

  // X-style single-column post with inline interaction row.
  const PostRow = ({ idea }: { idea: Idea }) => (
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* X-style header: back arrow, title, share */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}>
        <Pressable onPress={() => nav.goBack()} accessibilityLabel="Back" hitSlop={8} style={{ width: 30, height: 38, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Icon name="back" size={18} color={C.t} w={2} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: C.t, fontSize: 18, fontWeight: '600', marginLeft: 6 }}>{user.name}</Text>
        <Pressable onPress={shareProfile} accessibilityLabel="Share profile" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.ln, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="share" size={18} color={C.t} w={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {/* Banner */}
        {user.bannerUrl ? <Image source={{ uri: user.bannerUrl }} style={{ width: '100%', height: 150 }} resizeMode="cover" /> : <LinearGradient colors={['#1a1a1c', '#0c0c0d']} style={{ height: 150 }} />}

        {/* Header action row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: -24 }}>
          <View style={{ borderWidth: 3, borderColor: C.bg, borderRadius: 40, overflow: 'hidden' }}>
            {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: 78, height: 78, borderRadius: 39, resizeMode: 'cover' }} /> : <Avatar name={user.name} size={78} />}
          </View>
          {!isSelf ? (
            <View style={{ flexDirection: 'row' }}>
              <Pressable onPress={block} accessibilityLabel="More" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.ln, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Icon name="more" size={18} color={C.t} w={2} />
              </Pressable>
              <Pressable onPress={toggleFollow} accessibilityLabel={following ? 'Following' : 'Follow'} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: following ? 'transparent' : C.t, borderWidth: following ? 1 : 0, borderColor: C.ln }}>
                <Text style={{ color: following ? C.t : '#000', fontSize: 14, fontWeight: '700' }}>{following ? 'Following' : 'Follow'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => nav.navigate('EditProfile')} accessibilityLabel="Edit profile" style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.ln }}>
              <Text style={{ color: C.t, fontSize: 14, fontWeight: '700' }}>Edit profile</Text>
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={{ color: C.t, fontSize: 22, fontWeight: '800' }}>{user.name}</Text>
          {user.role && user.role !== 'member' ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.s2 }}>
              <Text style={{ color: C.dim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{user.role}</Text>
            </View>
          ) : null}
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 3 }}>@{user.handle}</Text>
          {user.bio ? <Text style={{ color: '#d1d1d6', fontSize: 14.5, lineHeight: 21, marginTop: 8 }}>{user.bio}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {user.location ? <Text style={[T.sm, { marginRight: 12 }]}>📍 {user.location}</Text> : null}
            {user.website ? <Text style={[T.sm, { marginRight: 12, color: C.t }]}>🔗 {user.website}</Text> : null}
            {joined ? <Text style={T.sm}>🗓 Joined {joined}</Text> : null}
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', marginTop: 13 }}>
            <Pressable onPress={() => nav.navigate('Following', { id: user.id, name: user.name })} style={{ marginRight: 26 }}>
              <Text style={{ color: C.t, fontWeight: '800' }}>{counts?.following ?? 0}</Text>
              <Text style={{ color: C.dim, fontSize: 14 }}>Following</Text>
            </Pressable>
            <Pressable onPress={() => nav.navigate('Followers', { id: user.id, name: user.name })}>
              <Text style={{ color: C.t, fontWeight: '800' }}>{counts?.followers ?? 0}</Text>
              <Text style={{ color: C.dim, fontSize: 14 }}>Followers</Text>
            </Pressable>
          </View>

          {/* X-style tabs */}
          <View style={{ flexDirection: 'row', marginTop: 16, borderBottomWidth: 2, borderBottomColor: C.ln, height: 40 }}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: C.t }}>
              <Text style={{ color: C.t, fontSize: 14, fontWeight: '700' }}>Posts</Text>
            </Pressable>
          </View>

          {/* Content: single column */}
          {ideas.length ? (
            ideas.map((x, i) => <Rise key={x.id} i={i}><PostRow idea={x} /></Rise>)
          ) : <Empty title="No posts yet" sub="Ideas they post will show up here." />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
