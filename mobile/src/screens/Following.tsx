import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { api } from '../api';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar } from '../ui';
import type { User } from '../types';

export function Following() {
  const nav = useNav();
  const route = useRoute<any>();
  const { id, name } = route.params as { id: string; name: string };
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { const r = await api<{ users: User[] }>(`/users/${id}/following`); setUsers(r.users); } catch {} setRefreshing(false); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 }}>
        <Pressable onPress={() => nav.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: C.t, fontSize: 18 }}>←</Text></Pressable>
        <View><Text style={{ color: C.t, fontSize: 16, fontWeight: '700' }}>Following</Text><Text style={T.sm}>{name}</Text></View>
      </View>
      <ScrollView refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {users.map((u) => (
          <Pressable key={u.id} onPress={() => nav.navigate('UserProfile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.ln }}>
            <View style={{ borderWidth: 1, borderColor: C.ln, borderRadius: 24, overflow: 'hidden', marginRight: 12 }}>
              {u.avatarUrl ? <Image source={{ uri: u.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Avatar name={u.name} size={44} />}
            </View>
            <View style={{ flex: 1 }}><Text style={{ color: C.t, fontSize: 15, fontWeight: '600' }}>{u.name}</Text><Text style={T.sm}>@{u.handle}</Text></View>
          </Pressable>
        ))}
        {!users.length ? <View style={{ padding: 40, alignItems: 'center' }}><Text style={T.sm}>Not following anyone yet.</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}