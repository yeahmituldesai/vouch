import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { api } from '../api';
import { Icon } from '../Icon';
import { ago } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Empty, Header, Press, Rise, tap } from '../ui';
import { errMsg } from './Home';
import type { Comment, RootParams } from '../types';

export function CommentsScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootParams, 'Comments'>>();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    try { setItems((await api<{ comments: Comment[] }>(`/ideas/${params.id}/comments`)).comments); } catch (e) { Alert.alert('Could not load feedback', errMsg(e)); }
    setLoaded(true);
  }, [params.id]);
  useEffect(() => { load(); }, [load]);
  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true); tap();
    try { const r = await api<{ comment: Comment }>(`/ideas/${params.id}/comments`, { method: 'POST', body: { body } }); setItems((l) => [r.comment, ...l]); setText(''); }
    catch (e) { Alert.alert('Could not send', errMsg(e)); }
    setBusy(false);
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Feedback" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList data={items} keyExtractor={(c) => c.id} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={[T.sm, { marginBottom: 6 }]} numberOfLines={1}>{params.name}</Text>}
          ListEmptyComponent={loaded ? <Empty title="No feedback yet" sub="Be the first to tell the founder what you think." /> : <View />}
          renderItem={({ item, index }) => (
            <Rise i={index}><View style={{ flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.ln }}>
              <Avatar name={item.author.name || item.author.handle} size={30} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: C.t, fontSize: 13.5, fontWeight: '600' }}>{item.author.name || '@' + item.author.handle}<Text style={{ color: C.g, fontWeight: '400' }}> · {ago(item.createdAt)}</Text></Text>
                <Text style={{ color: '#d1d1d6', fontSize: 15, lineHeight: 21, marginTop: 2 }}>{item.body}</Text>
              </View>
            </View></Rise>
          )} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 10, paddingTop: 6 }}>
          <TextInput value={text} onChangeText={setText} placeholder="Share your feedback" placeholderTextColor={C.g} multiline maxLength={500} accessibilityLabel="Your feedback"
            style={{ flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 22, backgroundColor: C.s2, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: C.t, fontSize: 16 }} />
          <Press onPress={send} disabled={busy || !text.trim()} label="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.t, marginLeft: 8, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.4 }}><Icon name="up" size={20} color="#000" w={2.4} /></Press>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
