import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Icon, IconName } from '../Icon';
import { ago } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Empty, Rise } from '../ui';
import type { Notice } from '../types';

const ICON: Record<string, IconName> = { vouch: 'vouch', feedback: 'chat', preorder: 'bag', want: 'bag', preorder_ok: 'bag', refund: 'bag', follow: 'users', idea_funded: 'check', idea_failed: 'x' };

export function Alerts() {
  const nav = useNav();
  const [items, setItems] = useState<Notice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setItems((await api<{ notifications: Notice[] }>('/me/notifications')).notifications); api('/me/notifications/read', { method: 'POST' }).catch(() => {}); } catch { /* keep old list */ }
    setLoaded(true); setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <Text style={[T.h1, { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 }]}>Notifications</Text>
      <FlatList data={items} keyExtractor={(n) => n.id} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 110, flexGrow: 1 }}
        refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={loaded ? <Empty title="You are all caught up" sub="Vouches, feedback and interest show up here." /> : <View />}
        renderItem={({ item, index }) => (
          <Rise i={index}>
            <Pressable onPress={() => item.data?.ideaId && nav.navigate('Idea', { id: item.data.ideaId })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.ln }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name={ICON[item.type] ?? 'bell'} size={19} /></View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={{ color: C.t, fontSize: 14.5, fontWeight: item.read ? '500' : '700' }}>{item.title}</Text>
                {item.body ? <Text numberOfLines={2} style={{ color: C.g, fontSize: 13, marginTop: 1 }}>{item.body}</Text> : null}
              </View>
              <Text style={{ color: C.g, fontSize: 12 }}>{ago(item.createdAt)}</Text>
            </Pressable>
          </Rise>
        )} />
    </SafeAreaView>
  );
}
