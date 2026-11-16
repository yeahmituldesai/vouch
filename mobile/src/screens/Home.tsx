import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Pressable, RefreshControl, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { Art } from '../Art';
import { WEB } from '../config';
import { Icon } from '../Icon';
import { useAuth } from '../auth';
import { ago, fmt } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Empty, Pill, Rise, success, tap } from '../ui';
import { VouchLogo } from '../VouchLogo';
import type { Idea } from '../types';

export async function vouchApi(id: string) {
  return api<{ vouched: boolean; count: number }>(`/ideas/${id}/vouch`, { method: 'POST' });
}
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong');

export function Post({ idea, i, onVouch }: { idea: Idea; i: number; onVouch: (id: string) => void }) {
  const nav = useNav();
  const { paymentsEnabled: pays } = useAuth();
  return (
    <Rise i={i}>
      <Pressable onPress={() => nav.navigate('Idea', { id: idea.id })} accessibilityRole="button" accessibilityLabel={`${idea.name} by ${idea.owner.name}`}
        style={{ flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.ln }}>
        <Avatar name={idea.owner.name || idea.owner.handle} url={idea.owner.avatarUrl} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: C.t, fontSize: 14, fontWeight: '600' }}>{idea.owner.name || '@' + idea.owner.handle}<Text style={{ color: C.g, fontWeight: '400', marginLeft: 4 }}> · {ago(idea.createdAt)}</Text></Text>
          <Text style={{ color: C.t, fontSize: 15, fontWeight: '700', marginTop: 3 }}>{idea.name}</Text>
          <Text numberOfLines={2} style={{ color: '#d1d1d6', fontSize: 14, lineHeight: 20, marginTop: 2 }}>{idea.description}</Text>
          <Art category={idea.category} height={150} radius={18} style={{ marginTop: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
            <Pressable onPress={() => nav.navigate('Comments', { id: idea.id, name: idea.name })} accessibilityLabel="Reply" style={{ marginRight: 16 }}>
              <Icon name="chat" size={20} color={C.g} w={2} />
              <Text style={{ color: C.g, fontSize: 13, marginTop: 2 }}>{fmt(idea.stats.comments)}</Text>
            </Pressable>
            <Pressable onPress={() => onVouch(idea.id)} accessibilityLabel={idea.viewer.vouched ? 'Liked' : 'Like'} style={{ marginRight: 16 }}>
              <Icon name="vouch" size={20} color={idea.viewer.vouched ? '#ff3b30' : C.g} w={2} />
              <Text style={{ color: idea.viewer.vouched ? '#ff3b30' : C.g, fontSize: 13, marginTop: 2 }}>{fmt(idea.stats.vouches)}</Text>
            </Pressable>
            <Pressable onPress={() => Share.share({ message: `Would you buy ${idea.name}? Vouch for it on Vouch.\n${WEB}/i/${idea.id}` }) } accessibilityLabel="Share" style={{ marginRight: 16 }}>
              <Icon name="share" size={20} color={C.g} w={2} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {pays ? (
              <Text style={{ color: C.t, fontSize: 13, fontWeight: '600' }}>{idea.stats.preorders}/{idea.goal}</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Rise>
  );
}

/** Shared by Home, Explore and Profile: vouch with instant haptic, state from the server reply. */
export function useVouch(setItems: React.Dispatch<React.SetStateAction<Idea[]>>) {
  return useCallback(async (id: string) => {
    tap();
    try {
      const r = await vouchApi(id);
      setItems((l) => l.map((x) => (x.id === id ? { ...x, viewer: { ...x.viewer, vouched: r.vouched }, stats: { ...x.stats, vouches: r.count } } : x)));
      if (r.vouched) success();
    } catch (e) { Alert.alert('Could not vouch', errMsg(e)); }
  }, [setItems]);
}

export function Home() {
  const { user } = useAuth();
  const [seg, setSeg] = useState<'for' | 'fol'>('for');
  const [items, setItems] = useState<Idea[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const busy = useRef(false);
  const onVouch = useVouch(setItems);

  const load = useCallback(async (reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const off = reset ? 0 : next;
      if (off === null) return;
      const r = await api<{ ideas: Idea[]; nextOffset: number | null }>(`/ideas?limit=20&offset=${off}${seg === 'fol' ? '&following=1' : ''}`);
      setItems((l) => (reset ? r.ideas : [...l, ...r.ideas]));
      setNext(r.nextOffset); setErr('');
    } catch (e) { setErr(errMsg(e)); }
    finally { busy.current = false; setLoading(false); setRefreshing(false); }
  }, [next, seg]);

  useEffect(() => { setLoading(true); setItems([]); setNext(0); busy.current = false; }, [seg]);
  useEffect(() => { if (loading) load(true); }, [loading, load]);
  useFocusEffect(useCallback(() => { if (!loading) { busy.current = false; load(true); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg]));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <VouchLogo height={26} />
          <Avatar name={user?.name || 'Me'} url={user?.avatarUrl} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          {(['for', 'fol'] as const).map((k) => (
            <Pressable key={k} onPress={() => { tap(); setSeg(k); }} accessibilityRole="tab" accessibilityState={{ selected: seg === k }} style={{ marginRight: 14 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: seg === k ? C.t : C.dim }}>{k === 'for' ? 'For you' : 'Following'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList data={items} keyExtractor={(x) => x.id} renderItem={({ item, index }) => <Post idea={item} i={index} onVouch={onVouch} />}
        onEndReached={() => next !== null && !loading && load(false)} onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); busy.current = false; load(true); }} />}
        contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
        ListEmptyComponent={loading ? <View style={{ paddingTop: 80, alignItems: 'center' }}><Text style={T.sm}>Loading ideas…</Text></View>
          : err ? <Empty title="Could not load ideas" sub={err} />
          : seg === 'fol' ? <Empty title="Nothing here yet" sub="Follow founders from an idea page and their new ideas show up here." />
          : <Empty title="No ideas yet" sub="Be the first. Tap + and post your idea." />} />
    </SafeAreaView>
  );
}
