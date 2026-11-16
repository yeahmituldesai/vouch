import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import { ArtGlyph } from '../Art';
import { Icon } from '../Icon';
import { fmt } from '../format';
import { useAuth } from '../auth';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Empty, Rise, tap } from '../ui';
import { errMsg } from './Home';
import type { Idea, User } from '../types';

const CATS = ['All', 'Snacks', 'Skincare', 'Clothing', 'Apps'] as const;

type Person = User & { followers?: number; following?: boolean };

export function Tile({ idea, i }: { idea: Idea; i: number }) {
  const nav = useNav();
  return (
    <Rise i={i} style={{ flex: 1 }}>
      <Pressable onPress={() => nav.navigate('Idea', { id: idea.id })} accessibilityRole="button" accessibilityLabel={idea.name}>
        <LinearGradient colors={['#3a3a3c', '#1c1c1e', '#050506']} style={{ aspectRatio: 0.9, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 }}>
          <View style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' }}><ArtGlyph category={idea.category} size={84} /></View>
          <Text numberOfLines={1} style={{ color: C.t, fontSize: 14, fontWeight: '700' }}>{idea.name}</Text>
          <Text style={{ color: C.g, fontSize: 12, marginTop: 1 }}>{fmt(idea.stats.vouches)} vouches</Text>
        </LinearGradient>
      </Pressable>
    </Rise>
  );
}

export function Explore() {
  const nav = useNav();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [items, setItems] = useState<Idea[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '30' });
      if (q.trim()) p.set('q', q.trim());
      if (cat !== 'All') p.set('category', cat);
      const r = await api<{ ideas: Idea[] }>('/ideas?' + p.toString());
      setItems(r.ideas); setErr('');
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  }, [q, cat]);

  useEffect(() => { const t = setTimeout(run, 300); return () => clearTimeout(t); }, [run]);

  useEffect(() => {
    if (!q.trim()) { setPeople([]); setPeopleLoading(false); return; }
    let cancelled = false;
    setPeopleLoading(true);
    const t = setTimeout(() => {
      api<{ users: Person[] }>(`/users/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { if (!cancelled) setPeople(r.users); })
        .catch(() => { if (!cancelled) setPeople([]); })
        .finally(() => { if (!cancelled) setPeopleLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  async function toggleFollow(p: Person) {
    try {
      const r = await api<{ following: boolean; followers: number }>(`/users/${p.id}/follow`, { method: 'POST' });
      setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, following: r.following, followers: r.followers } : x)));
    } catch {}
  }

  const showPeople = q.trim().length > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={T.h1}>Explore</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: C.s2, paddingHorizontal: 14, marginTop: 12 }}>
          <Icon name="search" size={18} color={C.g} w={2} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search ideas, brands and people" placeholderTextColor={C.g} returnKeyType="search" autoCorrect={false}
            accessibilityLabel="Search" style={{ flex: 1, color: C.t, fontSize: 16, marginLeft: 8 }} />
        </View>
      </View>
      <View style={{ height: 52 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, alignItems: 'center' }}>
          {CATS.map((c) => (
            <Pressable key={c} onPress={() => { tap(); setCat(c); }} accessibilityRole="button" accessibilityState={{ selected: cat === c }}
              style={{ height: 34, paddingHorizontal: 15, borderRadius: 17, backgroundColor: cat === c ? C.t : C.s2, justifyContent: 'center', marginRight: 7 }}>
              <Text style={{ color: cat === c ? '#000' : C.t, fontSize: 14, fontWeight: '600' }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 }}>
        {showPeople ? (
          <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
            <Text style={{ color: C.t, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>People {peopleLoading ? '…' : ''}</Text>
            {people.length === 0 && !peopleLoading ? (
              <Text style={T.sm}>No people found.</Text>
            ) : (
              people.map((u) => (
                <Pressable key={u.id} onPress={() => { tap(); nav.navigate('UserProfile', { id: u.id }); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.ln }}>
                  <View style={{ borderWidth: 1, borderColor: C.ln, borderRadius: 22, overflow: 'hidden', marginRight: 12 }}>
                    <Avatar name={u.name || u.handle} url={u.avatarUrl} size={44} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.t, fontSize: 15, fontWeight: '600' }}>{u.name || u.handle}</Text>
                    <Text style={T.sm}>@{u.handle}</Text>
                  </View>
                  {u.id !== me?.id ? (
                    <Pressable onPress={() => { tap(); toggleFollow(u); }} accessibilityRole="button"
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: u.following ? C.s2 : C.t }}>
                      <Text style={{ color: u.following ? C.t : '#000', fontSize: 13, fontWeight: '600' }}>{u.following ? 'Following' : 'Follow'}</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 }}>
          <Text style={{ color: C.t, fontSize: 16, fontWeight: '700' }}>{q || cat !== 'All' ? 'Ideas' : 'Trending this week'}</Text>
          <Text style={T.sm}>{items.length} ideas</Text>
        </View>
        {items.length === 0 && !loading ? (
          <View style={{ paddingHorizontal: 18 }}><Empty title="No ideas found" sub="Try another word or category." /></View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 18 }}>
            {items.map((idea, i) => <View key={idea.id} style={{ width: '48%' }}><Tile idea={idea} i={i} /></View>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
