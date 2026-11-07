import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import { ArtGlyph } from '../Art';
import { Icon } from '../Icon';
import { fmt } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Empty, Rise, tap } from '../ui';
import { errMsg } from './Home';
import type { Idea } from '../types';

const CATS = ['All', 'Snacks', 'Skincare', 'Clothing', 'Apps'] as const;

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
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [items, setItems] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={T.h1}>Explore</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: C.s2, paddingHorizontal: 14, marginTop: 12 }}>
          <Icon name="search" size={18} color={C.g} w={2} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search ideas and brands" placeholderTextColor={C.g} returnKeyType="search" autoCorrect={false}
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
      <FlatList key={cat + q} data={items} numColumns={2} keyExtractor={(x) => x.id} columnWrapperStyle={{ gap: 10, paddingHorizontal: 18, marginBottom: 10 }}
        renderItem={({ item, index }) => <Tile idea={item} i={index} />} contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={items.length ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 }}><Text style={{ color: C.t, fontSize: 16, fontWeight: '700' }}>{q || cat !== 'All' ? 'Results' : 'Trending this week'}</Text><Text style={T.sm}>{items.length} ideas</Text></View> : <View />}
        ListEmptyComponent={loading ? <View /> : err ? <Empty title="Could not load" sub={err} /> : <Empty title="No ideas found" sub="Try another word or category." />} />
    </SafeAreaView>
  );
}
